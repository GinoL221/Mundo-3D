# Proposal: platform-provisioning

Traceability: exploration #6897 (`openspec/changes/platform-provisioning/exploration.md`) · platform decision #6894 (not reopened) · prior art `openspec/changes/archive/2026-08-28-deploy-topology/`.

## Intent

`deploy-topology` shipped platform-agnostic deploy scripts but left provisioning NOT STARTED — the app cannot boot on a managed host. Production `config.js` has no `port` and no TLS (cannot reach Aiven); `ensureDatabase.js` runs `CREATE DATABASE` every prod boot against an existing DB with an unprivileged user; without `trust proxy` the login limiter keys on Render's edge IP and locks out all users globally. Success: a reproducible Render + Aiven + Vercel bring-up where login works and boot stays fail-closed.

## Scope

### In Scope
- `config.js`: `port` + `dialectOptions.ssl`, **production block only**.
- `ensureDatabase.js`: skip `CREATE DATABASE` in production.
- `env-preflight.js`: `DB_PORT` + TLS/CA vars + `deploy-pipeline-foundations` spec delta.
- `render.yaml` + `docs/RUNBOOKS.md` platform section (Render/Aiven/Vercel, custom domains, `COOKIE_DOMAIN`).
- `app.set('trust proxy', 1)`; explicit `0.0.0.0` bind.

### Out of Scope
- Object storage / `upload.ts`. Consequence stated, not fixed: admin uploads are lost on redeploy and spin-down. Future change.
- CD job in `ci.yml` (Render/Vercel native git auto-deploy).
- Cloud accounts and domain purchase (operator work); secrets in git (dashboards only).
- Broadening dev/test config blocks.

## Capabilities

### New Capabilities
- `managed-database-connectivity`: production connects over a non-standard port with mandatory TLS and never creates the database.
- `platform-hosting-topology`: committed Render manifest, custom-domain/cookie topology, proxy-aware runtime.

### Modified Capabilities
- `deploy-pipeline-foundations`: required-var list gains `DB_PORT` + TLS/CA; `PUBLIC_API_URL` demoted to warn-only backend-side (Q3 resolved).
- `api-jwt-auth`: rate limiting MUST key on the real client IP behind one proxy hop.

## Approach

Exploration Approach 1 (config-object threading): `config[env]` already reaches Sequelize, Umzug and the boot schema gate via `models/index.js`, so port + SSL propagate with no new wiring. Three stacked PRs, each under 400 lines:

| PR | Content |
|----|---------|
| 1 | `config.js` port+SSL + `ensureDatabase.js` prod skip + tests |
| 2 | `env-preflight.js` vars + spec delta + tests |
| 3 | `render.yaml` + RUNBOOKS + `trust proxy` + `0.0.0.0` |

Rejected: runbook-only (drift-prone, no source of truth); all-envs config change (alters dev/test, larger blast radius, no benefit).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/database/config/config.js` | Modified | production port + `ssl` |
| `backend/src/database/ensureDatabase.js` | Modified | production early return |
| `scripts/deploy/env-preflight.js` | Modified | new DB vars |
| `backend/src/app.js` | Modified | `trust proxy` |
| `backend/index.js` | Modified | explicit bind host |
| `render.yaml` | New | free-tier manifest |
| `docs/RUNBOOKS.md` | Modified | platform bring-up |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Aiven private-CA TLS wiring | High | Q1 resolved: `DB_CA_CERT` env PEM + `rejectUnauthorized: true`; `rejectUnauthorized:false` rejected |
| No custom domain → cross-site cookie breaks login | Med | Q2 resolved: hard runbook requirement; `sameSite:'none'` rejected |
| Cold start exceeds smoke-test 60s | Med | Tune `smoke-test.js` timeout at apply |
| Wrong `PUBLIC_API_URL` baked at Vercel build | Med | Runbook states it first; fix needs rebuild |

## Rollback Plan

Per-PR `git revert`; no migration is added, so no data change. Every code change is production-gated, so dev/test are unaffected. Platform side: disable auto-deploy and redeploy the previous commit; Aiven data is untouched.

## Dependencies

- Operator-provisioned Render, Aiven, Vercel accounts and a custom domain.
- Aiven CA material (delivery = Q1).

## Success Criteria

- [ ] Backend boots on Render against Aiven over TLS with migrations applied.
- [ ] `env-preflight` fails fast when a new DB var is missing.
- [ ] Login from the Vercel frontend sets and returns the auth cookie.
- [ ] Rate limiting counts per client IP, not per edge IP.
- [ ] An operator reproduces the bring-up from `docs/RUNBOOKS.md` alone.

## Proposal question round — RESOLVED (user confirmed 2026-08-29)

1. **Aiven CA delivery.** RESOLVED → `DB_CA_CERT` env var holding the PEM →
   `dialectOptions: { ssl: { ca: process.env.DB_CA_CERT, rejectUnauthorized: true } }`.
   Rationale: decouples CA rotation from the release cycle, matches the repo's "prod config from
   env" pattern, and `env-preflight.js` REQUIRED covers the "forgotten at deploy" risk. Committed
   CA file rejected; `rejectUnauthorized: false` rejected.
2. **Custom domain as a hard requirement.** RESOLVED → hard requirement. The operator provisions a
   custom domain: apex/www → Vercel, `api.<domain>` → Render, `COOKIE_DOMAIN=.<domain>`,
   `CORS_ORIGIN=https://<exact frontend origin>`. `*.vercel.app` + `*.onrender.com` is cross-site
   and breaks login (`cookieOptions.ts:41-50`, `sameSite:'lax'`); `sameSite:'none'` is not an
   accepted fallback.
3. **`PUBLIC_API_URL` on the backend preflight.** RESOLVED → demote to **warn-only** backend-side
   (still listed, still in the spec delta), mirroring the existing `COOKIE_DOMAIN` `WARN_ONLY`
   handling. Not dropped (keeps traceability), not left REQUIRED (avoids forcing a meaningless var
   on Render). Frontend build enforcement via `astro.config.mjs` is unchanged.
