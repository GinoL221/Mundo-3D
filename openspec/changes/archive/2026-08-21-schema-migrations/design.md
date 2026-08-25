# Design: Adopt Umzug schema migrations (retire boot-time sync)

## Technical Approach

Introduce a thin Umzug runner over the existing Sequelize connection (`db.sequelize`), reading function-style migrations from `backend/src/database/migrations/`. Schema provisioning moves out of the boot path into an explicit, manually-invoked `pnpm db:migrate` command (per resolved Q1 — never on boot, even in dev). Boot keeps a fail-fast connectivity check instead of mutating schema. The 3 orphaned `.sql` files are squashed into a single canonical **baseline** migration; existing populated environments mark the baseline pre-applied without running DDL (per resolved Q2 — no destructive rebuild, product images preserved).

The baseline's content is **generated from a live schema dump of the actual dev database**, not transcribed from model source, and is **proven on a genuinely fresh database in CI**. These two steps close the design's original load-bearing assumption (that model source matches the live DB) with concrete verification rather than a flag. (Scope intentionally narrow: no Testcontainers, no seed/profile matrix, no E2E fixture contracts — those belong to a broader production-hardening effort this change does not take on.)

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Squash 3 SQL files into one baseline vs. keep them as runnable migrations | The renames go FROM capitalized columns nobody has; they error on every real env. Keeping them runnable is dead/dangerous code | **Squash** into baseline; delete the 3 `.sql` files |
| Baseline content source: hand-authored `createTable` from reading models vs. **live schema dump** of the dev DB | Model source can drift from what `sync({alter:true})` actually built; only a live dump proves ground truth | **Generate from a live `mysqldump --no-data` (or per-table `SHOW CREATE TABLE`)** of the dev DB; embed the captured `CREATE TABLE` DDL as the frozen snapshot |
| Baseline `up()` body: transcribed `createTable` vs. raw dumped DDL | Transcribing types/charset/FK to `createTable` re-introduces transcription drift — the exact risk we are closing | **Execute the dumped `CREATE TABLE` statements** (FK-safe order) via `queryInterface.sequelize.query`; `down()` = `dropTable` in reverse |
| Converge existing dev DB: dedicated `adopt-baseline` command (`storage.logMigration`, no DDL) vs. IF-NOT-EXISTS DDL vs. run as-is | `createTable` without guards errors on the populated DB; plain sync risks drift | **`adopt-baseline` command** inserts the baseline name into `SequelizeMeta` without executing it |
| CLI surface: Umzug `runAsCLI()` vs. fully custom | `runAsCLI` gives `up`/`down`/`pending`/`executed` for free | **`runAsCLI` + one thin custom `adopt-baseline` subcommand** |
| Boot replacement for `sync({alter:true})` | Doing nothing loses connectivity fail-fast | **`db.sequelize.authenticate()`** — fail-fast, no schema mutation |
| Prove the baseline is self-consistent | A hand-checked baseline is still a guess | **CI step runs `db:migrate` from scratch against the already-configured fresh MySQL service** and fails the build on error |

## Data Flow

```text
(author-time) mysqldump --no-data dev DB → baseline.js up() (frozen DDL)
pnpm db:migrate            → migrate.js → Umzug.up()     → SequelizeMeta + DDL
pnpm db:migrate:adopt-baseline → migrate.js → storage.logMigration(baseline)  (no DDL)
boot (index.js)            → ensureDatabaseExists(env) → sequelize.authenticate() → seedInitialData → listen
```

Operational order: run migrations first, then start the server. A fresh env runs the baseline (creates full schema). The existing dev DB runs `adopt-baseline` once, then `db:migrate` is a no-op. CI proves the fresh-env path on every run.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/database/migrations/20260724000000-baseline.js` | Create | `up()` executes the `CREATE TABLE` DDL **captured from a live `mysqldump --no-data` of the dev DB** for all 6 tables (User, Category, Franchise, Product, ShoppingCart, RememberToken) in FK-safe order, including FK constraints, engine, and charset exactly as they exist. `down()` = `dropTable` in reverse order. |
| `backend/src/database/migrations/20260627-rename-*.sql` (×2) | Delete | Subsumed by baseline; error on every real env. |
| `backend/src/database/migrations/20260701-add-product-stock.sql` | Delete | Subsumed by baseline (`stock` already in model). |
| `backend/src/database/migrator.js` | Create | `buildMigrator()` factory: Umzug with `glob: 'src/database/migrations/*.js'`, `context: db.sequelize.getQueryInterface()`, `SequelizeStorage({ sequelize: db.sequelize })`. |
| `backend/src/database/migrate.js` | Create | CLI entry: `adopt-baseline` → `storage.logMigration`; else `migrator.runAsCLI()`. Exits non-zero on failure. |
| `backend/index.js` | Modify | Remove `sync({ alter: true })`; chain `authenticate()`; fix `ensureDatabaseExists("development")` → `ensureDatabaseExists(env)`. |
| `backend/package.json` | Modify | Add `umzug` dep; scripts `db:migrate`, `db:migrate:status`, `db:migrate:down`, `db:migrate:adopt-baseline`. |
| `.github/workflows/ci.yml` | Modify | Add a step that creates a fresh empty DB on the existing MySQL service and runs `db:migrate` against it, failing the build on any migration error (see below). |

Out of scope, unchanged: `test-prepare.js`, `testDb.ts` (they build test/e2e schema via their own `sync`), `ensureDatabase.js` (default param is fine; only the call site is fixed).

### CI addition (`.github/workflows/ci.yml`)

Insert after `Install dependencies`, before the test steps. Uses the `mysql` client preinstalled on `ubuntu-latest` to create a dedicated, throwaway DB name (distinct from `mundo_3d_test`), then runs the migrator from empty:

```yaml
      - name: Verify migrations build schema on a fresh database
        run: |
          mysql -h 127.0.0.1 -u root -e "CREATE DATABASE IF NOT EXISTS mundo_3d_migrate_ci;"
          pnpm --filter backend db:migrate
        env:
          DB_HOST: 127.0.0.1
          DB_USER: root
          DB_PASS: ""
          DB_NAME: mundo_3d_migrate_ci
```

A failure here (missing column, bad FK order, invalid DDL) fails the build — the proof that the baseline is self-consistent on a brand-new environment.

## Interfaces / Contracts

```js
// migrator.js
function buildMigrator() // → Umzug instance bound to db.sequelize
// migrate.js CLI: up | down | pending | executed | adopt-baseline
```

Tracking table: `SequelizeMeta` (Umzug default). Baseline file name is the single row inserted by `adopt-baseline`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `migrator.js` wiring; `ensureDatabaseExists` uses the passed env (not hardcoded) | Mock `db.sequelize`; assert glob/storage/context and config-by-env lookup. |
| Integration | Fresh scratch schema: `up` creates all tables; re-`up` no-op; `down` drops; `adopt-baseline` marks without creating | Self-contained scratch DB name; does NOT touch excluded test bootstraps. |
| CI (fresh-env proof) | `db:migrate` from an empty DB succeeds on every push/PR | Dedicated `mundo_3d_migrate_ci` DB on the existing MySQL service; build fails on migration error. |
| Manual | Dev DB convergence | Run `adopt-baseline` then `db:migrate` on the live dev DB; confirm products/images intact. |

## Threat Matrix

N/A — no routing, VCS/PR automation, executable-file classification, or process-integration boundary is introduced. Migrations execute SQL/DDL through Sequelize `QueryInterface`. The new CI step shells out to `mysql`/`pnpm` but only with static, workflow-authored arguments and no external/untrusted input.

## Migration / Rollout

MySQL DDL is non-transactional (implicit commits) — the baseline is documented as non-atomic; a partial failure on a fresh env is cleaned up by `down` or by dropping the scratch DB. Pre-launch, this is acceptable. Rollback of the change itself is a single revert (restores `sync({alter:true})`, removes `umzug` and the CI step); no data migration is performed, so no data rollback. CI's existing test/e2e DBs remain built by their independent bootstraps and are unaffected by the new migrate-proof DB.

## Risks

- **Load-bearing assumption (model source == live DB) — now MITIGATED.** Baseline content comes from a live `mysqldump --no-data` (ground truth), not model transcription, and is proven to build a working schema from empty by the CI step on every run. Residual risk drops from "unverified" to "verified twice."
- Author must run the dump against a dev DB known to match production intent; if the dev DB itself is wrong, the baseline inherits that. Mitigation: the apply phase confirms the dev DB schema before dumping (unchanged from original guidance).
- The CI proof validates fresh-env creation and self-consistency, not the `adopt-baseline` convergence path on the populated dev DB — that remains a manual verification step.

## Open Questions

None.
