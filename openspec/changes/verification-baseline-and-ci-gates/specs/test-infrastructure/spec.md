# Delta for Test Infrastructure

## ADDED Requirements

### Requirement: Deterministic Test-Class Selection

The workspace MUST provide a fast command excluding `.integration.test.js` and `.integration.test.ts` real-database suites, and a dedicated command retaining them.

#### Scenario: Commands are distinct

- GIVEN both integration extensions exist
- WHEN fast tests run without MySQL
- THEN the suites are not selected
- AND WHEN integration runs with MySQL
- THEN both suites run and report

### Requirement: Reproducible Type and Frontend Validation

Backend strict type-checking and frontend validation/build MUST run independently of fast tests and fail when validation cannot complete.

#### Scenario: Validation is actionable

- GIVEN backend and frontend checks run over their declared scopes
- WHEN each scope is valid or invalid
- THEN valid checks succeed, invalid checks return non-zero, and neither scope is silently omitted

### Requirement: Command and Documentation Consistency

Testing documentation MUST describe commands and evidence matching observable workspace behavior, including package manager and test classes.

#### Scenario: Documentation matches execution

- GIVEN a contributor follows a documented command
- WHEN it runs in the workspace
- THEN selection and success/failure meaning match the documented contract
