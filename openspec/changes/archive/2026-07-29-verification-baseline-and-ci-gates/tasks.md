# Tasks: Verification Baseline and CI Gates

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 300–360 repository lines; 0 remote-delivery lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | One PR: baseline, CI, docs |
| Delivery strategy | ask-always; no chain decision |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Selection, types, coverage, risk map | PR 1 | `pnpm --filter backend test:fast && pnpm --filter backend test:coverage && pnpm --filter backend type-check` | N/A — tooling only | Package, lockfile, Jest/TS, risk-map files |
| 2 | Quality, MySQL/E2E, artifacts, gate | PR 1 | `pnpm lint && pnpm frontend:check && pnpm frontend:test && pnpm frontend:build` | N/A — CI orchestration | `.github/workflows/ci.yml`, scripts |
| 3 | Documentation reconciliation | PR 1 | `git diff --check` plus command smoke checks | N/A — docs/config only | `README.md`, `openspec/config.yaml` |

## Phase 1: RED Tests and Foundation

- [x] 1.1 Create failing `backend/src/__tests__/jest-selection.test.js` tests: fast excludes both integration extensions; integration retains both; map to S1.
- [x] 1.2 Create failing `backend/src/__tests__/coverage-risk-map.test.js` tests for JS/TS, Tier 0, revision/lock metadata, and honest gaps; map to S10.

## Phase 2: Verification Baseline Implementation

- [x] 2.1 Update `package.json`, `backend/package.json`, `backend/tsconfig.json`, `pnpm-lock.yaml`, and `backend/jest.config.js` with commands, strict Supertest types, JS+TS coverage, reports, and unchanged 50% guards; pass 1.1.
- [x] 2.2 Create `backend/scripts/generate-coverage-risk-map.js`; pass 1.2 without product changes or product tests.
- [x] 2.3 Update `frontend/package.json` and Astro checker/compiler dependencies for independent, non-zero `frontend:check`, tests, and build.

## Phase 3: CI and Evidence Wiring

- [x] 3.1 Update `.github/workflows/ci.yml` with fail-closed `quality`, `integration`, `e2e`, and `verification-gate`; include MySQL, browsers, artifacts, `always()`, and success-only eligibility.

## Phase 4: Documentation, Verification, Rollback Evidence

- [x] 4.1 Reconcile `README.md` and `openspec/config.yaml` with pnpm commands, classes, thresholds, artifacts, and verification-only scope; omit product fixes.
- [x] 4.2 Run local selection/list, MySQL integration, backend types/lint/coverage, frontend check/test/build, and E2E; record failures as blocking.
- [x] 4.3 Record revision/lock/classification/prerequisites, risk map, artifacts, and rollback evidence limited to verification files.

Checkbox task count: 9 (P1: 2; P2: 3; P3: 1; P4: 3).

Dependency boundary: 1.x RED → 2.x GREEN → 3.1 CI → 4.1 docs → 4.2/4.3 local evidence. All checkboxes are locally completable in apply/verify; no commit, push, PR, publication, or remote mutation.

## Post-publication Authorized Operational Follow-up (Not an SDD Task)

After independent verify/archive and a published successful run, the maintainer observes exact live context plus SHA/URL, requests explicit remote authorization, and requires exact `verification-gate` on `main` only if stable. Missing/unstable context, permission failure, or unavailable capability remains typed `unavailable`/incomplete enforcement; preserve protections and make no compliance claim. Apply may not publish or mutate GitHub. The umbrella Gentleman alignment program is not fully fail-closed at GitHub merge level until this follow-up completes, even if the repository change verifies.
