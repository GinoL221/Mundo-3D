# Delta for Deploy Pipeline Foundations

## MODIFIED Requirements

### Requirement: Required Production Environment Variable Preflight

The system MUST provide a preflight script, invocable independently of `node index.js`/`app.js`,
that checks a fixed list of required-in-production environment variables and exits non-zero
before the app process starts if any are unset. The hard-required list MUST be: `JWT_SECRET`,
`CORS_ORIGIN`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT`,
`DB_CA_CERT`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_PUBLIC_URL_BASE`. This list MUST be a superset of, and MUST NOT conflict with, the existing
require-time guards for `JWT_SECRET` (all environments) and `CORS_ORIGIN` (production only)
already enforced in `backend/src/app.js`. `COOKIE_DOMAIN` and `PUBLIC_API_URL` MUST be checked
but MUST be warn-only (a missing value produces a warning, not a non-zero exit): `cookieOptions.ts`
already treats `COOKIE_DOMAIN` as optional, and `PUBLIC_API_URL` is a frontend build-time
variable enforced by `frontend/astro.config.mjs`, not meaningful to the backend runtime — a
hard-required preflight for either would be stricter than the application's own contract.
**Correction (2026-08-28)**: this requirement originally listed `COOKIE_DOMAIN` as
hard-required; the user explicitly confirmed warn-only during design, and that decision — plus
the already-implemented, already-tested behavior — is what this requirement now describes.
**Change (2026-08-30)**: `DB_PORT` and `DB_CA_CERT` added to hard-required list; `PUBLIC_API_URL`
demoted to warn-only (managed database connectivity and platform-hosting-topology changes).
**Change (2026-08-30, object-storage)**: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_URL_BASE` added to hard-required list to
support direct-to-bucket image uploads. `R2_ENDPOINT` is the explicit S3 API endpoint shown on
R2's token-creation screen, not derived from an account ID, so a later switch to a different
S3-compatible provider (e.g. Backblaze B2) is a value change, not a code change.
(Previously: hard-required list did not include any object-storage credentials.)

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

#### Scenario: Missing an R2 credential blocks the deploy

- GIVEN any of `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_NAME`, or `R2_PUBLIC_URL_BASE` is unset
- WHEN the preflight script runs
- THEN it MUST exit non-zero and identify the missing variable
