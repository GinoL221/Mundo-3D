# Tasks: Executable Architecture Boundary Guardrails

## Review Workload Forecast

### PR 0 — Planning-only boundary (current)

- **Branch:** `docs/architecture-boundary-guardrails-plan`
- **Exact paths:** `openspec/changes/architecture-boundary-guardrails/exploration.md`, `openspec/changes/architecture-boundary-guardrails/proposal.md`, `openspec/changes/architecture-boundary-guardrails/design.md`, `openspec/changes/architecture-boundary-guardrails/tasks.md`, `openspec/changes/architecture-boundary-guardrails/specs/backend-architecture-boundaries/spec.md`, `openspec/changes/architecture-boundary-guardrails/specs/frontend-domain-locality/spec.md`, `openspec/changes/architecture-boundary-guardrails/specs/architecture-verification-gate/spec.md`.
- **Measured burden:** 555 lines; planning-only, with no runtime code/product behavior.
- **Verification:** Structural `git diff --check` plus path/line count; semantic traceability/chain review.
- **Rollback:** Remove only those seven planning paths; production remains untouched.
- **Exception rationale:** Approved `size:exception` for technical SDD material without runtime behavior; do not split dependent artifacts across code PRs.

### Implementation forecast (separate from PR 0)

430–500 authored lines; each slice ≤190. Split: PR 1 parser → PR 2 rules → PR 3 wiring. Delivery: `ask-on-risk`, stacked-to-main only; no mixed strategy.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Dependency diagram (PR 0 is current)

`main → 📍 PR 0 docs/architecture-boundary-guardrails-plan → PR 1 parser → PR 2 rules → PR 3 wiring → final SDD verify`

PRs start from updated `main` after predecessor merge; delivery actions never block final SDD verification.

### Suggested Work Units

| Unit | Focused verification | Runtime harness | Rollback boundary |
|---|---|---|---|
| PR 0 `docs/architecture-boundary-guardrails-plan` | `git diff --check`; exact-path/555-line and semantic review | N/A: planning-only | Remove the seven OpenSpec paths |
| PR 1 `feat/architecture-boundary-guardrails-parser`; main after PR 0 | Jest architecture test `-t "AST|resolution"` | N/A: temp-tree fixtures | Remove parser/resolution and Slice 1 tests |
| PR 2 `feat/architecture-boundary-guardrails-rules`; main after PR 1 | Jest architecture test `-t "rules|allowlist|diagnostics"` | N/A: no product runtime | Remove rule/config/diagnostic code and Slice 2 tests |
| PR 3 `feat/architecture-boundary-guardrails-wiring`; main after PR 2 | `pnpm --filter backend architecture:check`; `pnpm test`; frontend build; `git diff --check` | Failing fixture blocks CI; no product runtime | Remove `check.js`, script, CI step, and Slice 3 tests |

## Delivery Gate

Before apply: review seven PR 0 artifacts and authorize `docs/architecture-boundary-guardrails-plan`. `sdd-apply` is not ready; PR 1 starts after PR 0 merges.

## Phase 1: PR 1 — Parser and Resolution

- [ ] 1.1 RED: extend `backend/src/architecture/__tests__/architecture-boundaries.test.js` for ESM/CJS/type edges; alias resolution; unresolved locals; non-production/docs; dynamic forms; `.astro` non-parsing.
- [ ] 1.2 GREEN: create `backend/tools/architecture/ast.js` and resolution in `engine.js`/`config.js`; produce deterministic edges and fail-closed diagnostics without rules/wiring.
- [ ] 1.3 Verify PR 1 with focused Jest, file-size, and `git diff --name-only`; keep later files out of the diff.

## Phase 2: PR 2 — Rules, Allowlists, and Diagnostics

- [ ] 2.1 RED: add R1–R9/S1–S21 tests for backend/CommonJS, isolation, frontend/Astro scope, resolution, allowlists, fixtures, diagnostics, and ordering.
- [ ] 2.2 GREEN: implement `config.js` allowlists/classifications and `engine.js` rules; preserve exact paths, no inheritance, sorted diagnostics, and no suppression.

## Phase 3: PR 3 — CLI, Package, CI, and Final Proof

- [ ] 3.1 RED: add R10/S22–S25 tests for success, failure/unavailable blocking, baseline independence, and rollback without runtime changes.
- [ ] 3.2 GREEN: create `backend/tools/architecture/check.js`, add `architecture:check` to `backend/package.json`, and add the blocking step to `.github/workflows/ci.yml`.
- [ ] 3.3 Verify PR 3 locally with package check, tests/build, diff check, and rollback evidence; delivery remains outside final SDD verification.
