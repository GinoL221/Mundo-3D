# Delta for CartService

## ADDED Requirements

### Requirement: ShoppingCart CRUD Operations

The system SHALL provide a `CartService` module that encapsulates all Sequelize operations on the `ShoppingCart` model, following the established service pattern (object literal, async methods, `module.exports`).

CartService MUST expose:
- `findByUserId(userId)` — returns all cart items for a user with included `Product` association
- `findAll()` — returns all cart items

#### Scenario: Find cart items by user ID with product details

- GIVEN a user with ID 5 has 3 items in their shopping cart
- WHEN `CartService.findByUserId(5)` is called
- THEN the service SHALL return an array of 3 cart items, each including the associated `Product` data
- AND the Sequelize query MUST use `include: [{ model: Product, as: 'product' }]`

#### Scenario: Find cart for non-existent user

- GIVEN no shopping cart entries exist for user ID 9999
- WHEN `CartService.findByUserId(9999)` is called
- THEN the service SHALL return an empty array

### Requirement: Service Registration in Index

The system MUST register `CartService` in `src/services/index.js` alongside existing `ProductService` and `UserService`.

#### Scenario: CartService is importable from services index

- GIVEN the service layer index file at `src/services/index.js`
- WHEN a controller imports `{ CartService }` from the services barrel export
- THEN `CartService` MUST be a valid object with the `findByUserId` and `findAll` methods