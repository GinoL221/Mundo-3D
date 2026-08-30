# Runbooks

Operational procedures for Mundo-3D's backend. These cover the application's own behavior (boot sequence, health checks, shutdown, migrations, secrets), CI triage, the platform-agnostic deploy pipeline scripts (see "Deploy Pipeline" below), and the concrete hosting target — Render + Aiven + Vercel, described by the committed `render.yaml` and covered end to end in "Platform bring-up" below.

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

## Compiled production start

Production is meant to run the compiled build, not `ts-node`: `pnpm --filter backend build` (emits `dist/`), then start with both `RUN_COMPILED=true` and `NODE_ENV=production` set. `RUN_COMPILED` is deliberately a separate flag from `NODE_ENV` — see `backend/index.js`'s comments — so setting `NODE_ENV=production` alone is not enough to get the compiled path; both are required together. `render.yaml`'s `buildCommand`/`startCommand` set exactly this (see "Platform bring-up" below) — there is no `Dockerfile`, Render builds and runs the Node process directly.

## Deploy Pipeline

Three small, dependency-free Node scripts under `scripts/deploy/` (repo root) implement the platform-agnostic parts of a deploy — they don't provision or target any specific platform, they just sequence and verify what already exists. A future CD job (or a manual deploy) runs them in this order:

1. **Build** — `pnpm --filter backend build` (emits `dist/`; not one of the deploy scripts, it's the existing build step).
2. **Env preflight** — `pnpm --filter backend deploy:env-preflight`. Fails fast (exit 1) *before* the app process even starts if any required production env var is missing: `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_CA_CERT`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE`. Lists every missing var in one message, not one at a time. `COOKIE_DOMAIN` and `PUBLIC_API_URL` are warn-only (exit 0 with a warning): `COOKIE_DOMAIN` is genuinely optional per `cookieOptions.ts` but required for a cross-subdomain deploy topology, and `PUBLIC_API_URL` is a frontend build-time var baked by Vercel at `astro build` — irrelevant to the backend process, so its absence here only warns.
3. **Migrate, then start** — `pnpm --filter backend deploy:migrate-and-start` runs `db:migrate` first; if it fails, the app is never started (exit code propagates, non-zero) — this is what actually enforces "migrations run before the new version serves traffic," since `index.js`'s own boot refuses to auto-migrate (see "Incident: backend process won't start" above). Forwards `SIGTERM`/`SIGINT` to the spawned server process so graceful shutdown still works normally when this wrapper is what the platform sends the signal to (see "Graceful shutdown" above). In production, `render.yaml`'s `startCommand` runs `pnpm --filter backend deploy:start`, which chains steps 2 and 3 (`env-preflight && migrate-and-start`) so a missing required var aborts before any DB or app work happens — steps 2/3 are also runnable standalone, as shown here.
4. **Smoke test** — `pnpm --filter backend deploy:smoke-test` (needs `SMOKE_TEST_BASE_URL` pointed at the just-deployed instance). Polls `GET /health/live` then `GET /health/ready` until both return 200 or `SMOKE_TEST_TIMEOUT_MS` elapses (default 60000ms) — readiness is never checked before liveness succeeds at least once. Non-zero exit means the deploy did not actually come up healthy, regardless of what the platform's own "deploy succeeded" signal says.

A non-zero exit at any step should stop the pipeline there — a build failure is a compile/lint problem, a preflight failure is a config problem, a migrate-and-start failure is a runtime/DB problem, and a smoke-test failure means the app started but never became healthy. Each failure category points somewhere different, so don't advance past a failed step assuming a later one will "recover."

To test any of the three scripts locally without deploying anywhere: `pnpm test:deploy-scripts` (root) runs their `node --test` unit suites; `pnpm --filter backend deploy:smoke-test` against a `pnpm --filter backend dev` instance exercises the real script end-to-end.

### Migration authoring: expand/contract

Schema migrations must stay compatible with **both** the previous and the new app version during a deploy window: additive changes first (nullable columns, new tables), destructive changes (drops, renames, `NOT NULL` tightening) only in a later migration once the old code path is confirmed gone. This is a manual authoring discipline — nothing in `migrate.js`/`checkPendingMigrations.js` enforces it — and it exists so a code rollback never needs a schema rollback. `db:migrate:down` (see "Rolling back a migration" above) remains a manual last resort, not the primary safety net; a deploy that ships code and a migration together should never *need* to roll the schema back if the migration itself followed this discipline.

### Note: physical-schema check now tolerates modern MySQL's integer display-width deprecation

`checkPendingMigrations.js`'s boot-time physical-schema verification used to compare column types as literal strings (e.g. expecting exactly `INT(11)`). MySQL 8.0.19+ stopped reporting that display-width suffix in `DESCRIBE`/`SHOW COLUMNS` output for integer columns not given an explicit width — a real MySQL 8.0.19+ server always reports bare `INT`, never `INT(11)`, which made the boot-time check fail closed against any current MySQL release, discovered while building this deploy pipeline's own real-database integration test. Fixed to tolerate an optional display-width suffix on integer types only (never on `DECIMAL`, where the parenthesized numbers are real precision/scale). If you see a schema-incompatibility error mentioning an integer column on a *very old* MySQL server (pre-8.0.19), that's the one case this fix doesn't paper over — the display width would genuinely differ there.

## Platform bring-up (Render + Aiven + Vercel)

The first concrete hosting target: the backend runs on Render (free-tier web service, described by the committed `render.yaml` blueprint at the repo root), the database on Aiven (managed MySQL), admin-uploaded images on Cloudflare R2 (S3-compatible object storage), and the frontend on Vercel (static Astro build). Everything shares one registrable domain so the auth cookie stays same-site. An operator with fresh Render, Aiven, Cloudflare, and Vercel accounts and a purchased custom domain `<domain>` can reproduce the whole environment from this section alone.

### Topology

| Host | Serves | DNS |
|---|---|---|
| Vercel | frontend — apex `<domain>` and `www.<domain>` | apex/`www` → Vercel |
| Render | API — `api.<domain>` | `api.<domain>` CNAME → the Render service's `onrender.com` host |
| Aiven | MySQL — private endpoint, non-standard port, private CA | not public |

The frontend origin and the API differ only by the `api.` label, so they are the **same site**: the auth cookie is issued with `Domain=.<domain>`, `SameSite=Lax`, `Secure`, and round-trips on credentialed XHR from the frontend to the API without `SameSite=None`. Do **not** switch `sameSite` to `none` to "fix" auth — if the cookie is not coming back, the domain wiring below is wrong, not the `sameSite` value.

### 1. Aiven — MySQL service

1. Create a MySQL service. Note the **host**, **port** (Aiven uses a non-standard port — this is `DB_PORT`), database name, user, and password from the service overview.
2. Download / copy the service's **CA certificate** (Aiven console → service → "CA Certificate"). This is a full multi-line PEM (`-----BEGIN CERTIFICATE----- … -----END CERTIFICATE-----`).
3. This value becomes `DB_CA_CERT`. Paste it **raw and multi-line**, exactly as issued. Do not collapse it to one line, do not `\n`-escape it, do not wrap it in quotes. The backend passes it straight to the MySQL driver as `ssl.ca` with `rejectUnauthorized: true`; an escaped or re-wrapped PEM fails the TLS handshake with an opaque error at boot.
4. The scoped Aiven user cannot `CREATE DATABASE`; the backend already skips that step when `NODE_ENV=production`, using the pre-provisioned database directly.

### 2. Render — backend web service

1. New → Blueprint, point it at this repo. Render reads `render.yaml`: one web service, build `pnpm install --frozen-lockfile && pnpm --filter backend build`, start `pnpm --filter backend deploy:start`, health check `/health/ready`, Node 22, with `NODE_ENV=production` / `RUN_COMPILED=true` already set.
2. In the service's **Environment**, fill every `sync: false` key — they are declared in `render.yaml` but intentionally have no value in git:
   - `JWT_SECRET`, `COOKIE_SECRET` — fresh random secrets (see "Rotating a leaked secret" for blast radius).
   - `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT` — from Aiven step 1.
   - `DB_CA_CERT` — the raw PEM from Aiven step 2/3.
   - `CORS_ORIGIN` — the **exact** frontend origin, a single string, e.g. `https://<domain>` (scheme + host, no trailing slash, no second value). Pick one canonical host (apex or `www`) and 301-redirect the other at the DNS/Vercel layer; the API allows exactly one origin.
   - `COOKIE_DOMAIN` — `.<domain>` (leading dot), so the cookie is valid for both the frontend origin and `api.<domain>`.
   - `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` — from Cloudflare R2 step 4 below.
3. Deploy. `deploy:start` runs `env-preflight` first: a missing required var (now including `DB_PORT`, `DB_CA_CERT`, and the five `R2_*` keys) fails the deploy before the server starts, listing every missing key at once. Then `db:migrate` runs, then the server binds `0.0.0.0:$PORT`.
4. Add the custom domain `api.<domain>` to the Render service and create the CNAME it shows you. Wait for Render to issue the TLS cert.
5. Confirm `https://api.<domain>/health/ready` returns `200`.

### 3. Vercel — frontend

1. Import the repo as a Vercel project, root `frontend/`, framework preset Astro (static output).
2. Set `PUBLIC_API_URL=https://api.<domain>` as a build-time environment variable. Astro **bakes** this into the static bundle at build time (`frontend/astro.config.mjs` fails the build if it is unset). Changing it later requires a **rebuild/redeploy** — there is no runtime override.
3. Add the apex domain `<domain>` and `www.<domain>` to the Vercel project; set whichever host is not `CORS_ORIGIN` to redirect to the canonical one.

### 4. Cloudflare R2 — object storage for admin-uploaded images

Seeded catalog images are committed to the repo and served by Vercel; only images an admin uploads at runtime (new/edited product images, user avatars) go to R2. Without this, uploaded images are lost on every Render redeploy/spin-down **and** 404 on the Vercel frontend (different origin from the backend).

1. Enable R2 on the Cloudflare account (Cloudflare dashboard → R2). Verify at bring-up whether activation still requires a payment method on file even within the free tier.
2. Create a bucket (e.g. `mundo-3d-uploads`). Its name is `R2_BUCKET_NAME`.
3. Enable public read access for the bucket:
   - Quickest: turn on the **r2.dev managed subdomain** (Bucket → Settings → Public access). It has no SLA and is rate-limited by Cloudflare — acceptable pre-launch.
   - Production: attach a **custom domain** (e.g. `img.<domain>`). This requires `<domain>`'s DNS zone to be on Cloudflare.
   - Either way, the resulting public base URL (no trailing slash) is `R2_PUBLIC_URL_BASE`, e.g. `https://pub-<hash>.r2.dev` or `https://img.<domain>`.
4. Create a **bucket-scoped S3 API token**: R2 → Manage API tokens → Create API token, permission **Object Read & Write**, scoped to this bucket. The screen shows:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** (shown once) → `R2_SECRET_ACCESS_KEY`
   - **S3 API endpoint** (`https://<account>.r2.cloudflarestorage.com`) → `R2_ENDPOINT`. This is the *API* host, not the public read host — the two are always different.
5. Set all five `R2_*` values in the Render service Environment (step 2 above).
6. Free-tier ceiling: 10 GB stored, 1M Class A + 10M Class B operations per month, **zero egress**. Comfortable for a small catalog — revisit only if uploads approach 10 GB or write volume grows sharply.
7. Verify end to end: create a product with an image via the admin UI → the object appears in the R2 dashboard → the persisted URL opens directly in a browser → redeploy the Render service → the image still renders on the frontend.

### 5. DNS summary

- `<domain>` (apex) and `www.<domain>` → Vercel (per Vercel's instructions for the project).
- `api.<domain>` → CNAME to the Render service host.
- `img.<domain>` (only if a custom R2 domain is used instead of the r2.dev subdomain) → per Cloudflare's instructions for the bucket's custom domain.

### 6. First-deploy order

TLS certs and DNS propagation make ordering matter:

1. Aiven service up, CA cert in hand.
2. Cloudflare R2 bucket created, public access enabled, S3 API token issued — the five `R2_*` values in hand.
3. Render service created, all env keys set (including the `R2_*` keys), `api.<domain>` DNS + cert issued, `/health/ready` green.
4. Vercel build with the final `PUBLIC_API_URL` (it points at the now-live API).
5. apex/`www` DNS cut over to Vercel.
6. Log in from `https://<domain>` and confirm the `m3d_auth` cookie is set and is sent back on the next API call (`deploy:smoke-test` covers health, not auth — verify the login round-trip manually), then upload a product image and confirm it renders from `R2_PUBLIC_URL_BASE`.

If `PUBLIC_API_URL` was baked before `api.<domain>` was reachable, the frontend still works once the API comes up (the value is a URL, not a build-time fetch) — but if the value itself is wrong, rebuild.

### Cold starts and `SMOKE_TEST_TIMEOUT_MS`

Render's free tier spins the service down after ~15 minutes idle. The next request triggers a full cold boot: `deploy:start` is not re-run, but the server process restarts and runs its own boot chain — DB `authenticate()` over TLS to Aiven, `checkNoPendingMigrations()`, `seedInitialData()` — before `/health/ready` flips to `200`. Those Aiven round-trips plus container spin-up regularly exceed the `deploy:smoke-test` default of `SMOKE_TEST_TIMEOUT_MS=60000`. When smoke-testing a service that may have been idle, raise `SMOKE_TEST_TIMEOUT_MS` (e.g. `120000`–`180000`); a slow first response after idle is expected, not a failed deploy.
