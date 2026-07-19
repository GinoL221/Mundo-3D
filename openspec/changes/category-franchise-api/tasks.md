# Tasks: Category & Franchise CRUD API

## Review Workload Forecast

| Field                   | Value                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| Estimated changed lines | PR7 design/tasks ~120–180; PR8 implementation/tests ~220–360         |
| 400-line budget risk    | Low per PR7 and PR8 work unit                                        |
| Chained PRs recommended | Yes — PR7 design/task alignment followed by PR8 implementation/TDD   |
| Suggested split         | PR6 contract → PR7 design/tasks → PR8 duplicate implementation/tests |
| Delivery strategy       | auto-chain                                                           |
| Chain strategy          | stacked-to-main                                                      |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Unit

| Unit | Goal                                                                  | PR  | Focused test                                                                     | Runtime harness                                              | Rollback boundary                                                        |
| ---- | --------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1    | Duplicate-name contract: unique names and deterministic 409 semantics | PR6 | `git diff --check`                                                               | N/A — documentation-only contract                            | Revert the two delta specs and `tasks.md` metadata only                  |
| 2    | Duplicate conflict design/task alignment                              | PR7 | `npx prettier --check openspec/changes/category-franchise-api/{design,tasks}.md` | N/A — documentation-only                                     | Revert `design.md` and `tasks.md` only                                   |
| 3    | Duplicate-name translation, 409 coverage, and full verification       | PR8 | `npx jest --coverage --runInBand`                                                | Supertest duplicate POST/PUT plus unchanged-state invariants | Restore the preserved PR8 stash/patch and revert only executable changes |

PR6 starts at `feat/category-franchise-api-5-franchise-routes` (PR5) on `feat/category-franchise-api-6-duplicate-contract` and ends with the duplicate-name contract and delta specs. PR7 starts serially from PR6 on `feat/category-franchise-api-7-duplicate-design`, targets the PR6 branch, and changes only `design.md` and `tasks.md`. PR8 starts serially from PR7 on `feat/category-franchise-api-8-duplicate-conflicts`, targets the PR7 branch, and restores the preserved executable implementation for repository, controller, route, strict-TDD, and full verification. No executable code belongs in PR7.

## Phase 1: Foundation

- [x] 1.1 Create `backend/src/application/dtos/FranchiseDTO.ts`.

## Phase 2: Category Domain (TDD)

- [x] 2.1–2.5 Add and test the five Category use-cases in `backend/src/application/use-cases/`.
- [x] 2.6 Translate Category FK-delete errors in `backend/src/infrastructure/repositories/SequelizeCategoryRepository.ts`.

## Phase 3: Category HTTP (TDD)

- [x] 3.1 Add `categoryValidators.ts`.
- [x] 3.2 TDD `CategoryApiController.ts` (400/404/409 mapping).
- [x] 3.3–3.4 Add category router and Supertest matrix in `routes/api/__tests__/categories.test.ts`.
- [x] 3.5 Mount categories in `infrastructure/routes/api/index.ts`.

## Phase 4: Franchise Domain (TDD)

- [x] 4.1–4.5 Add and test the five Franchise use-cases.
- [x] 4.6 Translate Franchise FK-delete errors in `SequelizeFranchiseRepository.ts`.

## Phase 5: Franchise HTTP (TDD)

- [x] 5.1 Add `franchiseValidators.ts`.
- [x] 5.2 TDD `FranchiseApiController.ts`.
- [x] 5.3–5.4 Add franchise router and Supertest matrix in `routes/api/__tests__/franchises.test.ts`.
- [x] 5.5 Mount franchises in `infrastructure/routes/api/index.ts`.

## Phase 6: Verification

- [x] 6.1 Run full Jest suite and confirm coverage ≥50%.
- [x] 6.2 Verify existing Spanish FK-409 bodies against Product convention.

## Phase 7: Duplicate-Name Conflict Remediation (PR8 delivery)

- [ ] 7.1 RED: add repository tests for Sequelize `UniqueConstraintError` on Category/Franchise create and update.
- [ ] 7.2 Translate duplicate persistence errors in both repositories to stable domain errors.
- [ ] 7.3 RED: add controller unit tests for deterministic duplicate create/update `409` mapping in both controllers.
- [ ] 7.4 Map duplicate domain errors to the stable API error shape; preserve FK-delete `409` behavior.
- [ ] 7.5 Add route tests for duplicate POST/PUT, unchanged records, and stable `409` bodies in both route suites.
- [ ] 7.6 Rerun focused tests, regression suites, and `npx jest --coverage --runInBand`.

## Dependency Order

Completed phases 1–5 landed serially through PR5; Phase 6 evidence is preserved. PR6 records the contract. PR7 aligns the Phase 7 design and delivery plan only. Phase 7 executable work is preserved for PR8 and is not credited until PR8 restores it and reruns repository → controller → route tests → full verification. Archive remains blocked until PR8 passes.
