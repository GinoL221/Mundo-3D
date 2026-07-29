# Delta for Architecture Verification Gate

## MODIFIED Requirements

### Requirement: Static Imports Resolve Fail Closed

The check MUST inspect static ESM import/export and CommonJS `require()`. Every local specifier MUST resolve; unresolved locals MUST block. Explicit local `.astro` specifiers MUST resolve only to exact existing files under the repository root; resolved targets are ordinary local edges and MUST NOT be parsed. Missing, outside-repository, non-local, directory, and ambiguous `.astro` references MUST remain unresolved; no broad fallback is permitted. External packages MUST be separate; production, test, migration, tool, and configuration files MUST remain distinct.
(Previously: resolution lacked an exact existing-`.astro` fallback.)

#### Scenario: Existing Astro target resolves

- GIVEN an in-scope file references an explicit local `.astro` specifier with an exact repository-root file
- WHEN the standalone check resolves the edge
- THEN it resolves as a local edge under the applicable rule

#### Scenario: Astro target is opaque

- GIVEN an explicit local `.astro` target exists
- WHEN the edge is resolved
- THEN it is an ordinary local edge and its internals are not parsed

#### Scenario: Invalid Astro fails closed

- GIVEN a `.astro` reference is missing, outside, non-local, a directory, or ambiguous
- WHEN the standalone check resolves it
- THEN it remains unresolved, blocks verification, with no broad fallback

#### Scenario: Unresolved local blocks

- GIVEN an in-scope file references an unresolvable local specifier
- WHEN the standalone check runs
- THEN it exits non-zero and reports source and specifier

#### Scenario: External package classification

- GIVEN an in-scope file references an installed external package
- WHEN dependencies are classified
- THEN it is external, not unresolved local

#### Scenario: ESM/CommonJS enforced

- GIVEN equivalent forbidden edges use ESM and static CommonJS `require()`
- WHEN the check runs
- THEN both are evaluated against the applicable rule

#### Scenario: Non-production edges

- GIVEN a test, migration, tool, or configuration file contains a cross-layer import
- WHEN production boundaries are evaluated
- THEN the edge creates no production violation

### Requirement: Gate Blocks Independently Without Product Changes

The architecture check MUST be standalone and exit zero only when edges pass. It MUST NOT move production files, change runtime/product/schema/authentication/cart behavior, or exceed 250 lines per production source file. The remediated tree MUST have zero known violations without baseline, suppression, allowlist, or weakened rules. Removing the private unused application barrel MUST eliminate 16 diagnostics without import rewrites or runtime changes. CI MUST invoke the check independently and block failure or unavailability. Parent PR 3 MUST remain separate and resume only after this prerequisite merges. Rollback MUST atomically restore `backend/src/application/use-cases/index.ts` and revert only the `.astro` resolver regression test/fallback. The parent checker, CLI, package, CI, parent artifacts, and runtime behavior MUST remain untouched.
(Previously: the gate lacked remediation and parent-boundary criteria.)

#### Scenario: Standalone success

- GIVEN all checked edges are valid after remediation
- WHEN the standalone command runs
- THEN it exits zero with no known current-tree violations

#### Scenario: Barrel diagnostics removed

- GIVEN the private unused application barrel is removed without import changes
- WHEN the architecture check runs
- THEN its 16 diagnostics are absent and runtime behavior is unchanged

#### Scenario: CI blocks failure

- GIVEN the command fails or cannot execute
- WHEN current CI runs the architecture step
- THEN CI fails rather than skipping the gate

#### Scenario: Baseline independent

- GIVEN the baseline capability is absent, blocked, or redesigned
- WHEN this command and CI step run
- THEN the gate remains runnable and fail closed

#### Scenario: Parent boundary preserved

- GIVEN parent PR 3 remains unmerged
- WHEN this prerequisite is delivered
- THEN parent artifacts remain separate and PR 3 resumes only after prerequisite merge

#### Scenario: Atomic rollback

- GIVEN the prerequisite is isolated from PR 3
- WHEN applied
- THEN `backend/src/application/use-cases/index.ts` is restored; only the `.astro` resolver test/fallback reverts
- AND parent remains untouched
