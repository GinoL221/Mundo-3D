# Documentation and Specification Drift Specification

## Purpose

Align verified documentation/configuration drift after a bounded Prettier baseline reset. This slice MUST NOT change application behavior, database state, or unresolved product and operational contracts.

## Requirements

### Requirement: Identify only verified drift

The change MUST compare statements with authoritative workspace manifests, test configuration, frontend paths, and CI evidence. It MUST limit semantic corrections to `frontend/src/store/` → `frontend/src/domains/` in `openspec/config.yaml` and `npm` → pnpm terminology in `backend/jest.config.js` comments.

#### Scenario: Produce an evidence-backed inventory

- GIVEN the repository declares pnpm 11.0.9, Astro, backend Jest, frontend Vitest, and current CI jobs
- WHEN candidate drift is reviewed
- THEN every correction maps to repository evidence and unverified or truthful statements are excluded

### Requirement: Normalize exactly the approved formatter baseline

Before semantic corrections, the change MUST normalize exactly `openspec/config.yaml` and `backend/jest.config.js` with the repository's existing Prettier configuration. Style-only changes in those two files are authorized, including unrelated textual formatting there; this MUST NOT become repository-wide or other-file cleanup. The forecast MUST remain approximately 50 style-only lines and below the 400-line authored-change budget.

#### Scenario: Apply bounded normalization

- GIVEN both target files fail the pinned Prettier baseline
- WHEN normalization runs
- THEN only those two files receive formatter changes and no application behavior or executable setting changes

### Requirement: Apply only the approved semantic corrections

After normalization, the change MUST apply only the two verified corrections and MUST preserve truthful documentation, commands, test selection, CI jobs, CI gates, and runtime semantics.

#### Scenario: Preserve current topology and behavior

- GIVEN the normalized targets and authoritative evidence are read back
- WHEN the corrections are compared
- THEN the SDD topology uses `domains: frontend/src/domains/`, Jest comments use pnpm terminology, and no behavior-bearing value changes

### Requirement: Prove deterministic meaning preservation

Acceptance MUST prove Jest exports are deterministically equivalent before and after normalization and corrections. It MUST also prove parsed YAML meaning is unchanged except the explicitly approved `store` → `domains` topology correction; all other keys, values, and sequence structure MUST remain equivalent.

#### Scenario: Reject executable or unintended configuration drift

- GIVEN before/after evidence is produced from the pinned baseline and working tree
- WHEN Jest exports and YAML structure are compared
- THEN Jest equivalence passes, only the approved YAML topology differs, and any other difference rejects the slice

### Requirement: Exclude unsupported and live operations

The slice MUST NOT claim runtime resilience, authentication, cart, catalog, coverage, or live-schema completion. It MUST NOT perform database or network operations, migrations, live baseline adoption, or any live `Product.stock` operation, including `ALTER TABLE Product ADD COLUMN stock ...`.

#### Scenario: Keep operational boundaries intact

- GIVEN unresolved runtime, product, security, or database decisions remain
- WHEN acceptance runs
- THEN no live mutation, migration, network call, or settled unsupported claim is introduced

### Requirement: Accept only bounded check-only evidence

Acceptance MUST include non-mutating readback, formatting/syntax checks, and an exact changed-path allowlist containing only the two target files. Any unsupported claim, broken reference, export mismatch, YAML difference outside the approved correction, unrelated path, or attempted mutation MUST fail acceptance.

#### Scenario: Accept or reject closed

- GIVEN the target files and evidence are validated
- WHEN all bounded checks pass
- THEN the slice is accepted without changing source or database state
- AND otherwise it is rejected until the offending scope or evidence is removed
