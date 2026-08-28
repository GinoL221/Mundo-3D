# Schema Migrations Specification

## Purpose

Defines how the backend manages database schema changes: an explicit, tracked
Umzug migration runner replaces implicit `sync({ alter: true })` on boot, and
the boot path fails fast on schema mismatch instead of mutating or silently
tolerating it.

## Requirements

### Requirement: Boot Must Not Mutate or Auto-Migrate Schema

The application boot path (`backend/index.js`) MUST NOT call
`sequelize.sync({ alter: true })` or any other schema-mutating sync call.
The boot path MUST NOT automatically invoke the migration runner, even in
pre-production/dev-only stages. Migrations MUST only be applied via an
explicit manual command (e.g. `npm run db:migrate`).

#### Scenario: Boot connects without altering schema

- GIVEN the database exists and is reachable
- WHEN the application boots
- THEN the app establishes a database connection
- AND no ALTER/CREATE/sync schema-mutating call is issued

#### Scenario: Boot fails fast on missing or incompatible schema

- GIVEN the database is reachable but a table required by the app's models
  is missing or incompatible
- WHEN the application boots
- THEN the app SHALL refuse to start accepting requests and SHALL exit or
  log a clear, actionable startup error identifying the schema problem
- AND it SHALL NOT start serving traffic that would only fail later on
  first query

### Requirement: Migration Runner Applies and Tracks Migrations

An explicit script MUST apply all pending Umzug migrations in order and
record each applied migration in a persisted tracking table.

#### Scenario: Applying pending migrations

- GIVEN pending migrations not yet recorded in the tracking table
- WHEN the migrate command runs
- THEN each pending migration applies in order
- AND each applied migration is recorded in the tracking table

#### Scenario: Idempotent re-run with nothing pending

- GIVEN all migrations are already recorded in the tracking table
- WHEN the migrate command runs again
- THEN no migration applies
- AND the command exits successfully with no error

### Requirement: Rollback of Most Recent Migration

The migration runner MUST support rolling back (`down`) the most recently
applied migration on demand.

#### Scenario: Rolling back the last migration

- GIVEN at least one migration is applied and recorded
- WHEN the rollback command runs
- THEN the most recently applied migration's `down` logic executes
- AND its record is removed from the tracking table

### Requirement: Baseline for Pre-Existing Schemas

An environment whose schema was already built by the legacy `sync()`
mechanism MUST be markable as having the existing migrations already
applied (baseline), without re-running the wrapped migrations'
ALTER/rename statements against a database that already matches the
target schema.

#### Scenario: Baselining a converged database

- GIVEN a database whose schema already matches the target schema (built
  via the legacy sync mechanism)
- WHEN the baseline procedure runs
- THEN the tracking table records the existing migrations as applied
- AND no ALTER/rename statement from those migrations executes against
  the database

### Requirement: Legacy Schema Consolidated Into a Single Baseline Migration

The 3 existing SQL files in `backend/src/database/migrations/` (rename
category/franchise columns, rename product columns, add product stock)
MUST be consolidated into a single tracked Umzug baseline migration whose
`up()` logic is generated from a live schema dump of a database the 3
originals have already converged (ground truth), not transcribed from
model source. The baseline's resulting schema MUST be equivalent to the
net effect of applying the 3 original SQL files in sequence (final
snake_case column names, and the `stock` column present on `Product`).
The 3 original SQL files MUST be deleted once the baseline migration
supersedes them.

#### Scenario: Baseline migration reproduces the net effect of the 3 originals

- GIVEN a fresh, empty database
- WHEN the baseline migration's up logic runs
- THEN the resulting schema matches the final shape produced by applying
  the 3 original SQL files in sequence
- AND the migration is discoverable and orderable by the runner

#### Scenario: Legacy SQL files are removed once superseded

- GIVEN the baseline migration exists and reproduces the 3 originals' net
  schema effect
- WHEN the change is applied
- THEN the 3 original SQL files are deleted from
  `backend/src/database/migrations/`
- AND no code references their old file paths

### Requirement: Environment-Aware Database Existence Check

`ensureDatabaseExists` MUST use the actual resolved environment (e.g.
`process.env.NODE_ENV` with its existing fallback), not a hardcoded
`"development"` literal.

#### Scenario: Non-development environment resolves its own config

- GIVEN `NODE_ENV` is set to a value other than `development` (e.g.
  `production` or `test`)
- WHEN `ensureDatabaseExists` runs during boot
- THEN it checks/creates the database for that resolved environment's
  configuration
- AND it does not fall back to the `development` database config

### Requirement: Test/E2E Bootstrap Paths Remain Unchanged

This change MUST NOT modify `backend/src/database/test-prepare.js` or
`backend/src/__tests__/helpers/testDb.ts`. These remain independent
test/e2e database bootstrap mechanisms outside the migration runner's
scope.

#### Scenario: Test suite bootstrap is untouched

- GIVEN the integration and e2e test suites use their existing bootstrap
  scripts
- WHEN this change is applied
- THEN `test-prepare.js` and `testDb.ts` behavior and content are
  unchanged

### Requirement: Order and OrderItem Migration Matches Baseline Conventions

The `Order`/`OrderItem` migration MUST be a hand-written raw-SQL migration
following `20260724000000-baseline.js` conventions: explicit
`fk_<table>_<referenced-table>` foreign key names, snake_case columns, and
`utf8mb4` charset. It MUST include a `UNIQUE (id_user, idempotency_key)`
constraint, and MUST be discoverable and applied by the existing migration
runner alongside the rest of the applied set. Its `down` MUST drop
`OrderItem` before `Order`, respecting FK order.

#### Scenario: Migration follows baseline conventions

- GIVEN the `Order`/`OrderItem` migration's `up` logic
- WHEN it runs against a fresh database
- THEN the resulting tables MUST use snake_case columns, `utf8mb4` charset,
  and `fk_<table>_<referenced-table>`-named foreign keys
- AND a `UNIQUE (id_user, idempotency_key)` constraint MUST exist on `Order`

#### Scenario: Down migration drops tables in FK order

- GIVEN the migration has been applied
- WHEN its `down` logic runs
- THEN `OrderItem` MUST be dropped before `Order`
