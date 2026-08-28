# Design: Deploy Pipeline Foundations

> `specs/deploy-pipeline-foundations/spec.md` did not exist at design time (sdd-spec may run in parallel). Designed directly from `proposal.md`, including its resolved 2026-08-28 Decisions.

## Technical Approach

Three dependency-free CommonJS Node scripts under repo-root `scripts/deploy/` (Node builtins only — `child_process`, `http`/`https`, `process.env`; no npm packages, so pnpm's isolated `node_modules` never becomes a resolution problem for a script living outside any workspace package). Each follows `backend/src/database/migrate.js`'s own convention: a plain exported function plus an `if (require.main === module)` CLI guard, so tests can call the function directly without shelling out. None of them touch `backend/index.js`/`app.js` boot logic — they only sequence *around* the existing boot, exactly as the proposal requires.

## Architecture Decisions

| Decision | Choice | Rejected alternative | Rationale |
|---|---|---|---|
| Script location | Repo-root `scripts/deploy/*.js`, aliased from `backend/package.json` | `backend/scripts/deploy/` (matches existing `backend/scripts/generate-coverage-risk-map.js` precedent) | These scripts are pipeline-level orchestration (a future CD job invokes them directly), not backend-internal tooling; repo-root mirrors how root `package.json` already orchestrates via `pnpm --filter backend ...`. Backend convenience aliases keep the house-style script names discoverable from `backend/package.json` too. |
| `migrate-and-start.js` scope | Owns migrate → start only; `pnpm --filter backend build` stays a separate, existing, prior pipeline step | One script owning build+migrate+start | Build failures (compile-time/code) and migrate/start failures (data/runtime) are different failure categories; collapsing them loses failure attribution and duplicates an already-correct single command for no benefit. |
| cwd independence | Script resolves `REPO_ROOT` from `path.resolve(__dirname, '..', '..')` and calls `pnpm --filter backend db:migrate` / `pnpm --filter backend start` from there | Assume caller's cwd is repo root | PaaS/CI hooks vary in starting cwd; the alias in `backend/package.json` (`node ../scripts/deploy/migrate-and-start.js`) starts in `backend/`, so the script must self-normalize rather than trust the invoker. |
| Subprocess invocation | `spawnSync`/`spawn` with a fixed argv array (`'pnpm'`, `['--filter', 'backend', 'db:migrate']`), `shell: false` (default), env passthrough only | `exec()`/`shell: true` with a template string | No untrusted input ever reaches argv (no user-supplied strings interpolated into a shell command) — eliminates shell-injection surface entirely rather than sanitizing it. |
| Signal handling | Forward `SIGTERM`/`SIGINT` from the wrapper process to the spawned `start` child | Let Node's default child-process signal behavior apply | A container/PaaS orchestrator signals PID 1 (this wrapper), not the grandchild `node index.js` automatically; without explicit forwarding, `index.js`'s graceful-shutdown drain (`SHUTDOWN_TIMEOUT_MS`) would never run on deploy/restart. |
| `COOKIE_DOMAIN` preflight severity | Warn-only, non-blocking | Hard-fail like the other 8 vars | `cookieOptions.ts` already treats it as optional (`if (process.env.COOKIE_DOMAIN)`); hard-failing on a var the app itself doesn't require would make the preflight stricter than the code's own contract. It IS required for the confirmed cross-subdomain cookie topology, so it warns loudly rather than staying silent. |
| Test runner for `scripts/deploy/` | Node's built-in `node --test` (Node ≥22, already the repo engine floor) | Reuse backend's Jest | Keeps the scripts *and their tests* dependency-free and outside any workspace's Jest `rootDir`/module-resolution scope. |

## Data Flow

```
CD hook: pnpm --filter backend build
              │
              ▼
   node scripts/deploy/migrate-and-start.js   (cwd-independent; self-resolves REPO_ROOT)
              │
    pnpm --filter backend db:migrate  ──exit≠0──▶ log + exit(code)  [app never starts]
              │ exit=0
              ▼
    pnpm --filter backend start  (spawned; SIGTERM/SIGINT forwarded)
              │  → runs existing index.js boot: ensureDatabaseExists → authenticate →
              │    checkNoPendingMigrations → seedInitialData → listen() → markReady()
              ▼
   node scripts/deploy/smoke-test.js [baseUrl]
        poll GET /health/live  (1s interval) ──until 200, or timeout──▶ exit 1
              │ 200
        poll GET /health/ready (1s interval) ──until 200, or timeout──▶ exit 1
              │ 200
             exit 0
```

`env-preflight.js` runs standalone, before the sequence above, with no dependency on it.

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/deploy/migrate-and-start.js` | Create | `run()`: spawns `db:migrate`, checks exit code, only then spawns `start`; forwards `SIGTERM`/`SIGINT`; exports `run` + CLI guard |
| `scripts/deploy/smoke-test.js` | Create | `run({ baseUrl, timeoutMs })`: polls `/health/live` then `/health/ready`; exports `run` + CLI guard reading `SMOKE_TEST_BASE_URL`/`SMOKE_TEST_TIMEOUT_MS` env vars or a CLI positional arg for base URL |
| `scripts/deploy/env-preflight.js` | Create | `checkEnv(env)`: returns `{ missing: string[], warnings: string[] }` for the required/warn-only var lists; CLI guard prints and sets `process.exitCode` |
| `scripts/deploy/migrate-and-start.test.js` | Create | `node --test`, mocks `child_process.spawn`/`spawnSync` to assert migrate-fail-blocks-start and signal-forwarding |
| `scripts/deploy/smoke-test.test.js` | Create | `node --test`, starts a tiny fixture `http` server (delayed/flaky 503→200 sequences) to assert polling/timeout/exit-code behavior |
| `scripts/deploy/env-preflight.test.js` | Create | `node --test`, calls `checkEnv({...})` with var-combination fixtures |
| `backend/src/__tests__/deploy-migrate-and-start.integration.test.js` | Create | Real MySQL integration test (same `bootstrapTestDatabase()` harness as `boot.integration.test.js`): spawns the real script against the CI/local test DB, asserts it starts the server and `/health/ready` eventually returns 200; a second case points at bad DB creds and asserts non-zero exit with the server never bound |
| `backend/package.json` | Modify | Add `deploy:migrate-and-start`, `deploy:smoke-test`, `deploy:env-preflight` aliases (`node ../scripts/deploy/<script>.js`) |
| `package.json` (root) | Modify | Add `"test:deploy-scripts": "node --test scripts/deploy"` |
| `docs/RUNBOOKS.md` | Modify | New `## Deploy Pipeline` section (see below) |

## Interfaces

```js
// scripts/deploy/env-preflight.js
const REQUIRED = ['JWT_SECRET', 'CORS_ORIGIN', 'COOKIE_SECRET',
  'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_HOST', 'PUBLIC_API_URL'];
const WARN_ONLY = ['COOKIE_DOMAIN'];
function checkEnv(env = process.env) {
  return {
    missing: REQUIRED.filter((k) => !env[k]),
    warnings: WARN_ONLY.filter((k) => !env[k]),
  };
}
module.exports = { checkEnv, REQUIRED, WARN_ONLY };
```

Failure output prints ALL missing vars in one message, then exits non-zero once (no interactive/one-at-a-time prompting):
```
[env-preflight] FAIL: 3 required production env var(s) missing: JWT_SECRET, DB_PASS, PUBLIC_API_URL
[env-preflight] WARN: COOKIE_DOMAIN not set — required only for the cross-subdomain cookie topology; safe to ignore on a single-domain deploy.
```

`smoke-test.js` exit codes: `0` = both endpoints reached 200 within `SMOKE_TEST_TIMEOUT_MS` (default 60000ms, 1000ms poll interval); `1` = timeout elapsed on either phase, or the base URL never accepted a connection. Every outcome prints elapsed time and the last observed status/error so a CI log is actionable without re-running.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit | `env-preflight.checkEnv()` var-combination matrix; missing-only, warn-only, all-present | `node --test`, no process/env mutation beyond passed-in fixture object |
| Unit | `smoke-test.js` polling/backoff/timeout math | `node --test` + fixture `http.createServer` returning controlled status sequences (503×N→200) |
| Unit | `migrate-and-start.js` fail-fast-before-start + signal forwarding | `node --test`, `child_process.spawn`/`spawnSync` mocked via `node:test`'s `mock` module |
| Integration | Real migrate-then-start against a live DB | New Jest integration test reusing `bootstrapTestDatabase()`, same real-child-process pattern as `backend/src/__tests__/boot.integration.test.js` |
| Manual/CI | Smoke test against a real running instance | `pnpm --filter backend dev` locally, then `deploy:smoke-test` against it, before wiring into any future CD job |

## Threat Matrix

N/A for every predefined row (`threat-matrix.md`'s rows are git/PR/commit/push-specific; none apply — no VCS or PR automation here). The one real process-integration boundary present (subprocess spawning of `pnpm`) is covered above under "Architecture Decisions" (fixed argv, `shell: false`, explicit signal forwarding) rather than forced into an inapplicable row.

## RUNBOOKS.md Section

New `## Deploy Pipeline` section, appended directly after the existing "Compiled production start" section (the current last section, which ends by naming this exact gap). Contents: (1) the 4-step sequence — `pnpm --filter backend build` → `deploy:env-preflight` → `deploy:migrate-and-start` → `deploy:smoke-test` — with exact commands and what each exit code means; (2) a `### Migration authoring: expand/contract` subsection stating every schema migration must stay compatible with both the previous and new app version during a deploy window (additive first; destructive changes — drops, renames, `NOT NULL` tightening — only once the old code path is confirmed gone), so a code rollback never needs a schema rollback, and that `db:migrate:down` remains a manual last resort, not the primary safety net (mirrors proposal Decision #4 verbatim).

## Migration / Rollout

No schema/runtime/API change. Revert the branch to remove the scripts and doc section; nothing outside `scripts/deploy/`, `backend/package.json`, root `package.json`, and `docs/RUNBOOKS.md` is touched.

## Open Questions

- [ ] Whether `test:deploy-scripts` gets wired into `pnpm test`/CI is left to `sdd-tasks`/a follow-up — proposal explicitly defers actual CI wiring.
- [ ] Exact `SMOKE_TEST_TIMEOUT_MS` default (60000ms proposed) may need platform-specific tuning once a real PaaS cold-start time is measured — not blocking, easily overridden via env var.

## Effort Estimate Flag

Still "small" as scoped: 3 scripts + 3 unit-test files + 1 integration test + 2 package.json edits + 1 doc section. No blast-radius growth found while reading `index.js`/`app.js`/`health.ts` — no boot-behavior changes needed.
