# Delta for FranchiseService

## ADDED Requirements

### Requirement: Franchise Lookup Operations

The system SHALL provide a `FranchiseService` module that encapsulates Sequelize lookups on the `Franchise` model, following the established service pattern.

FranchiseService MUST expose:
- `findAll()` — returns all franchises
- `findById(id)` — returns a single franchise by primary key, or `null` if not found

#### Scenario: Retrieve all franchises

- GIVEN 4 franchises exist in the database
- WHEN `FranchiseService.findAll()` is called
- THEN the service SHALL return an array of 4 franchise records

#### Scenario: Retrieve franchise by ID

- GIVEN a franchise with `IDFranchise` 2 exists
- WHEN `FranchiseService.findById(2)` is called
- THEN the service SHALL return the matching franchise record

#### Scenario: Franchise not found

- GIVEN no franchise with `IDFranchise` 9999 exists
- WHEN `FranchiseService.findById(9999)` is called
- THEN the service SHALL return `null`

### Requirement: Service Registration in Index

The system MUST register `FranchiseService` in `src/services/index.js`.

#### Scenario: FranchiseService is importable from services index

- GIVEN the index barrel export
- WHEN a controller imports `{ FranchiseService }` from `src/services`
- THEN `FranchiseService` MUST be a valid object with `findAll` and `findById` methods