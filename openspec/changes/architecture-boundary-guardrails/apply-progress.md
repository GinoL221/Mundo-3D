# Apply Progress: architecture-boundary-guardrails

## PR 1 — Parser and Resolution

- Delivery: stacked-to-main; `main@0fbaffd` → parser/resolution only.
- Tasks complete: 1.1, 1.2, 1.3. Remaining: 2.1–3.3.
- Budget: 163 authored additions/deletions, within the 190-line slice cap.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` failed: missing `ast`; alias case then failed as `external` | 6/6 passed after parser/resolver implementation | Added generic alias, ImportEquals, static-template coverage; 6/6 passed |
| 1.2 | Same task-1.1 test was written before all production modules | 6/6 passed | None needed; pure extraction/resolution functions |
| 1.3 | N/A — verification-only task | 6/6 focused Jest passed | N/A |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` — exit 0, 1 suite, 6 tests passed |
| Runtime harness | N/A — pure AST/resolution functions use temporary fixture trees; no product runtime boundary |
| File size | `wc -l`: ast 25, config 19, engine 19 (all ≤250) |
| Changed paths/lines | test, `ast.js`, `config.js`, `engine.js`, tasks, this artifact; 163 additions/deletions; no CLI/package/CI/rules files |
| Rollback | Remove the three `backend/tools/architecture/*` parser/resolution files and Slice-1 test; revert PR-1 task marks/progress only |

## Scope Notes

- Bare unresolved specifiers remain `external`; unresolved relative, absolute, and configured alias specifiers are `unresolved-local`.
- Rule enforcement, discovery roots, allowlists, CLI, package scripts, and CI remain for PR 2/3.
