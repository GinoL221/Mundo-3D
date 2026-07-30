```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c06067a2faf11715166bf690cae9ab2132bc932f02df085850c21c411d55a7e5
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 11/11
test_command: pnpm run test:fast
test_exit_code: 0
test_output_hash: sha256:31863485260efdef2f6fb1980ffaf863150f437a2f745d11dea0b95533e721c3
build_command: pnpm run frontend:build
build_exit_code: 0
build_output_hash: sha256:5c9a844d9d3a15a5c84ae9512067b0b2dd760c88f629e3b8cf6b4c4d9c7da1c0
```

## Verification Report

**Change**: verification-baseline-and-ci-gates
**Version**: N/A
**Mode**: Strict TDD; PASS WITH WARNINGS

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 9 |
| Tasks complete | 9 |
| Tasks incomplete | 0 |
| Requirements total | 9 |
| Requirements fully implemented | 9 |
| Scenarios total | 11 |
| Scenarios compliant | 11 |
| Scenarios partial | 0 |
| Scenarios untested | 0 |

### Repository State

This change was merged to `main` via PR #47 (merge commit `29074af7505a35d7c276ba5a10a5e49135a0b30a`) across three commits: `091409c` (backend baseline — RED tests, risk-map script, jest.config.js coverage, backend/package.json scripts, tsconfig.json Supertest types), `9652bf9` (CI fail-closed job structure, `@astrojs/check`, `chokidar` override, 12 pre-existing TS fixes in `header-modules.test.ts`), and `5631533` (README/openspec/config.yaml reconciliation). Verification below was run independently against `main` HEAD (`29074af7505a35d7c276ba5a10a5e49135a0b30a`), clean working tree, local MySQL 8.0 (`127.0.0.1:3306`, `root`/empty), and Playwright Chromium already installed. The `apply-progress` artifact (Engram id 3433) predates the commit/PR/merge and states the tree was left "uncommitted" at apply time — that is stale relative to the final state confirmed here but not a defect: publishing, PR creation, and merge are explicitly out of scope for the `apply` phase per `tasks.md`'s "Post-publication Authorized Operational Follow-up" section, and happened afterward as an operator action.

### Build & Tests Execution

**Architecture boundary check**: ✅ exit 0, zero diagnostics
Command: `pnpm --filter backend architecture:check`
Output hash: `sha256:4acb2a2974ee2ae578426173f72717a47d4b1c43b37fca0e6da1e6304f6534d3` (identical to the prior `architecture-boundary-guardrails` verify pass — deterministic, unaffected by this change, confirming the compatibility boundary).

**Lint**: ✅ exit 0
Command: `pnpm run lint`

**Backend strict type-check**: ✅ exit 0
Command: `pnpm run type-check` (`tsc --noEmit`)

**Fast tests (backend + frontend)**: ✅ 83 backend suites/557 tests passed + 7 frontend files/93 tests passed, exit 0
Command: `pnpm run test:fast`
Output hash: `sha256:31863485260efdef2f6fb1980ffaf863150f437a2f745d11dea0b95533e721c3`

**Coverage + risk map**: ✅ 93.4% stmts / 84.61% branches / 85.47% funcs / 94.3% lines (aggregate, well above the unchanged 50% global guard), exit 0
Command: `pnpm run test:coverage`
Output hash: `sha256:3a77c4552884a150bdad0448fc756e67dc65824594ca83766e93eacd32dccdf5`
Risk map (`backend/coverage/risk-map.json`, regenerated locally): `revision` field matches current HEAD exactly (`29074af7505a35d7c276ba5a10a5e49135a0b30a`); `summary.totalFiles: 91, tier0Files: 17, tier0Gaps: 1, otherGaps: 11` — identical to the value reported in `apply-progress`, confirming reproducibility from the same revision. The one Tier 0 gap is `backend/src/database/migrate.js` (branches 41.66%), reported honestly as `"status": "gap"`, not silently hidden or claimed fixed.

**Frontend Astro check**: ✅ 0 errors / 0 warnings / 0 hints across 46 files, exit 0
Command: `pnpm run frontend:check`

**Frontend build**: ✅ 15 Astro pages built, exit 0
Command: `pnpm run frontend:build`
Output hash: `sha256:5c9a844d9d3a15a5c84ae9512067b0b2dd760c88f629e3b8cf6b4c4d9c7da1c0`

**Backend real-DB integration tests**: ✅ 2 suites / 8 tests passed against local MySQL, exit 0
Command: `pnpm run test:integration` (`DB_HOST=127.0.0.1 DB_USER=root DB_PASS=""`)

**E2E (Playwright/Chromium)**: ✅ 16/16 passed, exit 0
Command: `pnpm run test:e2e` (`DB_HOST=127.0.0.1 DB_USER=root DB_PASS="" SESSION_SECRET=ci_test_secret_key_9876543210`)

**Independent GitHub Actions confirmation (PR #47, run 30500382380)**: ✅ all 4 jobs `pass` — `Quality` (52s), `Real-DB integration tests` (56s), `End-to-end (Playwright)` (2m3s), `Verification gate` (2s) — retrieved directly via `gh pr checks 47` and `gh run view --job 90738862235 --log`, independent of the implementing agent's or the user's report. The `Verification gate` job log shows the exact executed conditional: `quality: success`, `integration: success`, `e2e: success` → `"All mandatory checks succeeded."`, proving the success branch of the fail-closed `needs`+`if: always()` gate ran with real GitHub Actions job-result semantics, not just static YAML.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Intentional Verification Classes | S1 Checks execute | `jest-selection.test.js` (selection contract) + independently run `test:fast`/`test:coverage`/`type-check`/`lint`/`frontend:check`/`frontend:build`/`test:integration`/`test:e2e`, all exit 0 | ✅ COMPLIANT |
| R2 Fail-Closed Mandatory Checks | S2 Mandatory failure blocks integration | `.github/workflows/ci.yml` `verification-gate` job (`needs: [quality, integration, e2e]`, `if: always()`, explicit `!= "success"` OR-chain, `exit 1`); success branch confirmed at runtime via PR #47 job log | ✅ COMPLIANT (see Issues — failure branch not runtime-exercised) |
| R3 Compatibility Boundary | S3 Verification-only update | `git show --stat 29074af`: only test/config/CI/docs files changed (`ci.yml`, `jest.config.js`, `package.json`×3, `tsconfig.json`, `generate-coverage-risk-map.js`, 2 new test files, `header-modules.test.ts` type-only, `README.md`, `openspec/*`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`); no controller/use-case/route/entity/migration file touched; 557+93 pre-existing tests still pass unchanged | ✅ COMPLIANT |
| R4 Jest Coverage Collection Configuration | S4 Source scope is reported | `backend/jest.config.js` `collectCoverageFrom: ["src/**/*.{js,ts}", ...]` with commented, explicit exclusions; `risk-map.json` includes both `.js` (`app.js`, `database/*.js`) and `.ts` files | ✅ COMPLIANT |
| R4 Jest Coverage Collection Configuration | S5 Guardrail fails below value | `jest.config.js` `coverageThreshold.global` unchanged at 50% (inherited Jest built-in enforcement) | ✅ COMPLIANT (see Issues — failing branch not runtime-exercised in this pass) |
| R4 Jest Coverage Collection Configuration | S6 Guardrail passes at value | `pnpm run test:coverage` exits 0 at 93.4/84.61/85.47/94.3%, well above 50%, without requiring 100% | ✅ COMPLIANT |
| R5 Reproducible Risk Baseline | S7 Baseline is honest | Locally regenerated `risk-map.json` reproduces `tier0Gaps:1, otherGaps:11` and the exact `migrate.js` numbers reported in `apply-progress`; revision field matches current HEAD; gap is marked `"status": "gap"`, not fixed | ✅ COMPLIANT |
| R6 Meaningful High-Coverage Policy | S8 Behavior evidence leads | `coverage-risk-map.test.js` (tier0/tier1 classification, gap-vs-covered status) — the risk map is the concrete mechanism that lets reviewers weigh risk classification before a blind percentage; global guard intentionally kept at 50% despite 93%+ actual coverage, per "Guardrails MUST NOT increase before that baseline" | ✅ COMPLIANT (see Issues — the human-review-judgment half of this policy scenario is not itself mechanically testable) |
| R7 Deterministic Test-Class Selection | S9 Commands are distinct | `jest-selection.test.js` (8/8 assertions); independently ran `test:fast` (no MySQL, 83 suites clean) and `test:integration` (2 suites/8 tests, real MySQL) — both distinct and both pass | ✅ COMPLIANT |
| R8 Reproducible Type and Frontend Validation | S10 Validation is actionable | Independently ran `type-check` (exit 0) and `frontend:check`/`frontend:build` (exit 0) as commands separate from `test:fast` | ✅ COMPLIANT (see Issues — non-zero branch relies on inherited `tsc`/`astro check` exit-code contracts, not independently exercised as failing) |
| R9 Command and Documentation Consistency | S11 Documentation matches execution | `README.md` "Comandos" table and `openspec/config.yaml` `testing:` block cross-checked line-by-line against every command actually run above (`test:fast`, `test:coverage`, `test:integration`, `frontend:check`, `frontend:build`, `type-check`, `lint`) — all match | ✅ COMPLIANT |

**Compliance summary**: 11/11 scenarios compliant (4 of those carry a runtime-coverage or human-judgment caveat noted in Issues); 0 partial; 0 untested; 0 failing.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Deterministic Jest selection | ✅ Implemented | `testPathIgnorePatterns` excludes both `.integration.test.(js\|ts)`; dedicated `jest.integration.config.js` retains both; locked by `jest-selection.test.js`. |
| Fail-closed CI gate | ✅ Implemented | `verification-gate` needs all 3 upstream jobs, runs `if: always()`, blocks unless every `.result == "success"`; no `continue-on-error` anywhere in `ci.yml`. |
| Coverage risk map | ✅ Implemented | `generate-coverage-risk-map.js` (159 lines, within the 250-line cap) classifies tier0/tier1, excludes the aggregate `total` key, and is reproducible; locked by `coverage-risk-map.test.js` (11 cases). |
| Frontend validation wiring | ✅ Implemented | `@astrojs/check` added; `pnpm frontend:check` wired independently of `frontend:test`/`frontend:build`; `chokidar` override and `publicHoistPattern` resolve pnpm-specific resolution issues without weakening `trustPolicy: no-downgrade`. |
| Documentation/config consistency | ✅ Implemented | `README.md` and `openspec/config.yaml` both describe `pnpm` (not the prior `npm`), the 4-job CI structure, and every new command. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Separate fast/integration Jest configs | ✅ Yes | `jest.config.js` (fast) and `jest.integration.config.js` (dedicated), matching the design table exactly. |
| Pin Astro checker/compiler, retain tests/check/build | ✅ Yes | `@astrojs/check` + `typescript@6.0.3` added as devDependencies; `frontend:check`/`test`/`build` all independently green. |
| Supertest declarations, strict types kept | ✅ Yes | `"supertest"` added to `tsconfig.json` `types`; `tsc --noEmit` still exits 0. |
| JS+TS coverage, exclusions/reports/risk map, 50% guards unchanged | ✅ Yes | `collectCoverageFrom` now JS+TS; guardrails literally unchanged at 50%; risk map generated. |
| `quality`/`integration`/`e2e` → `always()` gate → `success` | ✅ Yes | Matches `ci.yml` exactly; confirmed at runtime on PR #47. |
| No `continue-on-error` | ✅ Yes | Verified absent from the entire `ci.yml` file (read in full). |
| Branch protection is delivery-only, no apply/verify mutation | ✅ Yes | No remote branch-protection mutation was performed by apply or by this verify pass; `tasks.md`'s "Post-publication Authorized Operational Follow-up" section explicitly defers it. |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | `apply-progress` contains a TDD Cycle Evidence table for tasks 1.1/1.2 (the only RED-test tasks; 2.x–4.x are GREEN-implementation/CI/docs tasks per `tasks.md`'s own phase structure). |
| All tasks have tests | ✅ | Both RED test files (`jest-selection.test.js`, `coverage-risk-map.test.js`) exist and were read in full; both currently pass. |
| RED confirmed (tests exist) | ✅ | Both files verified present with real, non-trivial assertions. |
| GREEN confirmed (tests pass) | ✅ | `pnpm run test:fast` and `pnpm run test:coverage` both exit 0 and include these files. |
| Triangulation adequate | ✅ | `jest-selection.test.js`: 8 cases/3 describe blocks; `coverage-risk-map.test.js`: 11 cases/3 describe blocks with distinct tier/status/reproducibility/error-path assertions. |
| Safety Net for modified files | ✅ | `jest.config.js`, `backend/package.json`, `tsconfig.json` modifications covered by the full pre-existing 557-test backend suite, all still passing. |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 557 (backend) + 93 (frontend) | 83 + 7 | Jest 30.x, Vitest 4.x |
| Integration | 8 | 2 | Jest 30.x against real MySQL 8.0 |
| E2E | 16 | 3 spec files | Playwright 1.61 (Chromium) |
| **Total** | **674** | **95** | |

### Changed File Coverage
| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `backend/scripts/generate-coverage-risk-map.js` | Not separately instrumented by the default run (excluded — it is a CLI/build-tooling script, not `src/**`, consistent with `collectCoverageFrom` scope) | — | — | ➖ Out of measured scope by design |
| `backend/jest.config.js`, `backend/tsconfig.json`, `backend/package.json`, `frontend/package.json` | N/A (config, not instrumented source) | — | — | ➖ Not applicable |
| `backend/src/__tests__/jest-selection.test.js`, `backend/src/__tests__/coverage-risk-map.test.js` | N/A (test files, excluded via `!src/**/*.test.{js,ts}`) | — | — | ➖ Not applicable |
| `.github/workflows/ci.yml`, `README.md`, `openspec/config.yaml` | N/A (CI/docs) | — | — | ➖ Not applicable |

**Average changed file coverage**: Not applicable — every changed production-adjacent file in this PR is verification tooling, config, CI, or documentation, none of which falls inside the instrumented `backend/src/**/*.{js,ts}` scope. Product source coverage is unchanged by this PR (93.4%/84.61%/85.47%/94.3% aggregate, reproduced independently above).

### Assertion Quality
No tautologies, ghost loops, assertion-without-production-call, or smoke-test-only patterns found in `jest-selection.test.js` or `coverage-risk-map.test.js`. `header-modules.test.ts`'s diff (part of this PR) is confirmed type-annotation-only (explicit `vi.fn` return types, `Storage` casts, one unused import removed) — no assertion or test-logic changes, verified by reading the full commit diff.

**Assertion quality**: 0 CRITICAL, 0 WARNING.

### Quality Metrics
**Linter**: ✅ 0 errors, 0 warnings (`pnpm run lint`, exit 0).
**Type Checker**: ✅ 0 errors (`pnpm run type-check`, exit 0); ✅ 0 errors/0 warnings/0 hints (`pnpm run frontend:check`, exit 0).

### Issues Found
**CRITICAL**:
None.

**WARNING**:
1. The fail-closed *failure* branch of `verification-gate` (a mandatory check actually failing or being skipped/cancelled) was not exercised at runtime in this verify pass or in PR #47's history — only the all-success branch has real GitHub Actions evidence. The bash conditional (`[ "$X" != "success" ] || ...; exit 1`) is simple, deterministic, and was read in full; risk is low but the failing path itself remains statically, not dynamically, proven.
2. Similarly, S5 (coverage guardrail fails below value) and the non-zero branch of S10 (backend/frontend validation) rely on inherited third-party tool contracts (Jest `coverageThreshold`, `tsc` exit codes, `astro check` exit codes) rather than custom logic written by this change, and were not independently exercised as failing in this pass.
3. S8 (Meaningful High-Coverage Policy) is partly a human-review-judgment requirement ("considered before percentage targets" describes how a reviewer weighs evidence). Its mechanical half — tier-aware risk classification instead of a single blind percentage — is implemented and covered by `coverage-risk-map.test.js`; the reviewer-judgment half is not itself something an automated test can assert.
4. `apply-progress` (Engram id 3433) states the working tree was left uncommitted at apply time; the actual final state (this verify pass) is three commits merged via PR #47. This is expected per `tasks.md`'s explicit "Post-publication Authorized Operational Follow-up" boundary (apply may not publish/mutate GitHub) but the artifact itself is now stale relative to the shipped state and should be read alongside this report, not in isolation.
5. `ts-jest` reports a config deprecation warning (`isolatedModules` should move from the "ts-jest" transform option to `tsconfig.json`) on every backend Jest run — pre-existing, non-blocking, unrelated to this change's pass/fail outcome.
6. `backend/src/database/migrate.js` has a pre-existing Tier 0 coverage gap (branches 41.66%), honestly surfaced by the risk map and explicitly out of scope for this change ("closing all legacy test debt" is out of scope per the proposal) — reported here for visibility, not as a defect of this change.

**SUGGESTION**:
1. Consider a bounded follow-up SDD change to close the `migrate.js` Tier 0 gap, tracked separately from verification tooling.
2. Consider adding one narrow negative-path CI smoke test (e.g., a manually triggered workflow_dispatch scenario or a documented manual drill) that intentionally fails one upstream job to observe `verification-gate` block in practice, closing the WARNING-1 gap without touching `main`'s protected history.

### Repository and Process Evidence
- Verified revision: `29074af7505a35d7c276ba5a10a5e49135a0b30a` (main HEAD, PR #47 merge commit), clean working tree at verification time.
- PR: `github.com/GinoL221/Mundo-3D/pull/47`, state `MERGED`, `mergedAt: 2026-07-29T23:46:45Z`.
- Independent GitHub Actions run: `30500382380` — 4/4 jobs `pass` (`Quality` 52s, `Real-DB integration tests` 56s, `End-to-end (Playwright)` 2m3s, `Verification gate` 2s), confirmed via `gh pr checks 47` and `gh run view --job 90738862235 --log`.
- Local re-verification environment: MySQL 8.0 Docker container (`mundo-3d-mysql-1`, healthy, `127.0.0.1:3306`), Playwright 1.61.0 with Chromium already cached.
- Coverage risk map regenerated locally is byte-identical in summary counts to the one reported in `apply-progress` (`tier0Gaps:1, otherGaps:11`), and its `revision` field matches this exact HEAD.
- No git commit, push, or remote mutation was performed by this verify pass.

### Verdict
PASS WITH WARNINGS
All 9 requirements and 11/11 scenarios pass against independently re-executed evidence (including one independent GitHub Actions confirmation on PR #47) with zero blockers and zero critical findings. Warnings are limited to unrun failure-path branches for standard/inherited tool contracts and CI gate logic, one policy-only scenario without a dedicated executable test, and a stale (but explainable) apply-progress artifact.
