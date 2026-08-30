# Deploy Pipeline Foundations Specification

## Purpose

Platform-agnostic scripting that lets any deploy hook run this app's build, migrate, and start steps in the correct order; verify a new instance is actually healthy before traffic is trusted to it; and fail fast if required production configuration is missing. This capability adds tooling only. It does not modify, restate, or relax the boot-time behavior already specified in `schema-migrations` (migrations never auto-run at boot) or `runtime-resilience` (liveness/readiness semantics).

## Requirements

### Requirement: Ordered Deploy Sequencing

The system MUST provide a single invocable command that runs the existing `db:migrate` command, then `start`, in that fixed order, and MUST NOT proceed to the `start` step if `db:migrate` exits non-zero. `build` is intentionally a separate, pre-existing pipeline step (`pnpm --filter backend build`) and not owned by this command — build failures (compile/lint) and migrate/start failures (data/runtime) are different failure categories, and RUNBOOKS.md documents `build` as the step that must run, and succeed, before this command. **Correction (2026-08-28)**: this requirement originally specified a `build → migrate → start` single command; design.md deliberately scoped the deploy sequencing command to migrate+start only, and that decision — plus the already-implemented, already-tested behavior — is what this requirement now describes. A shell-chained pipeline (`build && ... && deploy:migrate-and-start`) already gets "don't proceed past a failed build" for free from normal command chaining, without this command needing to own or re-invoke `build` itself.

#### Scenario: Successful deploy runs both steps in order
- GIVEN a deploy hook invokes the deploy sequencing command (after `build` has already succeeded as a separate pipeline step)
- WHEN `db:migrate` exits 0
- THEN `start` MUST be invoked afterward
- AND the app MUST NOT begin serving until migrations have completed

#### Scenario: A failed migration blocks the start step
- GIVEN a deploy hook invokes the deploy sequencing command
- WHEN `db:migrate` exits non-zero
- THEN the `start` step MUST be skipped
- AND the sequencing command MUST exit non-zero without ever invoking `start`

### Requirement: Post-Deploy Smoke Test

The system MUST provide a script, invocable from any CI/CD runner, that polls `GET /health/live` and then `GET /health/ready` against a target URL until both succeed or a bounded timeout elapses, and MUST exit non-zero if `/health/ready` never returns 200 within that timeout.

#### Scenario: Smoke test succeeds quickly against an already-healthy instance
- GIVEN a running instance whose `/health/live` and `/health/ready` both already return 200
- WHEN the smoke test script runs against that instance
- THEN it MUST exit 0 without waiting out the full timeout
- AND it MUST NOT report failure due to unrelated polling delay

#### Scenario: Smoke test fails when readiness never latches within the timeout
- GIVEN a running instance whose `/health/ready` keeps returning 503
- WHEN the smoke test script polls it for the configured bounded timeout
- THEN the script MUST exit non-zero
- AND it MUST NOT report success

#### Scenario: Smoke test waits for liveness before checking readiness
- GIVEN a target instance that is not yet accepting connections
- WHEN the smoke test script starts polling
- THEN it MUST keep polling `/health/live` until it succeeds, or the overall timeout elapses, before it begins polling `/health/ready`

### Requirement: Required Production Environment Variable Preflight

The system MUST provide a preflight script, invocable independently of `node index.js`/`app.js`, that checks a fixed list of required-in-production environment variables and exits non-zero before the app process starts if any are unset. The hard-required list MUST be: `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_CA_CERT`. This list MUST be a superset of, and MUST NOT conflict with, the existing require-time guards for `JWT_SECRET` (all environments) and `CORS_ORIGIN` (production only) already enforced in `backend/src/app.js`. `COOKIE_DOMAIN` and `PUBLIC_API_URL` MUST be checked but MUST be warn-only (a missing value produces a warning, not a non-zero exit): `cookieOptions.ts` already treats `COOKIE_DOMAIN` as optional, and `PUBLIC_API_URL` is a frontend build-time variable enforced by `frontend/astro.config.mjs`, not meaningful to the backend runtime — a hard-required preflight for either would be stricter than the application's own contract. **Correction (2026-08-28)**: this requirement originally listed `COOKIE_DOMAIN` as hard-required; the user explicitly confirmed warn-only during design, and that decision — plus the already-implemented, already-tested behavior — is what this requirement now describes. **Change (2026-08-30)**: `DB_PORT` and `DB_CA_CERT` added to hard-required list; `PUBLIC_API_URL` demoted to warn-only (managed database connectivity and platform-hosting-topology changes).

#### Scenario: Preflight fails fast when a required var is missing
- GIVEN one or more of the hard-required variables listed above is unset
- WHEN the preflight script runs
- THEN it MUST exit non-zero and identify which variable(s) are missing
- AND it MUST run and fail before the app process is started, not from inside `index.js`/`app.js`

#### Scenario: Preflight passes when all required vars are set
- GIVEN all hard-required variables listed above are set
- WHEN the preflight script runs
- THEN it MUST exit 0, whether or not `COOKIE_DOMAIN` or `PUBLIC_API_URL` is set
- AND the deploy sequencing command MAY then proceed to start the app

#### Scenario: A missing warn-only var warns without failing
- GIVEN all hard-required variables are set but `COOKIE_DOMAIN` or `PUBLIC_API_URL` is unset
- WHEN the preflight script runs
- THEN it MUST print a warning identifying each unset warn-only variable
- AND it MUST still exit 0

#### Scenario: Missing DB_PORT or DB_CA_CERT blocks the deploy
- GIVEN `DB_PORT` or `DB_CA_CERT` is unset
- WHEN the preflight script runs
- THEN it MUST exit non-zero and identify the missing variable

### Requirement: Deploy Pipeline Documentation

`docs/RUNBOOKS.md` MUST document a "Deploy Pipeline" section covering the deploy sequencing command, the smoke test script, and the env-preflight script, plus a short expand/contract migration-authoring note. The note MUST state that schema migrations are expected to remain compatible with both the previous and new app version during a deploy window (additive changes first; destructive changes only in a later migration) as an authoring discipline, and MUST NOT claim this is enforced by code.

#### Scenario: RUNBOOKS documents all three scripts
- GIVEN a developer reads `docs/RUNBOOKS.md`
- WHEN they look for how to deploy the app
- THEN they MUST find the deploy sequencing command, the smoke test script, and the env-preflight script documented together in one "Deploy Pipeline" section

#### Scenario: RUNBOOKS documents expand/contract as discipline, not enforcement
- GIVEN a developer reads the "Deploy Pipeline" section
- WHEN they read the migration-authoring note
- THEN it MUST describe expand/contract as a manual authoring discipline
- AND it MUST NOT claim any script or lint rule enforces it
