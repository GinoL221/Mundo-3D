# Tasks: Remediate Architecture Boundary Violations

## Review Workload Forecast

| Field | Value |
|---|---|
| Implementation estimate | 36–70 authored lines |
| Planning lines (explore/proposal/spec/design/tasks) | 122 + 57 + 92 + 67 + 45 = 383 |
| Total exact-path review burden | 419–453 additions/deletions |
| 400-line budget risk | High (planning artifacts included) |
| Chained PRs recommended | Yes — planning-only boundary; keep implementation as one PR |
| Delivery / chain | ask-on-risk / stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | One approved prerequisite implementation | PR 1 | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` | N/A until clean-main wiring exists | Revert `engine.js`, test, and restore `index.ts` |
| 2 | Parent PR 3 resumption after merge | Follow-up PR 3 | `pnpm --filter backend architecture:check` | Parent package/CI scenario | Revert parent PR 3 only |

## Phase 1: Handoff and Approval Gates

- [x] 1.1 From clean `main`, create the prerequisite worktree; after this file exists, copy only `exploration.md`, `proposal.md`, `design.md`, `tasks.md`, and `specs/architecture-verification-gate/spec.md`; compare an exact relative manifest and `sha256sum`, and prove dirty parent PR 3 paths are unchanged.
- [x] 1.2 Create/link a separate approved remediation issue before implementation PR work; record approval and keep issue #37, parent artifacts, runtime ledger, and remote untouched.

## Phase 2: RED Tests (before production changes)

- [x] 2.1 In `backend/src/architecture/__tests__/architecture-boundaries.test.js`, add failing resolver tests for exact existing `./`, `../`, multi-`../`, and `./dir/index.astro` files (no inferred index), opaque targets, and in-root regular symlinks.
- [x] 2.2 Add failing cases proving unresolved for missing, `./dir`, `./dir/`, `./dir/index`, ambiguous, traversal/outside-root, dangling/outside canonical symlink, query/hash, non-`.astro`, absolute/Windows/UNC, alias, package, unrecognized source roots, and empty/dot-segment forms; preserve ESM/CommonJS/alias/package fail-closed assertions.

## Phase 3: GREEN and Cleanup

- [x] 3.1 Modify only `backend/tools/architecture/engine.js`: derive recognized `backend/src`/`frontend/src` root, apply exact relative `.astro` fallback after TypeScript miss, canonicalize/contain with `realpathSync.native`, require a regular file, and return an opaque local edge.
- [x] 3.2 Prove zero exact repository consumers of `backend/src/application/use-cases/index.ts`; then delete only that barrel, with no import rewrites or changes to `check.js`, package, CI, rules, or allowlists.

## Phase 4: Verification and Delivery

- [x] 4.1 On clean `main`, run focused Jest, `pnpm --filter backend type-check`, `pnpm run frontend:build` when applicable, and `pnpm --filter backend test`; run `pnpm --filter backend architecture:check` only if available there, otherwise record N/A (never claim parent-only PASS); verify structural scope, `git diff --check`, source-size limits, and rollback evidence.
- [ ] 4.2 Stop at the ask-on-risk gate: choose planning-only review boundary versus `size:exception` or justified split; then deliver/merge one prerequisite PR only after approval and clean manifest evidence.
- [ ] 4.3 After merge, separately rebase/recreate parent PR 3 from updated `main`; rerun `pnpm --filter backend architecture:check` with zero diagnostics and collect final parent package/CI evidence. Do not implement this resumption in the prerequisite apply.
