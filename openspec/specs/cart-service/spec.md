# Cart Service Specification

## Purpose

Defines the application use cases and repository ports for retrieving and managing shopping carts, replacing legacy JavaScript service modules.

## Requirements

### Requirement: ShoppingCart CRUD Operations

The system SHALL define a repository port `IShoppingCartRepository` and implement a `SequelizeShoppingCartRepository` adapter to interact with the database. The system MUST expose use cases `GetCartByUserIdUseCase` and `GetCartDistinctCountUseCase` to encapsulate cart queries instead of a legacy JavaScript service.
(Previously: The system SHALL provide a JS CartService module encapsulating Sequelize operations on the ShoppingCart model.)

#### Scenario: Find cart items by user ID with product details

- GIVEN a user with ID 5 has 3 items in their shopping cart
- WHEN `GetCartByUserIdUseCase.execute(5)` is executed
- THEN the use case SHALL return an array of 3 cart items, each mapped to the DTO contract
- AND each item MUST include its associated product details

#### Scenario: Find cart for non-existent user

- GIVEN no shopping cart entries exist for user ID 9999
- WHEN `GetCartByUserIdUseCase.execute(9999)` is executed
- THEN the use case SHALL return an empty array

### Requirement: Cart Sync Payload Validation

All cart sync requests MUST validate the `items` array using `express-validator`. Each item MUST include a valid product identifier and a `quantity` field bounded to a minimum of 1 and a maximum of 99. Requests with invalid payloads MUST throw a `CartValidationException` and return HTTP 400.

#### Scenario: Valid cart sync payload is accepted

- GIVEN a cart sync request with `items` containing `{ productId: 10, quantity: 3 }`
- WHEN the validation middleware processes the request
- THEN the request MUST pass validation
- AND proceed to the sync use case

#### Scenario: Cart sync rejects out-of-range quantity

- GIVEN a cart sync request with `items` containing `{ productId: 10, quantity: 0 }`
- WHEN the validation middleware processes the request
- THEN a `CartValidationException` MUST be thrown
- AND the response status MUST be 400 Bad Request

#### Scenario: Cart sync rejects missing product identifier

- GIVEN a cart sync request with `items` containing `{ quantity: 5 }` (no product ID)
- WHEN the validation middleware processes the request
- THEN a `CartValidationException` MUST be thrown
- AND the response status MUST be 400 Bad Request

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

### Requirement: Standardized Sync API Request Payload

The Cart Sync REST API endpoint (specifically `PUT /api/cart` or the synchronization controller) MUST strictly require camelCase properties for each item in the payload. The legacy PascalCase / mixed-casing properties (such as `idProduct`) MUST be deprecated and rejected or ignored.

- The request body payload structure MUST contain an array of items where each item has:
  - `productId` (number, required) representing the product identifier.
  - `quantity` (number, required) representing the quantity.
- Fallback processing for `idProduct` in the request body is deprecated and MUST be removed.

#### Scenario: Sync request payload containing only standard camelCase properties passes validation

- GIVEN a cart sync request is received with body: `{"items": [{"productId": 12, "quantity": 2}]}`
- WHEN the cart validation middleware processes the request
- THEN the request validation SHALL succeed
- AND the request is passed to the SyncCartUseCase

#### Scenario: Sync request payload containing legacy idProduct fails validation

- GIVEN a cart sync request is received with body: `{"items": [{"idProduct": 12, "quantity": 2}]}`
- WHEN the cart validation middleware processes the request
- THEN a validation error SHALL be raised
- AND the response MUST return HTTP status 400 Bad Request

### Requirement: Astro Frontend Cart Store Standardized Sync Payload

The Astro frontend application's cart store (`frontend/src/store/cart.ts`) MUST construct the sync request payload using standard camelCase properties, specifically sending `productId` in place of the legacy `idProduct` attribute.

#### Scenario: Astro cart store dispatches sync request with standardized property names

- GIVEN the user updates the cart in the frontend Astro UI
- WHEN the `syncToBackend` function is triggered to synchronize the local state
- THEN the HTTP request dispatched to the backend API MUST include `productId` (instead of `idProduct`) in the serialized JSON body

## Removed Requirements

### Requirement: Service Registration in Index

(Reason: The legacy JavaScript `CartService` is removed and replaced by Hexagonal use cases, so it is no longer exported from `src/services/index.js`.)
(Migration: Replace imports of `CartService` with instances of `GetCartByUserIdUseCase` or `GetCartDistinctCountUseCase`.)