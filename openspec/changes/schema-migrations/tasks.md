# Tasks: Adopt Umzug schema migrations (retire boot-time sync)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600-650 (baseline DDL ~200, migrator/migrate.js ~110, tests ~230, index.js/package.json/ci.yml ~40, SQL deletions ~60) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 -> PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migrator infra: `migrator.js`, `migrate.js` CLI, `umzug` dep, scripts. Boot untouched. | PR 1 | `pnpm --filter backend test -- migrator` | N/A — no live DB target until baseline exists | Revert new files + package.json entries; no schema/boot impact |
| 2 | Baseline migration from live dump + delete 3 legacy `.sql` | PR 2 | `pnpm --filter backend test:integration -- migrate` | `mysql -e "CREATE DATABASE IF NOT EXISTS mundo_3d_migrate_scratch;"` then `DB_NAME=mundo_3d_migrate_scratch pnpm --filter backend db:migrate` (and `db:migrate:down`) | Revert `baseline.js`, restore 3 `.sql` files; infra from Unit 1 unaffected |
| 3 | Boot cutover (remove sync, authenticate, env fix) + CI fresh-env proof | PR 3 | `pnpm --filter backend test -- index` | CI step `pnpm --filter backend db:migrate` in `.github/workflows/ci.yml` against `mundo_3d_migrate_ci`; manual `db:migrate:adopt-baseline` on dev DB | Revert `index.js`/`ci.yml`, restoring `sync({alter:true})`; Units 1-2 stay merged harmlessly |

## Phase 1: Migrator Infrastructure (PR 1)

- [x] 1.1 RED: `backend/src/database/__tests__/migrator.test.js` — mock `db.sequelize`, assert `buildMigrator()` wires glob `src/database/migrations/*.js`, context `getQueryInterface()`, `SequelizeStorage` (Req: Migration Runner Applies and Tracks Migrations)
- [x] 1.2 GREEN: create `backend/src/database/migrator.js` implementing `buildMigrator()`
- [x] 1.3 Add `umzug` to `backend/package.json` dependencies

## Phase 2: Baseline Migration (PR 2)

- [x] 2.1 Run `mysqldump --no-data` (or `SHOW CREATE TABLE`) against the dev DB for User, Category, Franchise, Product, ShoppingCart, RememberToken; capture exact DDL (FK-safe order) — prep for 2.2
- [x] 2.2 GREEN: create `backend/src/database/migrations/20260724000000-baseline.js` — `up()` executes captured DDL via `queryInterface.sequelize.query`; `down()` = `dropTable` reverse order (Req: Baseline for Pre-Existing Schemas; Existing SQL Migrations Preserved as Tracked Migrations)
- [x] 2.3 Delete `backend/src/database/migrations/20260627-rename-category-franchise-columns.sql`, `20260627-rename-product-columns.sql`, `20260701-add-product-stock.sql`
- [x] 2.4 RED: `backend/src/database/__tests__/migrate.integration.test.js` — scratch DB: `up` creates all 6 tables; re-`up` is no-op; `down` drops; `adopt-baseline` logs without DDL (Req: Migration Runner Applies and Tracks Migrations; Rollback of Most Recent Migration; Baseline for Pre-Existing Schemas)
- [x] 2.5 GREEN: create `backend/src/database/migrate.js` CLI — `adopt-baseline` -> `storage.logMigration`; else `migrator.runAsCLI()`; non-zero exit on failure
- [x] 2.6 Add `db:migrate`, `db:migrate:status`, `db:migrate:down`, `db:migrate:adopt-baseline` scripts to `backend/package.json`

## Phase 3: Boot Cutover & CI Proof (PR 3)

- [ ] 3.1 RED: boot test (mock `ensureDatabaseExists`/`db.sequelize`/`seedInitialData`, `jest.isolateModules` with `NODE_ENV=production`) asserting `ensureDatabaseExists` is called with resolved `env`, `sync({alter:true})` is never called, `authenticate()` is called (Req: Boot Must Not Mutate or Auto-Migrate Schema; Environment-Aware Database Existence Check)
- [ ] 3.2 GREEN: modify `backend/index.js` — remove `sync({alter:true})`, chain `db.sequelize.authenticate()`, change `ensureDatabaseExists("development")` to `ensureDatabaseExists(env)`
- [ ] 3.3 Modify `.github/workflows/ci.yml` — add "Verify migrations build schema on a fresh database" step after Install dependencies, before tests: create `mundo_3d_migrate_ci`, run `pnpm --filter backend db:migrate` (Req: Migration Runner Applies and Tracks Migrations)
- [ ] 3.4 Confirm `backend/src/database/test-prepare.js` and `backend/src/__tests__/helpers/testDb.ts` have zero diff (Req: Test/E2E Bootstrap Paths Remain Unchanged)

## Phase 4: Manual Verification

- [ ] 4.1 Manual: **before** adopting, run `ALTER TABLE Product ADD COLUMN stock INT NOT NULL DEFAULT 0;` against the live dev DB — the live schema is missing this column (see PR 2 apply-progress "Risks"); the baseline's Product DDL includes `stock` to match the model, so `adopt-baseline` (no-DDL) will otherwise leave the real dev DB inconsistent with what it claims. Then run `db:migrate:adopt-baseline` followed by `db:migrate`; confirm no further DDL executes and product images are intact
- [ ] 4.2 Run `pnpm --filter backend test` and `pnpm --filter backend test:integration` full suites to confirm no regressions
