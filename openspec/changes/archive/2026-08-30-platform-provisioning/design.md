# Design: platform-provisioning

Traceability: proposal `openspec/changes/platform-provisioning/proposal.md` (Engram #6898, questions RESOLVED) · exploration #6897 · prior art `openspec/changes/archive/2026-08-28-deploy-topology/design.md`, `openspec/specs/deploy-pipeline-foundations/spec.md` (cited, not reproduced).

## Technical Approach

Exploration Approach 1: **config-object threading**. `models/index.js:10` already forwards the whole `config[env]` object as Sequelize's 4th argument, and `migrator.js:9-10` + `checkPendingMigrations.js` reuse that same `db.sequelize`. Adding `port` and `dialectOptions.ssl` to the **`production` block only** therefore reaches the runtime pool, the Umzug migrator, and the boot schema gate with zero new wiring. Everything else is a production-gated guard (`ensureDatabase`), a proxy-awareness flag (`app.js`), a required-var list (`env-preflight.js`), and declarative platform artifacts (`render.yaml`, RUNBOOKS). No migration, no new dependency, no dev/test behavior change.

## Architecture Decisions

### Decision: TLS material via `DB_CA_CERT` env PEM, block stays declarative

**Choice**: `production` gains `port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined` and `dialectOptions: { ssl: { ca: process.env.DB_CA_CERT, rejectUnauthorized: true } }`. No throwing validation inside `config.js`.
**Alternatives**: committed CA file (rejected, proposal Q1); `rejectUnauthorized: false` (rejected); eager fail-loud validation in the block.
**Rationale**: `config.js` is `module.exports = {...}` — the `production` literal is evaluated at require time in **every** env, so a throwing helper would break dev/test boots. The ternary avoids `Number(undefined) === NaN` reaching mysql2. Fail-loud belongs to `env-preflight.js`. Absent `DB_CA_CERT` degrades to Node's public CA bundle and fails the handshake loudly — never silently weakened.

### Decision: `ensureDatabaseExists` is a total no-op in production

**Choice**: `if (env === 'production') return;` placed **after** the unsupported-`NODE_ENV` validation (`ensureDatabase.js:9-12`) and **before** the `dbConfig` destructuring/`mysql.createConnection`. No residual port/SSL connection.
**Alternatives**: add port+SSL and keep `CREATE DATABASE`; add port+SSL for a connectivity probe only.
**Rationale**: the function's only work is `CREATE DATABASE IF NOT EXISTS` (`:24`); Aiven pre-provisions `defaultdb` and the scoped user lacks that privilege. A residual probe would duplicate `db.sequelize.authenticate()` (`index.js:145`, the very next chain step, now TLS-aware) through a second raw-mysql2 config path that can drift. Fail-closed is preserved: any genuine connect/auth failure still rejects into `index.js:157-165` → `process.exit(1)`. Keyed on the **`env` argument**, not `process.env.NODE_ENV`, because `index.js:144` passes it explicitly and `index.test.js` drives that argument. Returning `undefined` keeps the resolved shape, so `index.js:144`'s `.then()` chain is untouched. Placement after the validation preserves the existing "unsupported NODE_ENV throws" test contract.

### Decision: `app.set('trust proxy', 1)` — numeric, at app construction

**Choice**: inserted in `backend/src/app.js` immediately after `const server = express();` (`:36`), before `requestIdMiddleware` (`:41`) and long before `/api` mounts (`:117`) where `loginLimiter`/`registerLimiter` live.
**Alternatives**: `trust proxy: true`; a custom `keyGenerator`; setting it inside the limiter modules.
**Rationale**: Render terminates TLS at exactly one edge hop, so `1` trusts only the last proxy — a client-supplied `X-Forwarded-For` cannot spoof `req.ip`. `true` is permissive and trips express-rate-limit 8.5.2's `ERR_ERL_PERMISSIVE_TRUST_PROXY` validation. Placing it before `requestLoggerMiddleware` (`:103`) also fixes logged client IPs, not just rate-limit keys.

### Decision: `env-preflight` is the runtime gate, chained in `startCommand`

**Choice**: `render.yaml` `startCommand` runs `pnpm --filter backend deploy:env-preflight && pnpm --filter backend deploy:migrate-and-start`.
**Alternatives**: `startCommand` = migrate-and-start alone; preflight in `buildCommand`.
**Rationale**: `migrate-and-start.js` never calls the preflight (verified `:26-74`), so listing `DB_PORT`/`DB_CA_CERT` as REQUIRED would otherwise be inert. Runtime is the correct gate — `&&` short-circuits on the script's `process.exitCode = 1`.

### Decision: `render.yaml` declares env **keys** with `sync: false`

**Choice**: non-secret vars inline (`RUN_COMPILED=true`, `NODE_ENV=production`, `NODE_VERSION=22`); every secret declared as a key with `sync: false` and set in the dashboard. `healthCheckPath: /health/ready`.
**Alternatives**: leave all keys to the dashboard.
**Rationale**: the manifest becomes the reviewable inventory of what production needs, while no secret value ever enters git. `NODE_VERSION=22` pins what `engines.node >= 22` cannot. Build must keep devDependencies — `tsc` is a devDependency and `RUN_COMPILED=true` requires `dist/`.

## Data Flow

    Render start ──► env-preflight ──(exit 1 if missing)──► migrate-and-start
                                                                │
                                    db:migrate (Umzug, config[production] → port+TLS)
                                                                │
                                                          node index.js
                                                                │
      ensureDatabaseExists('production') ──► early return (no connection)
                                                                │
      sequelize.authenticate() ──► checkNoPendingMigrations() ──► seedInitialData()
                    │ (TLS to Aiven :DB_PORT with DB_CA_CERT)          │
                    └────── reject ──► logger.error ──► exit(1)   listen(PORT,'0.0.0.0')
                                                                       │
                                                                  markReady → /health/ready 200

    Browser ─https──► apex/www (Vercel static, PUBLIC_API_URL baked) ─XHR+credentials─►
             api.<domain> (Render) ─► trust proxy 1 → real req.ip → limiters
             ─► Set-Cookie m3d_auth; Domain=.<domain>; SameSite=Lax  (same-site ⇒ works)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/database/config/config.js` | Modify | `production` block gains `port` + `dialectOptions.ssl`; dev/test untouched |
| `backend/src/database/config/ensureDatabase.js` | Modify | production early return after the NODE_ENV validation |
| `scripts/deploy/env-preflight.js` | Modify | REQUIRED += `DB_PORT`, `DB_CA_CERT`; `PUBLIC_API_URL` REQUIRED → `WARN_ONLY` |
| `openspec/changes/platform-provisioning/specs/…` | Create | `deploy-pipeline-foundations` delta (owned by sdd-spec — referenced, not duplicated) |
| `backend/src/app.js` | Modify | `server.set('trust proxy', 1)` after `:36` |
| `backend/index.js` | Modify | `server.listen(PORT, '0.0.0.0', cb)` at `:152` (non-behavioral on Render; removes ambiguity) |
| `render.yaml` | Create | free-tier web service manifest |
| `docs/RUNBOOKS.md` | Modify | new "Platform bring-up" section after "Deploy Pipeline" (`:74`) |

## Interfaces / Contracts

New environment contract (production only):

| Var | Gate | Notes |
|-----|------|-------|
| `DB_PORT` | REQUIRED | Aiven non-standard port; parsed to `Number` |
| `DB_CA_CERT` | REQUIRED | full multi-line PEM; pasted raw in the Render dashboard |
| `COOKIE_DOMAIN` | WARN_ONLY (existing) | `.<domain>` — hard requirement per proposal Q2 |
| `PUBLIC_API_URL` | WARN_ONLY (demoted) | frontend build-time var; enforced by `astro.config.mjs:11` |

`SMOKE_TEST_TIMEOUT_MS` already exists (`smoke-test.js:59-61`) — cold-start tuning is a runbook note, **not** a code change.

## Testing Strategy

Strict TDD is active (`openspec/config.yaml: testing.strict_tdd: true`). RED before GREEN for every row.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (Jest) | `config.js` production block: `port` from `DB_PORT`, `undefined` when unset (never `NaN`), `ssl.ca` from `DB_CA_CERT`, `rejectUnauthorized: true`; dev/test blocks unchanged | new `backend/src/database/config/__tests__/config.test.js`; `jest.resetModules()` + env mutation per case |
| Unit (Jest) | `ensureDatabaseExists('production')` resolves `undefined` and **never** calls `mysql.createConnection`; non-prod path and the unsupported-NODE_ENV throw both still pass | extend `config/__tests__/ensureDatabase.test.js` (mock already in place at `:8-10`) |
| Unit (node:test) | `checkEnv` reports `DB_PORT`/`DB_CA_CERT` in `missing`; `PUBLIC_API_URL` in `warnings`, not `missing` | `scripts/deploy/*.test.js`, run by root `test:deploy-scripts` — **not** Jest |
| Integration (Jest+supertest) | `trust proxy` keys the limiter on the real client IP: two requests with distinct `X-Forwarded-For` do not share a bucket; a spoofed second hop is ignored | app-level supertest; limiters short-circuit on `NODE_ENV==='test'` (`loginLimiter.ts:24`), so the test must set a non-test env or assert `req.ip` directly |
| Integration (real DB) | **Not feasible** — CI's MySQL 8 service has no private CA/TLS. The TLS handshake is verified once, manually, at first deploy via `/health/ready` + `deploy:smoke-test` | stated as an accepted gap, not silently skipped |
| Manual | RUNBOOK reproducibility: operator performs the bring-up from the doc alone | success criterion in the proposal |

## Threat Matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No file classification or execution-by-extension logic. |
| Git repository selection | N/A | No `git` invocation added. |
| Commit state | N/A | No index/worktree automation. |
| Push state | N/A | Deploy is Render/Vercel native git auto-deploy; no ref resolution authored here. |
| PR commands | N/A | No PR automation. |

One real adversarial boundary exists outside this matrix and **is** covered by a RED test: header-spoofed client IP against `trust proxy` (see Testing Strategy, integration row).

## Migration / Rollout

No schema migration. Three stacked PRs onto `main` (delivery strategy: `stacked-to-main`, 400-line budget):

| PR | Content | Est. changed lines |
|----|---------|-----|
| 1 | `config.js` port+SSL, `ensureDatabase.js` prod skip, + unit tests | ~115 |
| 2 | `env-preflight.js` vars, spec delta, + node:test units | ~90 |
| 3 | `render.yaml`, `app.js` trust proxy, `index.js` bind host, RUNBOOKS section, + limiter test | ~205 |

**Review Workload note**: `Decision needed before apply: No` · `Chained PRs recommended: Yes` · `400-line budget risk: Low`. Each slice is independently revertible and independently verifiable (PR1/PR2 by unit suites, PR3 by the limiter test plus manual bring-up). PR1 must land before PR2 so the preflight guards vars the config actually consumes.

Operator sequence at first deploy: Aiven service + CA → Render service with env keys → DNS (`api.` → Render) → backend green on `/health/ready` → Vercel build with the final `PUBLIC_API_URL` → apex/www DNS → login smoke test.

## Rollback

Per-PR `git revert`; no data change. Every code path is production-gated, so dev/test/CI are unaffected by a revert. Platform side: disable Render auto-deploy and redeploy the previous commit; Aiven data untouched. Reverting PR3 alone restores the pre-proxy behavior without touching DB connectivity.

## Open Questions

- [ ] PEM newline handling: if an operator pastes `\n`-escaped CA text the handshake fails with an opaque error. Decision here: **no normalization in `config.js`**; the runbook mandates a raw multi-line paste. Revisit only if it bites in practice.
- [ ] `checkPendingMigrations.js:8-18` `REQUIRED_SCHEMA` still omits `Order`/`OrderItem` (pre-existing, exploration G3). Out of scope — the boot gate is weaker than it looks, but not weakened by this change.
