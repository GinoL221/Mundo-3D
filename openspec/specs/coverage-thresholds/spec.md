# Delta for Coverage Thresholds

## ADDED Requirements

### Requirement: Jest Coverage Collection Configuration

The system SHALL configure Jest to collect coverage from all source files under `backend/src/`, excluding `backend/src/database/seed.js` and `backend/src/app.js`.

The `backend/jest.config.js` MUST include:
- `collectCoverageFrom`: array of glob patterns targeting `src/**/*.js` (relative to configuration root) with negative patterns for `src/database/seed.js` and `src/app.js`
- `coverageDirectory`: set to `coverage`
- `coverageThresholds`: global thresholds set to 50% for branches, functions, lines, and statements

#### Scenario: Coverage is collected from source files only

- GIVEN the Jest configuration is applied
- WHEN `pnpm --filter backend test` is run with coverage enabled
- THEN Jest SHALL collect coverage from files matching `backend/src/**/*.js`
- AND SHALL exclude `backend/src/database/seed.js` and `backend/src/app.js` from coverage collection

#### Scenario: Build fails below 50% coverage

- GIVEN the global coverage thresholds are set to 50%
- WHEN any coverage metric (branches, functions, lines, statements) falls below 50%
- THEN Jest SHALL exit with a non-zero status code
- AND the CI pipeline MUST fail

#### Scenario: Build passes at or above 50% coverage

- GIVEN the global coverage thresholds are set to 50%
- WHEN all coverage metrics are at or above 50%
- THEN Jest SHALL exit with status code 0

### Requirement: Coverage Directory Output

The system SHALL output coverage reports to a `coverage/` directory at the backend package root (`backend/coverage/`).

#### Scenario: Coverage directory is created on run

- GIVEN Jest is configured with `coverageDirectory: 'coverage'` inside `backend/jest.config.js`
- WHEN `pnpm --filter backend test` is run with coverage enabled
- THEN a `coverage/` directory SHALL be created in the `backend/` package root containing the HTML and JSON coverage reports