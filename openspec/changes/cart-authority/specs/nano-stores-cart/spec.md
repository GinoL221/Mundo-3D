# Delta for Nano Stores Cart

## ADDED Requirements

### Requirement: Hydration Writes Bypass the Debounce Scheduler

A local cart state write performed by server hydration (login-triggered or cart-page-triggered) MUST NOT arm `scheduleSync()`'s debounce timer or max-wait timer. Hydration replaces local state directly, exactly as `loadCartFromStorage()` does, without opening a new sync burst.

#### Scenario: Hydration write opens no burst

- GIVEN no debounce burst is currently pending
- WHEN `hydrateFromServer()` writes the reconciled cart into local state
- THEN no debounce timer or max-wait timer MUST be armed as a result
- AND no `PUT /api/cart` MUST be scheduled from this write alone

### Requirement: Post-Merge Sync Reuses the Existing Scheduler

The single `PUT /api/cart` produced by a guest/login cart merge MUST be issued through `scheduleSync()` followed by a synchronous `flushCartSync()` call — the same pattern `checkout()` uses — and MUST NOT call `syncToBackend()` directly.

#### Scenario: Merge PUT goes through scheduleSync and flushCartSync

- GIVEN a login-triggered merge has computed a merged cart to persist
- WHEN the merge result is synced to the server
- THEN `scheduleSync()` MUST be called with the merged items
- AND `flushCartSync()` MUST be called synchronously immediately after
- AND `syncToBackend()` MUST NOT be called directly for this write

#### Scenario: Merge PUT does not strand an already-pending burst

- GIVEN a debounce burst was already pending before the merge runs
- WHEN the merge calls `scheduleSync()` with the merged result and then `flushCartSync()`
- THEN exactly one `PUT /api/cart` MUST be sent, carrying the merged result
- AND the burst's original rollback baseline MUST NOT be lost
