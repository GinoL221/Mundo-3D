# Runbooks

Operational procedures for Mundo-3D's backend. These cover the application's own behavior (boot sequence, health checks, shutdown, migrations, secrets), CI triage, the platform-agnostic deploy pipeline scripts (see "Deploy Pipeline" below), and the verified cardless free-tier hosting stack — Cloudflare Pages + Render Free + TiDB Cloud Starter + Brevo + Supabase Storage S3, described by `render.yaml` and covered end to end in "Platform bring-up" below.

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
- If this is happening right after a deploy that included new migrations, confirm migrations were applied _before_ the new backend code started (see "Rolling back a migration" below if you need to undo one).

## Incident: `/health/ready` stuck at 503, but `/health/live` returns 200

**Meaning**: the process is alive and listening (`/health/live` never checks dependencies — see `openspec/specs/runtime-resilience/spec.md`), but the boot-completion latch never got set, which only happens once DB auth + migration check + seed have all succeeded. A load balancer or orchestrator will correctly keep routing traffic away from this instance.

**Diagnosis**: this is the same failure class as "backend won't start" above, except the process itself is still running (it didn't exit) — check the same boot-sequence log lines. Common cause: DB became unreachable _after_ the process started listening but _before_ boot finished (race on a slow-starting DB container).

**Do not** restart the process blindly — if the DB is genuinely down, a restart won't help and just adds churn to the logs. Confirm DB reachability first.

## Incident: CI is red on `main` or a PR

Two real incidents hit this repo in one session (2026-08-26) — both were genuine infrastructure bugs, not flakes, and both are worth knowing about before assuming "it's just flaky":

1. **`Build frontend` step fails with an `astro build` error.** `frontend/astro.config.mjs` fails the `build` subcommand specifically if `PUBLIC_API_URL` isn't set — deliberate, so a production build can't silently fall back to a localhost API URL. If a CI step or environment stops setting it, every build fails from that point on, on every branch. Check `.github/workflows/ci.yml`'s "Build frontend" step has a `PUBLIC_API_URL` env var.
2. **`Real-DB integration tests` fails with a `TypeError` inside a test's cleanup/`afterAll`, often masking the real error one frame up.** `backend/jest.integration.config.js` runs with `maxWorkers: 1` specifically because integration tests share one live MySQL database and `bootstrapTestDatabase()` (`backend/src/__tests__/helpers/testDb.ts`) is only idempotent _within one process_ — parallel workers racing schema bootstrap (`ALTER TABLE ... ADD INDEX`) can duplicate-key-error. If this config ever gets weakened back to parallel workers, this class of failure returns.

**General triage**:

- Read the actual failing step's log, not just the red X — `gh run view --job <id> --log-failed`, and scroll _up_ from the last error if it looks like a masking symptom (a `TypeError` on `undefined` inside a cleanup hook almost always means an earlier `beforeAll`/`beforeEach` step threw first).
- Before assuming "flaky, just re-run it": check whether the failure is new (did it fail on the last N runs too?) and whether your own most recent change plausibly caused it. A test that failed intermittently across many unrelated runs is more likely genuinely flaky; a test that started failing right after a specific push almost always was caused by that push.
- `backend/src/__tests__/boot.integration.test.js` spawns a real child process and waits up to 10s for it to report a listening port — it's inherently sensitive to CPU contention on the CI runner and can flake under heavy concurrent load (many integration files/jobs running at once). If _only_ this test fails and a re-run passes clean, that's consistent with load-sensitivity, not a regression.

### CI audit and immutable-reference triage

1. In the `Audit all dependencies` log, treat `AUDIT_ADVISORY` as a dependency remediation: inspect and resolve the advisory, then rerun normally. Treat `AUDIT_AVAILABILITY_FAILURE` as a registry/network outage: repair or wait for connectivity, then rerun. Treat `AUDIT_EXECUTION_FAILURE` as an ambiguous failed audit: inspect the forwarded output before rerunning. Every classification is intentionally nonzero; never add a bypass or `continue-on-error`.
2. For a Renovate proposal, use [`ci-dependency-provenance.md`](ci-dependency-provenance.md) to verify the official publisher, tag-to-SHA or registry digest mapping, valid signature/provenance evidence, and Linux MySQL manifest intent. Renovate only proposes; maintainers approve provenance through the PR.
3. If a reviewed reference causes CI regression, preserve the failed-run link and revert the focused workflow, provenance record, and updater configuration to the prior approved immutable values. Do not roll back to mutable tags, disable the audit, or weaken the four-job verification gate.

### Playwright retry, visual baseline, and failure diagnostics

1. Read the E2E step summary before rerunning. `RECOVERED_PASS` means the first attempt failed and the single native Playwright retry passed; it does not block the gate, but record and investigate recurring cases. `FINAL_E2E_FAILURE` means the retry was exhausted and the verification gate must remain blocked.
2. For a final failure, an authorized maintainer opens the `playwright-failure-diagnostics` artifact within its 14-day retention window. Compare the first and final attempt results, traces, screenshots, and video before changing code or a snapshot. Do not intentionally add fixture data, credentials, cookies, or authorization headers to diagnostics.
3. A visual baseline change needs a PR explanation, Linux CI environment confirmation, image-diff review, and maintainer approval. CI fixes locale `es-AR`, UTC timezone, light color scheme, reduced motion, 1x scale, no touch/mobile, and a 1280x720 base viewport; the Home visual contract then applies its reviewed responsive viewports and deterministic fixtures. Local pixel parity is not baseline authority.
4. The browser cache key includes the locked Playwright version and Chromium revision. Keep both cache-miss browser installation and cache-hit system-dependency installation paths. If either path fails, preserve the run URL and logs; do not substitute a different browser channel or expand the matrix.
5. Artifact authorization is a repository Actions permission, not a workflow capability. Current GitHub API evidence shows this is a public repository and exposes no repository team; therefore maintainers must resolve and record an approved access model before asserting maintainer-team-only diagnostic access. Do not claim that this YAML enforces membership.
6. To roll back this reliability change, preserve failed-run evidence and revert the focused config/workflow/documentation change together. Do not add retries, `continue-on-error`, successful-run diagnostic uploads, or a gate exception as a workaround.

## Rotating a leaked secret

| Secret                           | Blast radius on rotation                                                                                                                                                                 | Procedure                                                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`                     | **Every existing session is invalidated immediately** — all logged-in users get logged out.                                                                                              | Set the new value in the deploy environment, restart the backend. No migration needed. Warn users beforehand if possible; this is disruptive by design (it's the whole point if the secret leaked).                                           |
| `COOKIE_SECRET`                  | Invalidates in-flight CSRF tokens (`m3d_csrf`) — users mid-form-submission get a CSRF rejection on their next state-changing request, resolved by a page reload. Does not log users out. | Set the new value, restart.                                                                                                                                                                                                                   |
| `DB_PASS` (or any DB credential) | Backend can't reconnect until updated — a bad rotation order causes the "backend won't start" incident above.                                                                            | Update the credential in MySQL _and_ in every environment's `.env`/deploy config in the same maintenance window, then restart the backend. Never rotate the DB-side credential before the backend's config is ready to pick up the new value. |
| `DEMO_SANDBOX_JWT_SECRET`        | **Every active Demo Sandbox session is invalidated immediately** — production user sessions (`JWT_SECRET`) are unaffected.                                                               | Generate a new >= 32-char secret distinct from `JWT_SECRET`, update `DEMO_SANDBOX_JWT_SECRET` in Render, and restart the backend.                                                                                                             |
| Slot DB passwords (`DEMO_SANDBOX_SLOTS_JSON`) | Affected sandbox slots fail to connect or reset until both sides match; production `DB_USER`/`DB_NAME` is unaffected.                                                               | Update the slot MySQL user password in TiDB Cloud and the matching `password` entry inside `DEMO_SANDBOX_SLOTS_JSON` in Render in the same window (or temporarily set `DEMO_SANDBOX_ENABLED=false` during rotation), then restart.            |

None of these secrets are recoverable from git history if they were ever committed — if a secret lands in a commit, rotating it is mandatory even after the commit is removed/force-pushed away, because the old value is still in anyone's already-fetched history (see `AGENTS.md`).

## Rolling back a migration

`pnpm --filter backend db:migrate:down` reverts the single most recently applied migration — it is a **destructive** operation (drops whatever that migration created). Review the migration file before running this; it's not a dry run.

There is no "roll back N migrations" shortcut — run `db:migrate:down` once per migration you need to undo, checking `db:migrate:status` between each to confirm you're reverting the one you intend to.

## Graceful shutdown behaves unexpectedly

On `SIGTERM`/`SIGINT`, the backend flips `/health/ready` to 503 immediately, stops accepting new connections, drains in-flight requests, closes the DB connection, then exits (`openspec/specs/runtime-resilience/spec.md`). If drain doesn't finish within `SHUTDOWN_TIMEOUT_MS` (default 10000ms, env-configurable), it force-exits rather than hanging — so a deploy/restart should never hang indefinitely on this process, but a very slow in-flight request can still get killed mid-response after the timeout. If restarts are killing requests that should have finished, raise `SHUTDOWN_TIMEOUT_MS`; if restarts are taking too long, lower it (traffic loss risk goes up as you lower it).

A second `SIGTERM`/`SIGINT` while shutdown is already in progress is a no-op — it will not restart the drain or crash the process, so sending the signal twice out of impatience is safe but doesn't speed anything up.

## Compiled production start

Production is meant to run the compiled build, not `ts-node`: `pnpm --filter backend build` (emits `dist/`), then start with both `RUN_COMPILED=true` and `NODE_ENV=production` set. `RUN_COMPILED` is deliberately a separate flag from `NODE_ENV` — see `backend/index.js`'s comments — so setting `NODE_ENV=production` alone is not enough to get the compiled path; both are required together. `render.yaml`'s `buildCommand`/`startCommand` set exactly this (see "Platform bring-up" below), so Render builds and runs the Node process directly. The root `Dockerfile` is the separate Render image-backed path and uses the same deploy pipeline.

## Why NODE_ENV is checked by value

`NODE_ENV=test` is not a harmless label in this codebase. It used to unlock
three things at once: the `test-only-*` JWT and cookie secrets, which are
committed to this repository and therefore public, and a full bypass of the
login and register rate limiters. A production process started that way would
have signed forgeable tokens with no throttling.

Two layers now prevent that:

- Those fallbacks require `JEST_WORKER_ID`, which only Jest sets and no deploy
  configuration can supply. The Playwright suite runs a real server, so it
  passes its own throwaway secrets and raised limits in
  `e2e/playwright.config.ts` rather than relying on the fallback.
- `env-preflight` refuses any `NODE_ENV` other than `production`, so the deploy
  `&&` chain short-circuits before the app or the migrations run.

## Deploy Pipeline

Three small, dependency-free Node scripts under `scripts/deploy/` (repo root) implement the platform-agnostic parts of a deploy — they don't provision or target any specific platform, they just sequence and verify what already exists. A future CD job (or a manual deploy) runs them in this order:

1. **Build** — `pnpm --filter backend build` (emits `dist/`; not one of the deploy scripts, it's the existing build step).
2. **Env preflight** — `pnpm --filter backend deploy:env-preflight`. Fails fast (exit 1) _before_ the app process even starts if `NODE_ENV` is anything other than `production` (with `test`, `JwtSecret.ts`/`CookieSecret.ts` fall back to constants committed in this repository and both rate limiters are skipped — see "Why NODE_ENV is checked by value" below), if `STORAGE_DRIVER` is invalid, or if any required production env var is missing:
   - Always required: `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_CA_CERT`.
   - Conditional by `STORAGE_DRIVER` (defaults to `r2` when unset):
     - `r2`: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` (`R2_REGION` and `R2_FORCE_PATH_STYLE` are optional overrides for S3-compatible providers such as Supabase Storage).
     - `cloudinary`: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
     - `disabled`: no storage credentials required (runtime uploads return `503`).
   - Lists every missing var in one message, not one at a time. `COOKIE_DOMAIN` and `PUBLIC_API_URL` are warn-only (exit 0 with a warning): `COOKIE_DOMAIN` is optional per `cookieOptions.ts` (not needed with the Cloudflare Pages same-origin `/api/*` proxy, required only for a cross-subdomain `api.<domain>` topology), and `PUBLIC_API_URL` is a frontend build-time var baked by Cloudflare Pages (or a custom-domain frontend build) at `astro build` — irrelevant to the backend process, so its absence here only warns.
3. **Migrate, then start** — `pnpm --filter backend deploy:migrate-and-start` runs `db:migrate` first; if it fails, the app is never started (exit code propagates, non-zero) — this is what actually enforces "migrations run before the new version serves traffic," since `index.js`'s own boot refuses to auto-migrate (see "Incident: backend process won't start" above). Forwards `SIGTERM`/`SIGINT` to the spawned server process so graceful shutdown still works normally when this wrapper is what the platform sends the signal to (see "Graceful shutdown" above). In production, `render.yaml`'s `startCommand` runs `pnpm --filter backend deploy:start`, which chains steps 2 and 3 (`env-preflight && migrate-and-start`) so a missing required var aborts before any DB or app work happens — steps 2/3 are also runnable standalone, as shown here. When enabling Demo Sandbox, run `pnpm --filter backend db:sandbox:bootstrap` before flipping `DEMO_SANDBOX_ENABLED=true` (see "Demo Sandbox" below).
4. **Smoke test** — `pnpm --filter backend deploy:smoke-test` (needs `SMOKE_TEST_BASE_URL` pointed at the just-deployed instance). Polls `GET /health/live` then `GET /health/ready` until both return 200 or `SMOKE_TEST_TIMEOUT_MS` elapses (default `120000ms`) — readiness is never checked before liveness succeeds at least once. Optionally set `SMOKE_EXPECT_DEMO_ENABLED=true` (asserts `GET /api/demo/status` returns `200` with `{ "enabled": true }`) or `SMOKE_EXPECT_DEMO_ENABLED=false` (asserts `404`); leaving it unset skips the demo check and invalid values fail fast. Non-zero exit means the deploy did not actually come up healthy, regardless of what the platform's own "deploy succeeded" signal says.

A non-zero exit at any step should stop the pipeline there — a build failure is a compile/lint problem, a preflight failure is a config problem, a migrate-and-start failure is a runtime/DB problem, and a smoke-test failure means the app started but never became healthy. Each failure category points somewhere different, so don't advance past a failed step assuming a later one will "recover."

To test any of the three scripts locally without deploying anywhere: `pnpm test:deploy-scripts` (root) runs their `node --test` unit suites; `pnpm --filter backend deploy:smoke-test` against a `pnpm --filter backend dev` instance exercises the real script end-to-end.

### Migration authoring: expand/contract

Schema migrations must stay compatible with **both** the previous and the new app version during a deploy window: additive changes first (nullable columns, new tables), destructive changes (drops, renames, `NOT NULL` tightening) only in a later migration once the old code path is confirmed gone. This is a manual authoring discipline — nothing in `migrate.js`/`checkPendingMigrations.js` enforces it — and it exists so a code rollback never needs a schema rollback. `db:migrate:down` (see "Rolling back a migration" above) remains a manual last resort, not the primary safety net; a deploy that ships code and a migration together should never _need_ to roll the schema back if the migration itself followed this discipline.

### Note: physical-schema check now tolerates modern MySQL's integer display-width deprecation

`checkPendingMigrations.js`'s boot-time physical-schema verification used to compare column types as literal strings (e.g. expecting exactly `INT(11)`). MySQL 8.0.19+ stopped reporting that display-width suffix in `DESCRIBE`/`SHOW COLUMNS` output for integer columns not given an explicit width — a real MySQL 8.0.19+ server always reports bare `INT`, never `INT(11)`, which made the boot-time check fail closed against any current MySQL release, discovered while building this deploy pipeline's own real-database integration test. Fixed to tolerate an optional display-width suffix on integer types only (never on `DECIMAL`, where the parenthesized numbers are real precision/scale). If you see a schema-incompatibility error mentioning an integer column on a _very old_ MySQL server (pre-8.0.19), that's the one case this fix doesn't paper over — the display width would genuinely differ there.

## Platform bring-up (Cloudflare Pages + Render Free + TiDB Cloud Starter)

Verified **100% cardless free-tier topology** (no credit card or custom domain required): **Cloudflare Pages** serves the static Astro frontend and proxies `/api/*` on the same origin (`frontend/functions/api/[[path]].ts`), **Render Free** runs the Node/Docker backend, **TiDB Cloud Starter** provides MySQL 8.0-compatible storage over TLS, **Brevo Free** sends confirmation email via HTTPS API v3 on port 443, and **Supabase Storage (S3-compatible)** stores runtime-uploaded product and avatar images.

### Topology

| Component | Provider (Free Tier) | Role & Routing |
| --- | --- | --- |
| Frontend + `/api/*` proxy | **Cloudflare Pages** | Static Astro build + Pages Function (`frontend/functions/api/[[path]].ts`) forwarding `/api/*` to Render |
| Backend API | **Render Free** | Node (`render.yaml`) or Docker (`Dockerfile`) web service (`*.onrender.com`), `/health/ready`, ~15-min idle spin-down |
| Database | **TiDB Cloud Starter** | MySQL 8.0-compatible over TLS on `DB_PORT=4000` with `isrgrootx1.pem` (`DB_CA_CERT`) |
| Transactional Email | **Brevo Free** | HTTPS API v3 (`MAIL_DRIVER=brevo-http`, port 443) — avoids Render Free's blocked outbound SMTP port 587 |
| Object Storage | **Supabase Storage S3** | Cardless S3-compatible storage (`STORAGE_DRIVER=r2`, `R2_REGION`, `R2_FORCE_PATH_STYLE=true`); alternatives: Cloudflare R2, Cloudinary, or `disabled` |

Because the Cloudflare Pages Function proxies `/api/*` on the **same origin** (`https://<project>.pages.dev`), browser cookies (`m3d_auth`, `m3d_refresh`, `m3d_csrf`, `m3d_user`) remain first-party (`SameSite=Lax`, `Secure`) with **`COOKIE_DOMAIN` unset**. Do **not** switch `sameSite` to `none`.

> **Custom-domain cross-subdomain alternative**: If you attach a custom domain `<domain>` and point the frontend directly at `https://api.<domain>` (CNAME → Render) instead of using the `/api/*` Pages proxy, set `PUBLIC_API_URL=https://api.<domain>` on the frontend build and `COOKIE_DOMAIN=.<domain>` + `CORS_ORIGIN=https://<domain>` on the backend so auth cookies remain same-site across `<domain>` and `api.<domain>`.

### 1. TiDB Cloud Starter — MySQL service

1. Create a **TiDB Cloud Starter** cluster (cardless) and pre-create the application database (for example, `mundo_3d_db`). The scoped production user does not rely on `CREATE DATABASE`; the backend skips database creation when `NODE_ENV=production`.
2. Record **host** (`DB_HOST`), **port** (`DB_PORT=4000`), **database** (`DB_NAME`), **user** (`DB_USER`), and **password** (`DB_PASS`).
3. Download the TiDB Cloud root CA PEM (`isrgrootx1.pem`). Paste its **raw, multi-line PEM** (`-----BEGIN CERTIFICATE----- … -----END CERTIFICATE-----`) into `DB_CA_CERT` in Render. Do not collapse newlines, `\n`-escape it, or wrap it in quotes — the MySQL driver passes it directly to `ssl.ca` with `rejectUnauthorized: true`.

### 2. Brevo Free — HTTPS API v3 (primary) or SMTP relay

**Render Free blocks outbound SMTP port 587** (causing `smtp_failed` timeouts after 120s). Use Brevo's HTTPS API on port 443 (`BrevoHttpMailAdapter`, `POST https://api.brevo.com/v3/smtp/email` with a 10s request timeout):

1. In Brevo, verify the sender email or domain. Brevo Free allows 300 emails/day across transactional and campaign sends.
2. In **Brevo → Settings → Security → Authorized IPs**, disable IP restriction for **API keys** when deploying on Render Free (Render Free uses dynamic egress IPs; leaving Authorized IPs enabled causes Brevo to reject API calls with `401` and log `outcome: "smtp_failed"`).
3. Generate a Brevo API v3 key (`xkeysib-...`, scoped to transactional email send) and set in Render:
   - `MAIL_DRIVER=brevo-http` (optional when `BREVO_API_KEY` is non-empty, recommended for clarity)
   - `BREVO_API_KEY=<your-brevo-v3-api-key>` (dashboard-only; never commit)
   - `MAIL_FROM=Mundo-3D <verified@sender.example>` (falls back to `SMTP_FROM` if `MAIL_FROM` is unset)
   - `PUBLIC_APP_URL=https://<project>.pages.dev` (canonical frontend origin, no trailing slash)
4. **Legacy SMTP relay (hosts allowing outbound port 587)**: set `MAIL_DRIVER=smtp`, `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Keep `SMTP_USER`/`SMTP_PASS` dashboard-only.

### 3. Object storage (`STORAGE_DRIVER`)

Seeded catalog images are committed to the repo and served from Cloudflare Pages' CDN. Only runtime uploads (admin-created/edited product images and user avatars) use `STORAGE_DRIVER` (`r2` | `cloudinary` | `disabled`, defaulting to `r2` in production when unset):

| Driver | `STORAGE_DRIVER` | Required Variables | Notes |
| --- | --- | --- | --- |
| **Supabase Storage (S3, cardless)** | `r2` | `R2_ENDPOINT`, `R2_REGION`, `R2_FORCE_PATH_STYLE=true`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL_BASE` | Verified cardless S3 option (`mundo-3d-media` public bucket). `R2_ENDPOINT` is Supabase's S3 endpoint; `R2_PUBLIC_URL_BASE` is the public object URL base (`.../storage/v1/object/public/<bucket>`). |
| **Cloudflare R2** | `r2` | `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` | `R2_REGION` defaults to `auto`; `R2_FORCE_PATH_STYLE` defaults to `false`. Verify whether R2 activation requires a card. |
| **Cloudinary Free** | `cloudinary` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Signed uploads via native `fetch` + `node:crypto` (zero extra dependencies). |
| **Disabled** | `disabled` | None | Static catalog images still load from Pages CDN; upload endpoints return `503`. |

### 4. Render Free — backend web service

1. Create a Web Service from this repo using **New → Blueprint** (`render.yaml`, Node 22, build `pnpm install --frozen-lockfile && pnpm --filter backend build`, start `pnpm --filter backend deploy:start`, health check `/health/ready`) — or use the **Docker** path below (`Dockerfile`).
2. Fill every `sync: false` key in Render **Environment** (keep `NODE_ENV=production` and `RUN_COMPILED=true`):
   - `JWT_SECRET`, `COOKIE_SECRET` — fresh random secrets (see "Rotating a leaked secret").
   - `PROXY_SHARED_SECRET` — fresh random secret shared with Cloudflare Pages so the backend trusts `X-Forwarded-Client-IP` (`CF-Connecting-IP`) **only** from the Pages proxy (direct hits to `*.onrender.com` cannot spoof rate-limit IPs).
   - `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_CA_CERT` — from TiDB Cloud Starter step 1.
   - `CORS_ORIGIN`, `PUBLIC_APP_URL` — exact canonical frontend origin (e.g. `https://<project>.pages.dev`, no trailing slash).
   - `COOKIE_DOMAIN` — leave unset when using the Cloudflare Pages `/api/*` same-origin proxy (set `.<domain>` only for the custom-domain `api.<domain>` topology).
   - `MAIL_DRIVER`, `BREVO_API_KEY`, `MAIL_FROM` (or `SMTP_*`) — from Brevo step 2.
   - `STORAGE_DRIVER` and the matching storage keys (`R2_*` or `CLOUDINARY_*`) — from step 3.
3. Deploy. `deploy:start` runs `env-preflight` → `db:migrate` → compiled server on `0.0.0.0:$PORT`.
4. **Production seed behavior**: on boot, `backend/src/database/seed.js` seeds `Category`, `Franchise`, and `Product` when tables are empty, and **explicitly skips `users.json` when `NODE_ENV=production`** (no demo/admin credentials are ever seeded in production).

### Render image-backed alternative — Docker (`Dockerfile`)

Use the root `Dockerfile` when deploying as a container image (Render **New → Web Service → Existing Image** or Docker-backed web service):

1. Build and push an immutable tag (never rely on a floating `:latest` tag):

   ```sh
   docker build --tag docker.io/<user>/mundo-3d-backend:<immutable-tag> .
   docker push docker.io/<user>/mundo-3d-backend:<immutable-tag>
   ```

   The image sets `NODE_ENV=production`, `RUN_COMPILED=true`, `PORT=10000`, copies `patches/`, `backend/openapi.json`, `backend/dist`, `backend/src/database`, and `scripts/deploy`, and runs `pnpm --filter backend deploy:start` (`env-preflight && migrate-and-start`).
2. Leave Render's command/entrypoint unset and configure health check `/health/ready`.
3. Provide the same environment variables listed in step 4 above in the Render dashboard (`PUBLIC_API_URL` is not needed by the backend container).

### 5. Cloudflare Pages — frontend & `/api/*` proxy

1. Create a Cloudflare Pages project connected to this repo:
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter frontend build`
   - Build output directory: `frontend/dist`
   - Functions directory: `frontend/functions` (automatically serves `frontend/functions/api/[[path]].ts` at `/api/*`)
2. Set build-time environment variable:
   - `PUBLIC_API_URL=https://<project>.pages.dev` (same origin as the Pages site, no trailing slash). `frontend/astro.config.mjs` fails the build if `PUBLIC_API_URL` is unset; changing it requires a rebuild.
3. Set Pages Function runtime environment variables (Production + Preview as needed):
   - `BACKEND_API_URL=https://<service>.onrender.com` (Render backend origin, no trailing slash)
   - `PROXY_SHARED_SECRET=<same-secret-as-Render>`
4. Proxy behavior (`frontend/functions/api/[[path]].ts`):
   - Strips incoming `x-proxy-secret`, `x-forwarded-client-ip`, and `host`, then attaches `X-Forwarded-Client-IP` (`CF-Connecting-IP`) + `X-Proxy-Secret`.
   - Normalizes Render Free cold-start non-JSON `502`/`503`/`504` HTML responses into `503` JSON (`{ "error": "..." }` with `Cache-Control: no-store` and `Retry-After: 10`), and `parseApiResponse` on the frontend renders a user-friendly retry message instead of a raw `JSON.parse` failure.

### 6. First-deploy order & live verification checklist

1. Provision **TiDB Cloud Starter** (`mundo_3d_db`, `DB_PORT=4000`, `isrgrootx1.pem`).
2. Verify **Brevo** sender and create `BREVO_API_KEY`.
3. Provision **Supabase Storage** public bucket (`mundo-3d-media`) and S3 keys (or select `cloudinary` / `disabled`).
4. Deploy **Render Free** with all env keys, then verify `GET /health/live`, `GET /health/ready` (`200`), and `GET /api/openapi.json` (`200`).
5. Deploy **Cloudflare Pages** with `PUBLIC_API_URL`, `BACKEND_API_URL`, and `PROXY_SHARED_SECRET`.
6. Run the live smoke verification on `https://<project>.pages.dev`:
   - [ ] `SMOKE_TEST_BASE_URL=https://<service>.onrender.com SMOKE_TEST_TIMEOUT_MS=120000 pnpm --filter backend deploy:smoke-test` returns `200` on `/health/live` and `/health/ready`.
   - [ ] Register + email confirmation + avatar upload (persists in Supabase Storage / `R2_PUBLIC_URL_BASE`) + login + `/api/users/refresh` round-trip.
   - [ ] Catalog loads seeded categories/franchises/products; checkout creates an order (`AWAITING_PAYMENT`).
   - [ ] After >15 min idle on Render Free, the first request recovers cleanly (Pages returns `503` JSON during wake-up if Render emits a gateway HTML page, then subsequent requests succeed once `/health/ready` is `200`).

### Cold starts and `SMOKE_TEST_TIMEOUT_MS`

Render Free spins the service down after ~15 minutes of inactivity. The next request triggers a cold boot: the server restarts and runs DB `authenticate()` over TLS to TiDB Cloud, `checkNoPendingMigrations()`, and `seedInitialData()` before `/health/ready` returns `200`. `deploy:smoke-test` defaults to `SMOKE_TEST_TIMEOUT_MS=120000`; if your instance has been idle or TiDB TLS warm-up is slow, raise `SMOKE_TEST_TIMEOUT_MS` (for example `120000`–`180000`). While Render is waking up, `frontend/functions/api/[[path]].ts` converts non-JSON `502`/`503`/`504` gateway pages into `503` JSON with `Retry-After: 10` so the browser shows an actionable retry message instead of crashing on HTML.

## Demo Sandbox (TiDB Cloud Starter + Render Free)

Opt-in ephemeral sandbox mode backed by 3–5 isolated MySQL schemas. Keep `DEMO_SANDBOX_ENABLED=false` (the default in `render.yaml`) until every slot database and DML-only user is provisioned and bootstrapped.

### 1. Provision 3–5 isolated slot databases & DML-only users in TiDB Cloud Starter

Using your TiDB Cloud admin account (never reuse `DB_NAME`, `DB_USER`, `root`, or `<cluster_prefix>.root`, and never use system schemas `mysql`, `information_schema`, `performance_schema`, `sys`), create 3–5 schemas and one least-privilege DML-only user per slot (only `SELECT, INSERT, UPDATE, DELETE` — **no** `CREATE`, `ALTER`, `DROP`, or `GRANT`). On TiDB Cloud Starter, include your cluster username prefix (e.g. `<cluster_prefix>.m3d_s1`) and keep the full username within MySQL/TiDB's 32-character limit:

```sql
CREATE DATABASE IF NOT EXISTS mundo_3d_slot_1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'm3d_slot_1'@'%' IDENTIFIED BY '<strong-unique-password-1>';
GRANT SELECT, INSERT, UPDATE, DELETE ON mundo_3d_slot_1.* TO 'm3d_slot_1'@'%';
-- Repeat for slot_2 .. slot_3 (up to slot_5), then:
FLUSH PRIVILEGES;
```

### 2. Bootstrap slots with `db:sandbox:bootstrap`

From an operator shell with network access to TiDB Cloud (never commit credentials), export `DB_NAME` and `DB_USER` (required so the CLI enforces control-plane collision checks), `DEMO_SANDBOX_SLOTS_JSON`, `DEMO_SANDBOX_DB_HOST` (or `DB_HOST`), `DEMO_SANDBOX_DB_PORT=4000` (or `DB_PORT`), `DEMO_SANDBOX_DB_CA_CERT` (or `DB_CA_CERT`), and explicit DDL admin credentials (`SANDBOX_BOOTSTRAP_ADMIN_USER`, `SANDBOX_BOOTSTRAP_ADMIN_PASS`):

```sh
# 1) Validate slot definitions, collisions, and target plan without mutating DBs:
pnpm --filter backend db:sandbox:bootstrap --dry-run

# 2) Apply business + slot migrations, verify DML-only users, and seed 17 products + synthetic USER/STAFF:
pnpm --filter backend db:sandbox:bootstrap
```

The CLI is idempotent and never seeds `ADMIN` accounts or prints passwords. Because each run fences and reseeds every slot, disable `DEMO_SANDBOX_ENABLED=false` (or confirm zero active demo sessions) before re-running against an already-enabled environment. New files in `backend/src/database/slot-migrations/` are discovered automatically; new business migrations must also be registered in `BUSINESS_MIGRATIONS` inside `backend/scripts/sandbox-bootstrap-slots.cjs`.

### 3. Configure the 7 `DEMO_SANDBOX_*` env vars in Render

Set the `sync: false` keys declared in `render.yaml` in the Render dashboard **before** flipping `DEMO_SANDBOX_ENABLED` to `true`:

- `DEMO_SANDBOX_JWT_SECRET` — fresh random secret (`>= 32` chars, strictly distinct from `JWT_SECRET`).
- `DEMO_SANDBOX_SLOTS_JSON` — JSON array of 3–5 objects `[{"slotId":"slot-1","database":"mundo_3d_slot_1","username":"m3d_slot_1","password":"..."}, ...]`.
- `DEMO_SANDBOX_DB_HOST`, `DEMO_SANDBOX_DB_PORT`, `DEMO_SANDBOX_DB_CA_CERT` — optional overrides if slots live on a separate TiDB cluster (otherwise they fall back to `DB_HOST`/`DB_PORT`/`DB_CA_CERT`).
- `DEMO_SANDBOX_RECOVER_ON_BOOT` — keep `"false"` for normal boots; set `"true"` only for crash recovery (see below).
- `DEMO_SANDBOX_ENABLED` — flip from `"false"` to `"true"` **only after** step 2 (`db:sandbox:bootstrap`) succeeds; `env-preflight` validates all constraints and fails closed on misconfiguration.

### 4. Verify live rollout

1. Run the deploy smoke test with the demo assertion enabled:
   ```sh
   SMOKE_TEST_BASE_URL=https://<service>.onrender.com SMOKE_EXPECT_DEMO_ENABLED=true pnpm --filter backend deploy:smoke-test
   ```
   Confirms `/health/live` (`200`), `/health/ready` (`200`), and `GET /api/demo/status` (`200` with `{ "enabled": true }`).
2. Perform a quick Buyer ↔ `STAFF` sanity check in the browser: start a sandbox session, add a product to the demo cart and send a test commission request as Buyer, switch role to `STAFF`, verify `/admin/products` (create without image) and `/admin/commission-requests` work while `DELETE /api/demo/products/:id` and `/api/demo/orders` return `403`, then click "Salir de la demo" (`DELETE /api/demo/session` returns `204`) and confirm production data is untouched.

### 5. Crash recovery, rollback, and local-env notes

- **Crash recovery (`DEMO_SANDBOX_RECOVER_ON_BOOT=true`)**: if the Render instance crashed mid-reset and left slots stuck in a dirty/expired lease state, temporarily set `DEMO_SANDBOX_RECOVER_ON_BOOT=true`, redeploy/restart so boot resets orphaned slots, then return it to `"false"`.
- **Instant kill-switch rollback**: set `DEMO_SANDBOX_ENABLED=false` in Render and restart. Demo endpoints immediately return `404` (verify with `SMOKE_EXPECT_DEMO_ENABLED=false`) while production traffic continues normally.
- **Secret rotation**: see "Rotating a leaked secret" above for `DEMO_SANDBOX_JWT_SECRET` and slot DB password rotation.
- **Local environment caveats**: under `NODE_ENV=test`, `backend/index.js:151-159` short-circuits boot and skips `startDemoSandboxRuntime`; under `NODE_ENV=development`, Sequelize's development config ignores `DB_PORT` (defaults to `3306`), so use explicit `DEMO_SANDBOX_DB_PORT` or `NODE_ENV=production` when targeting TiDB port `4000`.
