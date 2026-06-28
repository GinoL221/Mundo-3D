# Proposal: Naming Conventions Standardization (Slice 2A - Category & Franchise)

## Intent
Standardize the Category and Franchise database models, their domain entities, ports, repositories, DTOs, and related tests to use camelCase attributes dynamically mapped to snake_case database columns via Sequelize field mappings, accompanied by temporary legacy PascalCase getterMethods for backward compatibility. This aligns the lookup models with the already standardized `User` and `RememberToken` models.

## Scope

### In Scope
- **Models & Mappings:** Ensure `src/database/models/Category.js` and `src/database/models/Franchise.js` properties are in camelCase (`idCategory`, `nameCategory` / `idFranchise`, `nameFranchise`) mapped to snake_case column names (`id_category`, `name_category` / `id_franchise`, `name_franchise`) with temporary legacy PascalCase getters (`IDCategory`, `NameCategory` / `IDFranchise`, `NameFranchise`) for backward compatibility.
- **TypeScript Model Declarations:** Align `src/database/models/db.d.ts` interfaces (`CategoryAttributes`, `CategoryInstance`, `FranchiseAttributes`, `FranchiseInstance`) to use camelCase, while keeping optional legacy attributes (`IDCategory`, `NameCategory`, `IDFranchise`, `NameFranchise`) as part of the interface definitions.
- **Domain Entities & Repository Ports:** Verify domain entities (`src/domain/entities/Category.ts` and `src/domain/entities/Franchise.ts`) and port declarations (`src/domain/ports/ICategoryRepository.ts` and `src/domain/ports/IFranchiseRepository.ts`) use camelCase properties in all constructor and interface signatures.
- **Infrastructure Repositories:** Ensure repository implementations (`SequelizeCategoryRepository.ts` and `SequelizeFranchiseRepository.ts`) do not access or return PascalCase properties, using camelCase attributes instead.
- **DTOs & API Payloads:** Update lookup-related properties in DTOs. Specifically, migrate the nested Category name field in the Product API responses (and `ProductDTO`) from PascalCase (`Category`) to camelCase (`category`).
- **Client Frontend Updates:** Standardize client-side references in the Astro frontend (`frontend/src/pages/index.astro`, `frontend/src/pages/products.astro`, etc.) to use camelCase `product.category` instead of PascalCase `product.Category` once the API is updated.
- **Tests:** Update and verify all related model, repository, and controller/routing integration tests to use/assert camelCase properties.

### Out of Scope
- Refactoring `Product` model schema and domain entity properties (deferred to Slice 2B).
- Refactoring `ShoppingCart` model schema and domain entity properties (deferred to Slice 2C).
- Final cleanup/removal of legacy getterMethods (will be done after Slice 2C).

## Capabilities

### Modified Capabilities
- `category-franchise-standardization`: Alignment of lookup models to the camelCase-to-snake_case mapping standard.

## Approach
1. **Refactor & Validate Models:** Verify Sequelize model properties mapping and verify that legacy PascalCase getters exist for transition compatibility.
2. **DTO & API update:** Update `ProductDTO` interface to change `Category` to `category` (type string) and verify that `ListProductsUseCase`, `CreateProductUseCase`, etc., return the nested category name as `category`.
3. **Frontend Integration:** Refactor the Astro templates to access `product.category` instead of `product.Category`.
4. **Database Migration Script:** Create a manual database migration or DDL update script for MySQL to rename columns of existing tables `Category` and `Franchise` to snake_case (`id_category`, `name_category`, `id_franchise`, `name_franchise`).
5. **Run Verification:** Execute Jest test suites and verify all assertions on lookups and endpoints pass.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/database/models/Category.js` | Verified | camelCase properties mapped to snake_case columns with legacy getters. |
| `src/database/models/Franchise.js` | Verified | camelCase properties mapped to snake_case columns with legacy getters. |
| `src/database/models/db.d.ts` | Modified | Update Category and Franchise typings. |
| `src/domain/entities/Category.ts` | Verified | Keep constructor parameter names as camelCase. |
| `src/domain/entities/Franchise.ts` | Verified | Keep constructor parameter names as camelCase. |
| `src/application/dtos/ProductDTO.ts` | Modified | Change `Category: string` to `category: string`. |
| `src/application/dtos/CategoryDTO.ts` | Verified | Standardized to camelCase properties. |
| `src/application/use-cases/ListProductsUseCase.ts` | Modified | Change mapped DTO key from `Category` to `category`. |
| `src/application/use-cases/CreateProductUseCase.ts` | Modified | Change mapped DTO key from `Category` to `category`. |
| `src/application/use-cases/GetLatestProductUseCase.ts` | Modified | Change mapped DTO key from `Category` to `category`. |
| `src/application/use-cases/GetProductByIdUseCase.ts` | Modified | Change mapped DTO key from `Category` to `category`. |
| `src/application/use-cases/UpdateProductUseCase.ts` | Modified | Change mapped DTO key from `Category` to `category`. |
| `frontend/src/pages/index.astro` | Modified | Access `product.category` instead of `product.Category`. |
| `frontend/src/pages/products.astro` | Modified | Access `product.category` instead of `product.Category`. |
| `src/database/models/__tests__/CategoryModel.test.js` | Verified | Assertions check for camelCase properties and legacy getters. |
| `src/database/models/__tests__/FranchiseModel.test.js` | Verified | Assertions check for camelCase properties and legacy getters. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Database columns on disk mismatch | High | Run development environment with `alter: true` to auto-adjust schema; create a MySQL migration script for production. |
| Broken frontend client references | Medium | Update references in all Astro frontend pages immediately alongside DTO changes. |

## Rollback Plan
Revert changes to model files, DTOs, use cases, and frontend views using `git checkout`. If database columns were modified physically, restore the backup or rename the columns back using MySQL DDL statements.

## Success Criteria
- [ ] Model attributes for `Category` and `Franchise` are defined in camelCase.
- [ ] Table fields for `Category` and `Franchise` map to snake_case column names in SQL.
- [ ] DTO response for lookup models uses camelCase properties.
- [ ] Nested category property in Product API payloads uses the camelCase key `category` and frontend renders it properly.
- [ ] All tests run and pass successfully.
