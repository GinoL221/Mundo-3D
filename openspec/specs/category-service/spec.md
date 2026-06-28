# Specification: Category Service

## Requirements

### Requirement: Category Lookup Operations

The system SHALL provide a `CategoryService` module that encapsulates Sequelize lookups on the `Category` model, following the established service pattern.

CategoryService and Category Sequelize model MUST support camelCase naming conventions for attributes, while mapping them to snake_case database columns. Backward compatibility for legacy PascalCase fields MUST be preserved using Sequelize getterMethods.

- **camelCase Properties**:
  - `idCategory` (corresponds to legacy `IDCategory`)
  - `nameCategory` (corresponds to legacy `NameCategory`)
- **snake_case Database Columns**:
  - `id_category`
  - `name_category`

#### Scenario: Retrieve all categories

- GIVEN 5 categories exist in the database with snake_case columns (`id_category`, `name_category`)
- WHEN `CategoryService.findAll()` is called
- THEN the service SHALL return an array of 5 category records
- AND each returned category record MUST expose properties `idCategory` and `nameCategory` in camelCase
- AND each returned category record MUST expose legacy getters `IDCategory` and `NameCategory` in PascalCase for backward compatibility

#### Scenario: Retrieve category by ID

- GIVEN a category with `id_category` 1 exists in the database
- WHEN `CategoryService.findById(1)` is called
- THEN the service SHALL return the matching category record
- AND the returned category record MUST expose properties `idCategory` and `nameCategory` in camelCase
- AND the returned category record MUST expose legacy getters `IDCategory` and `NameCategory` in PascalCase for backward compatibility

#### Scenario: Category not found

- GIVEN no category with `id_category` 9999 exists
- WHEN `CategoryService.findById(9999)` is called
- THEN the service SHALL return `null`

### Requirement: Service Registration in Index

The system MUST register `CategoryService` in `src/services/index.js`.

#### Scenario: CategoryService is importable from services index

- GIVEN the index barrel export
- WHEN a controller imports `{ CategoryService }` from `src/services`
- THEN `CategoryService` MUST be a valid object with `findAll` and `findById` methods

### Requirement: Category Domain Entity and DTO Naming Conventions

The Category Domain Entity (`src/domain/entities/Category.ts`) and DTO (`src/application/dtos/CategoryDTO.ts`) MUST use camelCase naming conventions exclusively.

#### Scenario: Category Domain Entity instantiation

- GIVEN the `Category` domain class
- WHEN instantiating a category entity
- THEN it MUST accept and expose properties `idCategory` and `nameCategory` in camelCase

#### Scenario: Category DTO interface structure

- GIVEN the `CategoryDTO` interface
- WHEN a payload maps to `CategoryDTO`
- THEN it MUST define properties `idCategory` (number) and `nameCategory` (string) in camelCase

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