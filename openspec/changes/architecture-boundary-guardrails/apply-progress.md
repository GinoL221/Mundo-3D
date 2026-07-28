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

## PR 2 — Rules, Allowlists, and Diagnostics

- Delivery: stacked-to-main; `main@9c6309c` → rules/allowlists/diagnostics only.
- Tasks complete: 1.1, 1.2, 1.3, 2.1, 2.2. Remaining: 3.1–3.3.
- Budget before correction: 99 code/test changed lines (96 additions, 3 deletions), not 102. Final code/test delta: 106 lines (103 additions, 3 deletions); the tracked PR 2 working slice totals 159 lines including OpenSpec task/evidence updates, within the 190-line slice cap.

## TDD Cycle Evidence

| Task | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 2.1 | 6/6 focused Jest passed | 15 new rule/allowlist/diagnostic tests failed: `evaluateEdges is not a function` | 23/23 passed after 2.2 | Table covers allowed/forbidden backend, frontend, resolution, non-production, and exact-allowlist cases | None needed |
| 2.2 | 6/6 focused Jest passed | External framework/I/O cases failed: 2 expectations returned no violation | 23/23 focused Jest passed | Added Express and `node:fs` cases to force external policy | None needed; pure evaluation helpers remain compact |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` — exit 0, 1 suite, 23 tests passed |
| Runtime harness | N/A — this slice exports pure classification/rule functions; CLI/runtime integration is PR 3 scope |
| File size | `wc -l`: `config.js` 34, `engine.js` 57 (both ≤250) |
| Changed paths/lines | Before correction: test +42/-1, `config.js` +16/-1, `engine.js` +38/-1 = 99 code/test changed lines. Final: test +48/-1, `config.js` +16/-1, `engine.js` +39/-1 = 106 code/test changed lines. OpenSpec task/evidence updates bring the tracked working slice to 159 changed lines. |
| Rollback | Revert the PR-2 rule tests and the `config.js` allowlist / `engine.js` evaluator additions; PR-1 parsing/resolution remains intact |

## Scope Notes

- Exact `Set` membership prevents allowlist inheritance; diagnostics sort source, position, then rule and contain source, target/specifier, and rule.
- No CLI, package script, workflow, discovery wiring, or final CI behavior was added; these remain PR 3.

## PR 2 — Authorized Focused Correction (Ordinal 3)

- Authority: `pr2-contract-correction`, revision `sha256:f68da33fafcad1982e0982f8dd221b253a9729b172fd68176db91135208ddfef`; one corrective attempt only.
- Confirmed and fixed: domain local/unclassified targets, arbitrary application targets, non-route infrastructure-to-database edges, known project I/O/framework external packages, and diagnostic position propagation/order.
- Refuted in part: PR 1 AST extraction already attaches `line` and `column`; PR 2 omitted them from violations, so only the diagnostic handoff belonged to this correction.

## Corrective TDD Cycle Evidence

| Task | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| PR 2 correction | 23/23 focused Jest passed | 5 focused RED expectations failed for A–E; supplementary bare-`fs` RED then failed after the first GREEN | 29/29 focused Jest passed after minimal evaluator changes | Local UI, DTO/arbitrary application, route/non-route infrastructure, `node:`/bare-`fs`/`mysql2`, and same-source positions exercise distinct paths | None needed; compact pure evaluator retained |

## Corrective Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` — exit 0, 1 suite, 29 passed |
| Rules selection | Same command with `-t "rules|allowlist|diagnostics"` — exit 0, 1 suite, 23 passed, 6 skipped |
| Runtime harness | N/A — CLI/runtime integration is explicitly PR 3 scope; this correction changes only pure evaluator behavior |
| Rollback | Revert the PR-2 test/evaluator changes for the five confirmed contracts; parser/resolution, allowlist data, and PR-1 behavior remain intact |
