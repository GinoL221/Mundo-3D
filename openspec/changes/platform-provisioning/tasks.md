# Tasks: platform-provisioning

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~410 total (PR1 ~115, PR2 ~90, PR3 ~205) |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (stacked onto main, in order) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (pre-cached this session) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Production DB port + verified TLS; no CREATE DATABASE in prod | PR 1 | `pnpm test backend/src/database/config` | N/A — private-CA handshake not CI-testable; manual verify at first deploy via `/health/ready` | `config.js` + `ensureDatabase.js` diff; `git revert`, dev/test untouched |
| 2 | Preflight guards `DB_PORT`/`DB_CA_CERT`; `PUBLIC_API_URL` demoted to warn; preflight chained into start | PR 2 | `pnpm test:deploy-scripts` | N/A — pure env-var gate, covered by node:test | `env-preflight.js` + start-script chain; independent `git revert` |
| 3 | `render.yaml` manifest, `trust proxy`, explicit bind, RUNBOOKS, proxy-aware limiter | PR 3 | `pnpm test` (limiter integration suite) | Manual bring-up from RUNBOOKS at first deploy | `app.js`/`index.js`/`render.yaml`/`RUNBOOKS.md` diff; revert restores pre-proxy behavior |

## Phase 1: PR1 — Managed DB connectivity (production only)

- [x] 1.1 RED: new `backend/src/database/config/__tests__/config.test.js` — prod block `port` = `Number(DB_PORT)`, `undefined` (never `NaN`) when unset; `dialectOptions.ssl.ca` = `DB_CA_CERT`; `rejectUnauthorized: true`; assert no `rejectUnauthorized: false` anywhere; dev/test blocks byte-unchanged. Use `jest.resetModules()` + env mutation per case. [managed-database-connectivity: Production Database Port and TLS]
- [x] 1.2 GREEN: `backend/src/database/config/config.js` — `production` block gains `port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined` and `dialectOptions: { ssl: { ca: process.env.DB_CA_CERT, rejectUnauthorized: true } }`; no throwing validation; dev/test blocks untouched.
- [x] 1.3 RED: extend `backend/src/database/config/__tests__/ensureDatabase.test.js` — `ensureDatabaseExists('production')` resolves `undefined` and never calls `mysql.createConnection`; non-prod path still creates DB; unsupported-`NODE_ENV` still throws. [managed-database-connectivity: No Database Creation in Production]
- [x] 1.4 GREEN: `backend/src/database/config/ensureDatabase.js` — `if (env === 'production') return;` placed after the unsupported-`NODE_ENV` validation and before `dbConfig` destructuring / `mysql.createConnection`.
- [x] 1.5 RED+GREEN: unit test that `config[production]` `port` + `dialectOptions.ssl` thread through `backend/src/database/models/index.js` into the Sequelize options object; no new wiring expected.
- [x] 1.6 Integration (feasible slice only): assert non-prod connection path is unchanged against plain CI MySQL; add a code comment / test note recording the private-CA TLS handshake as an accepted CI gap (manual verify at first deploy).
- [x] 1.7 Run `pnpm test` for touched suites; confirm dev/test boot behavior unaffected.

## Phase 2: PR2 — Required-var preflight delta

- [x] 2.1 RED: `scripts/deploy/env-preflight.test.js` (node:test, run by root `test:deploy-scripts`) — `checkEnv` lists `DB_PORT` and `DB_CA_CERT` in `missing` when unset and the script exits non-zero identifying them. [deploy-pipeline-foundations: Required Production Environment Variable Preflight]
- [x] 2.2 RED: same suite — with all hard-required vars set but `PUBLIC_API_URL` unset, it appears in `warnings` (not `missing`) and the script exits 0; likewise `COOKIE_DOMAIN`.
- [x] 2.3 GREEN: `scripts/deploy/env-preflight.js` — add `DB_PORT`, `DB_CA_CERT` to the REQUIRED list; move `PUBLIC_API_URL` to the warn-only list using the same mechanism as `COOKIE_DOMAIN`.
- [x] 2.4 RED: test that the deploy start path runs preflight before `deploy:migrate-and-start` and a missing required var blocks before the app process starts.
- [x] 2.5 GREEN: chain preflight before migrate-and-start in the start path — new `backend` `deploy:start` script `node ../scripts/deploy/env-preflight.js && node ../scripts/deploy/migrate-and-start.js` (package script consumed by `render.yaml` in PR3).
- [x] 2.6 Run `pnpm test:deploy-scripts`; confirm green. Spec delta `deploy-pipeline-foundations` is already authored — reference, do not rewrite.

## Phase 3: PR3 — Platform manifest, proxy-awareness, runbook

- [ ] 3.1 RED: integration test (Jest + supertest) — login limiter buckets by the forwarded client IP: two requests with distinct `X-Forwarded-For` do not share a bucket; a spoofed second hop is ignored; client B (different IP) MUST NOT get `429` while client A does. Must exercise the limiter for real — `loginLimiter.ts:24` short-circuits when `NODE_ENV==='test'`, so set a non-test env or assert `req.ip` directly; not a vacuous pass. [api-jwt-auth: Proxy-Aware Login Rate Limiting]
- [ ] 3.2 GREEN: `backend/src/app.js` — `server.set('trust proxy', 1)` immediately after `const server = express();`, before `requestIdMiddleware` and the `/api` limiter mounts. [platform-hosting-topology: Proxy-Aware Runtime]
- [ ] 3.3 GREEN: `backend/index.js` — `server.listen(PORT, '0.0.0.0', cb)` (explicit bind host).
- [ ] 3.4 Create root `render.yaml` — one free-tier web service: `buildCommand` `pnpm --filter backend build`; `startCommand` the chained preflight + migrate-and-start; env `RUN_COMPILED=true`, `NODE_ENV=production`, `NODE_VERSION=22`; `healthCheckPath: /health/ready`; every secret declared as a key with `sync: false` (dashboard-set, no values in git). [platform-hosting-topology: Committed Platform Manifest]
- [ ] 3.5 `docs/RUNBOOKS.md` — new "Platform bring-up" section after "Deploy Pipeline": Aiven DB + CA retrieval + raw multi-line PEM paste; Render service + custom domain + env keys; Vercel + `PUBLIC_API_URL` at build time; DNS apex/www → Vercel and `api.` → Render; `COOKIE_DOMAIN=.<domain>` + `CORS_ORIGIN` exact origin (sameSite stays `lax`); first-deploy order; `SMOKE_TEST_TIMEOUT_MS` cold-start note. [platform-hosting-topology: Custom-Domain Cookie Topology; Reproducible Bring-Up Runbook]
- [ ] 3.6 Run `pnpm test` limiter suite; record manual bring-up verification as deferred to first deploy.

## Notes

- Order is strict: PR1 must land before PR2 (preflight must guard vars the config actually consumes), PR2 before PR3 (manifest `startCommand` uses the chained preflight).
- Threat matrix: all rows `N/A` except header-spoofed client IP vs `trust proxy` — covered by RED task 3.1.
- Non-goals (no tasks): object storage / `upload.ts`; a `ci.yml` CD job; cloud account/domain creation; secrets in git; dev/test config changes; PEM `\n` normalization in code (runbook-only by design).
