# Delta for Franchise Service

## ADDED Requirements

### Requirement: Franchise Database Physical Migration

The system MUST physically migrate the MySQL database schema to rename existing `Franchise` table columns to snake_case (`id_franchise`, `name_franchise`).

#### Scenario: Column renaming migration run
- GIVEN the database has a `Franchise` table with older/incorrect column names (e.g. `IDFranchise`, `NameFranchise`)
- WHEN the physical schema migration is executed
- THEN the columns MUST be renamed to `id_franchise` and `name_franchise` respectively
- AND all existing data MUST be preserved without loss
