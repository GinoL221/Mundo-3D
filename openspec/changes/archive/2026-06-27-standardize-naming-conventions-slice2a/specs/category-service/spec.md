# Delta for Category Service

## ADDED Requirements

### Requirement: Category Database Physical Migration

The system MUST physically migrate the MySQL database schema to rename existing `Category` table columns to snake_case (`id_category`, `name_category`).

#### Scenario: Column renaming migration run
- GIVEN the database has a `Category` table with older/incorrect column names (e.g. `IDCategory`, `NameCategory`)
- WHEN the physical schema migration is executed
- THEN the columns MUST be renamed to `id_category` and `name_category` respectively
- AND all existing data MUST be preserved without loss

### Requirement: Product API Category Payload and Frontend Integration

The Product API payload DTO MUST expose the nested category name as a camelCase key `category` (previously `Category`). The frontend application MUST consume this camelCase key to render the category name.

#### Scenario: Get product payload contains camelCase nested category
- GIVEN a product exists with an associated category
- WHEN requesting the product payload from the API
- THEN the response DTO MUST include the key `category` containing the category name string
- AND the response DTO MUST NOT contain the PascalCase key `Category`

#### Scenario: Frontend renders product category using camelCase property
- GIVEN the Astro frontend receives a list of products
- WHEN rendering the category name for a product
- THEN it MUST access `product.category` to retrieve the name
