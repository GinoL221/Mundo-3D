# Tasks: Cart Sync Batching

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Unit A ~250; Unit B ~270 (combined ~520, over the single-PR budget) |
| 400-line budget risk | Unit A: Low; Unit B: Low-Medium; combined single PR: High |
| Chained PRs recommended | Yes (2 sequential PRs, A then B) |
| Suggested split | PR 1 = Work Unit A (pure file-split refactor, zero behavior change), PR 2 = Work Unit B (debounce/flush behavior + test adaptation) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High if delivered as one PR; Low-Medium per unit if split

The design's own module boundary is also the natural PR boundary: Unit A moves `CartItem`/`APICartSyncPayload`/`cartItems`/`cartTotal`/`persistCart` into `cartState.ts` and `syncSeq`/`syncToBackend` into `cartSync.ts` **verbatim**, with `CartService.ts` reduced to the class plus re-exports. Unit A changes zero observable behavior — the existing test suite passes unmodified through the re-exports, so it needs no test-file edits. Unit B adds the scheduler (`scheduleSync`, `flushCartSync`, `discardPendingSync`, `registerCartFlushListeners`) on top of the already-split `cartSync.ts`, rewires `CartService.ts`'s call sites, and adapts/extends `CartService.test.ts`. Splitting this way keeps each PR independently reviewable, keeps Unit A's diff to a mechanical move a reviewer can verify line-for-line, and isolates all new behavior (and all test risk) in Unit B. Unit B cannot ship before Unit A merges — it edits the files Unit A creates.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Rollback boundary |
|---|---|---|---|---|
| A | Split `CartService.ts` into `cartState.ts` + `cartSync.ts` (verbatim) + `CartService.ts` (class + re-exports); zero behavior change | PR 1 | `cd frontend && npm test -- CartService` (existing suite, unmodified, must stay green) | Revert the 3-file split; `CartService.ts` returns to its current single-file form; no import site touched |
| B | Add debounce scheduler + forced-flush listeners in `cartSync.ts`; rewire `CartService.ts` call sites; adapt + extend `CartService.test.ts` | PR 2 (bases on PR 1 after merge) | `cd frontend && npm test -- CartService` | Revert `cartSync.ts` scheduler additions, `CartService.ts` call-site changes, and `CartService.test.ts` — Unit A's file split stays intact and functional (per-mutation sync restored) |

## Work Unit A: File Split (No Behavior Change)

### Phase 1: `cartState.ts`

- [x] A1.1 Create `frontend/src/domains/cart/services/cartState.ts` — move `CartItem`, `APICartSyncPayload`, `cartItems`, `cartTotal`, `persistCart` out of `CartService.ts` **verbatim** (including the `atom`/`computed` imports from `nanostores` and the SSR-guard comment on `persistCart`'s catch block). No logic changes.

### Phase 2: `cartSync.ts` Scaffolding

- [x] A2.1 Create `frontend/src/domains/cart/services/cartSync.ts` — move `syncSeq` and `syncToBackend` out of `CartService.ts` **verbatim**, comments included (`keepalive` rationale, the sequence-guard comment block, the no-rollback-on-throw comment block, both `cart-sync-error` dispatches). Import `CartItem` from `./cartState`, `API_URL`/`getSessionUser`/`withCredentials` from `../../../config`.

### Phase 3: Reduce `CartService.ts`

- [x] A3.1 Modify `frontend/src/domains/cart/services/CartService.ts` — remove the code now living in `cartState.ts`/`cartSync.ts`; re-export `cartItems`, `cartTotal`, `CartItem`, `APICartSyncPayload` from `cartState.ts` so every existing import site compiles unchanged; `CartService` class methods still call `syncToBackend` (imported from `./cartSync`) exactly as before — no call-site behavior change in this unit.

### Phase 4: Unit A Verification

- [x] A4.1 Run `cd frontend && npm test -- CartService` — full existing suite passes unmodified (proves the split preserved behavior byte-for-byte).
- [x] A4.2 Run `pnpm frontend:check` (`astro check`) — no new type errors from the split.
- [x] A4.3 Confirm no import site broke: `CartList.astro`, `product.astro` (via the `domains/cart` barrel), `cartBadge.ts`, `sessionUI.ts`, `domains/cart/index.ts` — all still resolve `CartItem`/`cartItems`/`cartTotal`/`CartService` from `./CartService` unchanged.
- [x] A4.4 Run `cd backend && npm run architecture:check` — confirm the `frontend.domain.locality` rule still passes now that cart logic spans three files, all still inside `frontend/src/domains/cart/services/`.

## Work Unit B: Debounce Scheduler and Flush Triggers

### Phase 5: Scheduler Core

- [x] B5.1 RED: in `CartService.test.ts`, add the global fake-timer harness — `beforeEach` gains `vi.useFakeTimers()` and a call to `discardPendingSync()` (imported directly from `./cartSync`, not re-exported through `CartService.ts`); `afterEach` gains `discardPendingSync()` and `vi.useRealTimers()`, inserted before the existing `vi.unstubAllGlobals()`/`vi.restoreAllMocks()`. Add the `flushSync()` helper (`await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)`), importing `SYNC_DEBOUNCE_MS` and `SYNC_MAX_WAIT_MS` from `./cartSync`. This alone will fail to compile/run until Phase 5-6 GREEN steps land — expected.
- [x] B5.2 GREEN: in `cartSync.ts`, add module constants `SYNC_DEBOUNCE_MS = 300` and `SYNC_MAX_WAIT_MS = 1000`, and module-level state `debounceTimer`, `maxWaitTimer`, `pendingItems`, `burstPreviousItems` (all nullable, per the design's Interfaces section).
- [x] B5.3 GREEN: implement `scheduleSync(items, previousItems)` in `cartSync.ts` exactly per the design — early-return on `!getSessionUser()`; `pendingItems = items` always; `burstPreviousItems = previousItems` **only** when it is currently `null` (the burst-open sentinel — never derive "is a burst open" from `.length` or from `debounceTimer !== null`); arm `maxWaitTimer` once per burst at `SYNC_MAX_WAIT_MS`; clear-and-re-arm `debounceTimer` at `SYNC_DEBOUNCE_MS` on every call.
- [x] B5.4 GREEN: implement `discardPendingSync()` in `cartSync.ts` — clears both timers, resets `debounceTimer`/`maxWaitTimer`/`pendingItems`/`burstPreviousItems` to `null`. Export it.
- [x] B5.5 GREEN: implement `flushCartSync()` in `cartSync.ts` — capture `items`/`previous` from `pendingItems`/`burstPreviousItems`, call `discardPendingSync()` **before** issuing the request (so a mutation arriving during the in-flight PUT opens a genuinely new burst), early-return if either captured value is `null`, otherwise `void syncToBackend(items, previous)`. Export it.

### Phase 6: Forced-Flush Listeners

- [x] B6.1 RED: add a new test (or extend Phase 8's new-tests batch, see B8.4/B8.5) asserting `registerCartFlushListeners(winStub, docStub)` binds a `pagehide` handler on the passed `win` and a `visibilitychange` handler on the passed `doc`, both invoking `flushCartSync()`, and returns an idempotent teardown function.
- [x] B6.2 GREEN: implement `registerCartFlushListeners(win = window, doc = document)` in `cartSync.ts` — binds `pagehide` on `win`, `visibilitychange` on `doc` (filtered to `doc.visibilityState === 'hidden'`); returns a teardown closure that removes both listeners; follows `cartBadge.ts`'s register-once/return-cleanup convention for idempotence. Do **not** bind `beforeunload`.
- [x] B6.3 GREEN: at the bottom of `cartSync.ts`, call `registerCartFlushListeners()` once at module scope, guarded by `typeof window !== 'undefined' && typeof document !== 'undefined'` (no-op under Astro SSR and under vitest's default `node` test environment).

### Phase 7: Wire `CartService.ts` to the Scheduler

- [x] B7.1 GREEN: modify `CartService.addToCart`/`removeFromCart`/`clearCart` — replace each `void syncToBackend(updated, current)` (and the `clearCart` equivalent with `[]`) with `scheduleSync(updated, current)` (three call sites total).
- [x] B7.2 GREEN: modify `CartService.checkout()` — replace `void syncToBackend([], current)` with `scheduleSync([], current)` immediately followed by `flushCartSync()` on the next line (scheduling then flushing, never calling `syncToBackend` directly — a direct call would strand a pending burst's `burstPreviousItems`). `checkout()` keeps its `(): boolean` signature and stays non-blocking; `flushCartSync()` is not awaited.
- [x] B7.3 GREEN: modify `CartService.loadCartFromStorage()` — call `discardPendingSync()` before returning (covers every branch: valid array, no stored value, malformed JSON, non-array JSON, `getItem` throwing), since re-establishing the baseline from localStorage invalidates any open burst.

### Phase 8: Adapt and Extend `CartService.test.ts`

- [x] B8.1 Mechanical pass: replace every remaining `await flushPromises()` and `await vi.waitFor(...)` call site with `await flushSync()` (or `await vi.advanceTimersByTimeAsync(0)` where only a promise-chain drain is needed, no timer to fire) followed by a plain `expect`, per the design's Testing Strategy. This covers the tests **not** separately listed as logic-adapted below: "does not call fetch when there is no active session", "sends the cart sync request with credentials + CSRF token...", "does NOT roll back local cart state when fetch itself throws...", "still dispatches a cart-sync-error event when fetch() throws...", "dispatches a cart-sync-error event when the sync fails", "does not roll back state when the backend sync succeeds". Each of these issues a single mutation per test, so one `flushSync()` still produces the same one PUT — no assertion-shape changes needed beyond the helper swap.
- [x] B8.2 RED→GREEN, adapted test: `does not let a late-arriving failed sync roll back state that a newer sync already confirmed` — insert `await flushSync()` between `addToCart(7)` and `removeFromCart(7)`, and after `removeFromCart(7)`, so the two mutations become two distinct flushed bursts (baselines `[]` and `[{7}]`, matching today's two `syncToBackend` calls). Both `mockImplementationOnce` handlers are still consumed in order. The late `resolveFirstFetch({ok:false})` is drained with `await vi.advanceTimersByTimeAsync(0)`, not `flushSync()` (no new debounce window to fire). `setItem.mockClear()` still sits immediately before the late resolve.
- [x] B8.3 RED→GREEN, adapted test: `does not let a late-arriving failed sync roll back a DIFFERENT newer mutation` — same shape: `await flushSync()` between `addToCart(7)` and `addToCart(8)`, and after `addToCart(8)`; late failure drained with `await vi.advanceTimersByTimeAsync(0)`.
- [x] B8.4 RED→GREEN, adapted test: `rolls back to the pre-checkout cart if the backend rejects the empty-items sync` — this one is **not called out in the proposal** but the design flags it as needing adaptation too: change `fetchMock.mockResolvedValue({ok:false, status:400})` (applied to all calls) to `mockResolvedValueOnce({ok:true})` for the `addToCart` burst, insert `await flushSync()` so `[product]` is genuinely server-confirmed before checkout, then `mockResolvedValueOnce({ok:false, status:400})` for the checkout flush. Without this, `addToCart` + `checkout()` coalesce into a single burst whose baseline is `[]`, and `cartBeforeCheckout` would no longer represent the last-confirmed state the rollback assertion depends on.
- [x] B8.5 Import `discardPendingSync`, `flushCartSync` (if directly exercised), `SYNC_DEBOUNCE_MS`, `SYNC_MAX_WAIT_MS`, and `registerCartFlushListeners` from `./cartSync` at the top of the test file (these are not re-exported through `./CartService`).

### Phase 9: New Tests

- [x] B9.1 RED→GREEN, new test: N rapid mutations coalesce into exactly 1 PUT — 3 `addToCart` calls at 100 ms spacing; `expect(fetchMock).not.toHaveBeenCalled()` before the window closes; `await flushSync()`; `expect(fetchMock).toHaveBeenCalledTimes(1)`; parsed request body's `items` equals all 3 products; `options.keepalive === true`.
- [x] B9.2 RED→GREEN, new test: `cart-updated` is **not** coalesced — same 3-mutation burst; assert `dispatchEventSpy` was called with `type === 'cart-updated'` exactly 3 times (once per mutation, independent of the single network flush).
- [x] B9.3 RED→GREEN, new test: the max-wait cap flushes without a quiet period — `addToCart` at t=0, then 4 more at 200 ms spacing (t=200…800, never letting 300 ms of quiet elapse); `expect(fetchMock).not.toHaveBeenCalled()` at t=800; `await vi.advanceTimersByTimeAsync(200)` to reach t=1000; `expect(fetchMock).toHaveBeenCalledTimes(1)` with all 5 items in the body (proves the cap flushed the latest snapshot, not a partial one).
- [x] B9.4 RED→GREEN, new test: `pagehide` flushes immediately — call `registerCartFlushListeners(winStub, docStub)` where the stubs capture registered handlers into a map; `addToCart` once; `expect(fetchMock).not.toHaveBeenCalled()`; invoke the captured `pagehide` handler directly; `expect(fetchMock).toHaveBeenCalledTimes(1)`; call the returned cleanup function before the test ends.
- [x] B9.5 RED→GREEN, new test: hidden tab flushes, visible tab does not — same stub shape with `doc.visibilityState = 'hidden'` before invoking the captured `visibilitychange` handler → 1 call; re-run (fresh registration + cleanup) with `doc.visibilityState = 'visible'` → 0 calls.
- [x] B9.6 Test-hygiene check across B9.4/B9.5: the window stub used elsewhere in this file (`{ dispatchEvent }`) has no `addEventListener`/`removeEventListener`. Build a richer stub for these two tests that still provides `dispatchEvent` (required by `persistCart`) plus `addEventListener`/`removeEventListener` that record handlers into a map for the test to invoke directly.

### Phase 10: Unit B Gotcha Checklist (explicit, not left implicit)

- [x] B10.1 Confirm `discardPendingSync()` runs in **both** `beforeEach` and `afterEach` — module state in `cartSync.ts` is a singleton shared across the whole test file; a leftover `burstPreviousItems` from one test silently poisons the next test's rollback baseline.
- [x] B10.2 Confirm every test that calls `registerCartFlushListeners(...)` also calls its returned cleanup before the test ends — the listener registration latches globally (per the design's idempotence decision), so a forgotten cleanup makes the next registration in a later test a no-op.
- [x] B10.3 Confirm no test uses a bare `setTimeout(resolve, 0)`/raw promise wait to drain pending work under fake timers — under `vi.useFakeTimers()` such a promise never settles; use `vi.advanceTimersByTimeAsync(...)` exclusively.
- [x] B10.4 Confirm `flushSync()` is used exclusively for the case a debounce window must fire (waits `SYNC_DEBOUNCE_MS`), and `vi.advanceTimersByTimeAsync(0)` is used exclusively for draining an already-fired promise chain with no timer left to advance (e.g. the late `resolveFirstFetch` resolution in B8.2/B8.3) — do not interchange them.

### Phase 11: Unit B Verification

- [x] B11.1 Run `cd frontend && npm test -- CartService` — all existing + adapted + new tests pass GREEN.
- [x] B11.2 Run `pnpm frontend:check` — no new type errors.
- [x] B11.3 Run `pnpm test` (root, all workspaces except e2e) — confirm no unrelated regression.
- [x] B11.4 Confirm no import site broke: `CartList.astro`, `product.astro`, `cartBadge.ts`, `sessionUI.ts`, `domains/cart/index.ts` barrel — unchanged per the design, verify by inspection (no diff expected in these files).
- [x] B11.5 Run `cd backend && npm run architecture:check` — confirm `frontend.domain.locality` still passes (all new/modified code stays inside `frontend/src/domains/cart/services/`).
- [x] B11.6 Manually re-check the proposal's Success Criteria checklist against the new tests: N rapid mutations → 1 PUT (B9.1); sustained mutations past the cap still sync (B9.3); `checkout()`/`pagehide`/hidden-tab each force an immediate flush (B8.4, B9.4, B9.5); `keepalive: true` present on every flush and the throw path still does not roll back (B9.1, existing throw test via B8.1); both stale-response ordering guarantees still hold (B8.2, B8.3); `cart-updated` still fires once per mutation (B9.2).

## Key Learnings

- The design's module boundary (verbatim move vs. new scheduler logic) doubles as a natural, low-risk PR split: a pure refactor with zero behavior change needs no test-file edits at all, so isolating it first shrinks the risky PR's diff and gives the risky PR a byte-for-byte-verified foundation.
- `CartService.ts` re-exports only `cartItems`, `cartTotal`, `CartItem`, `APICartSyncPayload` from `cartState.ts` — scheduler internals (`discardPendingSync`, `SYNC_DEBOUNCE_MS`, `SYNC_MAX_WAIT_MS`, `registerCartFlushListeners`) live in `cartSync.ts` and must be imported directly by the test file; this is easy to miss since the test file currently imports everything through `./CartService`.
- The proposal explicitly lists only 2 tests needing logic adaptation (the stale-response ordering pair), but the design's Testing Strategy section reveals a third (`checkout` rollback test) plus a file-wide mechanical swap (`flushPromises`/`vi.waitFor` → `flushSync`/`advanceTimersByTimeAsync`) touching roughly 6 more tests — all of it had to be made explicit here so `sdd-apply` doesn't silently skip the mechanical pass.
- Two singleton-state gotchas (`discardPendingSync` in both `beforeEach`/`afterEach`; listener cleanup after every `registerCartFlushListeners` call) are easy to omit and produce cross-test pollution that only shows up as flaky failures in unrelated tests — called out as their own verification phase rather than folded into individual test tasks.
- `backend/tools/architecture/engine.js`'s `frontend.domain.locality` rule already covers `frontend/src/**` paths (confirmed via `architecture-boundaries.test.js`, rule `S10/S12`) and is runnable via `cd backend && npm run architecture:check` — this is an automated check, not a manual-only verification step.

## Result Contract

- status: done
- executive_summary: 11 phases / 33 checkbox tasks across 2 sequential work units (Unit A: pure 3-file split, ~250 lines, low risk; Unit B: debounce scheduler + flush triggers + test adaptation, ~270 lines, low-medium risk) — chained PRs recommended since the combined ~520-line diff exceeds the 400-line ask-on-risk budget as a single PR.
- artifacts: openspec/changes/cart-batching/tasks.md
- next_recommended: sdd-apply
- risks: Unit B strictly depends on Unit A merging first (it edits files Unit A creates), so the two PRs cannot be parallelized; the checkout-rollback test adaptation (B8.4) was not listed in the proposal and could be missed by an implementer working from the proposal alone rather than the design; the two singleton-state test gotchas (discardPendingSync in both beforeEach/afterEach, listener cleanup) are easy sources of cross-test flakiness if skipped.
- skill_resolution: none
