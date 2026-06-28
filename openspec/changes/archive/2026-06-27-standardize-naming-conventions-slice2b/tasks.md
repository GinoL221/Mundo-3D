# Tasks: Standardize Naming Conventions for Product Model (Slice 2B)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 lines (total codebase) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Backend & DB changes) → PR 2 (Frontend changes) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB column migration, Sequelize mappings, domain model, repositories, DTOs, use cases, and tests | PR 1 | Base branch; backend unit tests included |
| 2 | Astro pages visual image error fallbacks and catalog updates | PR 2 | Targets main (or PR 1 branch); frontend updates |

## Phase 1: Database & Model Foundation

- [x] 1.1 Create migration SQL `src/database/migrations/20260627-rename-product-columns.sql` to rename `Product` columns to snake_case.
- [x] 1.2 Update `src/database/models/Product.js` with snake_case field mappings, camelCase attributes, and legacy getters.
- [x] 1.3 Update `src/database/models/ShoppingCart.js` FK mapping to map `IDProduct` association to `id_product` column.
- [x] 1.4 Update interfaces in `src/database/models/db.d.ts` to camelCase properties with optional legacy fields.

## Phase 2: Domain, DTOs & Core Backend

- [x] 2.1 Refactor `src/domain/entities/Product.ts` attributes to camelCase, add price validation (`> 0.00`), and define legacy getters.
- [x] 2.2 Update `src/application/dtos/ProductDTO.ts` and `src/application/dtos/ShoppingCartDTO.ts` to use camelCase attributes.
- [x] 2.3 Update `src/infrastructure/repositories/SequelizeProductRepository.ts` mappings, entity factory, and queries.
- [x] 2.4 Update core use cases (`CreateProductUseCase`, `UpdateProductUseCase`, `GetLatestProductUseCase`, `GetProductByIdUseCase`, `ListProductsUseCase`, `SyncCartUseCase`) to handle camelCase data.

## Phase 3: Astro Frontend Integration

- [x] 3.1 Modify `frontend/src/pages/index.astro` to handle camelCase properties and visual fallbacks for missing categories/images.
- [x] 3.2 Update `frontend/src/pages/products.astro` card template with camelCase attributes and `onerror` fallback handler.

## Phase 4: Testing & Verification

- [x] 4.1 Update `src/database/models/__tests__/ProductModel.test.js` to assert camelCase field mappings and associations.
- [x] 4.2 Update `src/application/__tests__/DomainEntities.test.ts` to verify product camelCase construction and price validation.
- [x] 4.3 Update use case tests (`CreateProductUseCase.test.ts`, `UpdateProductUseCase.test.ts`, `GetProductByIdUseCase.test.ts`, `ListProductsUseCase.test.ts`) to use camelCase structures.
