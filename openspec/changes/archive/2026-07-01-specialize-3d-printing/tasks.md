# Tasks: Specialize Mundo-3D for 3D Printing

Review Workload Forecast:
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

---

## Phase 1: Foundation / Database (PR 1)
- [x] Update Sequelize Product model definition in [Product.js](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/database/models/Product.js) to support 3D attributes (`material`, `height`, `width`, `depth`, `finish`, `productionTime`) mapped to correct fields.
- [x] Add 3D attributes types in [db.d.ts](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/database/models/db.d.ts).
- [x] Update the seeding script in [seed.js](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/database/seed.js) and database data in [products.json](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/database/data/products.json) to populate initial 3D printing properties.
- [x] Add/update Model tests in [ProductModel.test.js](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/database/models/__tests__/ProductModel.test.js) to verify column mapping and schema serialization.

## Phase 2: Core / Backend (PR 2)
- [x] Add domain logic validations to [Product.ts](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/domain/entities/Product.ts):
  - Validate `material` (must be 'PLA', 'Resina', 'PETG', 'Flex' or start with 'Otros: ')
  - Validate `height`, `width`, `depth` (must be >= 0)
  - Validate `productionTime` (must be a positive integer <= 30)
  - Expose PascalCase getters
- [x] Update entity tests in [DomainEntities.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/application/__tests__/DomainEntities.test.ts) to verify domain validations, including throwing on invalid material (e.g. without prefix), too long productionTime (>30), and negative dimensions.
- [x] Update repository mapping to map new 3D attributes in [SequelizeProductRepository.ts](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/infrastructure/repositories/SequelizeProductRepository.ts).
- [x] Update repository unit tests in [SequelizeProductRepository.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/infrastructure/repositories/__tests__/SequelizeProductRepository.test.ts) to verify saving and loading 3D specifications.
- [x] Update Express validators in [productValidators.ts](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/infrastructure/middlewares/validators/productValidators.ts) for form inputs.
- [x] Update validators tests in [validators.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/backend/src/infrastructure/middlewares/__tests__/validators.test.ts) to test the new validator constraints.
- [x] Verify use cases and controllers pass using tests.

## Phase 3: Frontend / Wiring (PR 3)
- [x] Update [product.adapter.ts](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/domains/products/adapters/product.adapter.ts):
  - Default `material` and `finish` to `"A consultar"`.
  - Format `productionTime` as `"${val} días"` or `"A consultar"`.
  - Formats dimensions dynamically: if at least one dimension is defined, format defined as `"${val} cm"` and others as `"no definida"`. If all dimensions are null/undefined/0, format all as `"A consultar"`.
- [x] Implement adapter tests verifying all scenarios (partially defined dimensions, fully undefined dimensions, custom material formatting).
- [x] Update product detail page script in [product.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/pages/product.astro):
  - Handle `#product-dimensions` script format correctly.
  - Implement JRPG-style Retro border/shadow UI styling for `.product-specs` and its elements.
- [x] Build and verify frontend Astro compilation.

## Phase 4: Verification & Documentation
- [x] Run full test suite (`npm test`) to ensure zero regression.
- [x] Document updated database schema structure in [DB.md](file:///home/ginopc/Desarrollo/Mundo-3D/DB.md).
- [x] Complete manual visual checks of the product catalog. Closed via automated headless Playwright e2e coverage (`e2e/tests/product-3d-specs.spec.ts`) instead of a manual GUI check — no display is available in this environment, but headless Chromium via Playwright is, and was used to verify the rendered `.product-specs` panel end-to-end.
