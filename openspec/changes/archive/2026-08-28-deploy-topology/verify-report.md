```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d5c76f42aecc59ae4df959b31f97953a38639493006c6298bd5cfdc1ede07266
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 10/10
test_command: node --test "scripts/deploy/**/*.test.js"
test_exit_code: 0
test_output_hash: sha256:77a5edeb189da47019b73892d7cdd6133f8522312fc09f45638c2a384bfe81e5
build_command: pnpm --filter backend build
build_exit_code: 0
build_output_hash: sha256:24c42b76aecef2c39c8a5639a3536efb936b03bdac9a8f8be50c0e71ffbc7af8
```

## Verification Report

**Change**: deploy-topology
**Capability**: deploy-pipeline-foundations
**Version**: spec.md as of 2026-08-28 (includes 2 recorded corrections)
**Mode**: Strict TDD
**Verified against**: `main` @ `2cf5f64` (squash-merge of PR #77, stacked on PR #76 `0e28588`), working tree clean
**Verified on**: 2026-08-28

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 27 |
| Tasks complete | 27 |
| Tasks incomplete | 0 |

All 27 checkboxes confirmed against actual files, not just the checkbox state:

| Phase | Claim | Independent confirmation |
|---|---|---|
| 1 (1.1-1.4) | `env-preflight.js` + 4-case test | Both files exist; 4/4 tests pass; `REQUIRED`/`WARN_ONLY`/`checkEnv` match design's interface verbatim; CLI guard present at lines 24-39 |
| 2 (2.1-2.4) | `smoke-test.js` + 4-case test | Both exist; 4/4 pass; only 3 `console.*` calls, all inside the `require.main` guard |
| 3 (3.1-3.3) | root `test:deploy-scripts` glob alias | Present in root `package.json`; backend Jest `testMatch` is `**/src/**` so it cannot collect `scripts/deploy/` |
| 4 (4.1-4.5) | `migrate-and-start.js` + test | Both exist; 10/10 pass (tasks.md predicted 5 — see divergence note) |
| 5 (5.1-5.3) | real-DB integration test | 2/2 pass against real MySQL 8.0.46; absent from root run (90 suites / 673 tests, unchanged) |
| 6 (6.1-6.2) | 3 backend deploy aliases | All 3 present in `backend/package.json`; CLI paths re-exercised this session |
| 7 (7.1-7.3) | RUNBOOKS Deploy Pipeline section | `## Deploy Pipeline` at line 74, immediately after "Compiled production start"; all 3 scripts named together |
| 8 (8.1-8.5) | full verification | Re-run fresh this session; every count reproduced or exceeded |

### Build & Tests Execution

**Build**: PASS
```text
$ pnpm --filter backend build
$ tsc -p tsconfig.build.json
exit 0
```

**Tests** — all four suites run fresh this session, nothing reused:

```text
$ node --test "scripts/deploy/**/*.test.js"
tests 18 | pass 18 | fail 0 | duration_ms 5225.6            exit 0

$ cd backend && DB_HOST=172.17.0.3 DB_USER=root DB_PASS="" npm run test:integration
Test Suites: 6 passed, 6 total
Tests:       14 passed, 14 total                            exit 0
(real MySQL 8.0.46, disposable container, removed after the run)

$ npx jest --config jest.integration.config.js deploy-migrate-and-start   (isolated re-run)
Test Suites: 1 passed | Tests: 2 passed, 2 total            exit 0

$ pnpm test                                                  (root regression check)
backend  Test Suites: 90 passed | Tests: 673 passed
frontend Test Files 9 passed | Tests 144 passed              exit 0

$ pnpm --filter backend lint
eslint src/  — no output                                     exit 0
```

No fabricated evidence: the disposable MySQL 8.0.46 container approach worked, so CI run 33177216435 was **not** needed as a substitute.

**Coverage**: see Changed File Coverage below.

### Spec Compliance Matrix

4 requirements / 10 scenarios. Every row's covering test was executed this session.

| # | Requirement | Scenario | Covering test | Result |
|---|---|---|---|---|
| R1.1 | Ordered Deploy Sequencing | Successful deploy runs both steps in order | `migrate-and-start.test.js > successful migrate runs start next, with the exact expected argv/cwd` **+** `deploy-migrate-and-start.integration.test.js > migrates then boots the real server, reaching a healthy /health/ready` | COMPLIANT |
| R1.2 | Ordered Deploy Sequencing | A failed migration blocks the start step | `migrate-and-start.test.js > a failed migration blocks start entirely and propagates the exit code` **+** `> a migration killed by a signal blocks start...` **+** `> a migration that never spawns at all...` **+** `integration > never starts the server when migrate fails (bad DB credentials)` | COMPLIANT |
| R2.1 | Post-Deploy Smoke Test | Succeeds quickly against an already-healthy instance | `smoke-test.test.js > both endpoints healthy immediately -> resolves well before timeout` (asserts `elapsed < 2000` against `timeoutMs: 5000`) | COMPLIANT |
| R2.2 | Post-Deploy Smoke Test | Fails when readiness never latches within the timeout | `smoke-test.test.js > /health/ready never returns 200 -> fails only after the timeout elapses` (asserts `ok === false` **and** `elapsed >= 1500`) | COMPLIANT |
| R2.3 | Post-Deploy Smoke Test | Waits for liveness before checking readiness | `smoke-test.test.js > waits for liveness before ever checking readiness` (every hit before the first `/health/ready` is `/health/live`) + `> base URL refuses connections -> fails without throwing` | COMPLIANT (see SUGGESTION S3) |
| R3.1 | Env Preflight | Fails fast when a required var is missing | `env-preflight.test.js > 3 required vars missing -> reported in REQUIRED array order` + `> an empty-string value counts as unset`; exit-code half proven by direct CLI execution this session (exit 1, all 8 named) | COMPLIANT (see WARNING W5) |
| R3.2 | Env Preflight | Passes when all required vars are set | `env-preflight.test.js > all required vars and COOKIE_DOMAIN present -> no missing, no warnings`; CLI exit 0 confirmed this session both with and without `COOKIE_DOMAIN` | COMPLIANT |
| R3.3 | Env Preflight | A missing COOKIE_DOMAIN warns without failing | `env-preflight.test.js > all required present, COOKIE_DOMAIN absent -> warns, does not fail`; CLI confirmed: WARN line printed, exit 0 | COMPLIANT |
| R4.1 | Deploy Pipeline Documentation | RUNBOOKS documents all three scripts | Static: `docs/RUNBOOKS.md:74-85` names env-preflight, migrate-and-start, and smoke-test in one `## Deploy Pipeline` section | COMPLIANT (doc requirement — runtime test N/A) |
| R4.2 | Deploy Pipeline Documentation | Documents expand/contract as discipline, not enforcement | Static: `docs/RUNBOOKS.md:87-89` — "This is a manual authoring discipline — nothing in `migrate.js`/`checkPendingMigrations.js` enforces it" | COMPLIANT (doc requirement — runtime test N/A) |

**Compliance summary**: 10/10 scenarios compliant, 0 UNTESTED, 0 FAILING.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Ordered Deploy Sequencing | Implemented | `spawnSync` for `db:migrate` is *blocking*, so `start` structurally cannot begin before migrations finish. Gate is `if (migrate.status !== 0) return exitCodeFrom(...)` — `status: null` (signal-killed) and `status: null, signal: null` (never spawned) both take the failure branch, so only a literal `0` proceeds. Fixed argv array, `shell: false`, `cwd: REPO_ROOT` resolved via `path.resolve(__dirname,'..','..')` — cwd-independent as designed. |
| Post-Deploy Smoke Test | Implemented | `run()` polls `/health/live` to 200 first, then `/health/ready`, both against one shared `deadline`. `get()` resolves `{status:null,error}` on ECONNREFUSED rather than throwing, so polling continues. Protocol chosen by `baseUrl.startsWith('https:')`. CLI reads `SMOKE_TEST_BASE_URL` with `process.argv[2]` fallback and `SMOKE_TEST_TIMEOUT_MS` (default 60000) — exactly the design contract. |
| Env Preflight | Implemented | `REQUIRED` is the exact 8-var list the spec mandates. Verified the spec's superset/non-conflict claim directly against source: `backend/src/app.js:2` throws on missing `JWT_SECRET` (all envs) and `:10` on missing `CORS_ORIGIN` (production only) — both are in `REQUIRED`, so the preflight is a strict superset and contradicts neither. `COOKIE_DOMAIN` warn-only matches `cookieOptions.ts:48`'s `if (process.env.COOKIE_DOMAIN)` optional treatment. Falsy check makes empty string count as unset. Runs standalone with no `index.js`/`app.js` import. |
| Deploy Pipeline Documentation | Implemented | Section placed exactly where design specified. Documents all 4 steps with exact commands and per-step failure categories. Expand/contract subsection mirrors proposal Decision #4 and explicitly disclaims enforcement. |

### Coherence (Design)

| design.md decision | Followed? | Notes |
|---|---|---|
| Script location: repo-root `scripts/deploy/*.js` + backend aliases | Yes | All 3 scripts at repo root; 3 aliases in `backend/package.json` |
| `migrate-and-start.js` owns migrate→start only, `build` stays separate | Yes | Script never invokes `build`; RUNBOOKS documents `build` as step 1 |
| cwd independence via `path.resolve(__dirname,'..','..')` | Yes | Exactly as written; alias `node ../scripts/deploy/...` starts in `backend/` and still resolves |
| Fixed argv + `shell: false`, no `exec()`/template strings | Yes | Asserted by a dedicated unit test |
| Signal handling: forward SIGTERM/SIGINT to the spawned child | **Diverged — improved** | Ships as whole-process-group signalling (`detached: true` + `process.kill(-child.pid, signal)`). See divergence note below. |
| `COOKIE_DOMAIN` warn-only | Yes | Matches spec correction and `cookieOptions.ts` |
| `node --test` for `scripts/deploy/`, Jest for the integration test | Yes | Confirmed both runners collect only their own files |
| Interfaces block (`REQUIRED`/`WARN_ONLY`/`checkEnv` shape, message text) | Yes | Implemented verbatim, including the two exact output strings |
| Data Flow: `env-preflight` standalone, smoke test after start | Yes | RUNBOOKS documents this 4-step order |
| Open Question #1: wire `test:deploy-scripts` into CI? | **Unresolved** | Still `[ ]` in design.md; no task created; not in `ci.yml`. See WARNING W3. |
| Open Question #2: `SMOKE_TEST_TIMEOUT_MS` default tuning | Deferred (acceptable) | 60000ms default shipped, env-overridable as designed |

#### Divergence note: implementation exceeds tasks.md in a specific, justified way

Five commits landed on PR #77 *after* tasks.md was written, during a real CI investigation. They are already merged into `main` and are **not** deviations to fix — they are improvements found by real failures. Recorded here so they are not lost:

1. `250e141` — integration test now uses a dedicated scratch DB `mundo_3d_migrate_scratch` instead of the shared `mundo_3d_test`. Fixes a genuine pre-existing collision: `testDb.ts`'s `sequelize.sync()` creates tables without recording anything in `SequelizeMeta`, so the baseline migration's `CREATE TABLE` collided. Unrelated latent bug, surfaced by the new test.
2. `302770b` — `--detectOpenHandles` on `test:integration` + `timeout-minutes: 5` on the CI step (diagnostics + hang guard).
3. `b6b724c` — added `exitCodeFrom(code, signal)`. **This closed a real correctness hole**: Node reports a signal-killed child as `code === null`, and assigning `process.exitCode = null` resets it to *unset*, so the wrapper exited **0** for a deploy that was actually torn down. Now mapped shell-style to `128 + signal`. Directly strengthens spec R1.2 ("MUST exit non-zero").
4. `4124300` → `7d63e78` — `start` child is now `detached: true` and signals go to the whole group via `process.kill(-child.pid, signal)`. **This was a real bug**: on CI, `pnpm` died from SIGTERM without relaying it to the real `node index.js` grandchild, orphaning a still-listening server that never drained. design.md's original "forward the signal to the spawned child" was insufficient because the spawned child is `pnpm`, not the server. The group-signal reaches the server regardless of how `pnpm` reacts. This *better* satisfies design.md's own stated rationale ("without explicit forwarding, `index.js`'s graceful-shutdown drain would never run").
5. `7df4b2e` — doc note in `jest.integration.config.js` on the `--detectOpenHandles` / `runInBand` / `timeout-minutes` interaction.

Net effect on task counts: tasks.md 8.1 predicted 13 unit tests; **18** exist and pass (migrate-and-start grew 5 → 10). tasks.md 8.4 recorded `migrate-and-start.js` at 52 lines; it is now **82** (still far under the 250 cap).

Consistent with the orchestrator's framing, this is **not** treated as a blocker or a defect. The only follow-up it creates is documentary: design.md's "Signal handling" row and its File Changes table are now stale (WARNING W4).

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Partial | `apply-progress` exists for Work Unit A only (Engram #6656); **no artifact for Work Unit B**. Neither uses the prescribed "TDD Cycle Evidence" table. |
| All tasks have tests | Yes | Every task claiming a test file: file exists and its tests pass |
| RED confirmed (tests exist) | Yes | 4/4 test files exist (`env-preflight`, `smoke-test`, `migrate-and-start`, integration). #6656 states RED was confirmed before implementation for Unit A; tasks.md 5.2 records RED-before-fix for the `checkPendingMigrations` repair |
| GREEN confirmed (tests pass) | Yes | 18/18 unit + 14/14 integration executed fresh this session, all pass |
| Triangulation adequate | Yes | R1.2 has 4 distinct cases (exit 1, signal-killed, never-spawned, real bad creds); R2 has 4 (fast-success, timeout, ordering, ECONNREFUSED); R3 has 4 (all-present, warn-only, 3-missing-ordered, empty-string). Expectations vary in value, not just shape. |
| Safety Net for modified files | Yes | `checkPendingMigrations.js` was modified, not new; its pre-existing suite ran, and 2 new cases were added (bare `INT` accepted; `BIGINT` still rejected) — both present and passing |

**TDD Compliance**: 5/6 checks fully passed, 1 partial (bookkeeping only — see W1/W2).

### Test Layer Distribution

| Layer | Tests | Files | Tool |
|---|---|---|---|
| Unit (pure) | 4 | 1 (`env-preflight.test.js`) | `node --test` |
| Unit (process-boundary doubles) | 10 | 1 (`migrate-and-start.test.js`) | `node --test` + `node:test` mock |
| Unit (with real HTTP fixture server) | 4 | 1 (`smoke-test.test.js`) | `node --test` + `http.createServer` |
| Integration (real MySQL + real subprocess) | 2 | 1 (`deploy-migrate-and-start.integration.test.js`) | Jest + MySQL 8.0.46 |
| E2E | 0 | 0 | Playwright present in repo, not applicable to deploy scripts |
| **Total (this change)** | **20** | **4** | |

Every layer's tooling was already present in cached repo capabilities — nothing was introduced that CI cannot run (though see W3: the `node --test` layer is not actually invoked by CI).

### Changed File Coverage

| File | Line % | Branch % | Uncovered lines | Rating |
|---|---|---|---|---|
| `scripts/deploy/migrate-and-start.js` | 95.12 | 94.12 | 77-80 (CLI guard) | Excellent |
| `scripts/deploy/env-preflight.js` | 63.41 | 80.00 | 25-39 (CLI guard) | Low — see W5 |
| `scripts/deploy/smoke-test.js` | not reported | not reported | — | Tool defect, see S5 |
| `backend/src/database/checkPendingMigrations.js` | covered by backend Jest suite | — | — | 2 targeted new cases added |

**Aggregate for `scripts/deploy/`**: 84.55% line / 90.91% branch (`node --test --experimental-test-coverage`).

Every uncovered range is a `require.main === module` CLI guard. All three guards were exercised manually at runtime this session with the expected exit codes, so the behavior is proven — but unguarded against regression (W5).

### Assertion Quality

Audited all 4 test files (20 tests) for trivial assertions.

| Finding | Count | Severity |
|---|---|---|
| Tautologies (`expect(true).toBe(true)`) | 0 | — |
| Assertions never invoking production code | 0 | — |
| Ghost loops over possibly-empty collections | 0 | `smoke-test.test.js:68`'s `.every()` is guarded by the `firstReadyIndex > 0` assertion on line 67 |
| Orphan empty-collection checks | 0 | `{missing: [], warnings: []}` has companion non-empty cases |
| Smoke-test-only assertions | 0 | — |
| Implementation-detail coupling | 1 | `migrate-and-start.test.js:87` (`detached === true`) — SUGGESTION S4 |
| Mock-heavy tests (mocks > 2x assertions) | 1 | `migrate-and-start.test.js:122` (3 mocks / 1 assertion) — SUGGESTION S6 |
| Weak single assertions | 2 | `smoke-test.test.js:78` asserts only `ok === false`; `integration:212` `expect(exitCode).not.toBeNull()` — the latter is *deliberately* unpinned with an in-file rationale, and the deterministic contract is pinned in the unit test |

**Assertion quality**: 0 CRITICAL, 0 WARNING, 3 SUGGESTION. No assertion in this change proves nothing.

### Quality Metrics

**Linter**: PASS — `pnpm --filter backend lint` (`eslint src/`) exits 0 with no output. Caveat: `scripts/deploy/` is outside every lint scope (S1).
**Type checker**: PASS — `pnpm --filter backend build` (`tsc -p tsconfig.build.json`) exits 0. The deploy scripts are plain CommonJS JS and are not type-checked.
**Line cap (AGENTS.md, 250)**: PASS — `env-preflight.js` 41, `smoke-test.js` 79, `migrate-and-start.js` 82, `checkPendingMigrations.js` 126. Largest test file 234 (exempt).
**`console.log` policy**: PASS — 5 total calls, all inside `require.main === module` CLI guards, which AGENTS.md and task 2.4 name as the intended exception. `migrate-and-start.js` has zero.
**Secrets**: PASS — no hardcoded credentials; all config read from `process.env`. Integration-test secrets are obvious throwaway literals in a test file.

### Issues Found

**CRITICAL**: None.

**WARNING**:

- **W1 — Missing `apply-progress` artifact for Work Unit B.** Only PR1's exists (Engram #6656). The larger, riskier half (migrate-and-start, real-DB integration test, docs, plus the 5 CI-hardening commits) has no persisted apply record. *Mitigation*: tasks.md Phases 4-8 carry per-task RED/GREEN annotations, and every claim in them was independently re-verified this session by running the tests. Bookkeeping gap, not a code gap.
- **W2 — No "TDD Cycle Evidence" table in either `apply-progress` artifact.** The strict-TDD protocol prescribes that table. Evidence exists in prose/tasks.md form instead. Deliberately **not** raised to CRITICAL: the rule's purpose is to detect an apply phase that reported no TDD evidence, and here the evidence was reported (just unstructured) *and* independently corroborated — every test file named exists and passes.
- **W3 — `test:deploy-scripts` is not wired into CI.** `.github/workflows/ci.yml` has no step invoking it, and root `pnpm test` (`pnpm --filter "!e2e" test`) cannot reach it because `scripts/` is not a workspace package. Consequence: the 18 unit tests that are the *sole* runtime evidence for 7 of 10 spec scenarios never execute on any PR. design.md Open Question #1 is still unchecked and tasks.md created no task for it — the question was dropped rather than resolved. Not a spec violation (the spec does not mandate CI wiring), but this change's own regression protection is currently inert.
- **W4 — design.md is stale relative to shipped code.** (a) The "Signal handling" row still describes `child.kill(signal)` on the immediate child; the shipped, more-correct behavior is whole-process-group signalling. (b) There is no design decision covering `exitCodeFrom` / signal-to-exit-code mapping at all. (c) The File Changes table omits `backend/src/database/checkPendingMigrations.js` and the RUNBOOKS note about it, both of which shipped. Back-fill these into design.md so the reactive CI-hardening decisions survive as design rationale.
- **W5 — CLI guards have no automated regression test.** `env-preflight.js:25-39` (63.41% line coverage), `migrate-and-start.js:77-80`, and `smoke-test.js`'s guard are all uncovered. Spec R3.1 requires "MUST exit non-zero"; the automated test asserts only `checkEnv()`'s *return value*. Task 1.4 explicitly scoped CLI testing out, and task 6.2 verified it manually — as did this verification (exit 1 / exit 0+WARN / exit 0 silent all confirmed). The behavior is correct today; nothing guards it tomorrow.

**SUGGESTION**:

- **S1** — `scripts/deploy/` is outside every ESLint scope (backend lints `src/` only, no root eslint config, `scripts/` is not a workspace package). Concrete evidence this matters: `scripts/deploy/smoke-test.test.js:66` computes `firstLive200Index` and never uses it — dead code a linter would have caught.
- **S2** — `smoke-test.js`'s timeout is not tightly bounded. `pollUntilHealthy` sleeps a full `POLL_INTERVAL_MS` after a failed attempt without re-checking the deadline, so each phase can overshoot by up to ~1s. Observed this session: `SMOKE_TEST_TIMEOUT_MS=1200` reported `elapsed: 2125ms`. Immaterial at the 60000ms default; would matter for a caller setting a short timeout.
- **S3** — R2.3's two halves are split across two tests (ordering proven with 503s, connection-refusal tolerance proven separately). A single case where the port is initially closed and then opens would cover the scenario's literal GIVEN ("not yet accepting connections") in one test.
- **S4** — `migrate-and-start.test.js:87` asserts `detached === true`, an implementation detail rather than a behavior. Acceptable as-is: the behavioral proof (no orphaned grandchild) lives in the integration test's `close`-event assertion, which is the stronger guard.
- **S5** — `node --test --experimental-test-coverage` silently omits `smoke-test.js` from the aggregate report, and reports "all files 100%" with zero file rows when that file is run alone. Do not use these numbers as a coverage gate without cross-checking.
- **S6** — `migrate-and-start.test.js:122` has 3 mocks to 1 assertion. Low priority: the assertion is behavioral and the process boundary genuinely requires doubles.

### Verdict

**PASS WITH WARNINGS**

All 27 tasks are complete and independently confirmed against the files. All 4 spec requirements and all 10 scenarios are implemented and backed by tests that were executed and passed this session (18/18 unit, 14/14 real-MySQL integration, 673+144 root regression, lint and build clean). Zero CRITICAL findings and zero blockers. The 5 divergences from tasks.md are post-hoc CI-hardening improvements that make the implementation *more* spec-compliant than planned, not defects. The 5 warnings are all documentation, bookkeeping, or regression-guard gaps — none contradicts a spec requirement and none blocks archive.
