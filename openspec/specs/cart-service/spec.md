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