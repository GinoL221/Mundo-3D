# CI hardening foundations

## Objective

Add low-risk, repository-local guardrails to GitHub Actions before the broader Playwright/immutable-reference modernization.

## Decision

Start with a bounded infrastructure slice in `.github/workflows/ci.yml`. Defer action/container SHA or digest pinning, audit outage policy, and Playwright retry/visual-environment policy to the planned `modernize-playwright-ci` SDD change because those require explicit operational choices.

## Scope

- Cancel obsolete runs for the same workflow/ref.
- Grant workflow jobs read-only repository contents permission.
- Add explicit job-level timeouts to every CI job.
- Set explicit artifact retention for coverage and Playwright evidence.

## Constraints

- Do not alter product code, test assertions, dependency versions, or Playwright behavior in this slice.
- Preserve the existing four-job fail-closed topology.
- Preserve all unrelated untracked artifacts.
- Do not push or open a PR without explicit delivery authorization.

## Tasks

### CIH-01 — Map the current CI baseline

- Confirm the existing quality, real-DB, Playwright, and verification-gate jobs.
- Record already-completed foundations and remaining hardening gaps.

Status: complete.

### CIH-02 — Add workflow guardrails

- Add top-level read-only `permissions`.
- Add top-level `concurrency` with cancellation for obsolete runs.
- Add explicit timeouts to `quality`, `integration`, `e2e`, and `verification-gate`.
- Add explicit retention days to coverage and Playwright artifacts.

Status: complete.

### CIH-03 — Verify the bounded slice

- Parse the workflow and inspect the resulting job/control contracts.
- Run repository checks proportionate to a workflow-only change.
- Confirm no unrelated tracked or untracked artifacts changed.

Status: complete.

### CIH-04 — Commit and prepare delivery

- Create a Conventional Commit on the feature branch.
- Record the commit in this task document and its Engram mirror.
- Ask before pushing or opening the dedicated PR.

Status: complete.

## Acceptance criteria

- Obsolete runs for the same ref are cancelled.
- CI jobs can read repository contents but receive no broader explicit token permissions.
- Every job has a finite timeout.
- Uploaded coverage and Playwright artifacts have explicit retention.
- Existing CI checks and fail-closed gate behavior remain unchanged.
- The change is isolated to `.github/workflows/ci.yml` plus ODD evidence.

## Verification

- YAML parse through the repository's available Prettier parser.
- `git diff --check`.
- Targeted inspection of workflow keys and values.
- CI after authorized publication.

## Verification evidence

- Direct Prettier check of `.github/workflows/ci.yml` exited 0.
- `git diff --check` exited 0.
- Targeted inspection confirmed read-only permissions, ref-scoped cancellation, 20/15/20/5-minute job timeouts, and 14-day artifact retention.
- Final verification changed no tracked or non-cache files; unrelated untracked artifacts remained preserved.

## Work-unit commit

- `294f79d` — `chore(ci): add workflow hardening guardrails`

## Roadmap boundary

The next `modernize-playwright-ci` SDD should decide:

- immutable action/container references and their update policy;
- Playwright fixed visual environment, retries, screenshots/video/traces, and timeout contracts;
- behavior when the audit service is unavailable;
- conditional artifact retention and cost policy beyond this explicit baseline.

## Progress

- [x] Confirmed no PRs or issues remain open after cleanup.
- [x] Confirmed current main contains the four-job CI foundation and Playwright race fixes.
- [x] Mapped remaining hardening gaps in Engram roadmap `ci/hardening-roadmap`.
- [x] Add workflow guardrails.
- [x] Verify the bounded slice.
- [x] Commit the work unit.
- [ ] Push and open the dedicated PR after explicit authorization.
