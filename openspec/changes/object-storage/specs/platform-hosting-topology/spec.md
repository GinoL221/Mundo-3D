# Delta for Platform Hosting Topology

## MODIFIED Requirements

### Requirement: Reproducible Bring-Up Runbook

`docs/RUNBOOKS.md` MUST contain a platform section that lets an operator reproduce the
Render + Aiven + Vercel bring-up unaided, covering custom-domain setup, `COOKIE_DOMAIN`,
`CORS_ORIGIN`, `DB_PORT`, `DB_CA_CERT`, and Cloudflare R2 bucket/credential setup (public
bucket creation, S3 API token generation, and the `R2_*` environment variables).
(Previously: runbook covered custom-domain, `COOKIE_DOMAIN`, `CORS_ORIGIN`, `DB_PORT`, and
`DB_CA_CERT` only, with no object-storage subsection.)

#### Scenario: An operator reproduces the bring-up from the runbook alone

- GIVEN fresh Render, Aiven, Vercel, and Cloudflare accounts and a purchased custom domain
- WHEN an operator follows the RUNBOOKS platform section
- THEN they MUST be able to bring up the backend, database, frontend, and R2 bucket without
  further guidance

#### Scenario: An operator completes R2 setup from the runbook alone

- GIVEN a fresh Cloudflare account
- WHEN an operator follows the R2 subsection of the RUNBOOKS platform section
- THEN they MUST be able to create the public bucket, generate an S3 API token, and set every
  required `R2_*` environment variable without consulting outside documentation
