# Delta Specification: Franchise Service Naming Convention Standardization

This delta specification modifies [openspec/specs/franchise-service/spec.md](file:///home/ginopc/Desarrollo/Mundo-3D/openspec/specs/franchise-service/spec.md) to standardize naming conventions to camelCase properties and snake_case database columns for Franchise model and service operations.

## MODIFIED Requirements

### Requirement: Franchise Lookup Operations

The system SHALL provide a `FranchiseService` module that encapsulates Sequelize lookups on the `Franchise` model, following the established service pattern.

FranchiseService and Franchise Sequelize model MUST support camelCase naming conventions for attributes, while mapping them to snake_case database columns. Backward compatibility for legacy PascalCase fields MUST be preserved using Sequelize getterMethods.

- **camelCase Properties**:
  - `idFranchise` (corresponds to legacy `IDFranchise`)
  - `nameFranchise` (corresponds to legacy `NameFranchise`)
- **snake_case Database Columns**:
  - `id_franchise`
  - `name_franchise`

#### Scenario: Retrieve all franchises

- GIVEN 4 franchises exist in the database with snake_case columns (`id_franchise`, `name_franchise`)
- WHEN `FranchiseService.findAll()` is called
- THEN the service SHALL return an array of 4 franchise records
- AND each returned franchise record MUST expose properties `idFranchise` and `nameFranchise` in camelCase
- AND each returned franchise record MUST expose legacy getters `IDFranchise` and `NameFranchise` in PascalCase for backward compatibility

#### Scenario: Retrieve franchise by ID

- GIVEN a franchise with `id_franchise` 2 exists in the database
- WHEN `FranchiseService.findById(2)` is called
- THEN the service SHALL return the matching franchise record
- AND the returned franchise record MUST expose properties `idFranchise` and `nameFranchise` in camelCase
- AND the returned franchise record MUST expose legacy getters `IDFranchise` and `NameFranchise` in PascalCase for backward compatibility

#### Scenario: Franchise not found

- GIVEN no franchise with `id_franchise` 9999 exists
- WHEN `FranchiseService.findById(9999)` is called
- THEN the service SHALL return `null`

## ADDED Requirements

### Requirement: Franchise Domain Entity and DTO Naming Conventions

The Franchise Domain Entity (`src/domain/entities/Franchise.ts`) and any Franchise DTOs MUST use camelCase naming conventions exclusively.

#### Scenario: Franchise Domain Entity instantiation

- GIVEN the `Franchise` domain class
- WHEN instantiating a franchise entity
- THEN it MUST accept and expose properties `idFranchise` and `nameFranchise` in camelCase

#### Scenario: Franchise DTO interface structure

- GIVEN a Franchise DTO interface
- WHEN a payload maps to it
- THEN it MUST define properties `idFranchise` (number) and `nameFranchise` (string) in camelCase
