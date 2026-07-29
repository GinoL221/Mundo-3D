# Apply Progress: architecture-boundary-guardrails

## PR 1 — Parser and Resolution

- Delivery: stacked-to-main; `main@0fbaffd` → parser/resolution only.
- Tasks complete: 1.1, 1.2, 1.3. Remaining: 2.1–3.3.
- Budget: 163 authored additions/deletions, within the 190-line slice cap.

## TDD Cycle Evidence

| Task | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 1.1 | N/A — first task of the change; no prior architecture suite existed | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` failed: missing `ast`; alias case then failed as `external` | 6/6 passed after parser/resolver implementation | Generic alias, ImportEquals, and static-template forms exercise distinct extraction/resolution paths | Added generic alias, ImportEquals, static-template coverage; 6/6 passed |
| 1.2 | 6/6 focused Jest passed (from 1.1) | Same task-1.1 test was written before all production modules | 6/6 passed | Same fixture suite proves extraction and resolution together; no case beyond 1.1's coverage was needed for these pure functions | None needed; pure extraction/resolution functions |
| 1.3 | 6/6 focused Jest passed (from 1.2) | N/A — verification-only task | 6/6 focused Jest passed | N/A — verification-only task | N/A |

*Safety Net / TRIANGULATE columns backfilled 2026-07-29 for format parity with PR 2/PR 3 tables below; no behavior, test, or evidence changed — see verify-report.md Issue 6.*

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

## PR 3 — CLI, Package, and CI (final port)

- Delivery: stacked-to-main final slice; remediated `main@7385a2a` → CLI/discovery, package command, CI gate, and S22–S25 only.
- Native authority: ordinal 6 active, revision `sha256:f8b6f40e1ef537544e625e2318760d72c725254f59799dfe128d0a44d6fce97b`; prior native outcome passed; correction finish revision not yet issued.
- Prior blocked draft was used as semantic reference only. The prior 16 barrel-export and 4 `.astro` resolution findings were remediated in prerequisite `d0b1334`; current package command has zero diagnostics and exits 0.

## TDD Cycle Evidence

| Task | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 3.1 | 32/32 focused Jest passed on remediated main | Added five S22–S25 tests first; 5 failed because `check` was missing | 37/37 focused Jest passed | Valid fixture, violation, unavailable root, baseline absence, and runtime-entrypoint fixture cover distinct paths | None needed |
| 3.2 | 32/32 focused Jest passed | Same missing-module RED preceded CLI/package/CI wiring | 37/37 focused Jest passed; `architecture:check` exit 0, zero diagnostics | `-t "S23"`: 2 passed (35 skipped); corrected fixture proves `backend.domain.inward` resolved target, unavailable root returns 1 | None needed |
| 3.3 | 37/37 focused Jest passed | N/A — verification task | Package harness, frontend build, and diff check passed | Backend suite disposition recorded below | None needed |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` — exit 0; 1 suite, 37/37 passed |
| Runtime harness | `pnpm --filter backend architecture:check` — exit 0; zero diagnostics. S23 targeted Jest — exit 0; 2 passed, proving both deliberate forbidden fixture and unavailable root yield code 1. |
| Relevant backend suite | `pnpm --filter backend exec jest --runInBand` — exit 1 only for pre-existing unavailable MySQL: 81/82 suites and 531/537 tests passed; 6 failures in `migrate.integration.test.js` (`AggregateError` / `SequelizeConnectionRefusedError`). The architecture suite is green; no wiring-related regression observed. |
| Frontend build | `pnpm run frontend:build` — exit 0; 15 pages built. |
| CI/package ordering | `architecture:check` is declared as `node tools/architecture/check.js`; CI invokes it immediately after frozen install and before migrations, lint, tests, and E2E. A non-zero command blocks the step. |
| File size / diff | `check.js` 42 lines; all architecture production sources 25/42/34/78 (≤250). `git diff --check` exit 0. Implementation diff: +81/-1 (82 changed lines); final candidate including task/progress artifacts: +111/-4 (115 changed lines), below the 190-line slice cap. Exact implementation paths: `check.js`, `backend/package.json`, CI workflow, architecture test. |
| Runtime scope | `git status --short` includes untracked `check.js`; tracked `git diff --name-only` plus status show only checker/test/package/CI and SDD artifacts, with no product runtime source changed. |
| Rollback | Revert `backend/tools/architecture/check.js`, its five S22–S25 tests, `backend/package.json` script, and CI step; then revert only parent task/progress marks. PR 1/2 checker behavior and all product runtime files remain intact. |

## Focused Remediation — Domain Contract Subtrees (fix batch 1)

- Scope: only the two independently confirmed evaluator gaps. Parent tasks remain 8/8 complete and unchanged.
- Binding: lineage `review-dae010dbafb95cd7`, generation `1`, fix batch `1`, failed evidence revision `sha256:b17cdabda4d968733785b0235615f7817bbfd5ea53a5f6f0c769e32f5b7c316c`.
- Evidence preimage: `sha256:2b29d1765ce6c7c5c3019692f1c60739889bbc61ed5b5e0b489a0aec90547e7a` (`apply-progress.md` before this append).

{"schema":"gentle-ai.remediation-result/v1","status":"success","lineage_id":"review-dae010dbafb95cd7","generation":1,"fix_batch":1,"failed_evidence_revision":"sha256:b17cdabda4d968733785b0235615f7817bbfd5ea53a5f6f0c769e32f5b7c316c","review_binding_revision":"sha256:db1ffc38a129fcb60ac306cb0cf4269373993caee8fca63c7a5e56700e1e8eae","evidence_preimage_hash":"sha256:2b29d1765ce6c7c5c3019692f1c60739889bbc61ed5b5e0b489a0aec90547e7a"}
{"schema":"gentle-ai.remediation-evidence/v1","lineage_id":"review-dae010dbafb95cd7","generation":1,"fix_batch":1,"failed_evidence_revision":"sha256:b17cdabda4d968733785b0235615f7817bbfd5ea53a5f6f0c769e32f5b7c316c","red":{"command":"pnpm --dir backend test src/architecture/__tests__/architecture-boundaries.test.js --runInBand","exit_code":1,"tests":{"failed":2,"passed":41,"total":43},"output_hash":"sha256:accbd942026ae5f180735c39c58a97d7f0ba5e66fb891a8154e6c0f778774bd9"},"green":{"command":"pnpm --dir backend test src/architecture/__tests__/architecture-boundaries.test.js --runInBand","exit_code":0,"tests":{"passed":43,"total":43},"output_hash":"sha256:0bb46c693ee12310771a1a63123d251751cb272d90cc8cf38597365986adcc82"}}

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Focused remediation batch 1 | `backend/src/architecture/__tests__/architecture-boundaries.test.js` | Unit | 37/37 passed | 2 expected failures: domain/application → `domain/services` | 43/43 passed after evaluator restriction | Allowed domain entities/ports/exceptions and application entities/ports/exceptions/DTOs; two forbidden service edges | None needed; shared contract predicate removes duplication |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused RED | `pnpm --dir backend test src/architecture/__tests__/architecture-boundaries.test.js --runInBand` — exit 1; 2 failed, 41 passed, 43 total; `sha256:accbd942026ae5f180735c39c58a97d7f0ba5e66fb891a8154e6c0f778774bd9` |
| Focused GREEN | same command — exit 0; 1 suite, 43/43 passed; `sha256:0bb46c693ee12310771a1a63123d251751cb272d90cc8cf38597365986adcc82` |
| Runtime harness | `pnpm --dir backend architecture:check` — exit 0, zero diagnostics; `sha256:4acb2a2974ee2ae578426173f72717a47d4b1c43b37fca0e6da1e6304f6534d3` |
| Narrow quality | ESLint changed test/engine — exit 0; `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Jest engine coverage — 43/43, 100% lines, 94.64% branches; `sha256:4f1882a47014666e0f556c3f1ed94e74f6dae84c39a575d2a17bdb340ccd6353` |
| Frontend build | `pnpm run frontend:build` — exit 0; 15 pages; `sha256:5d144f0299a94dc3279bfd637180700352e8a3655ecec967e805a70598251de8` |
| Diff check | `git diff --check` — exit 0; `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Cleanup/process | Temp fixture helper retains `finally` recursive cleanup; no background process was started by this work unit. |
| Rollback | Revert only the six test additions and `isDomainContract` evaluator restriction; this restores prior behavior without touching parent tasks, CLI/CI, or product runtime files. |
