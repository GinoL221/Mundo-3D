# Delta for Schema Migrations

## ADDED Requirements

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
