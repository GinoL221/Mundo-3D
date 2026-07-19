# Tasks: Category & Franchise CRUD API

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1500-1900 (10 use-cases + 10 tests, 2 controllers + tests, 2 routes + integration tests, 2 validators, 2 repo mods + tests, DTO, index.ts) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 (Franchise HTTP split across controller and route layers) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Resolved — chained PRs, stacked-to-main
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Category domain layer: 5 use-cases + repo FK-delete mod, unit tests only | PR 1 | Base: main/tracker. Independent of Franchise. ~475 lines |
| 2 | Category HTTP layer: validators, controller, route, mount, integration tests | PR 2 | Base: PR 1. ~650 lines |
| 3 | Franchise domain layer: FranchiseDTO + 5 use-cases + repo FK-delete mod, unit tests | PR 3 | Base/target: PR2 branch `feat/category-franchise-api-2-category-http` (PR #22), per user-approved chain continuation |
| 4 | Franchise validators + controller + strict-TDD controller unit tests | PR 4 | Base/target: PR3 branch `feat/category-franchise-api-3-franchise-domain` (PR #24). |
| 5 | Franchise routes + DI + Supertest integration tests + API router mount | PR 5 | Base/target: PR4 branch `feat/category-franchise-api-4-franchise-http`. |

Resolved: stacked-to-main. PR1 (Category domain) bases off main; PR2 stacks on PR1; PR3 stacks on PR2 branch `feat/category-franchise-api-2-category-http` (PR #22) by explicit user approval; PR4 (validators + controller unit) stacks on PR3 (PR #24); PR5 (routes + integration + mount) stacks on PR4. Final verification and archive follow PR5.

## Phase 1: Foundation

- [x] 1.1 Create `backend/src/application/dtos/FranchiseDTO.ts` (`idFranchise`, `nameFranchise`), mirrors `CategoryDTO`.

## Phase 2: Category Domain (TDD, Spec: category-api)

- [x] 2.1 TDD `ListCategoriesUseCase` — test (mock `ICategoryRepository`) + impl; returns `CategoryDTO[]`.
- [x] 2.2 TDD `GetCategoryByIdUseCase` — throws `Error('Category not found')` on miss.
- [x] 2.3 TDD `CreateCategoryUseCase` — returns created `CategoryDTO`.
- [x] 2.4 TDD `UpdateCategoryUseCase` — returns `CategoryDTO | null`.
- [x] 2.5 TDD `DeleteCategoryUseCase` — returns `boolean`.
- [x] 2.6 TDD `SequelizeCategoryRepository.delete()` — mock `db.destroy` throwing `ForeignKeyConstraintError`; rethrow `Error('Category has associated products')`.

## Phase 3: Category HTTP (Spec: category-api)

- [x] 3.1 Create `infrastructure/middlewares/validators/categoryValidators.ts` — create/update, `nameCategory` required/trimmed/non-empty.
- [x] 3.2 TDD `CategoryApiController` (index/show/create/update/destroy) — 400 NaN-id guard, 404 mapping, 409 mapping on FK message.
- [x] 3.3 TDD `infrastructure/routes/api/categories.ts` — DI wiring; `apiAuthMiddleware`+`requireRoles(ADMIN,STAFF)` on write, `adminGuard` on delete; open reads.
- [x] 3.4 Supertest `routes/api/__tests__/categories.test.ts` — full auth matrix, CRUD, 400/404/409 scenarios per spec.
- [x] 3.5 Mount `categoriesApiRouter` in `infrastructure/routes/api/index.ts`.

## Phase 4: Franchise Domain (TDD, Spec: franchise-api)

- [x] 4.1 TDD `ListFranchisesUseCase`.
- [x] 4.2 TDD `GetFranchiseByIdUseCase` — throws `Error('Franchise not found')`.
- [x] 4.3 TDD `CreateFranchiseUseCase`.
- [x] 4.4 TDD `UpdateFranchiseUseCase` — returns `FranchiseDTO | null`.
- [x] 4.5 TDD `DeleteFranchiseUseCase`.
- [x] 4.6 TDD `SequelizeFranchiseRepository.delete()` — catch FK error, rethrow `Error('Franchise has associated products')`.

## Phase 5: Franchise HTTP (Spec: franchise-api)

- [x] 5.1 Create `infrastructure/middlewares/validators/franchiseValidators.ts`.
- [x] 5.2 TDD `FranchiseApiController` (index/show/create/update/destroy).
- [x] 5.3 TDD `infrastructure/routes/api/franchises.ts` — same guard layout as categories.
- [x] 5.4 Supertest `routes/api/__tests__/franchises.test.ts` — full auth matrix, CRUD, 400/404/409.
- [x] 5.5 Mount `franchisesApiRouter` in `infrastructure/routes/api/index.ts`.

## Phase 6: Verification

- [ ] 6.1 Run full Jest suite; confirm coverage ≥ 50%.
- [ ] 6.2 Manually verify Spanish 409 body wording matches Product's convention (`ProductApiController.ts:201`).

## Dependency Notes

- Phase 1 blocks Phase 4 (FranchiseDTO needed).
- Phase 2 blocks Phase 3 (use-cases before controller/routes). Phase 4 blocks Phase 5 identically.
- Phase 2 and Phase 4 are mutually independent — can run in parallel.
- Phase 6 runs last, after both slices land.
