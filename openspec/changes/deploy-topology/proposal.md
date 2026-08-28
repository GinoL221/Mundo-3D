# Proposal: Deploy Pipeline Foundations

## Intent

Zero deploy infrastructure exists (no Dockerfile/Procfile/fly.toml/etc., no CD job in CI) even though boot/shutdown/migration code is already production-grade. `docs/RUNBOOKS.md` self-documents this gap. Shipping to any real platform today would be ad hoc: no enforced migrate-before-serve ordering at the pipeline level, no post-deploy verification, no single source of truth for required production env vars. This proposal builds the platform-agnostic pipeline scaffolding first, so the eventual platform choice is a config decision, not a from-scratch design exercise.

## Scope

### In Scope
- A scripted, ordered `build → migrate → start` sequence any platform's deploy hook can invoke (wraps existing `db:migrate`; boot already refuses to auto-migrate, so a pipeline must own this step explicitly).
- A post-deploy smoke test script polling `GET /health/live` then `GET /health/ready` to confirmation, usable from any CI/CD runner.
- A consolidated required-in-production env checklist (`JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECRET`, `COOKIE_DOMAIN`, `DB_*`, `PUBLIC_API_URL`) assembled from README/AGENTS.md/RUNBOOKS into one deploy-facing document, plus a small preflight script that fails fast if a required var is missing.
- `docs/RUNBOOKS.md` updates documenting the above as the "deploy pipeline" section it currently lacks, plus a short expand/contract migration-authoring note (see Decisions below) — the discipline itself, not any code enforcing it.

### Out of Scope (deferred — see Decisions)
- Actually provisioning a deploy platform, PaaS account, persistent volume, or managed MySQL instance — Decisions below settle *which kind*, not standing up the real infrastructure.
- Migrating `upload.ts` off local disk to object storage — explicitly decided against for now (see Decisions).
- Backup/restore procedure specifics for the managed MySQL service — depends on the actual provider chosen when infrastructure is provisioned.
- Actually wiring a CD job into `.github/workflows/ci.yml` that deploys somewhere (needs a target and branch-protection policy first).

## Capabilities

### New Capabilities
- `deploy-pipeline-foundations`: ordered migrate-then-deploy sequencing, post-deploy smoke test, and required-env preflight — platform-agnostic building blocks a future CD job will call.

### Modified Capabilities
None. `runtime-resilience` and `schema-migrations` boot behavior stay locked; this only adds tooling that respects their existing contracts.

## Approach

Build small, dependency-free scripts (Node, matching existing `backend` tooling conventions) rather than a platform-specific pipeline: a migrate runner, a smoke-test script, and an env-preflight check. Each is independently invocable so any future platform's deploy hook (VM cron, PaaS post-deploy hook, or a container CD job) can call them without rewrite. No new runtime dependencies; no changes to `app.js`/`index.js` boot logic.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `scripts/deploy/` (new) | New | migrate-runner, smoke-test, env-preflight scripts |
| `docs/RUNBOOKS.md` | Modified | New "Deploy Pipeline" section |
| `backend/package.json` | Modified | New `pnpm` script entries invoking the above |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scaffolding built now doesn't fit the eventually-chosen platform | Med | Kept deliberately generic (shell/Node scripts, no platform SDK calls) |
| Scope creep into actually choosing a platform mid-implementation | Med | Open Questions below block Scope finalization until answered |
| Env checklist becomes stale vs. actual `.env.example` files | Low | Preflight script reads var names, not a hand-maintained duplicate list |

## Rollback Plan

Revert the change branch. No schema, runtime, or API change; scripts and docs only.

## Dependencies

- None for this scoped slice. A follow-up change (platform-specific CD + possibly uploads/DB-hosting work) depends on the Open Questions being answered first.

## Success Criteria

- [ ] A single command runs migrate-then-start in the documented order.
- [ ] Smoke-test script returns non-zero if `/health/ready` never reaches 200 within a bounded timeout.
- [ ] Env-preflight script fails fast (before app boot) if any required production var is unset.
- [ ] `docs/RUNBOOKS.md` documents all three as the repo's answer to "how do I deploy this."

## Decisions (resolved 2026-08-28 — for the platform-specific follow-up, not this slice)

These do not change this slice's Scope (still deploy-agnostic scripts/docs only) but are recorded now so the follow-up change starts from a settled baseline instead of re-opening them:

1. **Deploy platform**: PaaS with a persistent-volume tier (e.g. Railway/Render/Fly.io-class). Git-push deploys, managed TLS/networking, built-in "redeploy previous build" rollback. Fits this app's scale and the absence of an ops team; avoids the containers+object-storage path's Dockerfile/registry/S3 work until horizontal scaling is an actual need, not a hypothetical one.
2. **Uploads storage**: stay on local disk. Zero code change to `upload.ts`; the chosen PaaS's persistent-volume tier is the only new requirement this creates. Revisit only if/when the app needs more than one backend instance.
3. **MySQL hosting**: a managed MySQL service (typically the PaaS's own DB add-on). Gets automated backups and point-in-time restore for free instead of the app owning that operationally with no existing procedure.
4. **Migration rollback policy**: expand/contract discipline going forward. Every schema migration must remain compatible with both the previous and the new app version during a deploy window (additive first — nullable columns, new tables; destructive changes — drops, renames, NOT NULL tightening — only in a later migration once the old code path is confirmed gone). This means a code rollback never requires a schema rollback. `db:migrate:down`'s one-step, destructive rollback stays as a manual last resort, not the primary safety net. This is a authoring discipline for future migrations, not a code change to `migrate.js`/`checkPendingMigrations.js` — worth a short RUNBOOKS.md note in this slice's scope (see Scope below) even though enforcing it isn't.
