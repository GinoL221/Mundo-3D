# Proposal: Verification Baseline and CI Gates

## Intent

Exploration found untrustworthy feedback: default Jest discovers a MySQL suite; backend strict type-check fails on missing Supertest types; CI omits type-check, frontend validation/build, and coverage; coverage misses JavaScript. Establish measured baseline without product changes.

## Goals and Scope

### In Scope
- Isolate `.integration.test.js` and `.integration.test.ts` from fast tests while preserving a dedicated real-MySQL command.
- Make backend tests/type-checking, frontend tests/build validation, lint, integration, and E2E checks mandatory and intentional in CI.
- Report a JS/TS baseline and classify uncovered behavior by risk.

### Out of Scope
- Cart/auth/business behavior, architecture or folder moves, runtime resilience, database changes, and dependency-boundary enforcement.
- Threshold increases or closing all legacy test debt before the corrected baseline exists.

## Capabilities

### New Capabilities
- `ci-verification-gates`: Mandatory checks with a fail-closed integration policy.

### Modified Capabilities
- `test-infrastructure`: Deterministic selection, type-check baseline, and explicit validation.
- `coverage-thresholds`: Measured, behavior-oriented, risk-aware guardrails.

## Approach and Impact

Preserve boundaries; correct selection, classify sources, measure the baseline, and gate checks. Developers get deterministic commands, reviewers evidence, and maintainers fail-closed integration. Tier 0 (security, data integrity, cart, stock, migrations) gets priority; lower-risk gaps are tracked.

High coverage means executable contracts at cheapest layer, stronger boundary evidence, and meaningful changed-behavior coverage—not blind 100%.

## Affected Areas

| Area | Impact |
|---|---|
| `backend/jest.config.js`, `backend/tsconfig.json` | Test selection, coverage scope, type baseline |
| `.github/workflows/ci.yml`, workspace scripts | Mandatory verification orchestration |
| `README.md`, testing OpenSpec docs | Command/evidence reference |

## Risks and Rollback

| Risk | Mitigation |
|---|---|
| Corrected selection exposes latent failures | Keep fast and real-DB jobs distinct; classify by risk. |
| Unavailable services create false confidence | A failed or unavailable mandatory check blocks integration. |

Rollback reverts only CI, test configuration, dependency/type, coverage, and documentation changes; persisted data and product behavior are untouched.

## Dependencies

pnpm, MySQL CI, Playwright setup, and coverage scope.

## Success Criteria

- [ ] Fast tests are environment-independent; real-DB suites run only in their intentional job.
- [ ] Mandatory checks fail closed, including when a required check cannot run.
- [ ] Backend type-check and frontend validation/build pass in CI.
- [ ] Coverage produces a reproducible baseline and risk map without requiring global 100%.
- [ ] Authored change stays near 100–220 lines and below the 400-line guard; otherwise ask before widening or chaining.

## Proposal Question Round

Supplied decisions answer outcome and scope. Specs should confirm mandatory job names, unavailable-dependency blocking, and whether unchanged Tier 0 gaps are tracked or baseline blockers.

## Relationship to the Umbrella

Sequence 1 of `gentleman-alignment-program`, providing verification for later architecture, cart, auth, and resilience changes.
