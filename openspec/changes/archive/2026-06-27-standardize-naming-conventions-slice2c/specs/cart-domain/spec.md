# Cart Domain Delta Specification (Slice 2C)

This delta specification defines the physical database migration requirements to transition the `ShoppingCart` table to snake_case column naming, aligning with the project's standardized domain mapping.

## Requirements

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
