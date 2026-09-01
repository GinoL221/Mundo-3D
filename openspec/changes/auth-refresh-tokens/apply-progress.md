# Apply Progress: Refresh Tokens with Rotation (HIGH-1) — PR1

**Batch**: 1 of N (first batch — no prior apply-progress existed).
**Scope**: PR1 only — tasks 1.1 through 1.19 (data layer: migration, boot-gate update, revived `RememberToken` slice with rotation semantics, no endpoint).
**Mode**: Strict TDD.
**Delivery**: `size:exception` (PR1), `chain_strategy: stacked-to-main` — per the maintainer's 2026-09-01 decision recorded in tasks.md's "Review-budget exception" section.

## Status

19/19 PR1 tasks complete (marked `[x]` in `tasks.md`). PR2 and PR3 tasks untouched, as scoped.

## MySQL availability — read before trusting any integration-test result below

**Host port 3306 was held by a local MySQL this session had no credentials for.** `pnpm test:integration` could not run.

- Unit tier (`pnpm test`): ran normally, all green (973/973 backend + 205/205 frontend).
- Integration tier: three files touch real MySQL and were **written but NOT executed** this batch:
  - `backend/src/database/__tests__/migrate.integration.test.js` (extended — task 1.1's migration schema/rollback proof)
  - `backend/src/infrastructure/repositories/__tests__/SequelizeRememberTokenRepository.integration.test.ts` (new — tasks 1.18/1.19's real-concurrency and reap/family_id proofs)

**No integration test is claimed as passing.** They will run for the first time in CI. This is the single riskiest gap in this batch: task 1.18's concurrent-`claimRotation` test is the load-bearing proof for the InnoDB semi-consistent-read assumption the whole rotation design (D1) rests on, and it has not yet been observed to pass against a real database.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.3 | `database/__tests__/checkPendingMigrations.test.js` | Unit | ✅ 22/22 (RememberToken+checkPendingMigrations suites) | ✅ Written, executed — 4/4 new cases failing | ✅ Executed — 12/12 passing | ✅ 4 cases (one per new column, `it.each`) | ➖ None needed |
| 1.5 | `database/models/__tests__/RememberTokenModel.test.js` | Unit | ✅ 1/1 | ✅ Written, executed — failing | ✅ Executed — passing | ➖ Single (structural schema assertion, one shape) | ➖ None needed |
| 1.8/1.9 | `infrastructure/repositories/__tests__/SequelizeRememberTokenRepository.test.ts` | Unit | ✅ 7/7 pre-existing | ✅ Written, executed — 7/7 new cases failing (module methods missing) | ✅ Executed — 14/14 passing | ✅ 2 cases per method (claim won/lost, revoke 2/0, reap 2/0) | ➖ None needed |
| 1.10/1.11 | `application/__tests__/RotateRefreshTokenUseCase.test.ts` | Unit | N/A (new file) | ✅ Written, executed — module not found | ✅ Executed — 2/2 passing | ✅ won-race / lost-race | ➖ None needed |
| 1.12/1.13 | `application/__tests__/RevokeRefreshTokenUseCase.test.ts` | Unit | N/A (new file) | ✅ Written, executed — module not found | ✅ Executed — 2/2 passing | ✅ non-zero / zero affected | ➖ None needed |
| 1.14/1.15 | `application/__tests__/RememberTokenUseCases.test.ts` (CreateRememberTokenUseCase) | Unit | ✅ 6/6 pre-existing | ✅ Written, executed — 2/2 new cases failing | ✅ Executed — 8/8 passing | ✅ 2 cases (persists generator output, per-call distinctness via injected mock) | ✅ Extracted `IdGeneratorPort`/`CryptoRandomIdGenerator` after architecture:check caught a layering violation |
| 1.16/1.17 | `application/__tests__/RememberTokenUseCases.test.ts` (VerifyRememberTokenUseCase) | Unit | ✅ 8/8 pre-existing (this file) | ✅ Written, executed — 1/1 new case failing | ✅ Executed — 9/9 passing | ➖ Single (revoked-before-expiry ordering; existing suite already covers expired/valid/absent) | ➖ None needed |
| (unplanned) 1.15 | `infrastructure/security/__tests__/CryptoRandomIdGenerator.test.ts` | Unit | N/A (new file) | ✅ Written, executed — module not found | ✅ Executed — 2/2 passing | ✅ format + non-determinism | ➖ None needed |
| 1.1/1.2 | `database/__tests__/migrate.integration.test.js` | Integration (real MySQL) | N/A — pre-existing suite not run this session (no MySQL) | ✅ Written, **NOT executed** | **NOT executed** | ➖ N/A | ➖ N/A |
| 1.18/1.19 | `infrastructure/repositories/__tests__/SequelizeRememberTokenRepository.integration.test.ts` | Integration (real MySQL) | N/A (new file) | ✅ Written, **NOT executed** | **NOT executed** | ➖ N/A | ➖ N/A |

### Test Summary
- **Total tests written this batch**: 24 new unit test cases (across 6 files, 2 of them new files) + 1 extended migration-integration suite (2 new cases) + 1 new integration test file (5 cases).
- **Total tests passing (executed, unit tier only)**: 973/973 backend, 205/205 frontend (full suite, not just this batch's files) — see Work Unit Evidence.
- **Layers used**: Unit (24 executed), Integration (7 written, 0 executed).
- **Approval tests** (refactoring): None — no refactoring tasks in this batch; `checkPendingMigrations.test.js`'s pre-existing "missing token_hash" case already served as the approval baseline for that file.
- **Pure functions created**: 0 new pure functions (all new code is port-implementing adapters or use-case orchestration with I/O side effects, matching the existing codebase's style for this layer).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm --filter backend test -- RememberToken checkPendingMigrations` → 33/33 passing. `pnpm --filter backend test -- RotateRefreshTokenUseCase RevokeRefreshTokenUseCase CryptoRandomIdGenerator` → 6/6 passing. Full suite: `pnpm --filter backend test` → 973/973 passing. |
| Runtime harness command/scenario and exact result | `pnpm test:integration` (real MySQL, task 1.18's `claimRotation` concurrency test) — **NOT executed, no local MySQL reachable this session.** Will run for the first time in CI. |
| Rollback boundary | Revert this branch. The migration's `down()` drops the 4 new columns and restores `token_hash_2..5`. Zero production callers exist for any of this PR's code (no route/controller wires `CreateRememberTokenUseCase`, `RotateRefreshTokenUseCase`, or `RevokeRefreshTokenUseCase` yet — confirmed by `rg` — matching design.md's "PR1 stays dead code" claim). |

## Additional verification run

- `pnpm test` (root, backend+frontend): all green — 973 backend + 205 frontend.
- `pnpm lint` (root, backend+frontend): clean.
- `pnpm type-check` (root → backend `tsc --noEmit`): clean.
- `pnpm --filter backend architecture:check`: clean (after the `IdGeneratorPort` fix below).

## Deviations from design.md / tasks.md — found during apply, not silently made

1. **`RotateRefreshTokenUseCase`'s test scope (task 1.10) was corrected.** Task 1.10 says to test "D2's six lookup-order rows" for this use case. Re-reading design.md: that six-row branch table (absent / revoked / expired / current-rotate / grace-hit / replay-past-grace) is explicitly `RefreshSessionUseCase`'s responsibility (design.md's "Lookup order in `RefreshSessionUseCase`" — task 2.10, PR2), which calls `findByHash` and branches *before* ever invoking rotation. `RotateRefreshTokenUseCase` is design.md D1's narrower, already-atomic claim→insert→reap transaction, invoked only for the "current" branch, with exactly two outcomes: won the race (rotate) or lost it (throw so the caller re-reads outside the aborted transaction). Implemented and tested per D1's actual scope; the six-row table remains correctly assigned to task 2.10 in tasks.md and was not touched.
2. **New `IdGeneratorPort`/`CryptoRandomIdGenerator` (not in design.md's File Changes table).** `CreateRememberTokenUseCase.ts` lives in the `application` layer, which `architecture:check`'s `backend.application.contracts` rule forbids from importing Node built-ins directly (mirrors why `TokenHasherPort` exists instead of the use case calling `crypto` for hashing). A first pass called `crypto.randomUUID()` directly and failed `pnpm --filter backend architecture:check`. Fixed by adding `domain/ports/IdGeneratorPort.ts` (one-method port) and `infrastructure/security/CryptoRandomIdGenerator.ts` (adapter), and injecting it as `CreateRememberTokenUseCase`'s third constructor argument. No production caller exists yet (this use case has zero live callers until PR2 wires it), so this is a non-breaking addition.
3. **`db.d.ts` (`RememberTokenAttributes`) updated** — not listed in design.md's File Changes table, but required for the repository's new methods to compile against the typed Sequelize model.
4. **`reapFamily` uses Sequelize's ORM `destroy()` with a computed cutoff `Date`, not design.md D1's literal raw-SQL `DELETE ... WHERE superseded_at < NOW() - INTERVAL :graceSeconds SECOND`.** Verified against `node_modules/sequelize`'s mysql dialect source: a raw query with `type: QueryTypes.UPDATE` is special-cased to return `[result, affectedRows]` (the `adjustStock` precedent this design explicitly follows), but a raw `QueryTypes.DELETE` is NOT special-cased the same way — it falls through to the generic raw-query branch, an ambiguous shape. `db.RememberToken.destroy({ where: { familyId, supersededAt: { [Op.lt]: cutoff } } })` is functionally identical (NULL `superseded_at` — the current row — never satisfies `<`, so the current row and any in-grace row are never touched) and avoids that ambiguity. Covered by the (unexecuted) integration test's two `reapFamily` scenarios.
5. **Two mocked-`sequelize` test fixtures needed a one-line update** (`database/models/__tests__/index.test.js` and `index.production-connection.test.js`): both hand-roll a partial `DataTypes` mock lacking `CHAR`, which broke once `RememberToken.js` started calling `DataTypes.CHAR(36)`. Added `CHAR: jest.fn().mockReturnValue('CHAR')` to both mocks, matching the existing `STRING`/`DECIMAL` mock pattern. Confirmed via the Safety Net: full suite was 972/972 before this fix, 973/973 after (net +1 from this batch's own new assertions elsewhere).
6. **`migrate.integration.test.js` needed non-trivial restructuring**, not just an added migration name. It previously hardcoded an exact 2-migration `executed()` list and a 2-call `down` sequence; both needed updating to account for the third (`refresh-token-rotation`) migration, plus a new column/index-level check standing in for a table-existence check (this migration alters `RememberToken`, it doesn't create a new table). This was NOT anticipated by tasks.md's task 1.1, which only mentions writing "a migration test... via `testDb.ts`" — the pre-existing migration-CLI integration suite needed maintenance regardless, or it would have failed in CI the moment this migration file existed.

## Actual changed-line count (against `main` @ `bb7fe09`, code only — excludes `tasks.md`'s 38-line bookkeeping diff)

**1,023 changed lines** (1,003 insertions + 20 deletions across 25 files) — see breakdown below. This is well above even the accepted `size:exception` forecast of ~450-600 lines for PR1.

| File | +/- |
|---|---|
| `application/__tests__/RememberTokenUseCases.test.ts` | +53/-3 |
| `application/__tests__/RevokeRefreshTokenUseCase.test.ts` (new) | +37/-0 |
| `application/__tests__/RotateRefreshTokenUseCase.test.ts` (new) | +79/-0 |
| `application/dtos/RememberTokenDTO.ts` | +1/-0 |
| `application/use-cases/CreateRememberTokenUseCase.ts` | +10/-2 |
| `application/use-cases/RevokeRefreshTokenUseCase.ts` (new) | +13/-0 |
| `application/use-cases/RotateRefreshTokenUseCase.ts` (new) | +62/-0 |
| `application/use-cases/VerifyRememberTokenUseCase.ts` | +8/-0 |
| `database/__tests__/checkPendingMigrations.test.js` | +19/-0 |
| `database/__tests__/migrate.integration.test.js` | +56/-11 |
| `database/checkPendingMigrations.js` | +8/-1 |
| `database/migrations/20260901000000-refresh-token-rotation.js` (new) | +91/-0 |
| `database/models/RememberToken.js` | +22/-0 |
| `database/models/__tests__/RememberTokenModel.test.js` | +22/-0 |
| `database/models/__tests__/index.production-connection.test.js` | +1/-0 |
| `database/models/__tests__/index.test.js` | +1/-0 |
| `database/models/db.d.ts` | +5/-0 |
| `domain/entities/RememberToken.ts` | +8/-1 |
| `domain/ports/IdGeneratorPort.ts` (new) | +6/-0 |
| `domain/ports/RememberTokenRepositoryPort.ts` | +24/-0 |
| `infrastructure/repositories/SequelizeRememberTokenRepository.ts` | +83/-1 |
| `infrastructure/repositories/__tests__/SequelizeRememberTokenRepository.integration.test.ts` (new) | +237/-0 |
| `infrastructure/repositories/__tests__/SequelizeRememberTokenRepository.test.ts` | +133/-1 |
| `infrastructure/security/CryptoRandomIdGenerator.ts` (new) | +8/-0 |
| `infrastructure/security/__tests__/CryptoRandomIdGenerator.test.ts` (new) | +16/-0 |

**Why it overshot the ~450-600 estimate**: the estimate likely undercounted (a) the two full integration-test files (237 + 67 lines, both mandated by tasks.md 1.1/1.18/1.19 and explicitly called out in the review-budget exception's "reviewer note" as the load-bearing risk proof), and (b) the unplanned-but-required `IdGeneratorPort`/`CryptoRandomIdGenerator` port+adapter+test (30 lines) needed to satisfy the architecture guard. Per the pre-approved `size:exception`, this was not grounds to stop — reported here for the estimate-vs-reality check the maintainer asked for.

## Rollback boundary

Revert this branch/commit. `20260901000000-refresh-token-rotation.js`'s `down()` drops all 4 new columns and restores the 4 `token_hash_2..5` unique indexes. No route/controller/composition-root file was touched — every new class (`RotateRefreshTokenUseCase`, `RevokeRefreshTokenUseCase`, `CryptoRandomIdGenerator`) has zero production callers, matching design.md D8's "PR1 stays dead code" claim.
