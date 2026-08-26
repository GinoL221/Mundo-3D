```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c1398edc09e202a315ed4f4d23b4f6b136834f8151a1bb2c48510e820a82ec59
verdict: fail
blockers: 1
critical_findings: 1
requirements: 3/4
scenarios: 7/8
test_command: pnpm --filter backend test && pnpm --filter backend test:integration
test_exit_code: 0
test_output_hash: sha256:a8b78eff05fc7d9a5e2faad71a5e8b39ee82a8cd81d08ca9fddf2f062ad49ff6
build_command: pnpm run type-check
build_exit_code: 0
build_output_hash: sha256:a88b902fe05948004b6929fbe435179d09244aea65be696ee50cf44a6c43f12c
```

## Verification Report

**Change**: concurrency-tests
**Version**: N/A
**Mode**: Strict TDD
**Branch verified**: `tmp/concurrency-tests-combined-verify` (merge-base with `origin/main`: `9488b10`)
**Commits**: `1f97b85` (cart race), `d58b558` (registration fix + RED unit test), `e83c5a8` (registration race test)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 20 |
| Tasks complete | 14 |
| Tasks incomplete | 6 (Phase 7 verification tasks 7.1-7.6) |

All 6 incomplete tasks are the Phase 7 verification tasks that this verify run itself executed. Their substance is satisfied by the evidence below; only the checkbox bookkeeping in `tasks.md` is outstanding.

### Build & Tests Execution

**Build (type-check)**: PASS — `pnpm run type-check` (`tsc --noEmit`), exit 0, no output.

**Lint**: PASS — `pnpm run lint` (`eslint src/`), exit 0, no findings.

**Tests**: PASS

```text
pnpm --filter backend test          -> Test Suites: 90 passed, 90 total  | Tests: 667 passed, 667 total  | exit 0
pnpm --filter backend test:integration -> Test Suites: 5 passed, 5 total | Tests:  12 passed,  12 total  | exit 0
```

Focused / repeat runs (flake confidence, task 7.2):

```text
npx jest SequelizeUserRepository.test                                          -> 9/9 passed
npx jest --config jest.integration.config.js SequelizeShoppingCartRepository.integration -> 2/2 passed x 6 consecutive runs
npx jest --config jest.integration.config.js SequelizeUserRepository.integration        -> 1/1 passed x 3 consecutive runs
```

Zero flakes observed across 6 cart-race runs and 3 registration-race runs. The full integration suite ran green in this pass, including the known resource-contention-sensitive `boot.integration.test.js` (untouched by this change).

**Coverage**: Not run — no coverage threshold configured for these suites. Informational only.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| CG: Cart Sync Last-Write-Wins | Concurrent cart syncs resolve by commit order | `SequelizeShoppingCartRepository.integration.test.ts > never corrupts the cart...` (inv. 3+5) and `> last write wins exactly when calls are sequential` | COMPLIANT |
| CG: Cart Sync Last-Write-Wins | Losing write is not merged with the winning write | `SequelizeShoppingCartRepository.integration.test.ts > never corrupts the cart...` (inv. 3+4) | COMPLIANT |
| CG: Documented Concurrency Non-Guarantees | Boot-time migration check performs no writes | `checkPendingMigrations.test.js:56-60` | COMPLIANT |
| CG: Documented Concurrency Non-Guarantees | Rate limit is enforced per process, not globally | (none found) | UNTESTED |
| UA: Business Error Propagation | Sequential duplicate email throws domain exception | `RegisterUserUseCase.test.ts:150` | COMPLIANT |
| UA: Business Error Propagation | Concurrent duplicate email throws the same domain exception | `SequelizeUserRepository.test.ts > translates a UniqueConstraintError...` + `SequelizeUserRepository.integration.test.ts` | COMPLIANT |
| UA: Controller DI and API JSON Auth | Sequential duplicate email registration returns 400 and cleans up the upload | `UserApiController.test.ts:121-142` | COMPLIANT |
| UA: Controller DI and API JSON Auth | Concurrent duplicate email registration resolves like the sequential path | `SequelizeUserRepository.integration.test.ts` | COMPLIANT |

**Compliance summary**: 7/8 scenarios compliant, 1 UNTESTED.

All 6 scenarios belonging to the two behaviors this change actually implements are COMPLIANT with runtime evidence.

`Boot-time migration check performs no writes` is COMPLIANT on genuine runtime evidence even though no test names the scenario: `checkPendingMigrations.test.js:56-60` asserts `checkNoPendingMigrations()` resolves against doubles whose entire surface is read-only (`migrator` exposes only `pending` and `options`; `queryInterface` exposes only `showAllTables` and `describeTable`). Any DDL or data-writing call would throw `is not a function` and fail that passing test, so the negative is proven at runtime, not merely by inspection.

`Rate limit is enforced per process, not globally` is UNTESTED. `registerLimiter.test.ts` / `loginLimiter.test.ts` assert the `rateLimit` config with `expect.objectContaining`, which does not assert the absence of a `store` option and therefore does not prove the default `MemoryStore` is in use. Source inspection confirms neither limiter passes a `store`, but the scenario's THEN clause describes a multi-process deployment property that no in-process test can execute.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Cart race characterized, cart production code unchanged | Implemented | `git diff --name-only 9488b10..HEAD` contains no cart production file; only the new cart integration test |
| `UniqueConstraintError` translated in the repository adapter | Implemented | `SequelizeUserRepository.create` wraps only `db.User.create`; message byte-identical to `RegisterUserUseCase.ts:25` |
| `UserAlreadyExistsException` accepts `{ cause }` | Implemented | Optional `options?: ErrorOptions` forwarded to `super`; existing single-arg call sites unaffected (667/667 unit tests green) |
| No orphaned avatar file on the losing registration | Implemented | Asserted against the real filesystem via bounded `fs.existsSync` poll, not a spy |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Load-bearing fact: `ShoppingCart` has `KEY id_user` | Yes | `20260724000000-baseline.js:113` |
| Load-bearing fact: `syncCart` = DELETE-then-INSERT in one tx, no version token | Yes | `SequelizeShoppingCartRepository.ts:51-80`; rolls back on error, which makes cart invariant 5 sound |
| Load-bearing fact: `User`'s only unique indexes are `email`..`email_5` | Yes | `20260724000000-baseline.js:40-44` |
| Test-owned barrier, no test-only production seam | Yes | Barrier is a test-local transaction + `SELECT ... FOR UPDATE`; zero production impact |
| Translation wraps ONLY `db.User.create` | Yes | `findByEmail` / `findById` / `findAll` byte-identical to base |
| No field matching on the unique constraint | Yes | `error instanceof UniqueConstraintError` only |
| `errorHandler.ts` branch rejected | Yes | `errorHandler.ts` absent from the diff |
| Registration test uses real object graph + `req`/`res` doubles | Yes | Real `SequelizeUserRepository` -> `RegisterUserUseCase` -> `UserApiController.register` |
| Orphan absence asserted on the real filesystem | Yes | `fs.existsSync` on real `fs.mkdtempSync` temp files, no `fs` spy |
| Duplicate email stays 400 (Open Question 1) | Yes | Asserted at 400 in both unit and integration tests; no status-code change in the diff |
| Both files matched by `jest.integration.config.js`, excluded from fast `npm test` | Yes | Verified empirically with `jest --listTests` on both configs |

### Out-of-Scope Confirmation

`git diff --name-only 9488b10..HEAD` returns exactly 6 source files plus 5 OpenSpec artifacts. Confirmed untouched: all stock-decrement code, all migration code, both rate limiters, `errorHandler.ts`, and every cart production file. No status code changed 400 -> 409. No schema or migration change.

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Unverifiable | `apply-progress` artifact not present on disk and Engram unavailable to this agent |
| All tasks have tests | Yes | Every implementation task maps to an executed test |
| RED confirmed | Yes (independently reproduced) | Reverting `SequelizeUserRepository.ts` to base makes `translates a UniqueConstraintError...` fail (1 failed, 8 passed); restoring makes it pass (9 passed). Tree restored clean. |
| GREEN confirmed | Yes | 9/9 in the focused unit run; 667/667 in the full unit suite |
| Triangulation adequate | Yes | Repository translation triangulated 2 ways (UniqueConstraintError -> translated; other error -> rethrown unchanged); cart triangulated 2 ways (contended + sequential) |
| Safety Net for modified files | Yes | Full 667-test unit suite green after modifying `UserAlreadyExistsException.ts` and `SequelizeUserRepository.ts` |

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (new) | 2 | 1 (`SequelizeUserRepository.test.ts`) | jest + mocks |
| Integration (new, real DB) | 3 | 2 (both `*.integration.test.ts`) | jest + real MySQL/MariaDB |
| E2E | 0 | 0 | N/A per design |
| **Total (new)** | **5** | **3** | |

### Changed File Coverage

Coverage analysis skipped — no coverage threshold is configured for these suites.

### Assertion Quality

No tautologies, no assertions that skip production code, no smoke-test-only assertions, no mock-heavy tests. Every assertion in the three changed test files exercises real production code against a real database or a real error object.

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `SequelizeShoppingCartRepository.integration.test.ts` | 102-105 | `for (const failure of rejected) { expect(...).toContain(reason.parent?.code) }` | Vacuous when both calls fulfil. Intentional per design ("assertions stay valid even if a run does not overlap") and 4 other invariants assert unconditionally, so not a ghost-loop defect. | SUGGESTION |
| `SequelizeShoppingCartRepository.integration.test.ts` | 121-122 | `expect(rows.length).toBe(winnerLength)` | Logically implied by invariant 3's deep equality; harmless redundancy. | SUGGESTION |

**Assertion quality**: 0 CRITICAL, 0 WARNING.

### Cart Race Invariant Scrutiny (highest-risk item)

| # | Invariant | Sound? | Reasoning |
|---|---|---|---|
| 1 | `fulfilled.length >= 1` | Yes | Both transactions cannot deadlock-abort each other; InnoDB always picks a victim |
| 2 | every rejection is `ER_LOCK_DEADLOCK` / `ER_LOCK_WAIT_TIMEOUT` | Yes | `reason.parent?.code` is `undefined` for a non-driver error, and `toContain(undefined)` fails, so validation/FK/connection failures are correctly caught |
| 3 | final rows deep-equal exactly A or exactly B | Yes | Both sides pass through the same `normalize()` (same key order, sorted by `idProduct`, `unitPrice` numeric), so the `JSON.stringify` comparison is safe. Disjoint product ids and different cardinality (2 vs 1) make a union or partial mix structurally distinguishable. An empty result (`[]`) matches neither and fails. The seeded pre-existing row is likewise excluded. |
| 4 | `rows.length === winner.length` | Yes (redundant) | Implied by invariant 3 |
| 5 | if exactly one fulfilled, the persisted winner is that call's payload | Yes | `syncCart` rolls back its transaction on error (`SequelizeShoppingCartRepository.ts:76-79`), so a rejected call leaves nothing persisted. `results[0]` is `syncCart(A)` by array position, matching `aFulfilled`. |

The barrier is real: `seedCartFixture()` genuinely inserts one ACTIVE `ShoppingCart` row before `findOne(... lock: t0.LOCK.UPDATE)` runs, so the `SELECT ... FOR UPDATE` always has a row to lock.

### Success Criteria Cross-Check (proposal)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Concurrent same-email registration: exactly one 201, one duplicate response matching the sequential path, no 500 | Met | `SequelizeUserRepository.integration.test.ts:120-127` asserts exactly 1 winner, exactly 1 loser with `{ error: 'Este email ya está registrado' }`, and `next` never called on either side |
| 2 | No orphaned avatar file after the losing registration | Met | `waitUntilRemoved(loserFilePath)` on the real filesystem, plus the winner's file confirmed still present |
| 3 | Cart race test passes repeatedly without flaking and documents last-write-wins | Met | 6 consecutive green runs; the sequential `it` is the documentation-grade last-write-wins assertion |
| 4 | No cart production code changed | Met | Confirmed against the real merge-base diff |
| 5 | `test:integration` green; CI `integration` job exercises both tests | Met | Suite green (12/12); `jest --listTests` confirms pickup; `.github/workflows/ci.yml` `integration` job (mysql:8.0) is a required check via `verification-gate` (`needs: [quality, integration, e2e]`) |

### Issues Found

**CRITICAL**:
1. Spec scenario `Rate limit is enforced per process, not globally` (`specs/concurrency-guarantees/spec.md:38-42`) has no covering test that passed at runtime. Per the verify contract a spec scenario is compliant only when a covering test passed, so this blocks archive as written. Note the scenario is not implementable-and-testable as stated: its THEN clause quantifies over multiple backend processes behind a load balancer, which an in-process Jest suite cannot exercise. The cheapest correct resolutions are (a) fold this non-guarantee into the requirement's prose and drop it as a GIVEN/WHEN/THEN scenario, or (b) keep it and record an explicit manual-verification waiver in project config. No production change is warranted — the proposal deliberately places rate limiting Out of Scope, and the code does use the per-process default `MemoryStore`.

**WARNING**:
1. `tasks.md` is 14/20, not 20/20 — Phase 7 (7.1-7.6) is unchecked. All six are satisfied by this run's evidence; the checkboxes must be updated before archive so the artifact matches reality.
2. `design.md`'s Testing Strategy planned no test for either scenario of the `Documented Concurrency Non-Guarantees` requirement, yet `sdd-spec` authored both as executable GIVEN/WHEN/THEN scenarios. One of the two turned out to be covered incidentally; the other is the CRITICAL above. Spec and design should agree on which requirements carry executable scenarios.
3. `apply-progress` artifact was unavailable (not on disk, Engram unreachable from this agent), so the apply phase's TDD Cycle Evidence table could not be cross-referenced. Mitigated by independently reproducing RED and GREEN from git.
4. Latent test-pollution hazard in `SequelizeUserRepository.test.ts`: the two new cases assign `(db.User as any).create = jest.fn()...` without restoring it. In the mocked branch `beforeEach` rebuilds a fresh object literal so nothing leaks, but in the `isSqliteAvailable` branch `db.User` is the shared `sqliteUserModel` and `beforeEach` reassigns the same reference, so the clobbered `create` would persist and break the `findById`/`findByEmail`/`findAll` sqlite paths (lines 100, 149, 195, 202). Currently unreachable: `sqlite3` is not a dependency of `backend/package.json` and is not installed, so `isSqliteAvailable` is always false. Harmless today, a trap if `sqlite3` is ever added.

**SUGGESTION**:
1. The registration race test cannot distinguish a loser that failed on the DB `UNIQUE` constraint (the new translation path) from one whose `findByEmail` happened to see the winner's row (the pre-existing sequential path); both produce an identical 400. This run genuinely exercised the race — the SQL log shows 2 `INSERT INTO User` statements with only 1 row persisted — but that is not asserted, so a future environment change could silently degrade the test into re-covering the sequential path. The deterministic unit test covers the translation regardless.
2. The cart race test does not assert that its barrier actually acquired a lock. `findOne` returning `null` would silently reduce the test to an unbarriered race while still passing. A single non-null assertion on the locked row would make barrier degradation visible.
3. `expect(rows.length).toBe(winnerLength)` (invariant 4) is implied by invariant 3 and could be dropped.

### Verdict

FAIL — 1 blocker.

The implemented work is sound: all 6 scenarios belonging to the two behaviors this change actually builds are COMPLIANT with runtime evidence, the production diff matches `design.md` line for line, every declared out-of-scope boundary holds, RED and GREEN were independently reproduced, and all four commands exit 0 with zero flakes across 9 repeat runs.

The single blocker is a coverage gap in an adjacent documentation-only scenario (`Rate limit is enforced per process, not globally`) that the spec phase wrote as executable but that no in-process test can execute. This is a spec-authoring correction, not an implementation defect, and it does not call any of the verified behavior into question.
