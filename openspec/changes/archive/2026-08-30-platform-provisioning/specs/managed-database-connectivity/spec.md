# Managed Database Connectivity Specification

## Purpose

Production connects to a managed database provider over a non-standard port with mandatory TLS, and never issues `CREATE DATABASE`. Development and test connection behavior is untouched.

## Requirements

### Requirement: Production Database Port and TLS

In `NODE_ENV=production` the database connection (application runtime and the migrator) MUST use a configurable port from `DB_PORT` and MUST enforce TLS with CA verification: `dialectOptions.ssl` MUST be set with the CA certificate from `DB_CA_CERT` and `rejectUnauthorized: true`. `rejectUnauthorized: false` MUST NOT be used anywhere. Development and test connection behavior MUST be unchanged — no port override and no TLS enforcement introduced by this capability.

#### Scenario: Production connects over the configured port with verified TLS

- GIVEN `NODE_ENV=production` with `DB_PORT` and `DB_CA_CERT` set
- WHEN the application or the migrator opens a database connection
- THEN it MUST connect on `DB_PORT` and present TLS using the CA from `DB_CA_CERT` with `rejectUnauthorized: true`

#### Scenario: Non-production connection behavior is unchanged

- GIVEN `NODE_ENV` is `development` or `test`
- WHEN a database connection is opened
- THEN no `DB_PORT` override and no TLS enforcement from this capability MUST apply

#### Scenario: Insecure TLS is rejected

- GIVEN the production database configuration
- WHEN it is inspected
- THEN `rejectUnauthorized: false` MUST NOT be present

### Requirement: No Database Creation in Production

In `NODE_ENV=production` the boot sequence MUST NOT attempt `CREATE DATABASE`; the managed database pre-exists and the scoped user lacks that privilege. Non-production boot MUST still ensure the database exists as before. Boot MUST remain fail-closed: genuine connection or authentication failures MUST still abort startup with a non-zero exit.

#### Scenario: Production boot skips database creation

- GIVEN `NODE_ENV=production`
- WHEN the boot sequence runs its database-existence step
- THEN it MUST return without issuing `CREATE DATABASE`
- AND boot MUST continue to authenticate, run the migration gate, and listen

#### Scenario: Non-production still creates the database

- GIVEN `NODE_ENV` is `development` or `test` and the database is absent
- WHEN the boot sequence runs
- THEN it MUST create the database as before

#### Scenario: A real connection failure still aborts boot

- GIVEN `NODE_ENV=production` and the database is unreachable or the credentials are invalid
- WHEN the boot sequence runs
- THEN the process MUST exit non-zero
