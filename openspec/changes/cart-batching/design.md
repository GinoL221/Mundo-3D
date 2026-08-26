# Design: Cart Sync Batching

## Technical Approach

A module-level trailing-edge debounce sits between the four mutation methods and the existing `syncToBackend`. `syncToBackend` itself is moved verbatim — `keepalive: true`, the `syncSeq` guard, the non-rollback catch block, both `cart-sync-error` dispatches — and is never rewritten. Only its *call sites* change: `void syncToBackend(...)` becomes `scheduleSync(...)`, and one new `flushCartSync()` issues the coalesced request.

`cartItems.set()` + `persistCart()` stay strictly per-mutation, so `cart-updated` and the badge are untouched.

Adding the scheduler to `CartService.ts` (192 lines today) would break the repo's 250-line cap, so the file is split into three modules inside `domains/cart/services/`. `CartService.ts` re-exports `cartItems`, `cartTotal`, `CartItem`, and `APICartSyncPayload`, so every existing import site (`CartList.astro`, `product.astro` via the `domains/cart` barrel, `cartBadge.ts`, `sessionUI.ts`, `header-modules.test.ts`, `CartService.test.ts`) compiles unchanged. All three files stay inside `domains/cart/`, so the `frontend.domain.locality` architecture rule still passes.

## Architecture Decisions

### Decision: the max-wait cap is an independent ceiling timer

| Option | Tradeoff | Verdict |
|---|---|---|
| Second `setTimeout(flush, 1000)` armed once at burst start, never re-armed | Two live handles; both cleared in one place | **Chosen** |
| Single timer re-armed at `min(DEBOUNCE, MAX_WAIT − elapsed)` | Recomputes a delay per mutation; needs an `elapsed >= MAX_WAIT` immediate-flush branch; off-by-one prone; hard to assert under fake timers | Rejected |
| Max-*attempts* counter (flush after N mutations) | Wrong invariant — the criterion is wall-clock staleness. Three mutations spread over five minutes would force a flush; 50 clicks in 200 ms would not be capped by time | Rejected |

**Rationale**: the ceiling is a wall-clock guarantee ("no mutation is held longer than 1000 ms"), so it should be expressed as wall-clock. Two independent timers make that literal, and both are deterministic under `vi.advanceTimersByTimeAsync`. Values: `SYNC_DEBOUNCE_MS = 300`, `SYNC_MAX_WAIT_MS = 1000` — as fixed by the proposal, as module constants (not env), since there is no frontend config channel for tuning.

### Decision: `burstPreviousItems === null` is the burst sentinel

One nullable field carries both "is a burst open?" and "what is the rollback baseline?". `previousItems` can legitimately be `[]`, so the sentinel must be `null`, never `.length`. Rejected a separate `burstOpen: boolean` (two fields that must be kept in sync) and deriving it from `debounceTimer !== null` (the cap timer can fire and leave the debounce handle stale for one tick).

### Decision: `checkout()` issues the flush synchronously, and does not await it

`checkout()` stays `(): boolean` and stays non-blocking. It calls `scheduleSync([], current)` then `flushCartSync()` on the next line, so `fetch()` is *invoked* before `checkout()` returns — exactly what `void syncToBackend([], current)` does today. `keepalive: true` then carries the in-flight request across `CartList.astro`'s `window.location.href = '/'`, as it already does.

Rejected `async checkout(): Promise<boolean>`: it forces `await` into the `.astro` click handler, blocks the success `alert()` on a network round-trip, and changes a public signature — all to gain a guarantee `keepalive` already approximates and that a cancelled CORS preflight can defeat anyway (see the existing catch-block comment).

Scheduling *then* flushing (rather than calling `syncToBackend` directly) matters: if a burst is already pending, `scheduleSync` overwrites `pendingItems` with `[]` (the correct end state) while leaving `burstPreviousItems` at the burst's original baseline (the correct rollback target). A direct call would strand the pending burst.

### Decision: listeners self-register at import, behind a `typeof window` guard

`registerCartFlushListeners()` is called once at `cartSync.ts` module scope when `typeof window !== 'undefined' && typeof document !== 'undefined'`. `CartService` is a module-level singleton with no component lifecycle, and every entry point already imports it, so self-registration is the only way to guarantee no page forgets. Rejected requiring each client script to call it: forgetting one produces exactly the High-likelihood "mutation never reaches the server" failure the proposal calls mandatory to mitigate.

The guard makes it a no-op during Astro SSR and under vitest (no config file ⇒ `environment: 'node'` ⇒ `window` is undefined at import time), so listener behavior is only ever exercised by explicitly calling the exported function with a stub. The idempotence latch follows `cartBadge.ts`'s existing register-once/return-cleanup convention.

`pagehide` binds to `window`; `visibilitychange` binds to `document` (its spec target) and filters on `visibilityState === 'hidden'`. `beforeunload` is deliberately not used.

## Interfaces

```ts
// frontend/src/domains/cart/services/cartSync.ts
export const SYNC_DEBOUNCE_MS = 300;
export const SYNC_MAX_WAIT_MS = 1000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let pendingItems: CartItem[] | null = null;
let burstPreviousItems: CartItem[] | null = null;

export function scheduleSync(items: CartItem[], previousItems: CartItem[]): void {
  if (!getSessionUser()) return;              // guest carts never arm a timer
  pendingItems = items;                       // latest snapshot wins
  if (burstPreviousItems === null) {          // FIRST mutation of this burst
    burstPreviousItems = previousItems;       // captured once, never overwritten
    maxWaitTimer = setTimeout(flushCartSync, SYNC_MAX_WAIT_MS); // ceiling, armed once
  }
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushCartSync, SYNC_DEBOUNCE_MS);  // quiet window, re-armed
}

export function discardPendingSync(): void {  // clear timers + state, issue nothing
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  if (maxWaitTimer !== null) clearTimeout(maxWaitTimer);
  debounceTimer = null;
  maxWaitTimer = null;
  pendingItems = null;
  burstPreviousItems = null;
}

export function flushCartSync(): void {
  const items = pendingItems;
  const previous = burstPreviousItems;
  discardPendingSync();                       // reset BEFORE issuing, so a mutation
  if (items === null || previous === null) return;  // during the in-flight PUT
  void syncToBackend(items, previous);        // opens a fresh burst
}

export function registerCartFlushListeners(
  win: Window = window,
  doc: Document = document
): () => void;                                // idempotent; returns teardown
```

`discardPendingSync` has one production caller: `CartService.loadCartFromStorage()`, which re-establishes the baseline from localStorage and therefore invalidates any open burst. It is also the test-suite reset hook (module state is a singleton across a test file).

## Data Flow

```
addToCart / removeFromCart / clearCart
    │
    ├─ cartItems.set(updated) ─→ persistCart ─→ 'cart-updated'   (every mutation)
    │
    └─ scheduleSync(updated, current)
           │  first of burst?  ──yes──→ burstPreviousItems = current
           │                            arm maxWaitTimer  (t0 + 1000ms)
           └─ pendingItems = updated;  re-arm debounceTimer (now + 300ms)

  debounce fires ──┐
  cap fires ───────┤
  checkout() ──────┼──→ flushCartSync() ──→ discardPendingSync()
  pagehide ────────┤                        void syncToBackend(pendingItems,
  hidden tab ──────┘                                           burstPreviousItems)
                                                    │
                            !ok && mySeq === syncSeq ┴─→ rollback to burst baseline
```

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/domains/cart/services/cartState.ts` | Create | `CartItem`, `APICartSyncPayload`, `cartItems`, `cartTotal`, `persistCart` — moved verbatim (~40 lines) |
| `frontend/src/domains/cart/services/cartSync.ts` | Create | `syncSeq` + `syncToBackend` moved **verbatim** (comments included), plus scheduler, `flushCartSync`, `discardPendingSync`, `registerCartFlushListeners`, self-registration guard (~135 lines) |
| `frontend/src/domains/cart/services/CartService.ts` | Modify | Class only + re-exports; 3 call sites → `scheduleSync`; `checkout()` → `scheduleSync` + `flushCartSync()`; `loadCartFromStorage()` → `discardPendingSync()` (~70 lines) |
| `frontend/src/domains/cart/services/CartService.test.ts` | Modify | Global fake timers; 3 adapted tests; 5 new tests |

No change to `CartList.astro`, `product.astro`, `cartBadge.ts`, `sessionUI.ts`, or `domains/cart/index.ts`.

## Testing Strategy

Global setup: `beforeEach` adds `vi.useFakeTimers()` and `discardPendingSync()`; `afterEach` adds `discardPendingSync()` and `vi.useRealTimers()` before the existing unstub/restore. `flushPromises()` is replaced by:

```ts
async function flushSync(): Promise<void> {
  await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS); // fire the debounce, drain the chain
}
```

Every `await flushPromises()` becomes `await flushSync()`; all four `vi.waitFor(...)` calls become `await flushSync()` (or `await vi.advanceTimersByTimeAsync(0)` when only a promise chain needs draining) followed by a plain `expect` — explicit advancement over polling.

### Adapted tests (guarantee unchanged, trigger granularity only)

| Test | Adaptation |
|---|---|
| `does not let a late-arriving failed sync roll back state that a newer sync already confirmed` | `await flushSync()` inserted between `addToCart(7)` and `removeFromCart(7)`, and after `removeFromCart(7)`. Both `mockImplementationOnce` handlers are still consumed, as two distinct flushes with the same baselines as today (`[]` and `[{7}]`). The late `resolveFirstFetch({ok:false})` is drained with `await vi.advanceTimersByTimeAsync(0)`. `setItem.mockClear()` still sits immediately before the late resolve. |
| `does not let a late-arriving failed sync roll back a DIFFERENT newer mutation` | Same shape: `await flushSync()` between `addToCart(7)` and `addToCart(8)` and after `addToCart(8)`; late failure drained with `advanceTimersByTimeAsync(0)`. |
| `rolls back to the pre-checkout cart if the backend rejects the empty-items sync` | **Also needs adaptation** (not listed in the proposal). `mockResolvedValue` → `mockResolvedValueOnce({ok:true})` for the `addToCart` burst, then `await flushSync()` so `[product]` is genuinely server-confirmed, then `mockResolvedValueOnce({ok:false, status:400})` and `checkout()`. Without this, add+checkout coalesce into one burst whose baseline is `[]`, and the test's `cartBeforeCheckout` assertion is no longer the last-confirmed state. |

### New tests

| # | Assertion | Shape |
|---|---|---|
| 1 | N rapid mutations → exactly 1 PUT | 3 `addToCart` at 100 ms spacing; `expect(fetchMock).not.toHaveBeenCalled()`; `await flushSync()`; `toHaveBeenCalledTimes(1)`; parsed body `items` equals all 3; `keepalive === true` |
| 2 | `cart-updated` is **not** coalesced | Same burst; `dispatchEventSpy` calls with `type === 'cart-updated'` === 3 |
| 3 | Cap flushes without quiet | `addToCart` at t=0, then 4 more at 200 ms spacing (t=200…800, never 300 ms quiet); `not.toHaveBeenCalled()` at t=800; `advanceTimersByTimeAsync(200)` → t=1000 → `toHaveBeenCalledTimes(1)` with all 5 items in the body (proves it flushed the latest snapshot, not a partial) |
| 4 | `pagehide` flushes immediately | `registerCartFlushListeners(winStub, docStub)` captures handlers into a map; `addToCart`; `not.toHaveBeenCalled()`; invoke `handlers.pagehide()`; `toHaveBeenCalledTimes(1)`; call the returned cleanup |
| 5 | Hidden tab flushes; visible tab does not | Same stub with `doc.visibilityState = 'hidden'` → 1 call; re-run with `'visible'` → 0 calls |

**Test gotchas to carry into tasks**: (1) module state is a singleton per test *file* — `discardPendingSync()` must run in both `beforeEach` and `afterEach` or a leftover `burstPreviousItems` silently poisons the next test's rollback baseline. (2) `registerCartFlushListeners` latches globally; every listener test must invoke the returned cleanup before it ends, or the next registration is a no-op. (3) Under fake timers a bare `setTimeout(resolve, 0)` never settles — use `advanceTimersByTimeAsync`, never a raw promise wait. (4) The window stub used today (`{ dispatchEvent }`) has no `addEventListener`; listener tests need their own richer stub that still provides `dispatchEvent`, because `persistCart` uses it.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change is browser-side timer scheduling around an existing `fetch` whose URL, method, headers, and body shape are unchanged.

## Resolved Risks

| Risk | Resolution |
|---|---|
| Rollback targets the wrong baseline | `burstPreviousItems` captured only when the sentinel is `null`, reset inside `flushCartSync` *before* the request is issued, so a mutation arriving during an in-flight PUT opens a genuinely new burst |
| `checkout()` redirects before the PUT is scheduled | `flushCartSync()` runs synchronously in `checkout()`, so `fetch()` is invoked before the function returns — identical timing to today |
| Page closes mid-window | `pagehide` + `visibilitychange → hidden`, self-registered at import so no entry point can forget |
| Debounce breaks the ordering guarantees | `syncSeq` untouched; both tests keep two distinct overlapping PUTs, now separated by explicit window advancement |
| 250-line file cap | Three-module split with re-exports; no import site changes |

## Open Questions

None blocking. Two accepted consequences, to be recorded in the spec delta rather than resolved here:

- **Coarser rollback granularity.** A failed flush now reverts the whole burst, not one mutation. This is *more* correct (the burst was one PUT), but a user can lose up to a window's worth of clicks on failure. Accepted.
- **`keepalive` on the `pagehide` path is best-effort.** A cross-origin PUT with a JSON body and credentials triggers a CORS preflight that `keepalive` does not cover, so a fast enough unload can still cancel the flush — the limitation already documented in `syncToBackend`'s catch block. `navigator.sendBeacon` is not a substitute (it cannot send `PUT` or the `X-CSRF-Token` header). Unchanged in kind, but the debounce widens the window in which it can bite; this is the single genuine residual risk of the change.

## Migration / Rollout

No migration. Frontend-only; no schema, no API contract, no persisted format change. Single revert of the branch restores per-mutation sync (the three-module split reverts with it; no import site was edited, so nothing outside `domains/cart/services/` is involved).
