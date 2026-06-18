# Cart Domain Specification

## Purpose

Defines the `ShoppingCart` domain entity and `CartStatus` constraints, ensuring type safety, stock limits, and price drift verification in the cart module.

## Requirements

### Requirement: Domain Entity Structure

The `ShoppingCart` domain entity MUST expose the properties: `idCart` (number), `idUser` (number), `idProduct` (number), `quantity` (number), `unitPrice` (number), and `status` (`CartStatus`).
`CartStatus` MUST be an enum representing `ACTIVE`, `ORDERED`, and `ABANDONED` statuses.

#### Scenario: Create a valid domain entity

- GIVEN a cart item with quantity 2, status ACTIVE, and price 150
- WHEN the domain entity is instantiated
- THEN the entity SHALL be successfully created with status ACTIVE

### Requirement: Stock Limits Validation

The cart item `quantity` MUST be an integer greater than 0, and it MUST NOT exceed the maximum stock boundary limit of 10.

#### Scenario: Exceeding quantity limit

- GIVEN a quantity of 11
- WHEN instantiating the domain entity
- THEN the entity validation SHALL throw a validation error

### Requirement: Price Drift Detection

The domain entity MUST expose a method or read-only attribute to detect if its `unitPrice` differs from the current active product price.

#### Scenario: Price drift identified

- GIVEN an entity with `unitPrice` of 100
- WHEN comparing it to an active product price of 120
- THEN the entity SHALL flag that a price drift has occurred
