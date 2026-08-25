# Apply Progress: schema-migrations

## Scope

This artifact restores the persisted apply evidence for the three implementation work units and the post-archive correction batches. The implementation is complete; the current continuation addresses final-verification findings only.

**2026-08-21 continuation (this batch):** closed final-verification CRITICAL finding #2 (physical schema compatibility gate) via strict TDD. This artifact itself also closes finding #1 (the artifact's own absence from the OpenSpec working change) by existing here.

## Completed Work Units

- **PR 1 — migrator infrastructure:** Umzug factory, storage wiring, dependency, and migration scripts.
- **PR 2 — baseline migration:** live-schema baseline, migration CLI, integration coverage, and removal of the three orphaned SQL files.
- **PR 3 — boot cutover:** removed boot-time `sync({ alter: true })`, added authentication and environment-aware provisioning, and added CI fresh-schema proof.
- **Post-archive fixes:** unique MySQL 8 foreign-key names, baseline failure diagnostics, scoped baseline adoption, seed error rethrow, pending-migration boot gate, unsupported-environment guard, and corresponding tests.

## Strict TDD Cycle Evidence

| Work                      | Test-first evidence                                                                                               | GREEN evidence                                                                              | TRIANGULATE evidence                                                                                                                | REFACTOR / safety evidence                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Migrator wiring           | `migrator.test.js` asserted the Umzug constructor contract before implementation                                  | Wiring tests passed after `migrator.js` was added                                           | Glob, query-interface context, and Sequelize storage were asserted independently                                                    | No production behavior refactor; factory remained under the file-size limit                   |
| Baseline migration        | `migrate.integration.test.js` established fresh/up/re-run/down/adopt expectations before CLI completion           | Real database migration and adoption scenarios passed                                       | Fresh schema, idempotent re-run, rollback, adoption, and invalid-DDL failure paths are covered                                      | DDL order and failure diagnostics were kept explicit; excluded test bootstraps were unchanged |
| Boot cutover              | Boot tests asserted the absence of `sync({ alter: true })` and the required call chain before wiring was complete | Boot tests passed after `authenticate()`, environment forwarding, and migration gate wiring | Connection failure, seed failure, pending migrations, empty pending state, unsupported environment, and test-env bypass are covered | `jest.dontMock()` was added where explicit Jest mocks persisted across isolated module tests  |
| Seed failure rethrow      | `seed.test.js` first reproduced a resolved promise on a failing model call                                        | Reject path and idempotency path passed after rethrowing                                    | Both failure and non-empty skip branches are asserted                                                                               | One-line production fix; no unnecessary refactor                                              |
| Physical migration safety | Baseline tests asserted FK-safe/reverse order and mid-loop diagnostics                                            | MySQL 8.0 validation passed with unique constraint names                                    | Unit mocks plus disposable MySQL 8.0 execution covered order, constraints, and failure behavior                                     | Transaction wrapper documents MySQL's non-atomic DDL limitation honestly                      |
| Physical schema compatibility gate (2026-08-21 continuation) | `checkPendingMigrations.test.js` extended to 4 tests (original pending-migrations test unchanged, plus 3 new: missing required table, missing required column, compatible schema); confirmed RED — all 4 failed with `TypeError: Cannot convert undefined or null to object` at `Object.entries(REQUIRED_SCHEMA)` since `REQUIRED_SCHEMA` did not exist yet | Added `REQUIRED_SCHEMA` (all 6 models' real snake_case DB columns, cross-checked against `migrations/20260724000000-baseline.js`) and `checkPhysicalSchema()` to `checkPendingMigrations.js`; all 4 unit tests passed | Missing-table, missing-column, and compatible-schema paths asserted independently; the pending-migrations-found path was re-verified unaffected since it throws before reaching the new layer | No unrelated refactor; `queryInterface` is sourced from the migrator's own Umzug `context` (`migrator.options.context`) instead of a new DB import, keeping the file at 80 lines and avoiding a second DB handle |

## Verification Evidence From Apply

- Focused boot/database tests passed during the implementation and post-archive fix batches.
- Historical full evidence: `pnpm test` passed 81 suites / 500 tests; integration passed 2 suites / 8 tests; lint was clean at that point.
- The current continuation revalidated `pnpm --filter backend test` with 80 suites / 494 tests and `pnpm --filter backend test:integration` with 2 suites / 8 tests.
- The authorized local development database check targeted `mundo_3d_db`. `Product.stock` was already present, so no ALTER was issued. `db:migrate:adopt-baseline` recorded `20260724000000-baseline.js` without executing baseline DDL, and a subsequent `db:migrate` found no pending migrations.
- `git diff --check` passed; no application files were changed by the operational verification.

## Current Final-Verification Remediation

The first final verification identified two substantive blockers:

1. `checkNoPendingMigrations()` verified only Umzug bookkeeping, not the physical presence of all required tables and model columns.
2. This artifact was missing from the working OpenSpec change despite the historical TDD evidence being available in Engram.

**2026-08-21 continuation — both closed:**

1. `checkPhysicalSchema()` was added to `backend/src/database/checkPendingMigrations.js`, run by `checkNoPendingMigrations()` immediately after the pending-migration check passes. It validates all 6 required tables (User, Product, ShoppingCart, Category, Franchise, RememberToken) and every required column via `queryInterface.showAllTables()` / `describeTable()`, rejecting with a clear, actionable error naming the missing table or column. `backend/index.js` needed no wiring change — `checkNoPendingMigrations()` was already the wired boot-chain call.
2. This artifact was restored to the working OpenSpec change (this file) and is now merged with the new evidence rather than overwritten.

Read-only constraint honored: no `ALTER`, adopt-baseline, or migration command was run against `mundo_3d_db` during this continuation. The test/E2E bootstrap exclusions (`test-prepare.js`, `testDb.ts`) were not touched (zero diff).

### Continuation Evidence (2026-08-21)

- RED: `pnpm --filter backend test -- checkPendingMigrations` → 4 failed / 4 total, all failing on `Object.entries(REQUIRED_SCHEMA)` (constant did not exist).
- GREEN: same command → 4 passed / 4 total.
- Boot-level regression: `backend/src/__tests__/index.test.js`'s "proceeds ... nothing pending" test needed a compatible `queryInterface` stub (the only existing boot test that reaches the new physical-schema layer); updated and passing. The "pending found" boot test needed no change (unaffected — throws before reaching the new layer).
- Full suite: `pnpm --filter backend test` → **80/80 suites, 496/496 tests** (was 494; +2 net new tests in `checkPendingMigrations.test.js`, 2→4).
- Integration suite: `pnpm --filter backend test:integration` → **2/2 suites, 8/8 tests** (unchanged).
- Focused lint: `eslint backend/src/database/checkPendingMigrations.js backend/src/database/__tests__/checkPendingMigrations.test.js backend/src/__tests__/index.test.js` → clean, 0 errors, 0 warnings.
- `git diff --check` → clean.
- Files touched this continuation: `backend/src/database/checkPendingMigrations.js` (modified, 80 lines), `backend/src/database/__tests__/checkPendingMigrations.test.js` (modified, test file, exempt from line cap), `backend/src/__tests__/index.test.js` (modified, test file, exempt from line cap), `openspec/changes/schema-migrations/tasks.md` (added Phase 7), this file.

## Status

Implementation tasks and operational Phase 4 tasks are complete. The physical schema compatibility gate (final-verification CRITICAL finding #2) is implemented, tested, and green. This artifact (final-verification CRITICAL finding #1) is now persisted in the working OpenSpec change. This apply batch does not itself declare the change verified or archived — that determination belongs to `sdd-verify`, which should regenerate `verify-report.md` against this state.
