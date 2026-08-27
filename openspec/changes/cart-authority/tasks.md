# Tasks: Cart Authority

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Unit 1 ~240; Unit 2 ~335; Unit 3 ~90 (combined ~665, over the single-PR budget) |
| 400-line budget risk | Unit 1: Low; Unit 2: Medium; Unit 3: Low; combined single PR: High |
| Chained PRs recommended | Yes (3 sequential PRs, 1 → 2 → 3) |
| Suggested split | PR 1 = pure core (types/mapping/merge/drift, unwired), PR 2 = async orchestration on the same two files, PR 3 = page wiring + e2e |
| Delivery strategy | Not passed to this phase's launch prompt — assumed `ask-on-risk` (session default per orchestrator workflow); orchestrator MUST confirm the actual cached value before `sdd-apply` |
| Chain strategy | pending — not yet selected by the user this session |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Cross-check against design.md: the design's own File-Changes estimate is **~450–600 lines** (`cartHydration.ts` ~130, `cartSync.ts` +3, `CartService.ts` +8, `CartList.astro`/`LoginForm.astro` markup+wiring, plus the bounded-race redirect and `hasPendingSync` additions it flagged as pushing the estimate up). My per-file estimate below lands at ~665, higher mainly because `cartHydration.test.ts` alone is estimated at ~420 lines once every scenario in the design's Testing Strategy table (2 mapping + 6 merge + 2 drift + 5 failure-path + 4 flow scenarios, plus the fake-timer/fetch-mock harness) is counted individually. Both estimates agree on the conclusion: **High risk as a single PR.**

The natural PR boundary mirrors the design's own decomposition: `cartHydration.ts`'s pure functions (map/merge/drift) have zero I/O and no page depends on them yet, so they review and revert independently of the async orchestration layered on top in the same two files, which in turn is wired into pages only in the last unit. No unit ships partially-working production behavior — Units 1 and 2 add dead code (a fully-tested, unwired module); only Unit 3 changes what a real page does.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Pure core: `mapServerCart`, `mergeCartItems`, `detectPriceDrift` + their unit tests. No I/O, no wiring. | PR 1 | `cd frontend && npx vitest run cartHydration` | N/A — pure functions, no timers/network involved, a plain test run is a complete proof | Delete `cartHydration.ts` and `cartHydration.test.ts`; no other file touched |
| 2 | Async orchestration: `hydrateFromServer`, `cartSync.ts`'s `hasPendingSync()`, `CartService.hydrateFromServer()` delegate. Still unwired from any page. | PR 2 (bases on PR 1 after merge) | `cd frontend && npx vitest run cartHydration` | N/A — exercised entirely through the fetch/timer mocks already in the unit test file; no page renders it yet | Revert the orchestration additions to `cartHydration.ts`, the 3-line `hasPendingSync()` in `cartSync.ts`, and the delegating static + re-exports in `CartService.ts`; Unit 1's pure functions stay intact and green |
| 3 | Wire hydration into `CartList.astro` (price-drift notice) and `LoginForm.astro` (bounded-race merge); e2e regression. | PR 3 (bases on PR 2 after merge) | `cd frontend && npx vitest run cartHydration` (regression) | `pnpm --filter e2e test -- cart.spec.ts` — guest-add → login → `/cart` union flow, against a running dev server/DB | Revert the two `.astro` call-site edits and the new e2e test; Units 1–2's module stays functional but unused (dead code, zero observable behavior change) |

## Phase 1: Types and DTO Mapping (`mapServerCart`)

- [x] 1.1 RED: create `frontend/src/domains/cart/services/cartHydration.test.ts` with `mapServerCart` tests: a null `product.image` maps to `image: ''`; `unitPrice` comes from `product.price` (not any row-level price); `productId`/`quantity` map straight through. *(cart-hydration spec: "Server DTO to CartItem Mapping")*
- [x] 1.2 GREEN: create `frontend/src/domains/cart/services/cartHydration.ts` with `ServerCartItemDTO`, `ServerCartResponse`, `PriceDrift`, `HydrationResult` interfaces, `MAX_ITEM_QUANTITY = 99`, and `mapServerCart()` per the design's Interfaces/Mapping sections. **Deviation**: `HydrationResult` intentionally NOT added in this PR — it is only meaningful alongside `hydrateFromServer()`, which is phase 5+ scope; adding an unused type now would be dead surface in a PR meant to stay pure/unwired. Will be added in the PR that implements `hydrateFromServer()`.

## Phase 2: Merge Logic (`mergeCartItems`)

- [x] 2.1 RED: add `mergeCartItems` tests — overlapping `productId` sums quantities; `name`/`image`/`unitPrice` on overlap take the server's value (server wins); a summed overlap exceeding 99 clamps to 99; a local-only item already over 99 also clamps to 99; an item with a non-finite or `< 1` quantity is dropped; server-only items pass through unchanged; local-only items pass through unchanged; output order is server items in server order, then local-only items appended. *(cart-hydration spec: "Guest-to-Account Cart Merge on Login", scenario "Merged quantity over 99 clamps silently"; design's merge rules table)*
- [x] 2.2 GREEN: implement `mergeCartItems(local, server)` in `cartHydration.ts` per the design's merge rules table (key by `productId`, sum, server-wins fields, `Math.min(99, sum)` clamp on every merged item, drop non-finite/`<1`, deterministic ordering).

## Phase 3: Price-Drift Detection (`detectPriceDrift`)

- [x] 3.1 RED: add `detectPriceDrift` tests — a product present in both sets with differing prices produces one `PriceDrift` entry with `{name, oldPrice, newPrice}`; a product present in both sets with equal prices produces no entry; a server-only product (no local record) produces no entry; multiple drifted products each produce their own entry. *(cart-hydration spec: "Price-Drift Notice on Hydration")*
- [x] 3.2 GREEN: implement `detectPriceDrift(local, server)` in `cartHydration.ts` — compare only products present in both sets, ignore the DTO's own `hasPriceDrift` field entirely (design decision: different comparands).

## Phase 4: Work Unit 1 Verification

- [x] 4.1 Run `cd frontend && npx vitest run cartHydration` — all pure-function tests green. (17/17 passed)
- [x] 4.2 Run `pnpm frontend:check` — no new type errors. (`npm run check` in `frontend/`: 0 errors, 0 warnings, 0 hints across 52 files)
- [x] 4.3 Confirm `frontend/src/domains/cart/services/CartService.test.ts` is untouched and still passes unmodified (regression gate — this file is never a target of this change). (`git status` confirms it is not in the diff; full `npm test` run: 9 files / 130 tests passed, including that file)

## Phase 5: Test Harness for Flow Tests

- [x] 5.1 In `cartHydration.test.ts`, add the flow-test harness mirroring `CartService.test.ts`'s stubs: `createLocalStorageMock()`, `stubCookie()`, `LOGGED_IN_COOKIE`, `vi.useFakeTimers()`. Use **one** `fetchMock` with `mockImplementation` that discriminates the GET (`/api/cart`, no body) from the PUT (`init.method === 'PUT'`) — never chained `mockResolvedValueOnce` for two different verbs. Call `discardPendingSync()` (imported from `./cartSync`) in **both** `beforeEach` and `afterEach` — module state in `cartSync.ts` is a singleton shared across the whole file, and a leftover burst from one test poisons the next test's rollback baseline.

## Phase 6: Guest and Failure Paths

- [x] 6.1 RED: guest session (`getSessionUser() === null`) ⇒ `hydrateFromServer()` resolves `{ok:false, reason:'guest'}`, and `fetch` is never called. *(cart-hydration spec: "Non-Blocking Hydration Failure"; design's failure-semantics table)*
- [x] 6.2 RED: `fetch` throws ⇒ `{ok:false, reason:'network'}`; `cartItems.get()` and `localStorage.setItem` are untouched (assert both explicitly, not just the return value).
- [x] 6.3 RED: `fetch` resolves with `!res.ok` (e.g. 401/500) ⇒ `{ok:false, reason:'http'}`; state untouched.
- [x] 6.4 RED: `fetch` resolves ok but `res.json()` throws, or the resolved `items` is not an array ⇒ `{ok:false, reason:'http'}`; state untouched. Drain each promise chain with `await vi.advanceTimersByTimeAsync(0)` — a bare `await` never settles under global fake timers.
- [x] 6.5 GREEN: implement `hydrateFromServer()`'s outer shape in `cartHydration.ts` — the whole body in one `try/catch` so the returned promise always resolves; early-return `{ok:false, reason:'guest', items: local, priceDrifts: [], syncScheduled:false}` before any fetch when there is no session; map fetch-throw, `!res.ok`, and JSON/shape failures to `{ok:false, reason:'network'|'http', ...}` with no state write and no `cart-sync-error` dispatch.

## Phase 7: `hasPendingSync()` and the Superseded Guard

- [x] 7.1 GREEN (additive only, no behavior change): add `export function hasPendingSync(): boolean { return burstPreviousItems !== null; }` to `frontend/src/domains/cart/services/cartSync.ts` — 3 lines, no existing line in that file changes. *(nano-stores-cart spec: consumed by the guard below, not a requirement itself)*
- [x] 7.2 RED: in replace mode (no `mergeLocal`), if a burst opens *during* the in-flight GET (`hasPendingSync()` becomes true after the GET resolves), `hydrateFromServer()` resolves `{ok:false, reason:'superseded'}` and leaves local state untouched (the local, post-mutation state wins). *(cart-hydration spec: "Non-Blocking Hydration Failure" — the abort case documented in design's "burst opened during the GET" decision)*
- [x] 7.3 GREEN: after the GET resolves in replace mode, check `hasPendingSync()` before writing the store; if true, return `{ok:false, reason:'superseded', items: local, priceDrifts: []}` without touching `cartItems`/`localStorage`.

## Phase 8: Replace-Mode Success Path

- [x] 8.1 RED: a pending debounce burst existing before `hydrateFromServer()` is called causes `flushCartSync()`'s PUT to be sent **before** the GET — assert via `fetchMock.mock.calls` order (index-based), not two separate spies. With no pending burst, hydration proceeds without waiting on any flush. Replace mode (no `mergeLocal`) writes `cartItems.set(server)` + `persistCart(server)` and issues **zero** PUT requests of its own; `priceDrifts` is returned from `detectPriceDrift(local, server)`. *(cart-hydration spec: "Cart-Page Hydration Ordering with Pending Mutations", both scenarios)*
- [x] 8.2 GREEN: implement the replace-mode body — `flushCartSync()` first, then `fetch` the GET, `mapServerCart()`, the Phase 7 superseded check, `detectPriceDrift(local, server)`, then the single terminal `cartItems.set(server)` + `persistCart(server)`, returning `{ok:true, items:server, priceDrifts, syncScheduled:false}`.

## Phase 9: Merge-Mode Success Path

- [x] 9.1 RED: `hydrateFromServer({mergeLocal:true})` with an **empty** local cart takes the replace path — local state replaced with the server cart, zero `PUT /api/cart` issued. *(cart-hydration spec: "Guest-to-Account Cart Merge on Login", scenario "Empty guest cart hydrates without writing")*
- [x] 9.2 RED: `hydrateFromServer({mergeLocal:true})` with a **non-empty** local cart merges via `mergeCartItems(local, server)`, issues **exactly one** `PUT /api/cart` carrying the merged set, via `scheduleSync(merged, server)` followed by a synchronous `flushCartSync()` — never `syncToBackend()` called directly. A burst already pending before the merge does not strand its original rollback baseline (the burst's `previousItems` is preserved as the PUT's rollback target, per design). *(cart-hydration spec: "Guest-to-Account Cart Merge on Login", scenario "Non-empty guest cart merges and syncs once"; nano-stores-cart spec: both "Post-Merge Sync Reuses the Existing Scheduler" scenarios)*
- [x] 9.3 GREEN: implement the merge-mode branch — `shouldMerge = mergeLocal === true && local.length > 0`; when false, take the Phase 8 replace path; when true, compute `merged = mergeCartItems(local, server)`, write `cartItems.set(merged)` + `persistCart(merged)`, then `scheduleSync(merged, server); flushCartSync();`, returning `{ok:true, items:merged, priceDrifts:[], syncScheduled:true}` (merge-mode drift is discarded per design, not surfaced — the caller redirects before any notice would render).

## Phase 10: `CartService` Delegating Static

- [x] 10.1 RED: `CartService.hydrateFromServer(options)` delegates its argument to `cartHydration.ts`'s `hydrateFromServer` and returns its result unchanged (spy on the module import). `CartService` also re-exports `HydrationResult`/`PriceDrift` types. *(cart-hydration spec: "Hydration Entry Point and Triggers" — "sole entry point")*
- [x] 10.2 GREEN: add the delegating static and type re-exports to `frontend/src/domains/cart/services/CartService.ts` (~8 lines, per design's Interfaces section).

## Phase 11: Work Unit 2 Verification

- [x] 11.1 Run `cd frontend && npx vitest run cartHydration` — full suite (Phases 1–10) green. (30/30 passed)
- [x] 11.2 Run `cd frontend && npx vitest run CartService` — confirm the existing suite still passes **unmodified** (regression gate; that file is not edited by this change). (full `npm test`: 9 files / 143 tests passed, including that file, unmodified)
- [x] 11.3 Run `pnpm frontend:check` — no new type errors. (`npm run check` in `frontend/`: 0 errors, 0 warnings, 0 hints across 52 files)
- [x] 11.4 Run `cd backend && npm run architecture:check` — confirm `frontend.domain.locality` still passes with the new module inside `frontend/src/domains/cart/services/`. (exit 0)

## Phase 12: `CartList.astro` — Price-Drift Markup and Hydration Call

- [x] 12.1 Add the `#cart-price-drift` `.alert` block above `.cart__container` in `frontend/src/domains/cart/components/CartList.astro`, hidden via `style="display:none"` (the file's existing idiom, mirroring `#cart-summary`) — one `.alert` block containing N `.alert__text` `<p>` elements, per the design's block+element decision. *(cart-hydration spec: "Price-Drift Notice on Hydration")*
- [x] 12.2 Add a `renderPriceDrift(drifts)` script function that builds each `.alert__text` line with `document.createElement('p')` + `textContent` (never `innerHTML`, since product names are server-supplied) and toggles the block's `display` to `block` only when `drifts.length > 0`.
- [x] 12.3 Wire the call order in the script: `loadCartFromStorage()` → `renderCart()` → `cartItems.subscribe(renderCart)` → `void CartService.hydrateFromServer().then(renderPriceDrift)`. Note: `cartItems.subscribe` fires immediately on subscribe, so `renderCart` runs twice at load today — this is pre-existing behavior and must NOT be "fixed" as part of this change. *(cart-hydration spec: "Cart-page Hydration Ordering with Pending Mutations")*

## Phase 13: `LoginForm.astro` — Bounded-Race Merge

- [x] 13.1 In `frontend/src/domains/auth/components/LoginForm.astro`, import `hydrateFromServer` (or `CartService.hydrateFromServer`) from `domains/cart/` and add `HYDRATION_REDIRECT_TIMEOUT_MS = 1500`. Between `broadcastSessionChanged()` and `window.location.href = '/'`, replace the direct redirect with `await Promise.race([hydrateFromServer({mergeLocal:true}), timeout(HYDRATION_REDIRECT_TIMEOUT_MS)]).then(redirect, redirect)` (or equivalent) — the redirect proceeds on either settle, first-wins, and never rejects. *(cart-hydration spec: "Hydration Entry Point and Triggers", scenarios "Login success triggers hydration and waits briefly for it", "Hydration exceeding the timeout still redirects", "Failing GET on login still redirects")*
- [x] 13.2 Confirm `LoginForm.astro`'s import from `domains/cart/` is tool-legal per the design's architecture-check note (`.astro` sources are classified `documentation`, not `production`, so `frontend.domain.locality` does not apply to this import) — run `cd backend && npm run architecture:check` to confirm no violation is raised. (exit 0)

## Phase 14: E2E Regression

- [x] 14.1 RED: add a test to `e2e/tests/cart.spec.ts` — guest adds a product, logs in (to an account with a pre-existing, different item already synced to its server-side cart), navigates to `/cart`, and the union of guest + account cart items renders. Confirmed RED before wiring: `.cart__item` count was 1 (expected 2) — the account's server-side item never merged in without hydration. Does not assert on the ordering between a `pagehide`-triggered PUT and the cart-page GET (documented cross-navigation race in design's "Resolved" section — not solvable client-side).
- [x] 14.2 GREEN: ran the new e2e test against a live dev server/DB (`npx playwright test cart.spec.ts`) and confirmed it passes after wiring Phases 12–13.

## Phase 15: Final Verification

- [x] 15.1 Run `cd frontend && npm test` — 9 files / 143 tests passed, no regressions (includes all of PR1/PR2's `cartHydration.test.ts`/`CartService.test.ts` unmodified).
- [x] 15.2 Run `cd frontend && npm run check` — 0 errors, 0 warnings, 0 hints across 52 files.
- [x] 15.3 Run `cd backend && npm run architecture:check` — exit 0; confirms `LoginForm.astro`'s import from `domains/cart/` is tool-legal in practice, not just per the design's reasoning.
- [x] 15.4 Ran `cd e2e && npx playwright test cart.spec.ts` full file (8/8) and the full suite (`npx playwright test`, 39/39) green, including the new merge test and every pre-existing test. Cross-checked every scenario in `cart-hydration/spec.md` against Phases 1–14: all covered (mapping/merge/drift by `cartHydration.test.ts`; login-trigger bounded-wait/timeout/failure and cart-page-trigger by `LoginForm.astro`/`CartList.astro` wiring plus the new e2e regression); none silently skipped.
