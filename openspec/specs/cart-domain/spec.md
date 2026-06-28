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

### Requirement: Database snake_case Mapping

The `ShoppingCart` model attributes MUST map to snake_case column names in the database.

- **`idCart`** (camelCase attribute) maps to database column **`id_cart`** (PK, AUTO_INCREMENT).
- **`idUser`** (camelCase attribute) maps to database column **`id_user`** (FK to User).
- **`idProduct`** (camelCase attribute) maps to database column **`id_product`** (FK to Product).
- **`quantity`** (camelCase attribute) maps to database column **`quantity`**.
- **`unitPrice`** (camelCase attribute) maps to database column **`unit_price`**.
- **`status`** (camelCase attribute) maps to database column **`cart_status`**.

#### Scenario: Database schema mapping matches conventions

- GIVEN the Sequelize model for `ShoppingCart` is defined
- WHEN the database is synchronized
- THEN the table column names MUST be in snake_case (`id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, `cart_status`)

### Requirement: Physical MySQL Database Migration to snake_case

The database migration MUST physically rename the columns of the `ShoppingCart` table to snake_case to ensure consistency with the standardized Sequelize model mapping.

- Rename `idCart` (or any legacy equivalent column) to `id_cart` (Primary Key, Auto Increment).
- Rename `idUser` (or any legacy equivalent column) to `id_user` (Foreign Key referencing the users table).
- Rename `idProduct` (or any legacy equivalent column) to `id_product` (Foreign Key referencing the products table).
- Rename `quantity` column to `quantity`.
- Rename `unitPrice` column to `unit_price`.
- Rename `cartStatus` column to `cart_status`.

#### Scenario: Database schema columns renamed physically in MySQL

- GIVEN the database migration script runs against a MySQL database containing a `ShoppingCart` table with old column names
- WHEN the migration execution completes
- THEN the columns in the `ShoppingCart` table SHALL be renamed to `id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, and `cart_status` respectively
- AND the foreign key constraints to users and products tables MUST be preserved under their new column names

### Requirement: Legacy PascalCase Getters

To prevent breaking existing code during migration, the `ShoppingCart` model and domain entity MUST expose getter methods mapping legacy PascalCase properties to their standard camelCase counterparts.

- `IDCart` -> returns `idCart`
- `IDUser` -> returns `idUser`
- `IDProduct` -> returns `idProduct`
- `Quantity` -> returns `quantity`
- `UnitPrice` -> returns `unitPrice`
- `CartStatus` -> returns `status`

#### Scenario: Legacy getters support backward compatibility

- GIVEN a `ShoppingCart` entity or model instance with standard camelCase values
- WHEN accessing legacy PascalCase properties (`IDCart`, `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, `CartStatus`)
- THEN they SHALL return the corresponding camelCase property values
