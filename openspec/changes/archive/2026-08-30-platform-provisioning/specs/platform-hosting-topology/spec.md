# Platform Hosting Topology Specification

## Purpose

A committed platform manifest plus the custom-domain, cookie, and proxy topology required for a reproducible Render + Aiven + Vercel production bring-up where login works and boot stays fail-closed.

## Requirements

### Requirement: Committed Platform Manifest

A `render.yaml` MUST exist at the repository root describing the free-tier backend web service. It MUST specify: build command `pnpm --filter backend build`, start command `deploy:migrate-and-start`, environment `RUN_COMPILED=true` and `NODE_ENV=production`, and Node major version 22.

#### Scenario: Manifest fully describes the backend service

- GIVEN the repository
- WHEN `render.yaml` is read
- THEN it MUST define one web service whose build command is `pnpm --filter backend build`, whose start command is `deploy:migrate-and-start`, and whose environment sets `RUN_COMPILED=true`, `NODE_ENV=production`, and Node 22

### Requirement: Custom-Domain Cookie Topology

Production authentication REQUIRES the frontend and the API to share one registrable domain: apex/www serves the frontend, `api.<domain>` serves the API, `COOKIE_DOMAIN=.<domain>`, and `CORS_ORIGIN` is the exact frontend origin. The auth cookie `sameSite` attribute MUST remain `lax`; `sameSite: 'none'` MUST NOT be used as a workaround for a cross-site deployment.

#### Scenario: Same-site topology lets the login cookie round-trip

- GIVEN the frontend at `https://<domain>`, the API at `https://api.<domain>`, `COOKIE_DOMAIN=.<domain>`, and `CORS_ORIGIN=https://<domain>`
- WHEN a user logs in from the frontend
- THEN the auth cookie MUST be set and returned on subsequent credentialed requests to the API

#### Scenario: sameSite=none is not used

- GIVEN the production cookie configuration
- WHEN it is inspected
- THEN `sameSite` MUST be `lax` and MUST NOT be `none`

### Requirement: Proxy-Aware Runtime

Running behind exactly one proxy hop (Render's edge), the application MUST set `trust proxy` to `1` so the client IP is derived from the first `X-Forwarded-For` entry, and it MUST bind explicitly to `0.0.0.0`.

#### Scenario: Trust proxy is set to a single hop

- GIVEN the application runs behind Render's edge proxy
- WHEN it initializes
- THEN `trust proxy` MUST be `1`
- AND the server MUST bind to `0.0.0.0`

### Requirement: Reproducible Bring-Up Runbook

`docs/RUNBOOKS.md` MUST contain a platform section that lets an operator reproduce the Render + Aiven + Vercel bring-up unaided, covering custom-domain setup, `COOKIE_DOMAIN`, `CORS_ORIGIN`, `DB_PORT`, and `DB_CA_CERT`.

#### Scenario: An operator reproduces the bring-up from the runbook alone

- GIVEN fresh Render, Aiven, and Vercel accounts and a purchased custom domain
- WHEN an operator follows the RUNBOOKS platform section
- THEN they MUST be able to bring up the backend, database, and frontend without further guidance
