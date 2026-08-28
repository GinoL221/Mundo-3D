# Runbooks

Operational procedures for Mundo-3D's backend. These cover the application's own behavior (boot sequence, health checks, shutdown, migrations, secrets), CI triage, and the platform-agnostic deploy pipeline scripts (see "Deploy Pipeline" below) — not a specific hosting platform, because none is defined in this repo yet (no `Dockerfile`, no CI step that installs with `--prod` and runs the compiled build — see the "Compiled production start" note below). Update the deploy-specific steps once a hosting target is chosen.

## Reading logs

Production logs are structured JSON on stdout (`backend/src/infrastructure/logging/logger.ts`, Pino). In development/test they're pretty-printed instead. Auth headers (`req.headers.authorization`) and cookies (`req.headers.cookie`) are redacted automatically in production, so a log excerpt is safe to paste into an issue or share with someone debugging remotely.

- Filter by level: `LOG_LEVEL` env var controls the minimum level emitted (defaults to `info`, or `silent` under `NODE_ENV=test`).
- Every request gets a correlation ID (`infrastructure/middlewares/requestId.ts`) — use it to follow one request across log lines.
- `pino-pretty` isn't installed in production; if you need to read raw JSON logs locally, pipe through `pnpm exec pino-pretty` from `backend/`.

## Incident: backend process won't start

**Symptom**: the process exits shortly after starting, or `pnpm dev`/`node index.js` never logs "El servidor esta corriendo".

**Diagnosis** — the boot sequence is: authenticate DB connection → check no pending migrations → seed initial data → `.listen()`. It fails closed at the first broken step, so the log line right before exit tells you which one:

1. `"Error al conectar con la base de datos o insertar datos iniciales"` — could be DB auth, pending migrations, or seed failure. Check the nested error for specifics.
2. Pending migrations specifically: run `pnpm --filter backend db:migrate:status` to see what's outstanding.
3. DB unreachable: confirm `DB_HOST`/`DB_USER`/`DB_PASS`/`DB_NAME` in `.env` are correct and the DB is actually listening (`mysql -h $DB_HOST -u $DB_USER -p`).

**Fix**:
- Pending migrations → `pnpm --filter backend db:migrate`, then retry boot.
- Bad credentials → fix `.env`, never commit the fix.
- If this is happening right after a deploy that included new migrations, confirm migrations were applied *before* the new backend code started (see "Rolling back a migration" below if you need to undo one).

## Incident: `/health/ready` stuck at 503, but `/health/live` returns 200

**Meaning**: the process is alive and listening (`/health/live` never checks dependencies — see `openspec/specs/runtime-resilience/spec.md`), but the boot-completion latch never got set, which only happens once DB auth + migration check + seed have all succeeded. A load balancer or orchestrator will correctly keep routing traffic away from this instance.

**Diagnosis**: this is the same failure class as "backend won't start" above, except the process itself is still running (it didn't exit) — check the same boot-sequence log lines. Common cause: DB became unreachable *after* the process started listening but *before* boot finished (race on a slow-starting DB container).

**Do not** restart the process blindly — if the DB is genuinely down, a restart won't help and just adds churn to the logs. Confirm DB reachability first.

## Incident: CI is red on `main` or a PR

Two real incidents hit this repo in one session (2026-08-26) — both were genuine infrastructure bugs, not flakes, and both are worth knowing about before assuming "it's just flaky":

1. **`Build frontend` step fails with an `astro build` error.** `frontend/astro.config.mjs` fails the `build` subcommand specifically if `PUBLIC_API_URL` isn't set — deliberate, so a production build can't silently fall back to a localhost API URL. If a CI step or environment stops setting it, every build fails from that point on, on every branch. Check `.github/workflows/ci.yml`'s "Build frontend" step has a `PUBLIC_API_URL` env var.
2. **`Real-DB integration tests` fails with a `TypeError` inside a test's cleanup/`afterAll`, often masking the real error one frame up.** `backend/jest.integration.config.js` runs with `maxWorkers: 1` specifically because integration tests share one live MySQL database and `bootstrapTestDatabase()` (`backend/src/__tests__/helpers/testDb.ts`) is only idempotent *within one process* — parallel workers racing schema bootstrap (`ALTER TABLE ... ADD INDEX`) can duplicate-key-error. If this config ever gets weakened back to parallel workers, this class of failure returns.

**General triage**:
- Read the actual failing step's log, not just the red X — `gh run view --job <id> --log-failed`, and scroll *up* from the last error if it looks like a masking symptom (a `TypeError` on `undefined` inside a cleanup hook almost always means an earlier `beforeAll`/`beforeEach` step threw first).
- Before assuming "flaky, just re-run it": check whether the failure is new (did it fail on the last N runs too?) and whether your own most recent change plausibly caused it. A test that failed intermittently across many unrelated runs is more likely genuinely flaky; a test that started failing right after a specific push almost always was caused by that push.
- `backend/src/__tests__/boot.integration.test.js` spawns a real child process and waits up to 10s for it to report a listening port — it's inherently sensitive to CPU contention on the CI runner and can flake under heavy concurrent load (many integration files/jobs running at once). If *only* this test fails and a re-run passes clean, that's consistent with load-sensitivity, not a regression.

## Rotating a leaked secret

| Secret | Blast radius on rotation | Procedure |
|---|---|---|
| `JWT_SECRET` | **Every existing session is invalidated immediately** — all logged-in users get logged out. | Set the new value in the deploy environment, restart the backend. No migration needed. Warn users beforehand if possible; this is disruptive by design (it's the whole point if the secret leaked). |
| `COOKIE_SECRET` | Invalidates in-flight CSRF tokens (`m3d_csrf`) — users mid-form-submission get a CSRF rejection on their next state-changing request, resolved by a page reload. Does not log users out. | Set the new value, restart. |
| `DB_PASS` (or any DB credential) | Backend can't reconnect until updated — a bad rotation order causes the "backend won't start" incident above. | Update the credential in MySQL *and* in every environment's `.env`/deploy config in the same maintenance window, then restart the backend. Never rotate the DB-side credential before the backend's config is ready to pick up the new value. |

None of these secrets are recoverable from git history if they were ever committed — if a secret lands in a commit, rotating it is mandatory even after the commit is removed/force-pushed away, because the old value is still in anyone's already-fetched history (see `AGENTS.md`).

## Rolling back a migration

`pnpm --filter backend db:migrate:down` reverts the single most recently applied migration — it is a **destructive** operation (drops whatever that migration created). Review the migration file before running this; it's not a dry run.

There is no "roll back N migrations" shortcut — run `db:migrate:down` once per migration you need to undo, checking `db:migrate:status` between each to confirm you're reverting the one you intend to.

## Graceful shutdown behaves unexpectedly

On `SIGTERM`/`SIGINT`, the backend flips `/health/ready` to 503 immediately, stops accepting new connections, drains in-flight requests, closes the DB connection, then exits (`openspec/specs/runtime-resilience/spec.md`). If drain doesn't finish within `SHUTDOWN_TIMEOUT_MS` (default 10000ms, env-configurable), it force-exits rather than hanging — so a deploy/restart should never hang indefinitely on this process, but a very slow in-flight request can still get killed mid-response after the timeout. If restarts are killing requests that should have finished, raise `SHUTDOWN_TIMEOUT_MS`; if restarts are taking too long, lower it (traffic loss risk goes up as you lower it).

A second `SIGTERM`/`SIGINT` while shutdown is already in progress is a no-op — it will not restart the drain or crash the process, so sending the signal twice out of impatience is safe but doesn't speed anything up.

## Compiled production start (no deploy target defined yet)

Production is meant to run the compiled build, not `ts-node`: `pnpm --filter backend build` (emits `dist/`), then start with both `RUN_COMPILED=true` and `NODE_ENV=production` set. `RUN_COMPILED` is deliberately a separate flag from `NODE_ENV` — see `backend/index.js`'s comments — so setting `NODE_ENV=production` alone is not enough to get the compiled path; both are required together. This repo does not yet define *where* that runs (no `Dockerfile`, no orchestration config) — that's the next real gap before any of the above incidents can happen against a real production instance rather than a local/staging one.

## Deploy Pipeline

Three small, dependency-free Node scripts under `scripts/deploy/` (repo root) implement the platform-agnostic parts of a deploy — they don't provision or target any specific platform, they just sequence and verify what already exists. A future CD job (or a manual deploy) runs them in this order:

1. **Build** — `pnpm --filter backend build` (emits `dist/`; not one of the deploy scripts, it's the existing build step).
2. **Env preflight** — `pnpm --filter backend deploy:env-preflight`. Fails fast (exit 1) *before* the app process even starts if any required production env var is missing: `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `PUBLIC_API_URL`. Lists every missing var in one message, not one at a time. `COOKIE_DOMAIN` is warn-only (exit 0 with a warning) — it's genuinely optional per `cookieOptions.ts`, but required for a cross-subdomain deploy topology specifically.
3. **Migrate, then start** — `pnpm --filter backend deploy:migrate-and-start`. Runs `db:migrate` first; if it fails, the app is never started (exit code propagates, non-zero) — this is what actually enforces "migrations run before the new version serves traffic," since `index.js`'s own boot refuses to auto-migrate (see "Incident: backend process won't start" above). Forwards `SIGTERM`/`SIGINT` to the spawned server process so graceful shutdown still works normally when this wrapper is what the platform sends the signal to (see "Graceful shutdown" above).
4. **Smoke test** — `pnpm --filter backend deploy:smoke-test` (needs `SMOKE_TEST_BASE_URL` pointed at the just-deployed instance). Polls `GET /health/live` then `GET /health/ready` until both return 200 or `SMOKE_TEST_TIMEOUT_MS` elapses (default 60000ms) — readiness is never checked before liveness succeeds at least once. Non-zero exit means the deploy did not actually come up healthy, regardless of what the platform's own "deploy succeeded" signal says.

A non-zero exit at any step should stop the pipeline there — a build failure is a compile/lint problem, a preflight failure is a config problem, a migrate-and-start failure is a runtime/DB problem, and a smoke-test failure means the app started but never became healthy. Each failure category points somewhere different, so don't advance past a failed step assuming a later one will "recover."

To test any of the three scripts locally without deploying anywhere: `pnpm test:deploy-scripts` (root) runs their `node --test` unit suites; `pnpm --filter backend deploy:smoke-test` against a `pnpm --filter backend dev` instance exercises the real script end-to-end.

### Migration authoring: expand/contract

Schema migrations must stay compatible with **both** the previous and the new app version during a deploy window: additive changes first (nullable columns, new tables), destructive changes (drops, renames, `NOT NULL` tightening) only in a later migration once the old code path is confirmed gone. This is a manual authoring discipline — nothing in `migrate.js`/`checkPendingMigrations.js` enforces it — and it exists so a code rollback never needs a schema rollback. `db:migrate:down` (see "Rolling back a migration" above) remains a manual last resort, not the primary safety net; a deploy that ships code and a migration together should never *need* to roll the schema back if the migration itself followed this discipline.

### Note: physical-schema check now tolerates modern MySQL's integer display-width deprecation

`checkPendingMigrations.js`'s boot-time physical-schema verification used to compare column types as literal strings (e.g. expecting exactly `INT(11)`). MySQL 8.0.19+ stopped reporting that display-width suffix in `DESCRIBE`/`SHOW COLUMNS` output for integer columns not given an explicit width — a real MySQL 8.0.19+ server always reports bare `INT`, never `INT(11)`, which made the boot-time check fail closed against any current MySQL release, discovered while building this deploy pipeline's own real-database integration test. Fixed to tolerate an optional display-width suffix on integer types only (never on `DECIMAL`, where the parenthesized numbers are real precision/scale). If you see a schema-incompatibility error mentioning an integer column on a *very old* MySQL server (pre-8.0.19), that's the one case this fix doesn't paper over — the display width would genuinely differ there.
