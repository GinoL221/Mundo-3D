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

## Removed Requirements

### Requirement: Service Registration in Index

(Reason: The legacy JavaScript `CartService` is removed and replaced by Hexagonal use cases, so it is no longer exported from `src/services/index.js`.)
(Migration: Replace imports of `CartService` with instances of `GetCartByUserIdUseCase` or `GetCartDistinctCountUseCase`.)