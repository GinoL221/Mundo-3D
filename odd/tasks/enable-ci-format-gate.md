# Enable CI format gate

## Goal

Add the repository-wide Prettier check to the existing CI quality job and verify the workflow locally.

## Scope

- `.github/workflows/ci.yml`
- Existing root `format:check` script and effective Prettier configuration are authoritative.

## Tasks

- [x] Add a dedicated `Check formatting` step to the `quality` job using `pnpm run format:check`.
- [x] Verify the workflow gate and local quality checks without touching integration/E2E infrastructure.

## Constraints

- Preserve existing gate ordering and all current quality, integration, E2E, and verification-gate behavior.
- Do not modify generated/OpenAPI assets, lockfiles, or application source.
- No push; staging and commit require separate explicit authorization.

## Evidence

- `pnpm run format:check`: passed.
- Workflow Prettier check: passed.
- OpenAPI, backend type-check, frontend check, frontend lint, and diff checks: passed.
- The quality job now runs `pnpm run format:check` immediately after dependency installation and before the dependency audit.
- The existing unquoted `$GITHUB_OUTPUT` redirect was safely changed to `"$GITHUB_OUTPUT"` after shellcheck flagged it.
