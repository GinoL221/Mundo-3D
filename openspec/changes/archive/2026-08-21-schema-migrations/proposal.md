# Proposal: Adopt Umzug schema migrations (retire boot-time sync)

## Intent

The backend has **no real schema-management discipline**. On every non-test boot, `backend/index.js` runs `db.sequelize.sync({ alter: true })`, silently diffing models against the live DB — while 3 orphaned SQL files in `src/database/migrations/` sit unrun by any runner. Two overlapping mechanisms coexist only by accident. The project is **pre-launch** (no production deploy yet), so this is the right moment to establish tracked, explicit migrations *before* the first production cutover — not fix a live system. A latent bug (`ensureDatabaseExists("development")` hardcodes the env key) sits in the same code and is bundled in.

## Scope

### In Scope
- Remove `sync({ alter: true })` from the `index.js` boot path.
- Introduce **Umzug** as the migration runner (tracking table, per-migration transaction, `down` support).
- Convert the 3 existing SQL files into tracked Umzug migrations, with an **initial baseline** marking the current schema as already-applied (so converged DBs don't re-run rename/ADD statements).
- Wire Umzug `up()` into an **explicit step** (e.g. `npm run db:migrate`).
- Fix `ensureDatabaseExists("development")` -> use the actual `env` variable.

### Out of Scope
- `test-prepare.js` (e2e, `force:true`) and `testDb.ts` (integration, `force:false`) bootstrap paths — intentionally separate, correctly scoped to their own test DBs, **must not be touched**.
- Any destructive `sync({force:true})`-style rebuild of the local dev DB (must preserve manually-generated product images).
- Documenting `.env.example` / DB provisioning (related but deferred).
- Production deployment pipeline design (none exists yet).

## Capabilities

### New Capabilities
None (tooling/infra change — no spec-level behavior contract added).

### Modified Capabilities
None.

## Approach

Add `umzug` + a thin `migrator` module reading migration files from `src/database/migrations/` using the existing Sequelize `QueryInterface`. Wrap each SQL file in a small `up`/`down` module. Seed `SequelizeMeta`-equivalent with a baseline entry so existing dev/CI DBs are marked converged. Boot no longer mutates schema; migrations run via an explicit command.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/index.js:21-43` | Modified | Remove sync call; fix `env` bug |
| `backend/src/database/config/ensureDatabase.js` | Modified | Called with real `env` |
| `backend/src/database/migrations/*.sql` | Modified | Wrapped as Umzug migrations |
| `backend/src/database/` (new migrator) | New | Umzug setup + baseline |
| `backend/package.json` | Modified | `umzug` dep + `db:migrate` script |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Baseline missing -> ADD/rename errors on converged DB | Med | Ship baseline marking current schema applied |
| Prod `NODE_ENV`/deploy method unconfirmed (no manifest) | Med | Pre-launch; resolve in design before first deploy |
| Accidentally touching test/e2e bootstraps | Low | Explicit non-goal; those DBs stay independent |
| Local product images lost | Low | No `force` rebuild; migrations are additive/idempotent |

## Rollback Plan

Single-commit change. Revert restores `sync({ alter: true })` on boot; `umzug` dep and `db:migrate` script are removed. No data migration performed, so no data rollback needed.

## Dependencies

- `umzug` (new npm dependency).

## Success Criteria

- [ ] Boot no longer runs `sync({ alter: true })`.
- [ ] `npm run db:migrate` applies pending migrations against a real DB.
- [ ] Re-running migrations on a converged DB is a no-op (baseline honored).
- [ ] `ensureDatabaseExists` uses the actual `env`.
- [ ] `npm test`, integration, and e2e suites unaffected.

## Proposal question round (for design)

Resolved assumptions from user: pre-launch (no prod cutover risk); preserve local product images (no destructive rebuild); bundle the `ensureDatabaseExists` fix; leave test/e2e bootstraps untouched.

Open for design:
1. Does `db:migrate` also run **automatically on boot** for now (no deploy pipeline yet), or must it always be a **manual explicit step** even in dev?
2. How is production actually deployed / what is its real `NODE_ENV`? No Dockerfile/manifest exists in-repo to confirm.
3. Baseline mechanism: pre-seed the tracking table with all existing migration names, or a dedicated `0000-baseline` no-op migration?
