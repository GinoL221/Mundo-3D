# CI Verification Gates Specification

## Purpose

Provide verification evidence without product changes.

## Requirements

### Requirement: Intentional Verification Classes

CI MUST execute backend/frontend unit, real-database integration, E2E, strict backend type-check, frontend validation/build, lint, and coverage.

#### Scenario: Checks execute

- GIVEN prerequisites are available
- WHEN CI verifies
- THEN all execute; fast excludes JS/TS real-DB suites and integration retains them

### Requirement: Fail-Closed Mandatory Checks

Every mandatory check MUST block integration if it fails or cannot execute because a dependency, service, or runner is unavailable.

#### Scenario: Mandatory failure blocks integration

- GIVEN a mandatory check fails or cannot start
- WHEN eligibility is evaluated
- THEN integration is blocked and the reason is reported, never treated as success

### Requirement: Compatibility Boundary

The baseline MUST NOT change product behavior, persisted data, API/authentication/cart/stock semantics, or architecture.

#### Scenario: Verification-only update

- GIVEN verification configuration or documentation is updated
- WHEN product checks run
- THEN product contracts remain unchanged and only verification evidence changes
