# Apply Progress: Documentation and Specification Drift

## Status

Complete — Attempt 1 was rolled back for a formatter-baseline failure. Attempt 2 applied the maintainer-approved two-file Prettier reset and the two semantic corrections; every final acceptance check passed.

## Baseline and Inventory

- `preEditSha`: `61d48dd10232a85b10c096799f9afecda2521052`
- Baseline targets: clean relative to `preEditSha`.
- Baseline untracked paths: `.codegraph/.gitignore` and the existing change artifacts. They were preserved; only `tasks.md` was intentionally updated and this required progress artifact was created.
- Verified drift only: `openspec/config.yaml` uses `frontend/src/store/` while the frontend uses `frontend/src/domains/`; Jest comments use npm commands while root scripts use pnpm workspace commands.
- Excluded: README and every unsupported/runtime/database claim.

## Completed Tasks

- [x] 1.1 Baseline recorded.
- [x] 1.2 Authoritative inventory completed.
- [x] 1.3 Fixed-argv RED check passed.
- [x] 1.4 README.sh allowlist RED check passed.
- [x] 1.5 Fixed-root and staged/unstaged RED checks passed.
- [x] 2.3 Immutable baseline/current Jest export equivalence passed after rollback.
- [x] 3.3 Target-only rollback and rerun evidence recorded.

## Incomplete Tasks

- [ ] 2.1 Correct the OpenSpec topology value.
- [ ] 2.2 Correct Jest comments.
- [ ] 3.1 Complete check-only acceptance.
- [ ] 3.2 Accept exactly the allowlisted implementation delta.

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused command | `git diff --check` — exit 0 after rollback. |
| Runtime harness | N/A — documentation/configuration-only slice; no runtime boundary may be invoked. |
| Rollback boundary | Restored only `openspec/config.yaml` and `backend/jest.config.js` from `preEditSha`; no unrelated implementation work was changed. |

## Validation and Rollback Evidence

| Command / scenario | Result |
|---|---|
| Fixed-argv metacharacter, unknown path, README.sh, nested-cwd, staged/unstaged RED harness | exit 0; every safety assertion passed. |
| Initial `git diff --check` | exit 0. |
| Initial `pnpm exec prettier --check openspec/config.yaml backend/jest.config.js` | exit 1; both files reported style issues. |
| `git restore --source=61d48dd10232a85b10c096799f9afecda2521052 --worktree -- openspec/config.yaml backend/jest.config.js` | exit 0; target delta empty. |
| Post-rollback `git diff --check` | exit 0. |
| Post-rollback Prettier check | exit 1; same two baseline files reported style issues. |
| Post-rollback `node --check backend/jest.config.js` | exit 0. |
| Post-rollback isolated VM export equivalence | exit 0; canonical JSON bytes identical. |
| Expected two-path delta assertion | exit 1 after rollback because actual delta is empty; acceptance correctly fails closed. |

## Diagnosis

The installed Prettier rejects both target files even after restoring their exact pinned baseline bytes. Running Prettier with `--write` would modify content outside the approved two textual corrections, so it was not run. No migrations, database commands, network operations, baseline adoption, or live `Product.stock` ALTER were executed.

## Delivery Boundary

- Delivery strategy: `ask-on-risk`; low-risk single work unit, no chain.
- Changed implementation paths at cleanup: none; both target corrections were rolled back.
- Attempt 1 next decision: approve a bounded formatter-baseline remediation or waive/replace the required Prettier acceptance command. Resolved by the Attempt 2 approval below.

## Attempt 2: Approved Formatter Baseline Reset

### Baseline and Scope

- Native request: `begin-doc-drift-format-20260730-01`; ordinal `2` was already active and was not started, reset, or finished here.
- Retry `preEditSha`: `61d48dd10232a85b10c096799f9afecda2521052`.
- Targets were clean at retry baseline. Existing untracked `.codegraph/.gitignore`, SDD artifacts, and prior `apply-progress.md` were preserved.
- Attempt 1 RED evidence was reused unchanged: fixed argv rejects metacharacters, README.sh is rejected without execution, fixed root works from nested cwd, and pinned SHA is stable across staged/unstaged cases.
- Verified scope remains only `frontend/src/store/` → `frontend/src/domains/` and npm-to-pnpm Jest comment terminology; README, runtime, CI, package scripts, and database claims were excluded.

### Completed Retry Tasks

- [x] 1.1 Retry baseline recorded.
- [x] 1.2 Authoritative meanings reconfirmed.
- [x] 1.3 Attempt 1 threat-boundary evidence reused; harness/boundary unchanged.
- [x] 2.1 Prettier 3.8.3 normalized exactly the two targets.
- [x] 2.2 Both approved semantic corrections applied.
- [x] 3.1 Immutable Jest VM export equivalence passed.
- [x] 3.2 Prettier YAML AST semantic equivalence passed with only `store` → `domains` allowed.
- [x] 3.3 Diff, formatting, syntax, allowlist, readback, and review-budget checks passed.
- [x] 3.4 Conditional rollback safeguard was not triggered: final acceptance passed; the fixed target-only rollback boundary was retained from Attempt 1 evidence.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused command | Final check-only suite — exit 0: diff check, Prettier check, Node syntax, VM/AST equivalence, allowlist/readback/budget. |
| Runtime harness | N/A — documentation/configuration-only scope; no runtime boundary was invoked. |
| Rollback boundary | `git restore --source=61d48dd10232a85b10c096799f9afecda2521052 --worktree -- openspec/config.yaml backend/jest.config.js`; affects only the two targets. |

### Final Validation

| Check | Result |
|---|---|
| `pnpm exec prettier --write openspec/config.yaml backend/jest.config.js` | exit 0; exactly two targets normalized. |
| Semantic corrections followed by target-only Prettier write | exit 0; no further style changes required. |
| `git diff --check` | exit 0. |
| `pnpm exec prettier --check openspec/config.yaml backend/jest.config.js` | exit 0. |
| `node --check backend/jest.config.js` | exit 0. |
| Isolated VM canonical Jest exports | exit 0; byte-identical JSON. |
| Prettier `__debug.parse` YAML AST comparison | exit 0; quote-style normalization treated as formatting, with only the approved topology mapping changed. |
| Baseline-relative path allowlist and readback | exit 0; exactly `backend/jest.config.js`, `openspec/config.yaml`. |
| Review budget | 76 additions/deletions across the two targets; above the approximate 50-line forecast but below the hard 400-line limit. |

### Diagnosis and Disposition

The initial retry comparator failed once because it retained YAML quote syntax (`quoteSingle` versus `quoteDouble`) as semantic type; it was corrected to canonicalize those three scalar presentation forms as one scalar type. A provisional 50-line assertion also failed because actual formatter output is 76 changed lines. The approved design defines that number as approximate and the governing review limit is 400, so final acceptance used the hard limit and records the forecast variance. No target rollback was required after the final passing suite.

No DB, network, migration, live baseline adoption, `Product.stock` ALTER, commit, push, PR, or native review command was run.
