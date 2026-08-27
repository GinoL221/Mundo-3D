## Exploration: cart-authority

### Change

Make the shopping cart authoritative via `GET /api/cart` hydration, and define a guest/login conflict policy. Explicitly out of scope: checkout/order flow redesign (no orders/payment exist yet — a separate future change).

### Current State

**Backend** — `ShoppingCart` is strictly per-authenticated-user; there is no guest/anonymous cart storage.
- Schema: `backend/src/database/migrations/20260724000000-baseline.js:104-118` — `id_user int NOT NULL`, CASCADE FK to `User`. No session/cart-id column.
- `GET /api/cart` (`backend/src/infrastructure/routes/api/cart.ts:22`) → `CartApiController.getCart` → `GetCartByUserIdUseCase` — fully implemented, auth-gated, returns `{ items, total }` filtered to `CartStatus.ACTIVE`. **Zero frontend callers** (confirmed via codegraph blast-radius) — dead code from the client's perspective.
- `PUT /api/cart` (`backend/src/infrastructure/routes/api/cart.ts:25`) → `SyncCartUseCase` → `SequelizeShoppingCartRepository.syncCart` — destructive full-replace (destroy ACTIVE rows, recreate) in one transaction. Always re-prices from the current product price at sync time. Behind `csrfGuard`.

**Frontend** — cart is local-first; the backend GET endpoint is never called.
- Source of truth: `frontend/src/domains/cart/services/cartState.ts` (nanostore) + localStorage, read exclusively by `CartService.loadCartFromStorage()`.
- Mutations optimistically update local state, then debounce a `PUT` via `frontend/src/domains/cart/services/cartSync.ts` (300ms debounce / 1000ms max-wait, `syncSeq` stale-response guard, forced flush on `checkout()`/`pagehide`/hidden-tab — all added by the `cart-batching` change, see below).
- HTTP-error responses roll back to `previousItems`. A genuinely **thrown** fetch (real network drop) does **not** roll back — `cartSync.ts`'s own comment self-documents this exact gap: no reconciling GET exists anywhere, so a dropped request silently persists diverged local state until the next mutation re-sends it.
- `LoginForm.astro` never touches the cart — a guest's local cart and a user's server cart are completely unlinked. `sessionUI.ts`'s logout clears the local cart only, never the server cart.

### Scenarios traced against real code (not assumed)

1. **Guest adds items, then logs in** — nothing merges or fetches. The first post-login local mutation's debounced `PUT` silently **overwrites** any pre-existing server cart (destructive full-replace).
2. **Logged-in user, a mutation's network request genuinely fails (thrown fetch, not HTTP error)** — local state diverges from the server forever; nothing self-heals.
3. **Same account, two tabs/devices** — each shows only its own localStorage snapshot; whichever debounced `PUT` lands last destructively overwrites the other.

### Prior SDD decisions this change must respect (not re-litigate)

- `2026-07-30-cart-consistency` explicitly deferred this exact gap: *"GET /api/cart reconciliation on load — real gap, candidate follow-up."* Also locked in: quantity ceiling 1-99; duplicate-`productId` merge-by-quantity-sum in `SyncCartUseCase`; missing-product silent drop is tested/intentional/unchanged; **last-write-wins `PUT` concurrency is an accepted tradeoff — the backend does no optimistic concurrency**, so any conflict policy is a client-side decision, not server-enforced.
- `2026-08-26-cart-batching` explicitly scoped out "guest carts" and "reconciling GET" as future work (this change), and added machinery that must not regress: debounce scheduler, `syncSeq` staleness guard, forced-flush triggers, rollback-to-`previousItems` — all covered by `CartService.test.ts` (regression gate).

### Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/domains/cart/services/CartService.ts`, `cartState.ts`, `cartSync.ts` | Modified | New hydration path (GET call); conflict-policy logic |
| `frontend/src/domains/auth/components/LoginForm.astro` | Modified | Trigger hydration/merge on login |
| `frontend/src/scripts/sessionUI.ts`, `cartBadge.ts` | Possibly modified | Cross-tab/focus re-hydration, if that timing is chosen |
| `backend/src/application/use-cases/SyncCartUseCase.ts` / `GetCartByUserIdUseCase.ts` | Possibly modified | Only if merge logic needs server-side support |
| `frontend/src/domains/cart/services/CartService.test.ts`, `backend/src/application/__tests__/SyncCartUseCase.test.ts`, `e2e/tests/cart.spec.ts` | Modified | New coverage; existing assertions must not regress |

### Approaches

**Hydration timing:**
1. Cart-page-load only — minimal, doesn't fix login-merge or open-tab staleness. Effort: Low.
2. On login + cart-page-load — directly fixes the reported gap. Effort: Low-Medium.
3. + on session-changed/focus (mirrors `sessionUI.ts`'s existing cross-tab pattern) — most consistent, more test surface. Effort: Medium.

**Guest/login conflict policy:**
1. Server wins — simplest; silently loses a guest's pre-login cart.
2. Local wins — today's latent de facto behavior once hydration exists; silently destroys any pre-existing server cart.
3. Merge by quantity — union of product ids, sum quantities; mirrors `SyncCartUseCase`'s existing dedupe pattern; price is a non-issue (server always re-prices at sync).
4. Ask the user — most correct UX, highest cost (new UI + e2e coverage), needs `LoginForm.astro` redesign (currently an unconditional redirect to `/`).

### Constraint

Guest-side true server authority is impossible without a schema migration (no anonymous cart support) — guests must stay local-only until login unless the user wants to expand scope to add anonymous cart persistence.

### Recommendation (not decided — for the proposal/user)

Hydration timing 2 (login + cart-page-load) + conflict policy 3 (merge by quantity) is the best UX/effort ratio, consistent with prior SDD decisions in this area.
