# Design: Cart Authority

## Technical Approach

One new module, `frontend/src/domains/cart/services/cartHydration.ts`, owns the `GET /api/cart` read, the DTO→`CartItem` map, the guest/login merge, price-drift detection, and the store write. `CartService.hydrateFromServer()` is a thin delegating static — the single public entry point, per the proposal. `cartSync.ts`'s scheduler is composed with, never bypassed: the merge write is `scheduleSync(merged, serverItems)` followed by `flushCartSync()` — checkout's proven pattern — and hydration begins with a `flushCartSync()` so a pending burst reaches the server before we read it back.

The store write is a single `cartItems.set(final)` + `persistCart(final)` at the very end of the success path. Every failure returns before it, so local state is either fully replaced or bit-for-bit untouched. `persistCart` already dispatches `cart-updated` (badge) and `cartItems.set` already drives `CartList`'s existing `subscribe` — no new render wiring for the item list.

Astro here is a plain MPA (`Layout.astro` has no `<ClientRouter/>`), so `cartSync.ts`'s module state is fresh on every page load. That fact shapes two decisions below.

## Architecture Decisions

### Decision: hydration stays out of `loadCartFromStorage()`; the cart page calls both

Locked by the proposal — restated, not reopened. `cartBadge.ts` calls `loadCartFromStorage()` from `Header.astro` on **every** page, so folding a `GET` into it would issue one request per navigation.

`CartList.astro` therefore keeps `loadCartFromStorage()` and *adds* hydration after it, in this order: `loadCartFromStorage()` → `renderCart()` → `cartItems.subscribe(renderCart)` → `void CartService.hydrateFromServer().then(renderPriceDrift)`. The synchronous localStorage read paints the cart immediately instead of leaving it blank for the duration of the round-trip; guests get the only behavior they can have; subscribing *before* hydrating means the server state re-renders itself when the store is written.

### Decision: mode is an explicit flag, never inferred from the store

`hydrateFromServer({ mergeLocal: true })` merges; the default replaces. Inferring "merge when local is non-empty" is catastrophic on the cart page: after the first merge, localStorage equals the merged set, so every subsequent `/cart` reload would sum the same quantities again and double them. Merge is a login-only event; the caller states it.

The local snapshot is read as `cartItems.get()` **inside** `hydrateFromServer`, at call time (before the `await`), not passed in. `cartBadge.ts` has already populated the store from localStorage on the login page, so this is the guest cart as of login, and the same snapshot serves drift detection in both modes.

### Decision: merge is server-first, summed, clamped, deterministic

| Rule | Choice | Rationale |
|---|---|---|
| Key | `productId` | The only stable identity in both shapes |
| Overlap | quantities summed | Proposal; guest intent is additive |
| `name` / `image` / `unitPrice` on overlap | **server wins** | Server is authority and re-prices at sync anyway; drift is reported, not resisted |
| Ceiling | `Math.min(99, sum)` before the PUT | `cart-service` spec §"Merged quantity exceeding the ceiling" 400s the **whole** cart; one over-99 product would roll back every other item |
| Floor | drop items with a non-finite or `< 1` quantity | Same whole-request 400 (validator bounds 1–99); a corrupt localStorage entry must not veto the merge |
| Order | server items in server order, then local-only items appended | Deterministic ⇒ assertable |

Clamping applies to every merged item, not only summed ones: `addToCart` has no client-side cap today, so a local-only item can already exceed 99.

### Decision: drift is computed client-side; `dto.hasPriceDrift` is ignored

The DTO's `hasPriceDrift` compares the *cart row's stored* `unitPrice` against the current product price — server-internal drift. The proposal's notice is about the price **the user last saw locally** versus the server's current price. Different comparands, so we compute `detectPriceDrift(local, server)` ourselves, over products present in **both** sets only (a server-only item has no locally-known price to have drifted from).

### Decision: one `.alert` block, one `.alert__text` per drifted item

`alerts.css` is a BEM block+element pair with `margin: 0` on the block, and no existing markup in `frontend/src` to copy. N stacked full-width purple banners would touch edge-to-edge; one block containing N `<p class="alert__text">` lines is what block+element means and needs no new CSS. Static markup lives in `CartList.astro` above `.cart__container`, hidden with `style="display:none"` (the file's existing idiom, mirroring `#cart-summary`), toggled to `block` when drifts exist.

Lines are built with `document.createElement('p')` + `textContent` — never `innerHTML` with an interpolated `nameProduct`. Product names are server-supplied and the file already uses `textContent` exclusively.

### Decision: a burst opened *during* the GET aborts a replace-mode hydration

Requires one additive, logic-free export in `cartSync.ts`:

```ts
export function hasPendingSync(): boolean { return burstPreviousItems !== null; }
```

If the user mutates the cart while the GET is in flight, adopting the older server snapshot would visibly undo their click, and their burst would then PUT the post-mutation state — UI and server diverged until the next load. Aborting keeps both consistent. This is exactly the proposal's own risk-row mitigation ("hydrate only when no burst is pending, or flush first"), applied to the one window the pre-flush cannot cover.

Merge mode needs no such check: `scheduleSync` + `flushCartSync` *coalesces* an open burst into the merge PUT rather than racing it (`pendingItems` is overwritten with the merged set; the burst's older baseline is retained as the rollback target). A merge with an empty local cart issues no PUT, so it takes the replace-mode guard: `shouldMerge = mergeLocal === true && local.length > 0`.

### Decision: the merge PUT's rollback baseline is the **server** snapshot

`scheduleSync(merged, serverItems)`. If the PUT is rejected, the truth on the server is still `serverItems`; rolling back to the guest's local set would assert something the server never had.

`syncSeq` composition: the guard gates only the **rollback** of a failed PUT, never the issuing of one. The merge PUT takes `mySeq = ++syncSeq` when it is issued, so it is by construction the newest sync at that instant — an older in-flight PUT that fails afterwards finds `mySeq !== syncSeq` and correctly suppresses its rollback, letting the merge win. A login-time merge-flush therefore cannot be treated as stale by anything that started before it, and nothing concurrent can start between `scheduleSync` and `flushCartSync` (both run synchronously, back to back).

### Decision: `LoginForm.astro` may import from `domains/cart/`

`frontend.domain.locality` is evaluated only for sources `classifyFile()` calls `production`, which requires a `.[cm]?[jt]sx?` extension (`config.js:11`); `.astro` sources are classified `documentation` and skipped at `engine.js:45`. The import is tool-legal and is the smallest diff — the alternative is a new `frontend/src/scripts/` composition-root module for one call.

## Interfaces

```ts
// frontend/src/domains/cart/services/cartHydration.ts

// The frontend cannot import from backend/; this mirrors backend
// ShoppingCartDTO / GetCartResult and is kept in sync by hand.
interface ServerCartItemDTO {
  idProduct: number;
  quantity: number;
  unitPrice: number;
  product: { idProduct: number; nameProduct: string; price: number; image: string | null };
}
interface ServerCartResponse { items: ServerCartItemDTO[]; total: number }

export const MAX_ITEM_QUANTITY = 99;

export interface PriceDrift { name: string; oldPrice: number; newPrice: number }

export interface HydrationResult {
  ok: boolean;                 // false ⇒ local state was NOT touched
  items: CartItem[];           // state now in the store (or the untouched local state)
  priceDrifts: PriceDrift[];   // [] unless ok
  syncScheduled: boolean;      // true only when a merge PUT was issued
  reason?: 'guest' | 'network' | 'http' | 'superseded';
}

export function mapServerCart(dtos: ServerCartItemDTO[]): CartItem[];
export function mergeCartItems(local: CartItem[], server: CartItem[]): CartItem[];
export function detectPriceDrift(local: CartItem[], server: CartItem[]): PriceDrift[];

/** Never rejects. Never writes state on any failure path. */
export function hydrateFromServer(options?: { mergeLocal?: boolean }): Promise<HydrationResult>;
```

Mapping: `productId ← idProduct`, `name ← product.nameProduct`, `image ← product.image ?? ''`, `unitPrice ← product.price` (current price, **not** the row's `unitPrice`), `quantity ← quantity`.

Request: `fetch(`${API_URL}/api/cart`, withCredentials({ method: 'GET' }))`. `credentials: 'include'` is required by `apiAuthMiddleware`; the `X-CSRF-Token` header `withCredentials` adds is inert (`csrfGuard` bypasses `SAFE_METHODS`) and using the shared helper keeps one call convention.

`CartService` gains one delegating static and re-exports the types:

```ts
static hydrateFromServer(options?: { mergeLocal?: boolean }): Promise<HydrationResult> {
  return hydrateFromServer(options);
}
```

### Failure semantics (both triggers)

| Condition | Result | State write | Event |
|---|---|---|---|
| `getSessionUser() === null` | `ok:false, reason:'guest'` — **no GET issued** | none | none |
| `fetch` throws | `ok:false, reason:'network'` | none | none |
| `!res.ok` (401/500/…) | `ok:false, reason:'http'` | none | none |
| `res.json()` throws, or `items` is not an array | `ok:false, reason:'http'` | none | none |
| burst opened during the GET, replace mode | `ok:false, reason:'superseded'` | none | none |

No `cart-sync-error` dispatch on any of them: hydration is a background reconcile, not a user action, and the existing toast is worded for a failed *write*. The whole body sits in one `try/catch`, so the returned promise always resolves.

## Sequence: guest-cart-merge-on-login (happy path)

```
LoginForm      AuthService     cartHydration        cartSync           Server
    │ submit                                                             │
    ├──login()──────►│──POST /api/users/login──────────────────────────►│
    │                │◄────200 + auth/csrf/m3d_user cookies─────────────┤
    │◄───resolve─────┤                                                   │
    ├─ dispatch 'session-changed' + broadcast                            │
    ├─ hydrateFromServer({mergeLocal:true}) ─►│                          │
    │                                          ├─ local = cartItems.get()│  (guest cart)
    │                                          ├─ flushCartSync() ──────►│  (no-op: no burst)
    │                                          ├──GET /api/cart─────────────────────►│
    │                                          │◄──200 {items,total}────────────────┤
    │                                          ├─ server  = mapServerCart(dto)
    │                                          ├─ drifts  = detectPriceDrift(local, server)   ← discarded (we redirect)
    │                                          ├─ merged  = mergeCartItems(local, server)     ← sum, clamp 99
    │                                          ├─ cartItems.set(merged); persistCart(merged)
    │                                          ├─ scheduleSync(merged, server) ─►│
    │                                          ├─ flushCartSync() ──────────────►│
    │                                          │                    void syncToBackend(merged, server)
    │                                          │                    mySeq = ++syncSeq
    │                                          │                    ├──PUT /api/cart (keepalive)──►│
    │◄──────── settle (or timeout) ────────────┤                                                   │
    ├─ window.location.href = '/'                                                                  │
```

Exactly one PUT: the merge is the only writer, and `flushCartSync()` consumes whatever `scheduleSync` just staged.

## Sequence: cart-page hydration with a pending debounce burst

```
CartList script          CartService/cartHydration       cartSync            Server
   ├─ loadCartFromStorage() ──────────────────────────► discardPendingSync()
   ├─ renderCart()                        (local paint, no network)
   ├─ cartItems.subscribe(renderCart)
   ├─ hydrateFromServer() ──►│
   │                          ├─ local = cartItems.get()
   │                          ├─ flushCartSync() ──────►│ pending? ──yes──► PUT(pendingItems)──►│
   │                          ├──GET /api/cart──────────────────────────────────────────────────►│
   │                          │◄──200 {items,total}─────────────────────────────────────────────┤
   │                          ├─ hasPendingSync()? ──yes──► return {ok:false,'superseded'}  (local wins)
   │                          ├─ no ──► drifts = detectPriceDrift(local, server)
   │                          ├─         cartItems.set(server); persistCart(server)
   │                          │                └─► subscribe fires ─► renderCart()   (items repaint)
   │◄── {ok:true, priceDrifts} ┤
   ├─ renderPriceDrift(drifts)  →  #cart-price-drift .alert  (one <p class="alert__text"> per item)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/domains/cart/services/cartHydration.ts` | Create | DTO types, `MAX_ITEM_QUANTITY`, `mapServerCart`, `mergeCartItems`, `detectPriceDrift`, `hydrateFromServer` (~130 lines) |
| `frontend/src/domains/cart/services/cartSync.ts` | Modify | **Additive only**: `hasPendingSync()` (3 lines). No existing line changes |
| `frontend/src/domains/cart/services/CartService.ts` | Modify | One delegating static + type re-exports (~8 lines) |
| `frontend/src/domains/cart/components/CartList.astro` | Modify | `#cart-price-drift` markup; hydrate after `subscribe`; `renderPriceDrift()` |
| `frontend/src/domains/auth/components/LoginForm.astro` | Modify | Merge call between the session broadcast and the redirect |
| `frontend/src/domains/cart/services/cartHydration.test.ts` | Create | All new unit coverage — keeps `CartService.test.ts` untouched |
| `e2e/tests/cart.spec.ts` | Modify | Guest adds → login → `/cart` shows the union |

No backend change. `cartState.ts`, `cartBadge.ts`, `sessionUI.ts`, `product.astro`, `domains/cart/index.ts` unchanged.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (pure) | map (null image → `''`, `unitPrice` from `product.price`); merge (sum, clamp 99, clamp a local-only >99, drop `<1`, server-only, local-only, order); drift (both-present only, none when equal) | Direct calls, no mocks |
| Unit (flow) | replace writes store+localStorage with **zero** PUT; merge fires exactly one PUT whose body is the merged set; empty local ⇒ zero PUT; guest ⇒ `fetch` never called; PUT-before-GET when a burst is pending; abort when a burst opens during the GET; each failure row leaves `cartItems.get()` and `localStorage.setItem` untouched | New `cartHydration.test.ts`, mirroring `CartService.test.ts`'s stubs (`createLocalStorageMock`, `stubCookie`, `LOGGED_IN_COOKIE`) |
| Regression | every existing `CartService.test.ts` assertion passes **unmodified** | Do not edit that file |
| E2E | guest adds → logs in → `/cart` renders the union | `e2e/tests/cart.spec.ts` |

**Gotchas to carry into tasks.** (1) One `fetch` mock serves both verbs — discriminate on `init.method`, use `mockImplementation`, not chained `mockResolvedValueOnce`. (2) `CartService.test.ts` runs global fake timers; the new file needs `await vi.advanceTimersByTimeAsync(0)` to drain `hydrateFromServer`'s real promise chain — a bare `await` never settles under fake timers. (3) Module state in `cartSync.ts` is a per-file singleton: `discardPendingSync()` in both `beforeEach` and `afterEach`. (4) Assert PUT-before-GET via `fetchMock.mock.calls` order, not two separate spies. (5) `cartItems.subscribe` fires immediately on subscribe — `renderCart` runs twice at load today; that is pre-existing and must not be "fixed" here.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The one new surface is server-supplied product names reaching the DOM, closed by the `textContent`-only rule above.

## Resolved Risks

| Risk | Resolution |
|---|---|
| Merged quantity > 99 rolls back the whole PUT | `Math.min(99, …)` on every merged item before `scheduleSync` |
| Merge PUT double-fires with a pending burst | `scheduleSync` + `flushCartSync` coalesces the burst into one PUT |
| Merge treated as stale by `syncSeq` | The guard gates rollback, not issuance; the merge is the newest `syncSeq` at issue time |
| Partial overwrite on failure | Single terminal `set` + `persistCart`; every failure returns earlier |
| Repeated `/cart` loads doubling quantities | Merge requires the explicit `mergeLocal` flag |
| Regressing existing debounce/rollback tests | `cartSync.ts` gains one pure accessor; new tests live in a new file |

## Resolved: the redirect-vs-GET race (was blocking)

The proposal required the login merge to be fire-and-forget and to never delay `window.location.href = '/'`. But `keepalive` covers the *PUT*, not the *GET*: if the document unloads before the GET resolves, `merged` is never computed and success criterion #1 fails intermittently, silently, and untestably in production.

**User decision**: bounded race, not true fire-and-forget. `Promise.race([hydrateFromServer({mergeLocal:true}), timeout(HYDRATION_REDIRECT_TIMEOUT_MS = 1500)]).then(redirect, redirect)` — never fails the redirect, never blocks it beyond 1.5s (typically ~50ms), guarantees the merge either completes or the user waits briefly rather than silently losing it. This relaxes the proposal's "zero delay" wording to "bounded delay" — the spec delta must reflect the 1.5s cap, not zero.

Accepted, non-blocking consequences (record in the spec delta):

- **Drift detected at login is discarded.** We redirect to `/`, and after the merge, local matches the server, so the same drift will not reappear on the next `/cart` load. Only the cart-page trigger renders the notice.
- **`pagehide`-PUT vs cart-page-GET is a genuine cross-navigation race.** Add on `/product`, navigate to `/cart`: `pagehide` issues the PUT, then the new page issues the GET. In practice the `/cart` HTML round-trip gives the PUT enough head start, but nothing guarantees it — the same class as the `keepalive`/CORS-preflight caveat already documented in `syncToBackend`'s catch block. Not solvable client-side; e2e must not assert on this ordering.
- **Review budget.** The two additions beyond the proposal (`hasPendingSync` + its test; the bounded-race redirect + its test) add roughly 35–40 authored lines. Revised estimate: **~450–600 lines**, still `400-line budget risk: High`.

## Migration / Rollout

No migration. Frontend-only: no schema, no API contract change (`GET /api/cart` already ships), no persisted-format change. Single revert of the branch removes the `GET` and restores local-first behavior; cart rows written by a merge remain ordinary cart rows.
