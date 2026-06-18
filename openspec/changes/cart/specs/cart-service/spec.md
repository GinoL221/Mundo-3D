# Delta for Cart Service

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Service Registration in Index

(Reason: The legacy JavaScript `CartService` is removed and replaced by Hexagonal use cases, so it is no longer exported from `src/services/index.js`.)
(Migration: Replace imports of `CartService` with instances of `GetCartByUserIdUseCase` or `GetCartDistinctCountUseCase`.)
