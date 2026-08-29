# Delta for Deploy Pipeline Foundations

## MODIFIED Requirements

### Requirement: Required Production Environment Variable Preflight

The system MUST provide a preflight script, invocable independently of `node index.js`/`app.js`, that checks a fixed list of required-in-production environment variables and exits non-zero before the app process starts if any are unset. The hard-required list MUST be: `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_CA_CERT`. This list MUST be a superset of, and MUST NOT conflict with, the existing require-time guards for `JWT_SECRET` (all environments) and `CORS_ORIGIN` (production only) already enforced in `backend/src/app.js`. `COOKIE_DOMAIN` and `PUBLIC_API_URL` MUST be checked but MUST be warn-only (a missing value produces a warning, not a non-zero exit): `cookieOptions.ts` already treats `COOKIE_DOMAIN` as optional, and `PUBLIC_API_URL` is a frontend build-time variable enforced by `frontend/astro.config.mjs`, not meaningful to the backend runtime — a hard-required preflight for either would be stricter than the application's own contract.
(Previously: hard-required list was `JWT_SECRET, CORS_ORIGIN, COOKIE_SECRET, DB_USER, DB_PASS, DB_NAME, DB_HOST, PUBLIC_API_URL`; `DB_PORT` and `DB_CA_CERT` were absent, and `PUBLIC_API_URL` was hard-required rather than warn-only.)

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
