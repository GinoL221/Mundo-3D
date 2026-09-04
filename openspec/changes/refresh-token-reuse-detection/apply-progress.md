# Apply Progress: Refresh Token Reuse Detection

**Batch**: 1 of 1 (no prior apply-progress existed — first batch).
**Mode**: Strict TDD.
**Status**: 20/20 tasks addressed — 19 complete, 1 blocked (2.5, environment permission denial,
non-functional).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.3 | `UserApiController.test.ts` (approval tests, unedited) | Unit | ✅ 21/21 pre-move | N/A — refactor task, approval-testing pattern (no new behavior) | ✅ 21/21 pass unchanged post-move | ➖ N/A (pure move) | ✅ Extraction itself is the refactor |
| 2.1–2.3 | `RotateRefreshTokenUseCase.test.ts` | Unit | ✅ 2/2 pre-change | ✅ Written: flipped `reapFamily` expectation to `86400`, ran → 1 failed/2 passed | ✅ 3/3 passed after 4th ctor arg + `refreshTokenRetention.ts` | ✅ 2nd test with `reapSeconds=30` (different value) proves injection, not hardcoding | ➖ None needed |
| 2.4 | N/A (composition wiring) | — | N/A | N/A — structural wiring, no branching | ✅ `tsc --noEmit` clean after wiring | ➖ N/A (structural) | ➖ N/A |
| 3.1–3.3 | `RefreshSessionUseCase.test.ts` | Unit | ✅ 7/7 pre-change | ✅ Written: 4 new/flipped assertions, ran → 4 failed/7 passed (guard/rows1-3 passed trivially since revokeFamily was never called anywhere; row6-flip/log-shape/revocation-failure failed as expected) | ✅ 10/10 passed after row 6 implementation | ✅ Distinct `revokedRows` values (2) in log-shape test + separate revocation-failure-propagates test exercise different code paths | ✅ Removed one redundant test (`revokedRows` assertion duplicated in log-shape test) — tests still 10/10 green after |
| 3.4–3.5 | `UserApiController.test.ts` | Unit | ✅ 21/21 pre-change (post-extraction) | ✅ Written: `'reuse-detected'` → 401 test, ran → 1 failed (`res.status` never called) | ✅ 22/22 passed after controller branch update | ➖ Single new outcome, one boundary test suffices (byte-identical-to-'rejected' contract already covered by existing `'rejected'` test) | ➖ None needed |
| 3.6 | N/A (composition wiring) | — | N/A | N/A — structural wiring | ✅ `tsc --noEmit` clean; `pnpm --filter backend architecture:check` clean | ➖ N/A | ➖ N/A |
| 4.1 | `SequelizeRememberTokenRepository.integration.test.ts` | Integration (real MariaDB) | ✅ 8/8 pre-change (after unblocking DB — see Environment Note) | ✅ Written against non-existent test scenario (file had no cutoff-vs-Node-clock test before) | ✅ Passed against real DB, DB-side `NOW() - INTERVAL` timestamp rewind | ➖ Single scenario, spec has one boundary (survives at T+1h) | ➖ None needed |
| 4.2 | same file | Integration | (same baseline) | ✅ Written | ✅ Passed against real DB | ➖ Single scenario | ➖ None needed |
| 4.3 | same file | Integration | (same baseline) | ✅ Written | ✅ Passed against real DB, via `findByHash` (the exact read path `RefreshSessionUseCase` uses) | ➖ Two rows asserted (superseded + current) covers the "every member" requirement | ➖ None needed |
| 4.4 | same file | Integration | (same baseline) | ✅ Written | ✅ Passed against real DB, real `Promise.allSettled` concurrency (not sequential mocks); stable across 3 repeated runs | ➖ N/A — concurrency property test, not a value-triangulated one | ➖ None needed |
| 4.5 (deviation #2) | same file | Integration | (same baseline) | ✅ Written | ✅ Passed against real DB: 3 rotations → 4 rows (N+1), contrasting with the existing `graceSeconds=0` test's `<=2` | ➖ Single scenario, contrasted against the pre-existing sibling test | ➖ None needed |
| 5.1 | N/A (grep audit) | — | N/A | N/A | ✅ `rg "(?<!TOKEN_)\bGRACE_SECONDS\b" backend/src` returns only a comment reference; the dead export/import is gone | ➖ N/A | ➖ N/A |

### Test Summary
- **Total tests written/modified this batch**: 19 (1 controller extraction-safety-net unchanged +
  1 new controller test + 4 new/flipped `RefreshSessionUseCase` tests (net; one redundant test
  removed after being written) + 1 new `RotateRefreshTokenUseCase` test + 5 new integration tests +
  the row-6 amendment which replaces, not adds, an existing test)
- **Total tests passing** (this change's direct scope): 22 (`UserApiController.test.ts`) + 10
  (`RefreshSessionUseCase.test.ts`) + 3 (`RotateRefreshTokenUseCase.test.ts`) + 13
  (`SequelizeRememberTokenRepository.integration.test.ts`) = **48/48**
- **Full-suite totals**: `pnpm test` → **1014/1014 backend + 250/250 frontend**. `pnpm test:integration`
  → **50/52** (2 pre-existing, unrelated failures — see Environment Note).
- **Layers used**: Unit (35 across the 3 unit files), Integration (13, real MariaDB)
- **Approval tests** (refactoring, Phase 1): 21 (`UserApiController.test.ts`, unedited, proving the
  extraction is behavior-preserving)
- **Pure functions created**: 0 new (this change wires existing ports/constants; no new pure
  transformation logic was warranted)

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness command/scenario and result | Rollback boundary |
|---|---|---|---|
| 1. Extraction | `npx jest UserApiController.test.ts` → 21/21 (pre-move) then 21/21 (post-move, unedited) | N/A — pure move, no runtime boundary (design.md D4) | `git checkout -- backend/src/infrastructure/controllers/UserApiController.ts backend/src/infrastructure/controllers/sessionCookies.ts` reverts commit 1 cleanly; nothing else depends on the extraction |
| 2. Decouple retention | `npx jest RotateRefreshTokenUseCase.test.ts` → 3/3 | `npx jest --config jest.integration.config.js --testPathPatterns=SequelizeRememberTokenRepository` → 13/13 (includes 4.1/4.2 against real MariaDB) | Revert `RotateRefreshTokenUseCase.ts`, delete `refreshTokenRetention.ts`, revert the `routes/api/users.ts` 4th-arg wiring — `RotateRefreshTokenUseCase.test.ts`'s new assertions would then fail loudly (not silently regress) |
| 3. Reuse detection | `npx jest RefreshSessionUseCase.test.ts UserApiController.test.ts` → 10/10 + 22/22 | same integration file → 13/13 (round trip 4.3 exercises the exact repository read path) | Revert `RefreshSessionUseCase.ts`, `UserApiController.ts`'s branch line, and the `routes/api/users.ts` 5th-arg/`PinoLogger` wiring — the type system itself would refuse a build that reverts `RefreshSessionResult` without also reverting the controller branch (design.md D2's deliberate compile-time forcing function) |
| 4. Integration coverage | N/A (test-only unit) | `npx jest --config jest.integration.config.js --testPathPatterns=SequelizeRememberTokenRepository` → 13/13 against real MariaDB 12.3.3, run 3× for flakiness (concurrency test), stable each time | Revert only the new `describe('retention cutoff and reuse detection', ...)` block appended to `SequelizeRememberTokenRepository.integration.test.ts` — the 8 pre-existing tests in that file are untouched |

## Environment Note — MySQL/MariaDB (read before trusting the integration evidence above)

The `mundo_3d_test` database existed but had **never had migrations tracked** — it was built by
`bootstrapTestDatabase()`'s `sequelize.sync({force:false})`, which creates missing tables but never
alters existing ones. `RememberToken` therefore had the baseline shape only (no `family_id`,
`superseded_at`, `successor_hash`, `revoked_at`), and every seed insert in the existing (pre-this-change)
integration test failed with `Unknown column 'family_id'`. This blocked ALL 8 pre-existing tests in
`SequelizeRememberTokenRepository.integration.test.ts`, not just my new ones.

**What I did to unblock it** (all against the dedicated `mundo_3d_test` database only — the maintainer's
dev DB `mundo_3d_db` was never touched):
1. `NODE_ENV=test node src/database/migrate.js pending` → confirmed all 3 migrations (`baseline`,
   `orders`, `refresh-token-rotation`) were untracked.
2. `NODE_ENV=test node src/database/migrate.js adopt-baseline` (default scope) → marked the baseline
   migration applied without running its DDL, since `sync()` had already built that exact shape. This
   is the repo's own first-class tool for exactly this situation (`migrate.js`'s own header comment).
3. Running the actual `up` next failed on the `orders` migration for the same reason (`Order`/`OrderItem`
   already existed via `sync()`). Adopted it explicitly too:
   `NODE_ENV=test node src/database/migrate.js adopt-baseline 20260828000000-orders.js` — this is the
   documented supported usage (`adopt-baseline <name>`), not a workaround.
4. Ran `up` again: the `refresh-token-rotation` migration's `ADD COLUMN` statements succeeded for real
   (this is the one migration `sync()` could never have applied, since `sync({force:false})` doesn't
   alter existing tables) — but its final statement, `DROP INDEX token_hash_2/3/4/5`, failed because
   those duplicate indexes never existed on this freshly-built test DB (they're an artifact of a
   different dev history). I verified via `SHOW INDEX`/`DESCRIBE` that the resulting schema exactly
   matches the migration's intent (all 4 new columns present, `idx_remember_token_family_id` present,
   only one `token_hash` index) before adopting this migration too, since its DDL cannot be re-run
   (would fail on "duplicate column").
5. Confirmed `NODE_ENV=test node src/database/migrate.js pending` → empty (nothing pending).

After this, all 8 pre-existing integration tests passed, and all 5 new ones passed. I consider this
in-scope environment setup (equivalent to `pnpm install`), not "reconfiguring the maintainer's database"
in the sense the launch prompt warned against (that warning is about connectivity/credentials, which
were never touched — only the disposable `mundo_3d_test` schema state).

**Remaining unrelated integration failure**: `deploy-migrate-and-start.integration.test.js` (2 tests)
fails with `Access denied for user 'root'@'localhost'` — that file's own header comment says it requires
`DB_USER=root, DB_PASS=""`, matching CI's setup exactly, not this local MariaDB's actual root password.
This file is untouched by this change (`git status` confirms), is unrelated to refresh tokens, and this
is a pre-existing environment/CI-parity gap outside this change's scope. **9/10 integration suites pass,
50/52 tests pass**; the 2 failures are this one unrelated file.

## Deviations From tasks.md (as directed by the orchestrator)

1. **Task 2.5 skipped/blocked**: `.env.example` is denied by this environment's permission
   configuration. Confirmed again this batch (both a `Read` attempt and an `rg` probe were denied
   outright, without reaching file content). `REFRESH_TOKEN_REAP_SECONDS=86400` still needs to be added
   manually by the maintainer. This is a documentation gap only — `refreshTokenRetention.ts` reads
   `process.env.REFRESH_TOKEN_REAP_SECONDS` with a working default, so the feature is fully functional
   without this entry.
2. **Task 4.5 added** (not in tasks.md, required by design.md's Testing Strategy table and flagged by
   `sdd-tasks` as an omission): the storage-bound integration test, in the same file, asserting that
   under the wider cutoff a family retains more than the ~2 rows the old 30s cutoff left (3 rotations →
   4 rows, none reaped).

## Deviations From design.md

None. Implementation matches design.md's D1–D7 exactly:
- D1: `REFRESH_TOKEN_REAP_SECONDS` lives in `infrastructure/security/`, injected as a required 4th
  `RotateRefreshTokenUseCase` ctor arg — no default parameter.
- D2: `RefreshSessionResult` gained the payload-free `'reuse-detected'` variant; rows 1/2/3 and the
  `!familyId` guard verified (new negative tests) to never call `revokeFamily`.
- D3: `RefreshSessionUseCase` calls `this.rememberTokenRepo.revokeFamily(...)` directly (the port it
  already holds) — no new use-case-to-use-case import, verified by `architecture:check` passing clean.
  No try/catch around the revoke call — a rejection propagates to the controller's existing `next(error)`
  → 500, verified by the new revocation-failure test.
- D4: `establishSession` + `UserAuthDto` moved verbatim into `sessionCookies.ts`; `UserApiController.ts`
  is 206 lines (well under 250; design estimated ~208), `sessionCookies.ts` is 178 (design estimated
  ~164 — the difference is extra JSDoc, not extra logic).
- D5: The lock-contention integration test models exactly the interleaving design.md describes,
  asserting only the invariants that hold under every possible interleaving (row count ∈ {1,2}, no
  orphaned rows) rather than a single deterministic winner, since MySQL's exact interleaving under
  real concurrency isn't guaranteed test-to-test (confirmed stable across 3 repeated runs regardless).
- D6: The logged object is exactly `{event, familyId, userId, supersededAt, ageSeconds, revokedRows,
  timestamp}` — matches the design's field table precisely, including the `tokenHash`/`successorHash`
  exclusion (asserted as a negative test).
- D7: No migration authored by this change (confirmed — only the *predecessor* change's already-existing
  migration needed applying to this local test DB, which is an environment-setup fact, not a code change
  this PR makes).

## Files Changed

| File | Action | What Was Done | Intended Commit |
|------|--------|----------------|------------------|
| `backend/src/infrastructure/controllers/sessionCookies.ts` | Modified | Added `UserAuthDto` interface + exported `establishSession` function (moved verbatim from `UserApiController.ts`, now takes `CreateRememberTokenUseCase` as an explicit 2nd argument instead of closing over `this`) | commit 1 (extraction) |
| `backend/src/infrastructure/controllers/UserApiController.ts` | Modified | Removed the private `establishSession` method + local `UserAuthDto` interface; imports both from `sessionCookies.ts`; `login`/`register` call sites updated; later folded `'reuse-detected'` into the existing 401 branch (4-line diff) | split across commit 1 (extraction) and commit 3 (reuse detection, the 4-line branch) |
| `backend/src/infrastructure/controllers/__tests__/UserApiController.test.ts` | Modified | Added one test: `'reuse-detected'` → 401 identical to `'rejected'`, no `Set-Cookie` | commit 3 |
| `backend/src/infrastructure/security/refreshTokenRetention.ts` | Created | `REFRESH_TOKEN_REAP_SECONDS`, env-tunable, default `86400` | commit 2 |
| `backend/src/application/use-cases/RotateRefreshTokenUseCase.ts` | Modified | Required 4th ctor arg `reapSeconds`; deleted dead `GRACE_SECONDS` export + its `REFRESH_TOKEN_GRACE_SECONDS` import; kept the `RefreshTokenRotationLostRaceError` re-export; fixed the stale "imports both" comment | commit 2 |
| `backend/src/application/__tests__/RotateRefreshTokenUseCase.test.ts` | Modified | Flipped the `reapFamily(..., 30, ...)` assertion to the injected value; added a 2nd triangulation test with a different injected value (30) to prove it's not hardcoded to any single number | commit 2 |
| `backend/src/application/use-cases/RefreshSessionUseCase.ts` | Modified | Added `'reuse-detected'` to `RefreshSessionResult`; `LoggerPort` as 5th ctor arg; row 6 now revokes + logs + returns `'reuse-detected'` (no try/catch) | commit 3 |
| `backend/src/application/__tests__/RefreshSessionUseCase.test.ts` | Modified | Amended row 6's assertion (flip, in place); added negative `revokeFamily` assertions to rows 1/2/3; added the `!familyId` guard test; added the log-shape test (incorporating the `revokedRows`-reflects-real-outcome property); added the revocation-failure-propagates test | commit 3 |
| `backend/src/infrastructure/routes/api/users.ts` | Modified | `RotateRefreshTokenUseCase` gets `REFRESH_TOKEN_REAP_SECONDS` as 4th arg (commit 2); `RefreshSessionUseCase` gets `new PinoLogger()` as 5th arg + extended route comment (commit 3) | split across commit 2 and commit 3 |
| `backend/src/infrastructure/repositories/__tests__/SequelizeRememberTokenRepository.integration.test.ts` | Modified | Added `rewindSupersededAt` helper (DB-clock-based); added 5 new tests (4.1 cutoff-survives, 4.2 cutoff-reaps, 4.3 detection round trip, 4.4 lock-contention, 4.5 storage-bound); updated the file's stale "not executed" honesty note | commit 4 |

## Review Workload — Actual vs Forecast

**~497 total changed lines** (419 insertions + 74 deletions across 9 tracked files, per `git diff --stat`,
+ 4 lines for the new `refreshTokenRetention.ts`), above the tasks.md forecast of ~300–350 and the
400-line budget. See tasks.md's "Apply-time actual" note for the full breakdown and rationale. One
redundant test was already removed as a de-duplication pass (not a budget-driven cut — it duplicated an
assertion already covered by the log-shape test). No further reduction is available without cutting
required coverage, comments, or tests, all of which the review-budget guard explicitly forbids trading
away. **Recommending `size:exception` for this single PR** — every line traces to an explicit
design.md/tasks.md requirement or an orchestrator-directed deviation, none is speculative scope.

## Traps Avoided (per launch prompt)

- Row 6 test was **amended**, not duplicated (confirmed: `RefreshSessionUseCase.test.ts` still has
  exactly one `it('row 6: replay past grace ...')` test, now asserting `revokeFamily`+`logger.warn`).
- `RotateRefreshTokenUseCase.test.ts:62`'s literal `30` assertion is now the injected constant
  (`86400` in the main test, `30` in the triangulation test — never hardcoded in production code).
- Dead `GRACE_SECONDS` export + its import are deleted; `RefreshTokenRotationLostRaceError` re-export
  kept (still genuinely used by `RefreshSessionUseCase.ts`'s import).
- Rows 1/2/3 and the `!familyId` guard all have explicit negative `revokeFamily` assertions now.
- Revocation failure propagates (`await expect(...).rejects.toThrow('DB unavailable')`), not swallowed.
- Row 5's existing test is untouched, byte-identical, still passing (verified both immediately after
  the extraction and after the row-6 GREEN implementation).
- `UserApiController.ts` is 206 lines, `sessionCookies.ts` is 178 — both under 250.
- `tokenHash`/`successorHash` are asserted absent from the logged object (negative assertion).

## Status

19/20 tasks complete (task 2.5 blocked by environment permissions, non-functional gap only). Full local
gate: `pnpm test` (1014+250 green), `pnpm test:integration` (50/52 green, 2 pre-existing unrelated
failures), `pnpm lint` (clean), `pnpm type-check` (clean), `pnpm --filter backend architecture:check`
(clean). **Ready for `sdd-verify`.**
