# Delta for Coverage Thresholds

## ADDED Requirements

### Requirement: Jest Coverage Collection Configuration

The system SHALL configure Jest to collect coverage from all source files under `src/`, excluding `src/database/seed.js` and `src/app.js`.

The `jest.config.js` MUST include:
- `collectCoverageFrom`: array of glob patterns targeting `src/**/*.js` with negative patterns for `src/database/seed.js` and `src/app.js`
- `coverageDirectory`: set to `coverage`
- `coverageThresholds`: global thresholds set to 50% for branches, functions, lines, and statements

#### Scenario: Coverage is collected from source files only

- GIVEN the Jest configuration is applied
- WHEN `npm test -- --coverage` is run
- THEN Jest SHALL collect coverage from files matching `src/**/*.js`
- AND SHALL exclude `src/database/seed.js` and `src/app.js` from coverage collection

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

The system SHALL output coverage reports to a `coverage/` directory at the project root.

#### Scenario: Coverage directory is created on run

- GIVEN Jest is configured with `coverageDirectory: 'coverage'`
- WHEN `npm test -- --coverage` is run
- THEN a `coverage/` directory SHALL be created in the project root containing the HTML and JSON coverage reports