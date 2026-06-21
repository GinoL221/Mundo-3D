# Delta Spec: Cart Domain (Slice 2C)

This delta specification defines the database field mappings and backward compatibility getters for the `ShoppingCart` model, extending the original Cart Domain Specification.

## Database Mapping Requirements

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

## Backward Compatibility Requirements

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
