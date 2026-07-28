# Delta for Architecture Verification Gate

## ADDED Requirements

### Requirement: Static Imports Resolve Fail Closed

The check MUST inspect static ESM import/export and CommonJS `require()`. Every local specifier MUST resolve; an unresolved local MUST block verification. External packages MUST be classified separately. Production, test, migration, tool, and configuration files MUST be distinct classes.

#### Scenario: Unresolved local blocks verification

- GIVEN an in-scope file references an unresolvable local specifier
- WHEN the standalone check runs
- THEN it exits non-zero and reports source and specifier

#### Scenario: External package is not a local failure

- GIVEN an in-scope file references an installed external package
- WHEN dependencies are classified
- THEN it is external, not unresolved local

#### Scenario: ESM and CommonJS are both enforced

- GIVEN equivalent forbidden edges use ESM import/export and static CommonJS `require()`
- WHEN the check runs
- THEN both are evaluated against the applicable rule

#### Scenario: Non-production edges do not create false violations

- GIVEN a test, migration, tool, or configuration file contains a cross-layer import
- WHEN production boundaries are evaluated
- THEN the edge creates no production violation

### Requirement: Composition Exceptions Are Narrow and Reviewable

Composition roots MUST use an exact, path-specific allowlist for startup, route, page, layout, component, and script surfaces. No directory-wide permission MAY create composition roots. Allowlist extensions MUST be reviewable. `.astro` internals MUST remain unparsed and MUST NOT imply dynamic coverage.

#### Scenario: Listed composition root is allowed

- GIVEN a listed startup or route file imports a concrete adapter
- WHEN its exact path matches the allowlist
- THEN it passes as an explicit exception

#### Scenario: Unlisted sibling is rejected

- GIVEN a similar file imports a concrete adapter
- WHEN its exact path is absent from the allowlist
- THEN it fails without directory inheritance

#### Scenario: Astro internals remain a limitation

- GIVEN an allowed `.astro` surface composes domains internally
- WHEN the check runs
- THEN it is not parsed and remains out of scope

### Requirement: Verification Evidence Is Actionable

Fixtures MUST prove green domain-to-port, application-to-port, adapter/database, external-package, and allowlisted-composition edges, plus red domain-to-infrastructure, application-to-database/concrete-adapter, database-to-production-layer, CommonJS outward, cross-domain, and unresolved-local edges. Diagnostics MUST identify source, target/specifier, and rule.

#### Scenario: Fixtures distinguish allowed and forbidden edges

- GIVEN the required green and red fixtures exist
- WHEN fixture verification runs
- THEN green cases pass and red cases fail with their expected rule

#### Scenario: Diagnostics support correction

- GIVEN a fixture violates a boundary
- WHEN verification reports the failure
- THEN it includes source, target or specifier, and rule

### Requirement: The Gate Blocks Independently Without Product Changes

The architecture check MUST be a standalone command that exits zero only when checked edges pass and non-zero for violations. Current CI MUST invoke it independently of `verification-baseline-and-ci-gates` and MUST block on non-zero or unavailable execution. The capability MUST NOT move production files, change runtime/product/schema/authentication/cart behavior, or exceed 250 lines per production source file. Rollback MUST remove only checker assets, command wiring, and CI invocation.

#### Scenario: Standalone command reports success

- GIVEN all checked edges are valid
- WHEN the standalone command runs
- THEN it exits zero

#### Scenario: CI blocks failure or unavailability

- GIVEN the command fails or cannot execute
- WHEN current CI runs the architecture step
- THEN CI fails rather than skipping the gate

#### Scenario: Baseline redesign is independent

- GIVEN `verification-baseline-and-ci-gates` is absent, blocked, or redesigned
- WHEN this command and CI step run
- THEN the architecture gate remains runnable

#### Scenario: Rollback preserves production

- GIVEN the guardrail is reverted
- WHEN checker assets, command wiring, and CI invocation are removed
- THEN runtime behavior and production file locations remain unchanged

## Explicit Limitations

Dynamic imports, constructed runtime `require()`, and `.astro` internals are not proven. No requirement promises coverage for these surfaces; they remain future extensions.
