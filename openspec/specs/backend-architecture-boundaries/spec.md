# Delta for Backend Architecture Boundaries

## ADDED Requirements

### Requirement: Domain Dependencies Stay Inward

Backend production domain modules MUST depend only on domain entities, ports, exceptions, and standard language types. They MUST NOT depend on infrastructure, database, framework, filesystem/network/process I/O, or UI modules.

#### Scenario: Domain contract dependency is accepted

- GIVEN a production domain module imports a domain entity and a port
- WHEN the architecture check resolves the static dependency
- THEN the dependency passes without a boundary violation

#### Scenario: Domain outward dependency is rejected

- GIVEN a production domain module imports Express, Sequelize, database, infrastructure, UI, or I/O code
- WHEN the architecture check runs
- THEN it fails and identifies the source, resolved target, and violated domain rule

### Requirement: Application Uses Abstract Contracts

Backend production application modules MUST depend on domain ports, entities, exceptions, and application DTOs. They MUST NOT depend on concrete adapters, database modules, framework modules, I/O modules, or UI modules.

#### Scenario: Application port dependency is accepted

- GIVEN a use case imports a domain port, entity, exception, or application DTO
- WHEN the architecture check resolves the dependency
- THEN the dependency passes as an allowed application contract

#### Scenario: Application concrete dependency is rejected

- GIVEN a use case imports a concrete repository, database model, Express module, or filesystem module
- WHEN the architecture check runs
- THEN it fails with the source, target, and violated application rule

### Requirement: Database Production Code Remains Isolated

Production database modules MUST NOT import production domain, application, or infrastructure modules. Database internals MAY depend on their database configuration, ORM, and standard supporting packages.

#### Scenario: Database implementation dependency is accepted

- GIVEN a production database module imports its ORM or database configuration
- WHEN the architecture check resolves the dependency
- THEN no database boundary violation is reported

#### Scenario: Database inward dependency is rejected

- GIVEN a production database module imports a domain entity, use case, controller, or other infrastructure module
- WHEN the architecture check runs
- THEN it fails and identifies the forbidden target and database rule

### Requirement: Backend Static Module Forms Are Classified

The check MUST evaluate static ESM imports/exports and CommonJS `require()` references in backend scope. Production, test, migration, tool, and configuration files MUST be classified separately so test-only edges do not create production violations.

#### Scenario: CommonJS outward edge is enforced

- GIVEN a production CommonJS module requires a forbidden infrastructure or database target
- WHEN the architecture check runs
- THEN it reports the same boundary violation class as an equivalent static ESM edge

#### Scenario: Non-production edge does not create a false violation

- GIVEN a test, migration, tool, or configuration file imports a production adapter or framework module
- WHEN the architecture check evaluates production boundaries
- THEN that edge does not create a production architecture violation
