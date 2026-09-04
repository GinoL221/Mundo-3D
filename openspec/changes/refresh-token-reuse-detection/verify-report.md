```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:077ec5535c0f29f2cc099f4857ef4bbeabb3e516f4505072ad2cc3302ac18506
verdict: pass
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 13/13
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:d1820bae657bb8dbd95b9967dce6ffed87fb89dcfb489655b5b01a2341933a23
build_command: pnpm type-check
build_exit_code: 0
build_output_hash: sha256:a88b902fe05948004b6929fbe435179d09244aea65be696ee50cf44a6c43f12c
```

## Verification Report

**Change**: refresh-token-reuse-detection
**Version**: delta spec for `refresh-token-rotation` (4 requirements, 13 scenarios)
**Mode**: Strict TDD
**Verified at**: `main` @ `d2761a8`, working tree clean apart from `.impeccable/` (untracked tool cache, excluded from attempt scope)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 20 |
| Tasks incomplete | 1 (task 2.5, blocked by environment permission denial) |

Task 2.5 (`.env.example` gains `REFRESH_TOKEN_REAP_SECONDS=86400`) is recorded as blocked in
`tasks.md:54` and `apply-progress.md:94-99`, confirmed independently by the orchestrator. It is a
documentation-only gap: `refreshTokenRetention.ts:4` reads `process.env.REFRESH_TOKEN_REAP_SECONDS`
with a working `86400` default, so no behaviour depends on it. Classified WARNING (cleanup task),
not CRITICAL (core task).

### Build & Tests Execution

**Build (type-check)**: PASSED

```text
pnpm type-check -> exit 0
pnpm --filter backend architecture:check -> exit 0
```

`architecture:check` passing clean is the runtime proof of design D3 — `RefreshSessionUseCase`
reaches revocation through the domain port it already holds, with no banned
application -> application import.

**Tests**: PASSED

```text
pnpm test -> exit 0
  backend:  Test Suites: 122 passed, 122 total
            Tests:       1013 passed, 1013 total
  frontend: Test Files   20 passed (20)

npx jest --config jest.integration.config.js --testPathPatterns=SequelizeRememberTokenRepository
  -> exit 0
  Test Suites: 1 passed, 1 total
  Tests:       13 passed, 13 total   (real MariaDB)
  output hash: sha256:24fe1f47f69f24fe05db1f934e0251956da4b00e74597b41b1e9c45770b56826
```

The two `deploy-migrate-and-start.integration.test.js` failures reported at apply time were not
re-run here: that file is outside the diff (`git diff --stat 645e313..HEAD` confirms), and it fails
on a hardcoded `root`/empty-password fallback that does not match this maintainer's MariaDB. Recorded
as pre-existing and unrelated, not re-litigated.

**Coverage**: Not collected for this run - informational only, never blocking.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Refresh Token Reuse Detection | Every family member is rejected after detection | `SequelizeRememberTokenRepository.integration.test.ts:404` + `RefreshSessionUseCase.test.ts:76` + `UserApiController.test.ts:513` | PARTIAL |
| Refresh Token Reuse Detection | The reuse response is indistinguishable from an ordinary rejection | `UserApiController.test.ts:525` vs `:513` | COMPLIANT |
| Refresh Token Reuse Detection | Reuse is logged server-side | `RefreshSessionUseCase.test.ts:169` | COMPLIANT |
| Retention on Rotation | Rows past the retention cutoff are reaped | `SequelizeRememberTokenRepository.integration.test.ts:375` | COMPLIANT |
| Retention on Rotation | A row survives well past the old cutoff | `SequelizeRememberTokenRepository.integration.test.ts:345` | COMPLIANT |
| Retention on Rotation | A grace hit leaves the family untouched | `RefreshSessionUseCase.test.ts:128` (`:150-153`) + `SequelizeRememberTokenRepository.integration.test.ts:316` | COMPLIANT |
| Rotation on Every Use With a Grace Window | Successful refresh rotates the token | `RefreshSessionUseCase.test.ts:111` + `RotateRefreshTokenUseCase.test.ts:40` | COMPLIANT |
| Rotation on Every Use With a Grace Window | Grace hit issues an access cookie only, without re-rotating | `UserApiController.test.ts:486` | COMPLIANT |
| Rotation on Every Use With a Grace Window | Replay past the grace window fails | `RefreshSessionUseCase.test.ts:156` + `UserApiController.test.ts:525` | COMPLIANT |
| Rotation on Every Use With a Grace Window | Family id is populated on every row | `SequelizeRememberTokenRepository.integration.test.ts:174` | COMPLIANT |
| Rotation on Every Use With a Grace Window | A past-grace replay revokes the family | `RefreshSessionUseCase.test.ts:156` (`:163-166`) | COMPLIANT |
| Concurrent Refresh From Multiple Tabs | Two tabs refresh concurrently and both stay logged in | `SequelizeRememberTokenRepository.integration.test.ts:106` + `RefreshSessionUseCase.test.ts:128` | COMPLIANT |
| Concurrent Refresh From Multiple Tabs | A losing tab's grace hit never triggers reuse detection | `RefreshSessionUseCase.test.ts:128` (`:153` only) | PARTIAL |

**Compliance summary**: 11/13 COMPLIANT, 2/13 PARTIAL, 0 UNTESTED, 0 FAILING.

Both PARTIAL entries are explained under Issues Found (W3, S1). Neither is a behavioural defect: in
both cases the shipped code does the right thing and can be shown to do so by reading it; what is
missing is an assertion that pins the clause against a future edit.

### Correctness (Static Evidence)

Security claims were checked in the production code, not only in the tests, per the launch prompt.

| Claim | Status | Evidence |
|-------|--------|----------|
| Reuse response byte-identical to an ordinary 401 | VERIFIED | `UserApiController.ts:102-105` - `'rejected'` and `'reuse-detected'` share one `if`, one `res.status(401)`, one object literal. Identity is structural, not merely asserted. No header, field or status varies. |
| Logger never receives `tokenHash` / `successorHash` | VERIFIED | `RefreshSessionUseCase.ts:138-149` logs exactly `event, familyId, userId, supersededAt, ageSeconds, revokedRows, timestamp`. The human message (`:148`) interpolates `familyId` only. Matches design D6's field table exactly. |
| A `revokeFamily` failure propagates, never degrades to 401 | VERIFIED | No try/catch at `RefreshSessionUseCase.ts:134`. The only try/catch (`:91-109`) wraps the rotate call; `resolveGraceOrReject` is invoked at `:106` from inside that catch handler and at `:113` outside it - in neither position is a throw from `:134` caught. Surfaces via `UserApiController.ts:135-137` -> `next(error)` -> 500. |
| Rows 1, 2, 3 and the `!familyId` guard still return plain `'rejected'` | VERIFIED | `RefreshSessionUseCase.ts:74, 80, 84, 123` unchanged; negative `revokeFamily` assertions at test `:73, :86, :97, :107`. |
| Retention decoupled from grace | VERIFIED | `RotateRefreshTokenUseCase.ts:54` passes `this.reapSeconds`; constant at `refreshTokenRetention.ts:4`; composition root wires it at `routes/api/users.ts:45`. |
| Dead `GRACE_SECONDS` removed, `RefreshTokenRotationLostRaceError` re-export kept | VERIFIED | `rg --pcre2 '(?<!TOKEN_)\bGRACE_SECONDS\b'` over `backend/ frontend/ e2e/` returns exactly one hit, a historical comment at `RotateRefreshTokenUseCase.test.ts:50`. The module-level export and its import are gone. The re-export survives at `RotateRefreshTokenUseCase.ts:12` and is genuinely consumed - see W4 for the misrecorded reason. |
| 250-line cap held | VERIFIED | `UserApiController.ts` 206, `sessionCookies.ts` 178, `RefreshSessionUseCase.ts` 175, `routes/api/users.ts` 221, `RotateRefreshTokenUseCase.ts` 59, `refreshTokenRetention.ts` 4. |

### Changed-Signature Sweep

The predecessor's worst defect was a changed signature silently defaulting at an unswept call site.
Every construction site of both changed constructors was enumerated and checked.

| Constructor | Site | Argument supplied | Verdict |
|---|---|---|---|
| `RotateRefreshTokenUseCase` (4th arg `reapSeconds`) | `routes/api/users.ts:41-46` | `REFRESH_TOKEN_REAP_SECONDS` | CORRECT |
| `RotateRefreshTokenUseCase` | `RotateRefreshTokenUseCase.test.ts:51` | `86400` | CORRECT |
| `RotateRefreshTokenUseCase` | `RotateRefreshTokenUseCase.test.ts:76` | `30` (triangulation - proves injection, not a hardcode) | CORRECT |
| `RotateRefreshTokenUseCase` | `RotateRefreshTokenUseCase.test.ts:88` | `86400` | CORRECT |
| `RefreshSessionUseCase` (5th arg `LoggerPort`) | `routes/api/users.ts:47-53` | `new PinoLogger()` | CORRECT |
| `RefreshSessionUseCase` | `RefreshSessionUseCase.test.ts:57` | `mockLogger` | CORRECT |

Six sites total, no others exist in `backend/` or `e2e/`. Both arguments are required with no default
parameter, so an omission is a compile error rather than a silent fallback - design D1's stated
lesson from the predecessor holds. No fixture or helper constructs either class.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 - retention constant in infrastructure, injected, no default | Yes | `refreshTokenRetention.ts:4`; required 4th ctor arg at `RotateRefreshTokenUseCase.ts:28`. |
| D2 - payload-free `'reuse-detected'`; rows 1-3 keep `'rejected'` | Yes | `RefreshSessionUseCase.ts:24` carries no payload; the comment at `:21-23` states why. |
| D3 - `revokeFamily` via the repository port, failure propagates | Yes | `:134`, no try/catch; `architecture:check` clean. |
| D4 - `establishSession` + `UserAuthDto` moved to `sessionCookies.ts` | Yes | Move is verbatim; the 21 pre-existing controller tests pass unedited. Line counts 206/178 vs design's ~208/~164 estimate. |
| D5 - lock contention proven against a real DB | Yes | `SequelizeRememberTokenRepository.integration.test.ts:429`, real `Promise.allSettled`, invariant assertions rather than a fixed winner. |
| D6 - `logger.warn`, family-scoped, no token material | Yes | Field-for-field match, including the negative assertions at test `:188-189`. |
| D7 - no migration, no schema change | Yes | `git diff --stat 645e313..HEAD` touches no migration and no `checkPendingMigrations.js`. |
| Live spec not yet merged | Correct | `git diff --name-only 645e313..HEAD -- openspec/specs/` is empty. Merging is archive's job, not drift. |

**Design deviations**: none found.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | `apply-progress.md:10-23`, one row per task group. |
| All tasks have tests | Yes | 20/20 completed tasks; 4 are structural wiring or audit with no test surface, each declared as such. |
| RED confirmed (tests exist) | Yes | 4/4 test files exist and carry the claimed cases. |
| GREEN confirmed (tests pass) | Yes | 48/48 in this change's direct scope re-executed here: 22 + 10 + 3 unit, 13 integration. |
| Triangulation adequate | Yes | `RotateRefreshTokenUseCase.test.ts:51/:76` inject two different cutoffs; `RefreshSessionUseCase.test.ts:173` overrides `revokedRows` to 2 against the `beforeEach` default of 1. |
| Safety Net for modified files | Yes | 21/21 controller, 7/7 use-case, 2/2 rotate, 8/8 integration baselines recorded pre-change. |

**TDD Compliance**: 6/6 checks passed. One recorded RED failure *mode* is questionable - see S3.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 35 | 3 | Jest + ts-jest |
| Integration (real MariaDB) | 13 | 1 | Jest + `jest.integration.config.js` |
| E2E | 0 | 0 | Playwright installed; design.md declares E2E "None" with reason |
| **Total** | **48** | **4** | |

### Changed File Coverage

Coverage analysis skipped - not collected for this run. Informational only, never blocking.

### Assertion Quality

No tautologies, no orphan empty-collection checks, no ghost loops, no assertion-without-production-call,
no smoke-test-only cases were found across the four test files. Negative assertions
(`not.toHaveBeenCalled`, `not.toHaveProperty`) are paired with positive ones in the same or a sibling
test, so none stands alone. The one loop over a collection
(`SequelizeRememberTokenRepository.integration.test.ts:474-476`) is guarded by the preceding
`expect(finalCount).toBeGreaterThanOrEqual(1)`, so it cannot be a ghost loop.

**Assertion quality**: All assertions verify real behaviour. 0 CRITICAL, 0 WARNING.

### Quality Metrics

**Linter**: Not re-run (orchestrator reported clean pre-commit).
**Type Checker**: No errors (`pnpm type-check` exit 0).
**Architecture boundary check**: No violations (`pnpm --filter backend architecture:check` exit 0).

### Issues Found

**CRITICAL**: None.

**WARNING**:

- **W1 - The domain port still calls the retention cutoff a "grace window".**
  `backend/src/domain/ports/RememberTokenRepositoryPort.ts:29` reads
  "Deletes rows in the family whose grace window has already elapsed", and its parameter is still
  named `graceSeconds` (`:30`). The implementation repeats it:
  `backend/src/infrastructure/repositories/SequelizeRememberTokenRepository.ts:111-122`
  ("any row still inside its grace window are never touched", "a row whose grace window has fully
  elapsed is reapable"). The delta spec's MODIFIED "Retention on Rotation" requirement states the
  opposite in as many words: the cutoff "is independent of the 30-second grace window ... grace
  decides accept-vs-reject; retention decides how long a superseded row survives". design.md listed
  both files as deliberately unchanged, which correctly covers their *behaviour* - but nobody
  re-read their prose after the semantics moved, so the contract every reader consults still
  documents the conflation this change exists to break. Behaviour is correct; the documentation is
  the pre-change world.

- **W2 - `RefreshTokenGrace.ts`'s header names a consumer that no longer exists.**
  `backend/src/domain/entities/RefreshTokenGrace.ts:1-5` says the constant is "shared by
  RotateRefreshTokenUseCase (reap cutoff) and RefreshSessionUseCase (grace-hit detection)" and lives
  in `domain/` "so neither imports the other's module directly". Task 2.3 deleted
  `RotateRefreshTokenUseCase`'s import of it. Verified: `REFRESH_TOKEN_GRACE_SECONDS` now has exactly
  one consumer, `RefreshSessionUseCase.ts:7`. The comment names a dead consumer, labels the grace
  window a "reap cutoff", and states a placement rationale that no longer applies. Same conflation as
  W1, one layer in.

- **W3 - A spec scenario clause has no covering assertion.**
  "A losing tab's grace hit never triggers reuse detection" requires "the family MUST NOT be revoked
  **and no reuse event MUST be logged**". `backend/src/application/__tests__/RefreshSessionUseCase.test.ts:128-154`
  (row 5) asserts `revokeFamily` was not called (`:153`) but never asserts `mockLogger.warn` was not
  called - even though the sibling `!familyId` guard test does exactly that at `:108`. The lost-race
  path that resolves to grace (`:204-220`) has the same gap. The behaviour is correct today because
  the `logger.warn` call sits inside the past-grace branch at `RefreshSessionUseCase.ts:138`, but the
  clause is unpinned: an edit that logs on the grace path would ship green.

- **W4 - `apply-progress.md` records a false justification for keeping the re-export.**
  `apply-progress.md:162-163` states the `RefreshTokenRotationLostRaceError` re-export was kept
  because it is "still genuinely used by `RefreshSessionUseCase.ts`'s import". It is not:
  `RefreshSessionUseCase.ts:8` imports the symbol from
  `../../domain/exceptions/RefreshTokenRotationLostRaceError`, the canonical domain path, not from
  `RotateRefreshTokenUseCase`. The re-export's only real consumer is
  `RotateRefreshTokenUseCase.test.ts:1`. The decision is right and the source comment at
  `RotateRefreshTokenUseCase.ts:8-11` describes it correctly; only the durable record is wrong. It is
  wrong in the dangerous direction - a future maintainer who checks the recorded reason, confirms
  `RefreshSessionUseCase` does not need it, and deletes the re-export breaks the test file.

- **W5 - Two recorded counts do not match the tree.**
  (a) `apply-progress.md:33` records "`pnpm test` -> **1014/1014 backend**". Measured on the
  committed tree: **1013 passed, 122 suites**. The delta is consistent with the redundant test
  removed during the REFACTOR step (`apply-progress.md:15`) having been counted before its removal.
  (b) `apply-progress.md:5` records "**20/20 tasks addressed - 19 complete, 1 blocked**". `tasks.md`
  actually carries **21** task checkboxes (20 `- [x]`, 1 `- [ ]`), and native
  `gentle-ai sdd-status` independently reports `total: 21, completed: 20, pending: 1`. Both recorded
  totals are one low. Neither changes any outcome, but a completion record that miscounts its own
  denominator is exactly the artifact a later phase trusts instead of re-deriving.

- **W6 - Task 2.5 is incomplete.**
  `.env.example` still lacks `REFRESH_TOKEN_REAP_SECONDS=86400`. Blocked by an environment permission
  denial, confirmed independently by the orchestrator, and honestly recorded in `tasks.md:54` and
  `apply-progress.md:94-99`. Documentation-only: `refreshTokenRetention.ts:4` defaults to `86400`.
  Carry to archive as a maintainer follow-up. Not re-litigated here, and no read or write of that file
  was attempted.

**SUGGESTION**:

- **S1** - "Every family member is rejected after detection" is proven by composition, never
  end-to-end: real-DB revocation (`integration.test.ts:404`), revoked-row -> `'rejected'`
  (`RefreshSessionUseCase.test.ts:76`), `'rejected'` -> 401 (`UserApiController.test.ts:513`). Every
  link passes at its own layer; no single test presents a family member to `POST /api/users/refresh`
  and observes 401. design.md's Testing Strategy declares this inherited gap explicitly ("no
  HTTP-level test exists for `/api/users/refresh`", Engram #7158) and this change does not create
  that tier. Recorded, not charged against this change.

- **S2** - `tasks.md:45` (task 1.2) and `apply-progress.md:135` say `UserApiController.ts` "imports
  both" `UserAuthDto` and `establishSession` from `sessionCookies.ts`. It imports only
  `establishSession` (`UserApiController.ts:13-20`); `UserAuthDto` has no consumer outside
  `sessionCookies.ts`. Not importing it is the correct outcome - an unused import would fail lint -
  so this is a record inaccuracy, not a code defect.

- **S3** - `apply-progress.md:16` records task 3.4's RED as "1 failed (`res.status` never called)".
  `backend/jest.config.js:18` uses `ts-jest` with default diagnostics enabled, so the union-narrowing
  failure design.md D2 deliberately relies on ("adding a payload-free variant makes TypeScript fail
  the build until the controller handles it") would have surfaced as a compile error, not a runtime
  assertion failure. The test itself is genuine, meaningful and passing; the recorded failure mode
  reads as a semantic paraphrase rather than literal runner output. This cannot be re-verified after
  the fact and is reported as an observation, not a finding of fabrication.

- **S4** - `tasks.md:75` (task 5.1) as written asks to confirm `rg GRACE_SECONDS backend/src`
  "returns no results". It returns one: the historical comment at
  `RotateRefreshTokenUseCase.test.ts:50`. The task's own parenthetical and `apply-progress.md:23`
  both amend this honestly; only the headline task text overstates. The comment itself is legitimate -
  it explains why the assertion changed.

- **S5** - The `~497`-line diff against the 400-line budget is confirmed
  (`git diff --stat 645e313..HEAD` = 419 insertions + 74 deletions across the 10 code files, plus 4
  for `refreshTokenRetention.ts`). The maintainer's accepted `size:exception` is recorded in
  `tasks.md:18-31` and `apply-progress.md:145-154`. Not re-litigated.

### Archive Readiness - Native Blocker (not a verification failure)

`gentle-ai sdd-status refresh-token-reuse-detection --json` reports, independently of this
verification:

```text
nextRecommended: resolve-blockers
dependencies: { apply: blocked, verify: blocked, archive: blocked }
blockedReasons: [
  "blocked(edit_authority_missing): tasks.md targets edit paths outside the authorized edit
   roots: \"/\"; edit tasks.md so every work unit stays inside the authorized edit roots, or
   grant this change edit authority for the named paths, or mark a read-only input with
   (read-only) right after its backticked path"
]
```

The status also carries a blocking `gentle-ai.sdd-integration.consent/v1` envelope offering
`granted` / `declined`. **That decision belongs to the human, relayed by the orchestrator.** This
verify phase neither answered it nor ran any grant invocation.

This blocker and pending task 2.5 are the same underlying fact: task 2.5's target, `.env.example`,
resolves outside this change's authorized edit roots, which is also why the apply phase could not
write it. It is a governance gate, not a defect in the implementation and not a verification
prerequisite - every test, type-check and boundary check above executed and passed on the committed
tree regardless of it.

### Verdict

**PASS WITH WARNINGS**

Every one of the 13 delta-spec scenarios has executing coverage and nothing fails: 1013 backend +
20 frontend suites green, 13/13 real-DB integration green, type-check and architecture boundary check
clean. All four security claims were confirmed in the production source rather than only in test
assertions - the reuse 401 is structurally the same statement as the ordinary 401, the log carries no
token material, a `revokeFamily` failure genuinely escapes to a 500, and all six construction sites of
the two changed constructors pass the right argument. No CRITICAL issue blocks archive.

Six WARNINGs are documentation and record drift, not behaviour: three source comments and a domain
port still describe the reap cutoff as the grace window (W1, W2) - precisely the conflation this
change's own spec forbids - one spec clause is asserted only halfway (W3), and two durable records
state things that are not true of the tree they describe (W4, W5). W6 is the known, accepted,
environment-blocked `.env.example` entry. None of the six is a behavioural defect, and none of them is what stops archive: archive is gated by
native `blocked(edit_authority_missing)`, a human decision recorded above and untouched by this
phase. All six warnings should be carried into the archive record rather than closed silently.
