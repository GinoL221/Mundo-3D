# Delta for Concurrency Guarantees

## Purpose

Document which concurrent-access behaviors of the backend are guaranteed, which are accepted last-write-wins tradeoffs, and which are out of scope for this capability. This is a documentation-and-test capability: it proves existing behavior with real-DB integration tests, it does not introduce new product behavior.

## ADDED Requirements

### Requirement: Cart Sync Last-Write-Wins (Accepted Tradeoff)

`SequelizeShoppingCartRepository.syncCart` MUST resolve two overlapping `PUT /api/cart` requests for the same user by commit order, not request-arrival order: whichever transaction commits last determines the final persisted set of ACTIVE cart rows, and the earlier-committing write's rows MUST be fully replaced. This is a documented, accepted tradeoff (see `archive/2026-07-30-cart-consistency`) and MUST NOT be treated as a defect. No optimistic-concurrency (version/ETag) mechanism is introduced by this requirement.

#### Scenario: Concurrent cart syncs resolve by commit order

- GIVEN a user with an existing ACTIVE cart
- WHEN two `PUT /api/cart` requests for that user are issued concurrently with different item payloads
- THEN the transaction that commits last MUST determine the final persisted ACTIVE cart rows
- AND the rows written by the earlier-committing transaction MUST NOT remain in the final state

#### Scenario: Losing write is not merged with the winning write

- GIVEN two concurrent `PUT /api/cart` requests with disjoint item sets for the same user
- WHEN both requests complete
- THEN the final cart MUST contain only the items from the last-committed request
- AND items unique to the earlier-committed request MUST NOT appear in the final cart

### Requirement: Documented Concurrency Non-Guarantees

The system SHOULD document, rather than fix, two known concurrency boundaries: migration checks and rate limiting. Boot-time migration verification (`checkNoPendingMigrations()`) is read-only and MUST NOT perform schema writes, so it introduces no migration race — this is testable in-process and MUST hold per the scenario below.

Separately, the request rate limiter's `MemoryStore` is scoped per Node.js process: in a multi-process deployment, each process enforces the configured limit independently against its own store, so the effective combined limit across processes may exceed the configured single-process value. This is an accepted scaling limitation, not a correctness guarantee, and is out of scope for a fix here. It is a property of a multi-process deployment topology, not of a single process, so it is NOT expressed as an executable scenario — an in-process test suite cannot exercise it. Source inspection confirms neither `loginLimiter` nor `registerLimiter` passes a `store` option, so both use the default per-process `MemoryStore`.

Stock decrement concurrency is explicitly OUT of scope for this capability — it is covered by its own existing test and behavior.

#### Scenario: Boot-time migration check performs no writes

- GIVEN the application boot sequence
- WHEN `checkNoPendingMigrations()` runs
- THEN it MUST only read migration state
- AND it MUST NOT execute any schema-altering (DDL) or data-writing operation

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
