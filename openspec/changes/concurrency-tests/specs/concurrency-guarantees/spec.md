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

The system SHOULD document, rather than fix, two known concurrency boundaries: migration checks and rate limiting. Boot-time migration verification (`checkNoPendingMigrations()`) is read-only and MUST NOT perform schema writes, so it introduces no migration race. The request rate limiter's `MemoryStore` is scoped per Node.js process; in a multi-process deployment, effective limits apply per process, not globally. This is an accepted scaling limitation, not a correctness guarantee, and is out of scope for a fix here. Stock decrement concurrency is explicitly OUT of scope for this capability — it is covered by its own existing test and behavior.

#### Scenario: Boot-time migration check performs no writes

- GIVEN the application boot sequence
- WHEN `checkNoPendingMigrations()` runs
- THEN it MUST only read migration state
- AND it MUST NOT execute any schema-altering (DDL) or data-writing operation

#### Scenario: Rate limit is enforced per process, not globally

- GIVEN a deployment running multiple backend processes behind a load balancer
- WHEN requests from the same client are distributed across processes
- THEN each process MUST enforce the configured limit independently against its own `MemoryStore`
- AND the effective combined limit across processes MAY exceed the configured single-process value
