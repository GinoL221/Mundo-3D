# Tasks: Documentation and Specification Drift

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Approx. 50 style-only lines plus two corrections |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR with two reviewable work units; no chained PRs |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

No further size decision is required before the authorized retry.

## Attempt 1 Evidence (Completed)

- Baseline/inventory and all four applicable RED checks passed; untracked SDD artifacts and `.codegraph/` were preserved.
- The semantic edits were applied, then restored to `preEditSha` because baseline Prettier failed; the empty delta correctly failed closed.
- Rollback, diff-check, syntax, and Jest VM equivalence passed; retry tasks remain incomplete.
- Reuse the RED harness; rerun only if its argv, cwd, allowlist, or commit-state boundary changes.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Normalize and apply the two approved corrections | PR 1 | `pnpm exec prettier --write <two targets>` | N/A — documentation/configuration only | Restore both targets to the retry-pinned blobs |
| 2 | Prove meaning, scope, and rollback safety | PR 1 | Prettier check + `node --check` + equivalence harness | N/A — no runtime boundary is allowed | Restore only the two target files |

## Phase 1: Retry Preflight and Meaning Baseline

- [x] 1.1 Validate clean targets, pin retry `preEditSha`, and record status including untracked `apply-progress.md`, SDD artifacts, and `.codegraph/`; compare only post-start implementation delta.
- [x] 1.2 Reconfirm meanings from manifests, scripts, frontend domains, Jest config, and CI; reject README, unsupported claims, or target drift.
- [x] 1.3 Reuse Attempt 1's fixed-argv, README.sh, nested-cwd, staged/unstaged, and empty-index RED evidence; rerun only if the harness or boundary changed.

## Phase 2: Authorized Normalization and Corrections

- [x] 2.1 Normalize exactly `openspec/config.yaml` and `backend/jest.config.js` with repository `prettier@3.8.3`; verify the two-path, 50-line style budget.
- [x] 2.2 Apply only `store: frontend/src/store/` → `domains: frontend/src/domains/` in `openspec/config.yaml` and the npm-to-pnpm comment correction in `backend/jest.config.js`.

## Phase 3: Deterministic Acceptance and Rollback

- [x] 3.1 Compare final Jest exports with the immutable baseline in an isolated VM; sort keys recursively, preserve arrays, and compare canonical JSON bytes.
- [x] 3.2 Parse/canonicalize YAML with bundled Prettier `__debug.parse`; allow only `architecture.frontend.store` → `domains` key/value change.
- [x] 3.3 Read back targets; run `git diff --check`, Prettier `--check` on both targets, `node --check`, and the baseline-relative two-path allowlist.
- [x] 3.4 On failure, restore both targets from retry `preEditSha`, rerun checks, and record rollback; never run DB/network/migrations, baseline adoption, or the live stock ALTER.
