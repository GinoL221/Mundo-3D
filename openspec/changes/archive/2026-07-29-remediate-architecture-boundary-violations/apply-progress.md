# Apply Progress: Remediate Architecture Boundary Violations

**Mode:** Strict TDD. **Delivery:** stacked-to-main implementation slice; planning PR #42 merged at `a114018`, no commit/PR/remote mutation performed.

## Completed
- [x] 1.1: `a114018` is an ancestor; five handoff artifacts match its SHA-256 exactly; worktree was clean before apply.
- [x] 1.2: GitHub issue #41 is OPEN and labelled `status:approved`.
- [x] 2.1, 2.2, 3.1: exact Astro fallback tests and symlink-safe resolver implemented.
- [x] 3.2: zero consumer matches in `backend`/`frontend`; deleted only `backend/src/application/use-cases/index.ts`.

## TDD Cycle Evidence
| Tasks | Safety net | RED | GREEN | Refactor |
|---|---|---|---|---|
| 2.1/2.2/3.1 | 29/29 pass | 2 new tests failed (29 pass) | 31/31 pass | None needed |
| 3.2 | 31/31 pass | absence test failed (31 pass) | 32/32 pass | None needed |
| 4.1 | 32/32 candidate pass | N/A: evidence-only, no test/production change | 32/32 candidate pass | N/A |

## Work Unit Evidence
| Evidence | Exact result |
|---|---|
| Focused test | `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` → exit 0, 32/32 tests. |
| Runtime harness | N/A: resolver has no runtime boundary; `pnpm run frontend:build` exit 0, 15 pages. |
| Consumer proof | `rg` found zero imports/requires in `backend` or `frontend` for the barrel. |
| Rollback | Restore `backend/src/application/use-cases/index.ts`; revert only `engine.js` and its architecture test. |

## Verification / Remaining
- [x] 4.1: differential proof: base/candidate type-check both exit 2 with the same five TS7016 `supertest` locations; backend test both exit 1 with the same `src/database/__tests__/migrate.integration.test.js` AggregateError at `ensureDatabase.js:19` and `SequelizeConnectionRefusedError` at line 44 (one failed/81 passed suite; base 523, candidate 526 passing tests). Focused Jest: base 29/29, candidate 32/32; candidate frontend build exit 0, 15 pages; `architecture:check` absent in both, so N/A; `git diff --check` exit 0. No regression.
- [ ] 4.2: delivery/merge intentionally not performed.
- [ ] 4.3: parent resumption belongs to the parent after prerequisite merge.

**Scope:** `backend/tools/architecture/engine.js`, its test, the deleted barrel, this change's tasks/progress only. No parent artifacts or `sdd-attempt` changed.
