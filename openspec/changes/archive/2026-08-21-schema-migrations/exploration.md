# Exploration: schema-migrations

## Current State

`backend/index.js:21-43` branches only on `env === "test"`. For every other value of `NODE_ENV` (including `development` and, as coded, `production`) it runs `ensureDatabaseExists("development")` -> `db.sequelize.sync({ alter: true })` -> `seedInitialData(db)` -> `server.listen()`. Two findings sharpen the known-facts brief:

- `ensureDatabaseExists("development")` passes a **hardcoded literal** `"development"`, not `env` — so even a real `NODE_ENV=production` boot still resolves `config.development` (which happens to fall back to the same `DB_*` env vars, so it's not currently destructive, but it's a latent bug worth fixing alongside this change).
- No Dockerfile, docker-compose, or deployment manifest exists anywhere in the repo, so production's actual `NODE_ENV` and provisioning method can't be confirmed from source — this is an **open question for the proposal phase**, not something verifiable from the repo alone.

There are **three independent, uncoordinated sync call sites**, not one:

1. `backend/index.js:29` — `sync({alter:true})` on every non-test boot (dev/prod).
2. `backend/src/database/test-prepare.js:16` — `sync({force:true})` (destructive), run via `npm run db:test:prepare`, wired into `e2e/global-setup.ts:6` (`execSync('pnpm --filter backend db:test:prepare')`) before every Playwright run. Not called anywhere in `.github/workflows/ci.yml` directly.
3. `backend/src/__tests__/helpers/testDb.ts:41-46` — `bootstrapTestDatabase()` calls `sync({force:false})`, used only by the one real-DB integration test (`SequelizeProductRepository.integration.test.ts`, run via `npm run test:integration`).

Plain `npm test` (`jest.config.js`) is fully mocked and excludes `*.integration.test.ts` — the default unit-test suite has **no dependency on any sync mechanism**, so removing `index.js`'s sync call is safe for `npm test`. Only the opt-in integration and e2e suites touch a real DB, and each already has its own independent bootstrap.

**Migration tooling reality check**: `backend/.sequelizerc` exists (points `config`/`models-path`/`seeders-path`/`migrations-path` into `src/database/`) but `sequelize-cli` is **not installed anywhere** (zero matches in `package.json` deps/devDeps or in the tree). It's dead config from an abandoned earlier attempt. `umzug` is also absent. The 3 SQL files in `backend/src/database/migrations/` are applied by **no script, CLI, or CI step** — no runner exists, no tracking table, no `down` migrations.

Cross-checking the SQL content against the live Sequelize model `field:` mappings: the two rename migrations exactly match current model column names (e.g. `Category.js` has `field: 'id_category'`), confirming they were a one-time historical fix for pre-existing PascalCase-column databases — a fresh DB built via `sync()` today would already get correct snake_case columns without them. The third file (`add-product-stock.sql`) is fully redundant with `sync({alter:true})` today: `Product.js` already defines `stock: { type: INTEGER, defaultValue: 0, field: 'stock' }`. The SQL files and `sync({alter:true})` are two overlapping mechanisms that only avoid conflict by accident.

## Affected Areas

- `backend/index.js:21-43` — the sync call, the `env==='test'` gate, and the `ensureDatabaseExists("development")` bug.
- `backend/src/database/models/index.js` + `backend/src/database/models/*.js` — 6 models (`User`, `Product`, `ShoppingCart`, `Category`, `Franchise`, `RememberToken`) whose `field:` mappings define what `sync` diffs against.
- `backend/src/database/config/config.js` — CLI-shaped `development`/`test`/`production` keys, reads `DB_*` env vars; no `.env.example` exists anywhere in the repo.
- `backend/src/database/config/ensureDatabase.js` — called 3x with different env-key arguments.
- `backend/src/database/migrations/*.sql` — the 3 orphaned files.
- `backend/.sequelizerc` — dead config, references a `seeders-path` that was never created.
- `backend/src/database/test-prepare.js` + `e2e/global-setup.ts` — destructive e2e bootstrap, independent of `index.js`.
- `backend/src/__tests__/helpers/testDb.ts` — non-destructive integration-test bootstrap, independent.
- `.github/workflows/ci.yml` — no explicit migration step; CI's MySQL service is always fresh, so it never exercises an ALTER against pre-existing data.

## Approaches

1. **Continue raw SQL + minimal custom runner** — hand-rolled tracking table + transactional apply script.
   - Pros: no new dependency, keeps existing files valid as-is.
   - Cons: reinvents locking/transactions/checksums/down-migrations that mature tools solve; team maintains it forever.
   - Effort: Medium.

2. **Adopt Umzug** — Sequelize-ecosystem-native migration runner; wrap existing raw SQL in thin `up`/`down` modules, tracked execution, called explicitly at deploy time (not implicit on boot).
   - Pros: minimal footprint, single small dependency, transactional per-migration execution, tracking table, `down` support, no CLI scaffolding needed, plays well with existing test/e2e sync scripts left untouched.
   - Cons: new dependency; SQL files need thin wrapper modules (small effort).
   - Effort: Medium.

3. **Adopt `sequelize-cli`** — install it, convert files into CLI-managed migrations, use its `SequelizeMeta` tracking.
   - Pros: `.sequelizerc` is already half set up for it; official tooling; migration/seeder scaffolding.
   - Cons: heavier CLI surface; the dead `.sequelizerc` is evidence the team already started and abandoned this path once; historically more DX friction.
   - Effort: Medium.

## Recommendation

Umzug. It's the lightest Sequelize-native option, avoids resurrecting a CLI path the team already abandoned (dead `.sequelizerc`), and composes cleanly with the existing test/e2e bootstrap scripts (`test-prepare.js`'s `force:true`, `testDb.ts`'s `force:false`), which should stay untouched — those solve a different problem (ephemeral test DBs) than production migration tracking. Scope for the proposal:

(a) remove `sync({alter:true})` from `index.js`'s boot path,
(b) wire Umzug's `up()` into an explicit deploy-time step,
(c) convert the 3 existing SQL files into tracked Umzug migrations with an initial baseline,
(d) fix the `ensureDatabaseExists("development")` hardcoded-string bug.

## Risks

- Production deployment mechanism/`NODE_ENV` is unconfirmed from the repo (no Dockerfile/manifest) — must be confirmed before removing the boot-time sync.
- No existing migration baseline: any runner adoption needs a "mark as already applied" step for environments whose schema was built by `sync` rather than the SQL files, or `ADD COLUMN`/rename statements will error against already-converged schemas.
- The `ensureDatabaseExists("development")` bug is unrelated but adjacent — worth bundling into the same change.
- Test/e2e sync paths (`test-prepare.js`, `testDb.ts`) must NOT be folded into the new runner — they're intentionally separate and currently working; plain `npm test` never touches a real DB, so it has no dependency on any sync mechanism.
- No `.env.example` exists anywhere in the repo — `DB_HOST`/`DB_USER`/`DB_PASS`/`DB_NAME` are undocumented for new-environment setup.

## Ready for Proposal

Yes — proceed to `sdd-propose` with the Umzug approach as scoped above. Open question to resolve early in propose/design: how production is actually deployed today, since no Dockerfile/manifest exists in-repo to confirm it.
