## Exploration: Standardize Naming Conventions (Slice 2)

### Current State
Currently, the database models for `Category`, `Franchise`, `Product`, and `ShoppingCart` use PascalCase properties that map directly to database column names of the same casing on disk (e.g., `IDProduct`, `NameProduct`, `IDCategory`, `IDFranchise`, `Quantity`, `UnitPrice`, `CartStatus`). The corresponding domain entities (`Category.ts`, `Franchise.ts`, `Product.ts`), ports, repositories, DTOs, use cases, controllers, and their unit/integration tests all use these legacy PascalCase properties. This is inconsistent with the recently standardized `User` and `RememberToken` models, which use camelCase properties mapped to snake_case database columns dynamically via Sequelize field mappings, accompanied by legacy PascalCase getterMethods for backward compatibility.

### Affected Areas
- **Models & TypeScript Typings**:
  - `src/database/models/Category.js` — Refactor property names to camelCase and map fields to snake_case column names. Add legacy getters.
  - `src/database/models/Franchise.js` — Refactor properties to camelCase and map fields to snake_case columns. Add legacy getters.
  - `src/database/models/Product.js` — Refactor properties to camelCase and map fields to snake_case columns. Add legacy getters.
  - `src/database/models/ShoppingCart.js` — Refactor properties to camelCase and map fields to snake_case columns. Add legacy getters.
  - `src/database/models/db.d.ts` — Update interface typings (`CategoryAttributes`, `FranchiseAttributes`, `ProductAttributes`, `ShoppingCartAttributes`).
- **Domain Entities & Ports**:
  - `src/domain/entities/Category.ts` — Convert constructor properties to camelCase (`idCategory`, `nameCategory`).
  - `src/domain/entities/Franchise.ts` — Convert constructor properties to camelCase (`idFranchise`, `nameFranchise`).
  - `src/domain/entities/Product.ts` — Convert constructor properties to camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`).
  - `src/domain/ports/` — Update port declarations for `ICategoryRepository.ts`, `IFranchiseRepository.ts`, `IProductRepository.ts`, and `IShoppingCartRepository.ts` to match camelCase entity types.
- **DTOs & Mappers**:
  - `src/application/dtos/CategoryDTO.ts` — Convert properties to camelCase.
  - `src/application/dtos/ProductDTO.ts` — Convert properties to camelCase.
  - `src/application/dtos/ShoppingCartDTO.ts` — Convert properties to camelCase and update `mapToShoppingCartDTO` mapping function.
- **Use Cases**:
  - `src/application/use-cases/CreateProductUseCase.ts` — Update input interfaces and map properties to camelCase.
  - `src/application/use-cases/GetLatestProductUseCase.ts`, `GetProductByIdUseCase.ts`, `ListProductsUseCase.ts`, `UpdateProductUseCase.ts` — Update model property access and response mapping to camelCase.
  - `src/application/use-cases/SyncCartUseCase.ts` — Update access to `product.price`.
- **Infrastructure Repositories & Controllers**:
  - `src/infrastructure/repositories/SequelizeCategoryRepository.ts` — Update model instance property access and queries.
  - `src/infrastructure/repositories/SequelizeFranchiseRepository.ts` — Update model instance property access and queries.
  - `src/infrastructure/repositories/SequelizeProductRepository.ts` — Update model instance property access and queries.
  - `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` — Update model instance property access and queries.
  - `src/infrastructure/controllers/ProductApiController.ts` & `CartApiController.ts` — Verify compatibility with camelCase DTOs.
  - Legacy Services (`src/services/productService.js`, `categoryService.js`, `franchiseService.js`) — Update queries and data mutations to camelCase.
- **Tests**:
  - `src/database/models/__tests__/` — Update model definition validation tests.
  - `src/application/__tests__/` — Update mock entities and assertions in product and cart use case tests.
  - `src/infrastructure/repositories/__tests__/` — Update entity initialization and query assertions in repository integration tests.
  - `src/infrastructure/controllers/__tests__/` — Update assertions verifying JSON response shapes.
  - `src/infrastructure/routes/__tests__/` & `src/infrastructure/routes/api/__tests__/` — Update integration/E2E test assertions to check for camelCase properties in responses.

### Approaches

1. **Monolithic All-in-One Refactor** — Refactor all four remaining models, their corresponding domain entities, repositories, DTOs, use cases, controllers, legacy services, and all unit/integration/E2E tests in a single change.
   - **Pros**: Immediate standardization across the entire application in a single pass; no mixed state between PascalCase and camelCase domains.
   - **Cons**: High likelihood of exceeding the 400-line budget constraint (~700+ lines changed); hard to review, high cognitive load, and high risk of regressions.
   - **Effort**: High.
   - **400-line budget risk**: High.

2. **Phased Sliced Refactor (Recommended)** — Divide the remaining models and their dependencies into three sequential, smaller slices:
   - **Slice 2A (Lookup Models)**: Refactor `Category` and `Franchise` models, entities, ports, repositories, services, and tests. (~150 lines changed).
   - **Slice 2B (Core Product Model)**: Refactor `Product` model, entity, port, repository, DTO, use cases, legacy service, and tests. (~380 lines changed).
   - **Slice 2C (Transactional Cart Model)**: Refactor `ShoppingCart` model, DTO, port, repository, use cases, controllers, routes, and tests. (~250 lines changed).
   - **Pros**: Keeps every slice's PR change-set well within or near the 400-line review budget; isolates verification; reduces code review complexity and risk.
   - **Cons**: Requires executing three separate implementation/verification cycles.
   - **Effort**: Medium.
   - **400-line budget risk**: Low to Medium.

### Recommendation
We recommend **Approach 2 (Phased Sliced Refactor)**. Refactoring `Category` and `Franchise` first (Slice 2A) is highly isolated and sets up the lookup dependencies. Then, `Product` (Slice 2B) can be cleanly refactored. Finally, the transactional `ShoppingCart` (Slice 2C) can be updated. This ensures code changes remain manageable and reviewable under the 400-line limit.

### Risks
- **Sequelize DB Association Constraints**: Model associations (defined in `src/database/models/index.js`) must be validated to ensure foreign keys match the new camelCase property names and snake_case column names correctly.
- **API Response Casing**: Client applications (frontend) consumed JSON responses with PascalCase casing (e.g. `IDProduct`). Standardizing DTOs to camelCase will change the JSON payload shapes, which must be carefully verified to prevent breaking external clients.

### Ready for Proposal
Yes
