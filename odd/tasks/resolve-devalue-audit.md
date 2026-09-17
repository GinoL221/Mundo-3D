# Resolve devalue audit blocker

## Objective

Remove the moderate `devalue` advisory that blocks the post-merge CI quality job, without changing application behavior or unrelated dependency resolutions.

## Problem and rationale

CI run 35281906272 fails at `pnpm audit` because `astro@7.3.1` resolves `devalue@5.8.1`, which is affected by GHSA-9rgm-9g3h-6x36. Astro declares a compatible `^5.8.1` range, and the patched release is `5.9.1` or newer. The fix belongs in the workspace dependency policy and lockfile, not in application code.

## Scope

- Record the approved issue for the CI dependency blocker.
- Add a range-compatible pnpm override for `devalue`.
- Regenerate only the lockfile resolution needed by that override.
- Verify dependency audit and the relevant quality checks.
- Publish a focused PR linked to the approved issue.

## Constraints

- Do not touch application source or unrelated dependency overrides.
- Preserve all existing untracked artifacts.
- Do not commit directly to `main` or merge without explicit user authorization.
- Do not use a blanket `pnpm update` that changes unrelated packages.

## Tasks

### DEP-01 — Record approved issue

- Search open and closed issues for an equivalent report.
- Create issue #152 with public CI evidence and `status:approved`.

### DEP-02 — Pin patched devalue

- Add `devalue: ^5.9.1` to the existing workspace overrides.
- Regenerate `pnpm-lock.yaml` using the existing package-manager policy.
- Confirm no unrelated lockfile upgrades are introduced.

### DEP-03 — Verify audit and quality

- Run `pnpm audit`.
- Run the focused frontend checks and tests required by the change.
- Run the complete applicable local verification before publication.

### DEP-04 — Publish focused PR

- Commit the work unit with a Conventional Commit.
- Push `fix/resolve-devalue-audit` and open a PR linked to issue #152.
- Wait for CI and report any failure without merging.

## Acceptance criteria

- `pnpm-lock.yaml` resolves `devalue` to `5.9.1` or newer.
- `pnpm audit` passes.
- No application behavior or unrelated dependency resolution changes.
- PR validation and CI pass, including the verification gate.
- Existing untracked files remain untouched.

## Checks

- `pnpm audit`
- `pnpm install --frozen-lockfile`
- `pnpm frontend:check`
- `pnpm --filter frontend test`
- `pnpm test:fast`
- `git diff --check`
- GitHub Actions CI and PR validation checks.

## Progress

- [x] Diagnosed CI run 35281906272 and identified the `devalue@5.8.1` advisory.
- [x] Created approved issue #152 after duplicate search.
- [x] Added the workspace override and updated only the devalue lockfile entries.
- [x] Verified the dependency and application checks.
- [ ] Publish and validate the focused PR.

## Verification evidence

- Run 35281906272: integration and E2E passed; Quality failed only at `pnpm audit`; Verification gate failed as a consequence.
- `astro@7.3.1` declares `devalue: ^5.8.1`, so `5.9.1` is range-compatible.
- No repository files were changed while diagnosing the run.
- `pnpm install --lockfile-only` selected `devalue@5.9.2`, but its pnpm v11 formatting churn was discarded; the final candidate keeps only the workspace override and three devalue lockfile substitutions.
- `pnpm list` still showed the pre-update installed `devalue@5.8.1` until the frozen install refreshed local links.
- First independent verification attempt was blocked by a missing closing brace in the manually preserved lockfile entry; the syntax error was corrected before the successful retry.
- Successful independent verification: frozen install, audit, Astro check, frontend tests, fast tests, diff check, and status all passed. The only non-blocking note was Jest's existing forced-worker-shutdown warning.

## Next step

Commit the verified work unit, push the focused branch, and open the PR linked to issue #152.
