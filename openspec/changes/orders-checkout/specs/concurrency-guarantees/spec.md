# Delta for Concurrency Guarantees

## ADDED Requirements

### Requirement: Order Creation Idempotency and Concurrent Checkout Guarantee

A retried `POST /api/orders` request carrying the same `Idempotency-Key`
for the same user MUST NOT create a second order or apply a second stock
decrement: the unique violation on `(id_user, idempotency_key)` MUST abort
the retry's transaction, and the use case MUST return the already-committed
order. Concurrent, non-retried checkout requests from the same user MUST be
serialized by locking (`SELECT ... FOR UPDATE`) that user's `ACTIVE` cart
rows, so a second concurrent request observes an empty active cart. This
requirement does not extend to general stock-decrement concurrency across
different users/orders, which remains covered by `adjustStock`'s own
guarded conditional update and stays out of this capability's scope, as
already documented.

#### Scenario: Retried checkout replays instead of duplicating

- GIVEN an order already committed for `Idempotency-Key` K and user U
- WHEN user U retries `POST /api/orders` with the same key K
- THEN no second order or stock decrement MUST occur
- AND the original order MUST be returned

#### Scenario: Concurrent same-user checkouts serialize via cart lock

- GIVEN a user's `ACTIVE` cart and two concurrent `POST /api/orders` requests
  with distinct idempotency keys
- WHEN both requests are processed
- THEN the cart-row lock MUST ensure only one request observes a non-empty
  active cart
- AND exactly one order MUST be created from that cart's contents
