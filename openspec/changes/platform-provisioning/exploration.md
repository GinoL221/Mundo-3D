# Exploration: platform-provisioning

Brand-new change (NOT a reuse of the ARCHIVED `deploy-topology`). Provisions the free hosting
stack decided in Engram #6894: Render free web service (backend / Express) + Aiven always-free
MySQL + Vercel static (Astro).

`deploy-topology` (archived 2026-08-28, PRs #76/#77) shipped only the platform-agnostic scripts
`scripts/deploy/{env-preflight,migrate-and-start,smoke-test}.js` plus the RUNBOOKS "Deploy
Pipeline" section; no host / managed DB / CD job was ever provisioned.

Prior art cited, not reproduced:
- `openspec/changes/archive/2026-08-28-deploy-topology/explore.md`
- `openspec/specs/deploy-pipeline-foundations/spec.md`

Engram mirror: `sdd/platform-provisioning/explore` (observation #6897).

## Current state (evidence)

- Boot chain `backend/index.js:143-166` (non-test): `ensureDatabaseExists(env)` → `authenticate`
  → `checkNoPendingMigrations` → `seedInitialData` → `server.listen(PORT)` → `markReady`;
  fail-closed `process.exit(1)` on any rejection (`index.js:157-165`).
- `backend/src/database/config/config.js`: 3 envs, each only `username` / `password` / `database`
  / `host` / `dialect`. No `port`, no `dialectOptions` anywhere. `backend/src/database/models/index.js:2,10`
  passes the whole `config[env]` object as Sequelize's 4th arg, so `port` + `dialectOptions.ssl`
  added there reach the runtime connection, the Umzug migrator (`migrator.js:9`), and the boot
  physical-schema gate.
- DB layer is entirely plain JS (glob-verified; only `db.d.ts` is TS).
  `pnpm --filter backend db:migrate` (`backend/package.json:20`) runs in prod with no ts-node /
  no dist build. Two migrations: `20260724000000-baseline.js`, `20260828000000-orders.js`.
- Frontend `frontend/astro.config.mjs`: `defineConfig({})` — no adapter/output, 100% static.
  `PUBLIC_API_URL` required + statically baked at `astro build` (`astro.config.mjs:11-16`).
- CI `.github/workflows/ci.yml` verification-only, no CD job. No render.yaml / vercel.json /
  Dockerfile / Procfile.
- Runtime: root `package.json` `packageManager` `pnpm@11.0.9`, `engines.node >=22`; frontend
  `>=22.12.0`. `RUN_COMPILED=true` (`backend/index.js:11,25`, `backend/src/app.js:27`) → require
  `./dist` + skip ts-node; prod start needs BOTH `RUN_COMPILED=true` and `NODE_ENV=production`.

## Six pre-identified facts — verification

1. **config.js has no port/SSL — CONFIRMED.** `config.js:4-10 / 11-17 / 18-24`. Aiven uses a
   non-standard port + requires TLS; the production block can't connect as-is. Add `port` +
   `dialectOptions.ssl` to the `production` block ONLY; propagates via `models/index.js:10`.
2. **ensureDatabase.js has no port/SSL + runs CREATE DATABASE, prod always calls it — CONFIRMED.**
   `ensureDatabase.js:19-23` raw `mysql2 createConnection({host,user,password})` then `:24`
   `CREATE DATABASE IF NOT EXISTS`. `backend/index.js:144` is the first boot step; prod hits it
   every boot. On Aiven the DB (`defaultdb`) exists and the scoped user usually lacks
   `CREATE DATABASE` → call fails → boot aborts. Fix = SKIP in production (not "add SSL and keep
   creating"). Only callers: `index.js:144` + its test.
3. **env-preflight.js lacks DB_PORT / SSL — CONFIRMED.** `scripts/deploy/env-preflight.js:1-10`
   `REQUIRED = [JWT_SECRET, CORS_ORIGIN, COOKIE_SECRET, DB_USER, DB_PASS, DB_NAME, DB_HOST,
   PUBLIC_API_URL]`; `:15` `WARN_ONLY = [COOKIE_DOMAIN]`. Same list codified in
   `openspec/specs/deploy-pipeline-foundations/spec.md:48` → needs a SPEC DELTA. Extra:
   `PUBLIC_API_URL` is a frontend build-time var (`frontend/astro.config.mjs:11`), useless on a
   Render backend — candidate to demote on the backend side in the same delta.
4. **cookieOptions sameSite=lax breaks cross-site login — CONFIRMED.**
   `backend/src/infrastructure/security/cookieOptions.ts:41-50`: `secure = NODE_ENV==='production'`,
   `sameSite:'lax'`, `domain` only if `COOKIE_DOMAIN` set. Frontend credentialed fetch
   (`frontend/src/config.ts:39-51`), backend CORS credentials + exact-origin match
   (`backend/src/app.js:73-97`, `:81`). `*.vercel.app` + `*.onrender.com` = cross-site →
   SameSite=Lax cookie not returned on login XHR → auth broken. Resolution = custom domains
   (apex/www → Vercel, `api.` → Render, `COOKIE_DOMAIN=.<domain>`,
   `CORS_ORIGIN=https://<exact frontend origin>`). Render free = 2 custom domains + managed TLS
   (Render docs 2026). `sameSite:'none'` rejected (Safari/Brave third-party-cookie blocking).
5. **Render free has no persistent disk; multer uploads ephemeral — CONFIRMED (code + docs).**
   `backend/src/infrastructure/middlewares/upload.ts:21-40` `multer.diskStorage` →
   `path.join(process.cwd(),'public','img',dest)`; `backend/src/app.js:100` `express.static` of
   `backend/public`. Seeded catalog images committed in BOTH `backend/public/img/products/` AND
   `frontend/public/img/products/`; frontend renders `/img/...` from its own Vercel origin →
   seeded images survive. Admin uploads (a) hit Render ephemeral FS → lost on every
   redeploy/restart/15-min spin-down, (b) only reachable on the backend origin which Vercel pages
   don't reference. Render docs 2026: free web services cannot attach a persistent disk. THIS
   SLICE DOES NOT TOUCH `upload.ts` — object storage is a separate future change; state the
   boundary + runtime consequence.
6. **Missing trust proxy + explicit 0.0.0.0 bind; PORT from env; seed every boot — MOSTLY CONFIRMED.**
   - `trust proxy`: **CONFIRMED ABSENT** (grep, whole non-test backend). Behind Render's proxy,
     `express-rate-limit` v8 (`loginLimiter.ts:12-21`, `registerLimiter.ts`) keys on `req.ip` =
     Render edge IP → all clients share one bucket → `LOGIN_LIMIT_MAX` (default 5) failed logins
     lock out login GLOBALLY for 15 min; also trips proxy-misconfig validation. Fix:
     `app.set('trust proxy', 1)`.
   - `0.0.0.0` bind: **PARTIAL.** `backend/index.js:152` `server.listen(PORT, cb)` has no host →
     Node listens on all interfaces; usually works on Render; explicit `'0.0.0.0'` removes
     ambiguity. Not a blocker.
   - `PORT`: **CONFIRMED** `backend/index.js:36` `process.env.PORT || 3031`.
   - `seedInitialData` every prod boot: **CONFIRMED** `backend/index.js:147`; `seed.js` guards
     every insert with `count() === 0` (`:35/:41/:47/:71`) → vs a persistent Aiven DB = ~4
     `COUNT(*)` + zero writes per boot = SAFE; caveat: admin emptying a table → next boot
     re-seeds it. `seed.js` uses `console.log` — pre-existing, out of scope.
   - Node `>=22.12` / pnpm `11.0.9`: **CONFIRMED**; `>=22` range doesn't pin on Render → use
     `NODE_VERSION=22` or `.node-version`.
   - `RUN_COMPILED`: **CONFIRMED**; build must keep devDeps (`tsc`/`typescript` are
     devDependencies) — no `pnpm install --prod` before `pnpm --filter backend build`.
   - Follow-up #6702 (DB_PORT) is absorbed here.

## Additional gotchas

- **G1 (highest uncertainty): Aiven private CA.** `mysql2` TLS needs the Aiven CA cert.
  `ssl:{rejectUnauthorized:true}` with no `ca` fails; `ssl:{rejectUnauthorized:false}` is weak.
  Recommend `DB_CA_CERT` env (PEM) →
  `dialectOptions:{ssl:{ca:process.env.DB_CA_CERT, rejectUnauthorized:true}}`. Decide in tasks phase.
- **G2:** `db:migrate` in prod is already viable (plain JS, glob `*.js`, `migrate-and-start.js`
  runs it from repo root before start, `backend/package.json:24`); inherits `config.js` port+ssl
  automatically.
- **G3:** `backend/src/database/checkPendingMigrations.js:8-18` `REQUIRED_SCHEMA` still lists only
  the original 6 tables (no Order/OrderItem). Pre-existing, non-blocking, note only.
- **G4:** `CORS_ORIGIN` is a single exact string (`app.js:81`). Only one of www/apex/custom
  passes; serve the frontend from exactly that origin, redirect the rest.
- **G5:** `PUBLIC_API_URL` frozen at Vercel build time (`astro.config.mjs:4-16`). Must be
  `https://api.<domain>` from the first build; wrong value = rebuild + redeploy.
- **G6:** No CD job / no manifest today; Render + Vercel native git-auto-deploy is the mechanism
  (a new `ci.yml` deploy job is OUT of scope).
- **G7:** Cold start after a 15-min spin-down re-runs the full boot chain (incl. 2 Aiven
  round-trips) before `/health/ready` → 200; `smoke-test.js` default 60 s timeout
  (`scripts/deploy/smoke-test.js:5`) may need raising.

## Approaches

1. **Config-object threading + skip-in-prod + committed render.yaml.** `port` / `dialectOptions.ssl`
   in `config.js` `production` block only; `ensureDatabaseExists` production early-return;
   env-preflight + spec delta; commit `render.yaml` + RUNBOOKS platform section;
   `app.set('trust proxy', 1)`.
   Pros: smallest diff, reuses the existing Sequelize path, dev/test untouched, `render.yaml` =
   reviewable IaC. Cons: free-tier `render.yaml` care, CA-via-env awkward. Effort: Medium
   (~3 PRs, each < 400 lines).
2. **Runbook-only, no render.yaml.** Same code, dashboard setup documented in RUNBOOKS.
   Pros: no wrong-manifest risk, fastest. Cons: no version-controlled source of truth,
   drift-prone. Effort: Low-Medium.
3. **Broaden config.js for all envs / unconditional port+SSL.** Pros: uniform. Cons: changes
   dev/test connection behavior, CI sets no `DB_PORT`, larger blast radius for no benefit.
   Effort: Medium, higher risk.

## Recommendation

**Approach 1.** Scope the config change to the `production` block, skip `ensureDatabaseExists` in
production, land env-preflight + the `deploy-pipeline-foundations` spec delta together, commit
`render.yaml` + a RUNBOOKS platform section. Custom domain + `COOKIE_DOMAIN` is a HARD runbook
requirement. Decide Aiven CA delivery (env PEM recommended) in the tasks phase. Three stacked PRs
within the 400-line budget:

- **PR1:** `config.js` port+SSL (production only) + `ensureDatabase.js` production skip + tests.
- **PR2:** `env-preflight.js` DB_PORT/SSL + `deploy-pipeline-foundations` spec delta + tests.
- **PR3:** `render.yaml` + `docs/RUNBOOKS.md` platform section + `app.set('trust proxy', 1)`.

## Risks

- Aiven private-CA SSL wiring — highest uncertainty; needs a concrete CA-delivery decision.
- `trust proxy` omission is a real correctness bug behind Render's proxy (global login lockout);
  must land with the bring-up.
- Cross-site cookie: skipping the custom domain breaks login with no code workaround short of
  `sameSite='none'` (not chosen here).
- Cold-start boot chain re-runs `ensureDatabaseExists` / `authenticate` /
  `checkNoPendingMigrations` / seed (incl. Aiven round-trips) before readiness; smoke-test
  timeout may need tuning.
- Ephemeral disk: admin-uploaded images disappear on redeploy/spin-down — accepted this slice,
  must be called out; object storage is a required future change.
- `PUBLIC_API_URL` baked at Vercel build time — wrong first value needs a full rebuild.

## Ready for Proposal

Yes. The proposal phase should confirm the Aiven CA delivery mechanism and the custom-domain
requirement with the user.
