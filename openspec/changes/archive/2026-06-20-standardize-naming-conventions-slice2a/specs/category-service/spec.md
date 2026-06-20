# Delta Specification: Category Service Naming Convention Standardization

This delta specification modifies [openspec/specs/category-service/spec.md](file:///home/ginopc/Desarrollo/Mundo-3D/openspec/specs/category-service/spec.md) to standardize naming conventions to camelCase properties and snake_case database columns for Category model and service operations.

## MODIFIED Requirements

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

## ADDED Requirements

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
