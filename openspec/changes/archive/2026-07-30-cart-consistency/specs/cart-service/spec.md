# Delta for Cart Service

## ADDED Requirements

### Requirement: Duplicate Product ID Merge on Sync

When a `PUT /api/cart` payload contains multiple items with the same `productId`, `SyncCartUseCase` MUST merge them into a single persisted row per product by summing their quantities before persistence, instead of creating duplicate ACTIVE rows for the same product.

#### Scenario: Duplicate productId entries merge into a single row

- GIVEN a cart sync request with `items` containing `{productId: 10, quantity: 20}` and `{productId: 10, quantity: 15}`
- WHEN `SyncCartUseCase` processes the request
- THEN exactly one ACTIVE row MUST be persisted for `productId` 10
- AND its `quantity` MUST equal 35

#### Scenario: Merged quantity exceeding the ceiling rejects the whole request

- GIVEN a cart sync request with `items` containing `{productId: 10, quantity: 60}` twice
- WHEN `SyncCartUseCase` sums the duplicate entries to a merged quantity of 120
- THEN the request MUST be rejected with HTTP 400
- AND no row MUST be persisted for this sync (the merged quantity MUST NOT be silently capped at 99)

### Requirement: Use-Case Domain Invariant Enforcement

`SyncCartUseCase` MUST validate each merged item's quantity through the `ShoppingCart` domain entity's validation logic (`ShoppingCart.assertValidQuantity`) before calling `ShoppingCartRepositoryPort.syncCart`, so that an invalid quantity never reaches the persistence layer at all. This closes the gap where the validator's 1–99 range was previously enforced only on read, not on write.

#### Scenario: Use case invokes domain entity validation and rejects invalid quantity before calling the repository

- GIVEN a merged item with quantity 100 is about to be synced
- WHEN `SyncCartUseCase.execute` processes the merged items
- THEN the `ShoppingCart` domain entity validation MUST be invoked
- AND the request MUST be rejected with HTTP 400 before `ShoppingCartRepositoryPort.syncCart` is called
- AND no database row MUST be created

#### Scenario: Valid quantity persists via entity-validated use case

- GIVEN a merged item with quantity 99 is about to be synced
- WHEN `SyncCartUseCase.execute` processes the merged items
- THEN the domain entity validation MUST pass
- AND `ShoppingCartRepositoryPort.syncCart` MUST be called with the validated item
- AND the row MUST be persisted with quantity 99
- AND a subsequent `GET /api/cart` for that user MUST return HTTP 200
