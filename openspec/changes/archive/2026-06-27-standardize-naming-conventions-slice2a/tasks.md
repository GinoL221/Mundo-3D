# Tasks: Naming Conventions Standardization (Slice 2A)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150-200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Not needed |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Standardize Category & Franchise naming conventions | PR 1 | Base branch; tests and Astro templates included |

## Phase 1: Database Migration & Foundation

- [x] 1.1 Create migration SQL `src/database/migrations/20260627-rename-category-franchise-columns.sql` with column rename statements.
- [x] 1.2 Run local database reset to synchronize schema changes and seed initial lookup data.

## Phase 2: DTOs & Use Cases (Application Layer)

- [x] 2.1 Update `src/application/dtos/ProductDTO.ts` to change `Category: string` to `category: string`.
- [x] 2.2 Update DTO mapping key from `Category` to `category` in `src/application/use-cases/ListProductsUseCase.ts`.
- [x] 2.3 Update DTO mapping key from `Category` to `category` in `src/application/use-cases/CreateProductUseCase.ts`.
- [x] 2.4 Update DTO mapping key from `Category` to `category` in `src/application/use-cases/GetLatestProductUseCase.ts`.
- [x] 2.5 Update DTO mapping key from `Category` to `category` in `src/application/use-cases/GetProductByIdUseCase.ts`.
- [x] 2.6 Update DTO mapping key from `Category` to `category` in `src/application/use-cases/UpdateProductUseCase.ts`.

## Phase 3: Frontend Integration

- [x] 3.1 Update `frontend/src/pages/index.astro` to access `product.category` instead of `product.Category`.
- [x] 3.2 Update `frontend/src/pages/products.astro` to access `product.category` instead of `product.Category`.

## Phase 4: Testing & Verification

- [x] 4.1 Update `src/application/__tests__/CreateProductUseCase.test.ts` to assert `.category` instead of `.Category`.
- [x] 4.2 Update `src/application/__tests__/GetLatestProductUseCase.test.ts` to assert `.category` instead of `.Category`.
- [x] 4.3 Update `src/application/__tests__/GetProductByIdUseCase.test.ts` to assert `.category` instead of `.Category`.
- [x] 4.4 Update `src/application/__tests__/ListProductsUseCase.test.ts` to assert `.category` instead of `.Category`.
- [x] 4.5 Update `src/application/__tests__/UpdateProductUseCase.test.ts` to assert `.category` instead of `.Category`.
- [x] 4.6 Execute `pnpm test` to verify all test suites pass.
