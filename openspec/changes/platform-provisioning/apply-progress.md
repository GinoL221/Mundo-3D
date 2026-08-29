# Apply Progress: platform-provisioning

Mode: Strict TDD (RED → GREEN → REFACTOR). Test runner: `pnpm test` (Jest for backend).
Delivery: stacked-to-main. Branch: `feat/platform-provisioning-db-connectivity`.

## PR1 — Managed DB connectivity (production only) — COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 1.1 RED — `config/__tests__/config.test.js` | [x] | 8 cases: prod `port` from `DB_PORT`, `port` key absent when unset (never `NaN`), `ssl.ca` from `DB_CA_CERT`, `rejectUnauthorized: true`, no `rejectUnauthorized:false` anywhere, dev/test key-set regression guards. `jest.resetModules()` + per-case env mutation. |
| 1.2 GREEN — `config/config.js` production block | [x] | `...(process.env.DB_PORT ? { port: Number(process.env.DB_PORT) } : {})` + `dialectOptions: { ssl: { ca: process.env.DB_CA_CERT, rejectUnauthorized: true } }`. Declarative, no throwing validation. dev/test blocks untouched. |
| 1.3 RED — extend `config/__tests__/ensureDatabase.test.js` | [x] | +2 cases: production is a no-op (never calls `mysql.createConnection`, resolves `undefined`); unsupported `NODE_ENV` still throws before the production short-circuit. |
| 1.4 GREEN — `config/ensureDatabase.js` | [x] | `if (env === 'production') { return; }` after the unsupported-`NODE_ENV` validation, before `dbConfig` destructuring / `mysql.createConnection`. |
| 1.5 RED+GREEN — threading via `models/index.js` | [x] | New `models/__tests__/index.production-connection.test.js` (2 cases): production `config[env]` passes `port` + `dialectOptions.ssl` as the Sequelize 4th (options) arg; development threads neither. RED is established transitively by 1.1/1.2 (same `config.production` object) — passed immediately after the `config.js` change, confirming zero extra wiring. |
| 1.6 Integration (feasible slice) | [x] | Non-prod path unchanged asserted by the development-env case in `index.production-connection.test.js` + all 15 pre-existing `src/database` suites still green. See Accepted Gap below. |
| 1.7 Run touched suites | [x] | `jest src/database` → 15 suites / 49 tests green. Full `pnpm test` → backend 112 suites / 930 tests, frontend 14 files / 181 tests, exit 0. |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `src/database/config/__tests__/config.test.js` | Unit | ✅ 5/5 baseline | ✅ 2 failing (prod port, prod TLS); 6 guard tests green | ✅ 8/8 after `config.js` edit | ✅ port set vs. port omitted; TLS values vs. no-insecure-TLS; dev vs. test key-set | ➖ code already declarative/commented |
| 1.3/1.4 | `src/database/config/__tests__/ensureDatabase.test.js` | Unit | ✅ 2/2 baseline | ✅ 1 failing (prod no-op) | ✅ 4/4 after `ensureDatabase.js` edit | ✅ prod no-op vs. non-prod creates vs. unsupported throws vs. validation-before-short-circuit | ➖ none needed |
| 1.5/1.6 | `src/database/models/__tests__/index.production-connection.test.js` | Unit (constructor-arg capture) | N/A (new file) | ✅ RED transitive via 1.1/1.2 on shared `config.production` object | ✅ 2/2 | ✅ production threads port+ssl vs. development threads neither | ➖ none needed |

### Test Summary
- Total tests written: 12 (8 in config.test.js, 2 added to ensureDatabase.test.js, 2 in index.production-connection.test.js)
- Total tests passing: 12 / 12 (full suite: backend 930, frontend 181, exit 0)
- Layers used: Unit (12)
- Approval tests: None — no refactoring tasks
- Pure functions created: 0 (config is a declarative object literal; guard is a single early-return branch)

### Work Unit Evidence
| Evidence | Value |
|---|---|
| Focused test command + result | `pnpm --filter backend exec jest src/database/config src/database/models/__tests__/index.production-connection.test.js src/database/models/__tests__/index.test.js` → 4 suites / 17 tests passed |
| Runtime harness command/scenario + result | N/A — private-CA TLS handshake is not reproducible in CI (CI MySQL has no private CA). Non-prod runtime path exercised by 15 `src/database` suites (49 tests) green. Manual verification at first deploy via `/health/ready` + `deploy:smoke-test`. |
| Rollback boundary | `git revert` of the PR1 commit restores `config.js` + `ensureDatabase.js`; new test files are additive. dev/test/CI behavior is production-gated and unaffected either way. |

### Accepted Gap (recorded, not silently skipped)
Private-CA TLS handshake against the managed database is **not CI-testable** — the CI MySQL 8 service has no private CA and no TLS endpoint. This is verified once, manually, at first deploy via `/health/ready` returning 200 and `pnpm --filter backend deploy:smoke-test`. Not faked in tests.

### Deviations from design
None. `config.js` uses a spread-ternary (`...(cond ? { port } : {})`) instead of the design's `port: cond ? Number(...) : undefined` so the `port` key is truly absent (not present-with-`undefined`) when `DB_PORT` is unset — a stricter reading of the spec's "no port override" for dev/test parity and "never NaN". Behaviour identical for the driver.

### Pre-existing issues noted
`backend/src/database/config/__tests__/ensureDatabase.test.js` was already Prettier-non-conformant before this change; not reformatted to keep the PR1 diff focused. ESLint passes clean on all touched files.

## PR2 — Required-var preflight delta — COMPLETE

Branch: `feat/platform-provisioning-preflight-vars` (stacked off `feat/platform-provisioning-db-connectivity`).
Focused test runner: `pnpm test:deploy-scripts` (`node --test`, per design — these are node:test, not Jest).

| Task | Status | Notes |
|------|--------|-------|
| 2.1 RED — `env-preflight.test.js` DB_PORT/DB_CA_CERT | [x] | `checkEnv` cases + subprocess cases: `DB_PORT` / `DB_CA_CERT` unset → in `missing`, script exits non-zero naming them. |
| 2.2 RED — `PUBLIC_API_URL` / `COOKIE_DOMAIN` warn-only | [x] | All hard-required set, `PUBLIC_API_URL` unset → `warnings: ['PUBLIC_API_URL']`, `missing: []`, script exit 0; `COOKIE_DOMAIN` case retained. |
| 2.3 GREEN — `scripts/deploy/env-preflight.js` | [x] | `REQUIRED` += `DB_PORT`, `DB_CA_CERT` (inserted after `DB_HOST`, matching spec order). `PUBLIC_API_URL` removed from `REQUIRED`, appended to `WARN_ONLY` (same `checkEnv` filter mechanism as `COOKIE_DOMAIN`). WARN message + `WARN_ONLY` comment generalised to cover both keys. |
| 2.4 RED — start chain | [x] | New `scripts/deploy/deploy-start-chain.test.js`: structural asserts (`backend` `deploy:start` exists, `env-preflight` before `migrate-and-start`, joined by `&&`) + real integration: `pnpm --filter backend deploy:start` with `DB_PORT` unset → exit non-zero, stdout names `DB_PORT`, `db:migrate` never runs. |
| 2.5 GREEN — chain preflight into start | [x] | Added `backend/package.json` script `deploy:start` = `node ../scripts/deploy/env-preflight.js && node ../scripts/deploy/migrate-and-start.js`. |
| 2.6 Run `pnpm test:deploy-scripts` | [x] | 30/30 pass, exit 0. Full `pnpm test`: backend 112 suites / 930 tests, frontend 14 files / 181 tests, exit 0. |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1/2.2/2.3 | `scripts/deploy/env-preflight.test.js` | Unit (node:test) + subprocess | ✅ 4/4 pre-existing (1 rewritten for the new contract) | ✅ 9 failing (DB_PORT/DB_CA_CERT not required; PUBLIC_API_URL still hard-required; subprocess exits) | ✅ 16/16 after `env-preflight.js` edit | ✅ DB_PORT vs DB_CA_CERT vs 3-missing-in-order; warn-only PUBLIC_API_URL vs COOKIE_DOMAIN; checkEnv return vs real process exit code | ➖ list is declarative; no refactor needed |
| 2.4/2.5 | `scripts/deploy/deploy-start-chain.test.js` | Structural + integration (real `pnpm` subprocess) | N/A (new file) | ✅ 3 failing (`deploy:start` absent) | ✅ 3/3 after `backend/package.json` edit | ✅ script-present vs order (`env-preflight` before `migrate-and-start`) vs `&&` short-circuit vs missing-var aborts before `db:migrate` | ➖ 2 assertions reflowed for neighbour-file style |

### Test Summary
- Tests added/changed: 12 new in `env-preflight.test.js` (1 pre-existing case rewritten to the new contract, 3 pre-existing kept), 3 new in `deploy-start-chain.test.js`.
- `pnpm test:deploy-scripts`: 30 tests, 30 pass, 0 fail, exit 0.
- Full `pnpm test`: backend 930 pass / 112 suites, frontend 181 pass / 14 files, exit 0.
- Layers: Unit (checkEnv), subprocess exit-code, structural (package.json), integration (`pnpm --filter backend deploy:start`).

### Work Unit Evidence
| Evidence | Value |
|---|---|
| Focused test command + result | `pnpm test:deploy-scripts` → 30 tests / 30 pass / exit 0 |
| Runtime harness command/scenario + result | `pnpm --filter backend deploy:start` spawned with `DB_PORT` unset (all other REQUIRED set) → exit non-zero, stdout names `DB_PORT`, `db:migrate` never reached (asserted in `deploy-start-chain.test.js`). This is the real Render start path. |
| Rollback boundary | `git revert` of the PR2 commit restores `env-preflight.js` (`REQUIRED`/`WARN_ONLY` lists + messages) and removes the `deploy:start` script; test files are additive. No runtime behaviour outside the deploy preflight/start path is touched; `render.yaml` consumption of `deploy:start` is deferred to PR3. |

### Deviations from design
Task 2.5 text names the chain as `pnpm --filter backend deploy:env-preflight && pnpm --filter backend deploy:migrate-and-start`. Implemented as a `backend` package script `deploy:start` = `node ../scripts/deploy/env-preflight.js && node ../scripts/deploy/migrate-and-start.js` — the same two steps, same `&&` short-circuit, but using the direct `node ../scripts/deploy/*.js` form the sibling `deploy:*` aliases already use (avoids a nested `pnpm` invocation per step). PR3's `render.yaml` `startCommand` will call `pnpm --filter backend deploy:start`. Design decision "env-preflight is the runtime gate, chained in startCommand" is otherwise honoured exactly.

### Pre-existing issues noted
`scripts/deploy/*.js` are outside the repo's Prettier gate (root `format` targets only `backend/src` + `frontend/src`); `env-preflight.js` was already Prettier-non-conformant before this change (trailing-comma-in-call-args). Matched the existing `scripts/deploy/` style rather than Prettier defaults. No root ESLint config covers `scripts/`.

## PR3 — Platform manifest, proxy-awareness, runbook — NOT STARTED
