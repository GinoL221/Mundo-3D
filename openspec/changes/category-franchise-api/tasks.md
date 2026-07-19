# Tasks: Category & Franchise CRUD API

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Original chain ~1500–1900; PR6 contract ~160; PR7 implementation/TDD ~180–280 |
| 400-line budget risk | Low per PR6/PR7 work unit |
| Chained PRs recommended | Yes — PR6 contract followed by PR7 implementation/TDD |
| Suggested split | PR6: PR5 → duplicate contract/spec/tasks; PR7: PR6 → duplicate implementation/TDD |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Unit

| Unit | Goal | PR | Focused test | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Duplicate-name contract: unique names and deterministic 409 semantics | PR6 | `git diff --check` | N/A — documentation-only contract | Revert the two delta specs and `tasks.md` metadata only |
| 2 | Duplicate-name translation and 409 coverage for both entities | PR7 | `npm test -- --runInBand Category Franchise` | Supertest duplicate POST/PUT on both routes | Revert PR7 repository/controller/test changes only |

PR6 starts at `feat/category-franchise-api-5-franchise-routes` (PR5) on `feat/category-franchise-api-6-duplicate-contract` and ends with the duplicate-name contract, delta specs, and delivery plan only. PR7 starts serially from PR6 on `feat/category-franchise-api-7-duplicate-conflicts`, targets the PR6 branch, and owns all repository, controller, route, strict-TDD, and coverage work. No executable code, route, FK-delete, or archive work belongs in PR6.

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

## Phase 7: Duplicate-Name Conflict Remediation (PR7)

- [ ] 7.1 RED: add repository tests for Sequelize `UniqueConstraintError` on Category/Franchise create and update.
- [ ] 7.2 Translate duplicate persistence errors in both repositories to stable domain errors.
- [ ] 7.3 RED: add controller unit tests for deterministic duplicate create/update `409` mapping in both controllers.
- [ ] 7.4 Map duplicate domain errors to the stable API error shape; preserve FK-delete `409` behavior.
- [ ] 7.5 Add route tests for duplicate POST/PUT, unchanged records, and stable `409` bodies in both route suites.
- [ ] 7.6 Rerun focused tests, regression suites, and `npx jest --coverage --runInBand`.

## Dependency Order

Completed phases 1–5 landed serially through PR5; Phase 6 evidence is preserved. PR6 records the contract and chain split. Phase 7 depends serially on PR6 and proceeds repository → controller → route tests → full verification. Archive remains blocked until Phase 7 passes.
