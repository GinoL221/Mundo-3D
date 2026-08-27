# Proposal: Cart Authority

## Intent

The frontend never reads the server cart. `GET /api/cart` works, is auth-gated, and has zero callers; `loadCartFromStorage()` reads only localStorage. Three traced consequences:

1. **Guest logs in** → nothing merges. The first post-login mutation's debounced `PUT` (destructive full-replace) silently destroys the user's existing server cart.
2. **Thrown fetch** (network drop, no HTTP response) → `cartSync.ts` deliberately does not roll back and self-documents that nothing reconciles; local state stays diverged indefinitely.
3. **Two tabs/devices** → each shows its own snapshot; the last `PUT` wins destructively.

Server authority exists; the client never asks. This change makes it ask.

## Scope

### In Scope
- `hydrateFromServer()`: `GET /api/cart`, map DTO → `CartItem`, replace local state + localStorage.
- Hydration triggers: **login success** and **cart-page load** only.
- Guest/login merge: union by `productId`, summing quantities for products in both carts, then one `PUT` — only if the guest cart is non-empty (an empty guest cart hydrates with zero writes).
- Merged quantity exceeding the 99-unit ceiling is clamped to 99 client-side, silently, before the `PUT` (no user-facing notice for this case).
- Cart-page hydration with an open debounce burst: flush the pending local mutation first (`flushCartSync`), then hydrate — a just-clicked "add" never visibly vanishes.
- Price-drift notice: when hydration adopts a server price that differs from the price the item had locally, show a "price changed" notice per affected item (e.g. "El precio de X cambió de $A a $B").
- Failure is non-blocking: a failed hydration never blocks login/navigation; local state is kept.
- Tests: hydration, merge, clamp, pending-burst-flush, price-drift-notice, and failure paths; existing debounce/rollback/staleness assertions stay green.

### Out of Scope
- Checkout/order redesign (no orders exist yet).
- Cross-tab, focus, or `session-changed` re-hydration.
- Anonymous/guest server-side carts (needs a schema migration; `id_user NOT NULL`).
- Any backend concurrency control — last-write-wins stays an accepted tradeoff.
- Any merge confirmation modal (the merge itself is still automatic/silent — only price drift gets a notice).

## Capabilities

### New Capabilities
- `cart-hydration`: server→client cart reconciliation, its triggers, the guest/login merge policy, and non-blocking failure behavior.

### Modified Capabilities
- `nano-stores-cart`: hydration writes local state without arming a debounce burst; the post-merge `PUT` goes through the existing scheduler, not a direct `syncToBackend` call.

## Approach

New `cartHydration.ts` beside `cartSync.ts`; `CartService.hydrateFromServer()` is the only entry point. Hydration is **not** added to `loadCartFromStorage()` — `cartBadge.ts` calls that on every page via `Header.astro`, which would issue a `GET` per navigation. The merge write goes through `scheduleSync()` + `flushCartSync()` (checkout's proven pattern), never `syncToBackend` directly. On the cart page, if a debounce burst is currently pending, `flushCartSync()` runs before hydration so a just-clicked local edit reaches the server first.

Mapping: DTO `product.price` (current) becomes `unitPrice` — the server re-prices at sync anyway. `product.image` is nullable server-side, `CartItem.image` is not; fall back to empty string.

Price-drift notice: before overwriting a locally-known item's `unitPrice` with the server's current price during hydration, compare the two; for each item where they differ, collect a `{ name, oldPrice, newPrice }` entry and render one line per item through the existing `.alert`/`.alert__text` component (`alerts.css`) — no new visual component. Reused only for this notice, not for the merge itself (the merge stays silent, per Out of Scope).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/domains/cart/services/cartHydration.ts` | New | GET, DTO→`CartItem` map, merge |
| `frontend/src/domains/cart/services/CartService.ts` | Modified | `hydrateFromServer()` |
| `frontend/src/domains/cart/services/cartSync.ts` | Unchanged/verified | Reuse `discardPendingSync`/`scheduleSync`/`flushCartSync` |
| `frontend/src/domains/cart/components/CartList.astro:117` | Modified | Flush pending burst, hydrate on cart-page load, render price-drift `.alert` |
| `frontend/src/domains/auth/components/LoginForm.astro:95-107` | Modified | Merge before redirect (fire-and-forget) |
| `frontend/src/domains/cart/services/CartService.test.ts` + new hydration tests | Modified/New | Coverage; existing assertions must not regress |
| `e2e/tests/cart.spec.ts` | Modified | Guest-merge-on-login flow |
| `backend/**` | Unchanged | No server change |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regressing `CartService.test.ts` debounce/rollback/`syncSeq` assertions | Med | Do not edit `cartSync.ts` logic; keep every existing assertion green, unmodified |
| Merge `PUT` double-fires with a pending burst | Med | Route through `scheduleSync`+`flushCartSync` (checkout's proven pattern); never call `syncToBackend` |
| Merged quantity > 99 → `cart-service` spec mandates 400 for the **whole** cart, rolling back everything | High | Clamp merged quantity to 99 client-side before the `PUT` (see Open Questions) |
| Hydration failure blocks login | Low | Fire-and-forget with catch; redirect never awaits success |
| Hydration on cart page overwrites unflushed local mutations | Med | `discardPendingSync()` is wrong here if a burst is open — hydrate only when no burst is pending, or flush first |
| 400-line review budget | High | Estimated 400–550 authored lines incl. spec deltas and tests (raised by the price-drift notice, added after the proposal question round); `delivery_strategy` is `ask-on-risk`, expect a split/exception decision at `sdd-tasks` |

## Rollback Plan

Single revert of the change branch. No schema change, no migration, no data backfill. Reverting removes the `GET` call and restores local-first behavior; the original defects return, nothing else. Cart rows written by a merge stay valid — they are ordinary cart rows.

## Dependencies

None. `GET /api/cart` and `SyncCartUseCase` already ship.

## Success Criteria

- [ ] A guest with local items who logs in ends with the union of both carts, quantities summed per product, persisted server-side.
- [ ] A guest with an empty local cart who logs in triggers zero `PUT` requests — hydration only.
- [ ] A merge summing a product's quantity past 99 clamps to 99 before the `PUT`, silently.
- [ ] Loading `/cart` as a logged-in user renders server state, even with an empty or stale localStorage.
- [ ] Loading `/cart` with a pending debounced mutation flushes it before hydrating — the just-added item is not lost.
- [ ] Hydration that changes an item's price from its locally-known value renders one price-changed notice per affected item.
- [ ] A failing/500 `GET /api/cart` on login still redirects and leaves the local cart intact.
- [ ] Every existing `CartService.test.ts` assertion passes unmodified.
- [ ] Exactly one `PUT` results from a login merge (no duplicate flush).
- [ ] `pnpm test` green; coverage ≥ 50%.

## Decisions (resolved via user proposal-question round)

1. **Merged quantity above 99**: clamp to 99 client-side, silently — no user-facing notice for this case.
2. **Cart-page hydration with an open debounce burst**: local wins — flush the pending mutation first, then hydrate.
3. **Price drift on hydration**: show a per-item "price changed" notice, reusing the existing `.alert`/`.alert__text` component. This expanded the original proposal's scope (initially assumed deferred) — raised the review-budget risk from High to more-confidently-High; see Risks.
4. **Login with an empty guest cart**: pure hydration only, zero `PUT` fired.
