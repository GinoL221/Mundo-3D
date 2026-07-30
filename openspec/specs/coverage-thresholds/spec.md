# Delta for Coverage Thresholds

## ADDED Requirements

### Requirement: Jest Coverage Collection Configuration

The system SHALL measure production JavaScript and TypeScript under `backend/src/`, explicitly classify and report exclusions, and retain the existing 50% global guardrails for branches, functions, lines, and statements until a measured, reviewed baseline justifies a change. Guardrails MUST NOT increase before that baseline.

#### Scenario: Source scope is reported

- GIVEN coverage is enabled
- WHEN the baseline is generated
- THEN production JavaScript and TypeScript under `backend/src/` are included, and exclusions are reported

#### Scenario: Guardrail fails below value

- GIVEN a guardrail is not met
- WHEN the coverage check runs
- THEN it returns non-zero and mandatory verification fails

#### Scenario: Guardrail passes at value

- GIVEN all guardrails are met
- WHEN the coverage check runs
- THEN it returns zero without requiring global 100% coverage

### Requirement: Reproducible Risk Baseline

The baseline MUST be reproducible from the same revision, dependencies, classification, and prerequisites. Uncovered behavior MUST be risk-classified; Tier 0 security, integrity, cart, stock, and migration gaps MUST be visible and prioritized.

#### Scenario: Baseline is honest

- GIVEN the baseline repeats or a pre-existing Tier 0 gap is found
- WHEN evidence is reviewed
- THEN classification is comparable; the gap is visible, not claimed fixed, and blocks only a declared mandatory check or current-change criterion
- AND remediation is assigned to a bounded follow-up unless explicitly included here

### Requirement: Meaningful High-Coverage Policy

High coverage MUST mean executable contracts at the cheapest useful layer, with stronger boundary evidence where infrastructure changes outcomes. A percentage alone MUST NOT define correctness.

#### Scenario: Behavior evidence leads

- GIVEN a behavior has an appropriate unit, boundary, integration, or E2E contract
- WHEN coverage quality is reviewed
- THEN contract evidence and risk classification are considered before percentage targets

### Requirement: Coverage Directory Output

The system SHALL output coverage reports to a `coverage/` directory at the backend package root (`backend/coverage/`).

#### Scenario: Coverage directory is created on run

- GIVEN Jest is configured with `coverageDirectory: 'coverage'` inside `backend/jest.config.js`
- WHEN `pnpm --filter backend test` is run with coverage enabled
- THEN a `coverage/` directory SHALL be created in the `backend/` package root containing the HTML and JSON coverage reports