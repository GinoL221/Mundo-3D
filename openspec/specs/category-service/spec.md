# Delta for CategoryService

## ADDED Requirements

### Requirement: Category Lookup Operations

The system SHALL provide a `CategoryService` module that encapsulates Sequelize lookups on the `Category` model, following the established service pattern.

CategoryService MUST expose:
- `findAll()` — returns all categories
- `findById(id)` — returns a single category by primary key, or `null` if not found

#### Scenario: Retrieve all categories

- GIVEN 5 categories exist in the database
- WHEN `CategoryService.findAll()` is called
- THEN the service SHALL return an array of 5 category records

#### Scenario: Retrieve category by ID

- GIVEN a category with `IDCategory` 1 exists
- WHEN `CategoryService.findById(1)` is called
- THEN the service SHALL return the matching category record

#### Scenario: Category not found

- GIVEN no category with `IDCategory` 9999 exists
- WHEN `CategoryService.findById(9999)` is called
- THEN the service SHALL return `null`

### Requirement: Service Registration in Index

The system MUST register `CategoryService` in `src/services/index.js`.

#### Scenario: CategoryService is importable from services index

- GIVEN the index barrel export
- WHEN a controller imports `{ CategoryService }` from `src/services`
- THEN `CategoryService` MUST be a valid object with `findAll` and `findById` methods