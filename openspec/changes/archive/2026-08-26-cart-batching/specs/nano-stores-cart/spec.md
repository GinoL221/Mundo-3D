# Delta for Nano Stores Cart

## MODIFIED Requirements

### Requirement: Asynchronous, Non-blocking API Synchronization

Local cart changes MUST trigger a background asynchronous PUT request to `/api/cart` to persist changes on the server, but the request itself MUST be debounced rather than sent per mutation. Multiple mutations that land within a trailing-edge debounce window of one another MUST be coalesced into a single PUT carrying the cart state as of the last mutation in that burst. A mutation stream sustained past a hard max-wait cap MUST still flush without waiting for a quiet period, so a continuous stream of mutations cannot indefinitely postpone the sync. The pending flush MUST also fire immediately, bypassing the remaining debounce window, when `checkout()` is called (synchronously, before `checkout()` returns), when the `pagehide` event fires, or when `visibilitychange` transitions the document to `hidden`. The UI-facing `cart-updated` event MUST continue to fire once per local mutation, immediately, independent of when the coalesced network flush happens. The `previousItems` snapshot a flush uses for rollback MUST be captured from before the first mutation of the coalesced burst, not from the most recent mutation, so that a failed flush restores the cart to the last state the server is known to have held. The UI must remain responsive and not block the user during synchronization.
(Previously: every mutation triggered its own immediate PUT with no coalescing; `previousItems` was the state immediately before that single mutation; there were no forced-flush triggers.)

#### Scenario: Rapid mutations coalesce into a single PUT

- GIVEN a logged-in user triggers several cart mutations (add/remove/clear) in quick succession
- WHEN each mutation lands within the debounce window of the previous one
- THEN exactly one `PUT /api/cart` request MUST be sent for the whole burst
- AND that request's payload MUST reflect the cart state as of the last mutation in the burst

#### Scenario: Sustained mutations still flush via the max-wait cap

- GIVEN a logged-in user keeps mutating the cart continuously, each mutation landing before the previous debounce window elapses
- WHEN the elapsed time since the first unflushed mutation of the burst reaches the max-wait cap
- THEN a `PUT /api/cart` request MUST be sent immediately, without waiting for a quiet period
- AND the debounce/cap cycle MUST restart for any further mutations that follow

#### Scenario: checkout() forces an immediate flush before returning

- GIVEN a logged-in user has pending, not-yet-flushed cart mutations
- WHEN `checkout()` is called
- THEN the pending flush MUST be dispatched synchronously before `checkout()` returns
- AND a caller relying on `checkout()`'s return value (e.g. to redirect) MUST NOT be able to navigate away before that flush has been dispatched

#### Scenario: Page hide forces an immediate flush

- GIVEN a logged-in user has pending, not-yet-flushed cart mutations
- WHEN the browser fires `pagehide`
- THEN the pending flush MUST be dispatched immediately, bypassing the remaining debounce window

#### Scenario: Tab becoming hidden forces an immediate flush

- GIVEN a logged-in user has pending, not-yet-flushed cart mutations
- WHEN the browser fires `visibilitychange` and the document's visibility is now `hidden`
- THEN the pending flush MUST be dispatched immediately, bypassing the remaining debounce window

#### Scenario: A failed flush rolls back to the state before the burst's first mutation

- GIVEN a burst of coalesced mutations starting from cart state S0 and ending at cart state Sn after the last mutation in the burst
- WHEN the resulting single flush's PUT request resolves with a non-ok response
- THEN the local cart state MUST roll back to S0, the state before the burst's first mutation
- AND MUST NOT roll back to the state before only the burst's last mutation

#### Scenario: Every flush preserves keepalive and the no-rollback-on-thrown-fetch-error behavior

- GIVEN a coalesced flush is dispatched to `/api/cart`
- WHEN the request is sent
- THEN it MUST include `keepalive: true`, exactly as a per-mutation sync did before this change
- AND WHEN `fetch()` itself throws instead of resolving (e.g. the request was cancelled by navigation) THEN the local cart state MUST NOT be rolled back, exactly as before this change

#### Scenario: A stale flush failure does not roll back a newer confirmed flush

- GIVEN an older coalesced flush and a newer coalesced flush are both in flight
- WHEN the older flush's failure response arrives after the newer flush has already resolved successfully
- THEN the older flush's failure MUST NOT roll back the cart state the newer flush already confirmed

#### Scenario: cart-updated still fires once per mutation, not once per flush

- GIVEN a user performs several rapid cart mutations that will be coalesced into a single network flush
- WHEN each individual mutation is applied to the local store
- THEN a `cart-updated` event MUST fire immediately for that mutation, independent of the network flush
- AND the number of `cart-updated` events dispatched MUST equal the number of mutations, not the number of coalesced network flushes
