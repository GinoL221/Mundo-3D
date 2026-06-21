## Exploration: Standardize Naming Conventions (Slice 2B - Core Product Model)

### Current State
In the previous slice (Slice 2A), naming conventions were standardized for `Category` and `Franchise` lookup models. Now, in Slice 2B, we focus on the core `Product` model.
Currently, the `Product` model (`src/database/models/Product.js`) uses legacy PascalCase properties (`IDProduct`, `NameProduct`, `DescriptionProduct`, `Price`, `Image`) mapped directly to the database column names of the same casing on disk, except for `idCategory` and `idFranchise` which were already refactored.
The corresponding domain entity (`Product.ts`), port (`IProductRepository.ts`), repository (`SequelizeProductRepository.ts`), DTOs (`ProductDTO.ts`, `ShoppingCartDTO.ts`), use cases, controllers, and their unit/integration tests all use these legacy PascalCase properties.
The Astro frontend (located in `frontend/src/`) fetches products from the API and also relies on these PascalCase properties (`IDProduct`, `NameProduct`, `Price`, etc.).

### Affected Areas

1. **Database & Typings**:
   - `src/database/models/Product.js` — Refactor property names to camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`) and map fields to snake_case column names. Keep legacy getterMethods (`IDProduct`, `NameProduct`, `Price`, `DescriptionProduct`, `Image`, `IDCategory`, `IDFranchise`) returning their camelCase counterparts.
   - `src/database/models/db.d.ts` — Update `ProductAttributes` and `ProductInstance` to use camelCase and define optional legacy properties for backwards compatibility.

2. **Domain Entities & Ports**:
   - `src/domain/entities/Product.ts` — Convert constructor properties to camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`).
   - `src/domain/ports/IProductRepository.ts` — Update port signature to use camelCase (e.g. `Omit<Product, 'idProduct' | ...>`).

3. **DTOs & Mappers**:
   - `src/application/dtos/ProductDTO.ts` — Convert properties to camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`, `Category`).
   - `src/application/dtos/ShoppingCartDTO.ts` — Update access to `entity.product` properties to camelCase (`nameProduct`, `price`, `image`) and update the nested `product` object attributes (`idProduct`, `nameProduct`, `price`, `image`).

4. **Use Cases**:
   - `src/application/use-cases/CreateProductUseCase.ts` — Update input properties to camelCase and map output properties.
   - `src/application/use-cases/GetLatestProductUseCase.ts`, `GetProductByIdUseCase.ts`, `ListProductsUseCase.ts`, `UpdateProductUseCase.ts` — Update property access and mapped output properties.
   - `src/application/use-cases/SyncCartUseCase.ts` — Update access to `product.Price` to `product.price`.

5. **Infrastructure Repositories & Services**:
   - `src/infrastructure/repositories/SequelizeProductRepository.ts` — Update mappings, creation payload, update payload, and query structures to camelCase.
   - `src/services/productService.js` (Legacy) — Convert properties, update data mapping, and update `transformWithCategoryCount` to camelCase.

6. **Frontend**:
   - `frontend/src/pages/index.astro` — Update fetched product property references to camelCase.
   - `frontend/src/pages/products.astro` — Update fetched product property references to camelCase.
   - `frontend/src/pages/product.astro` — Update fetched product property references to camelCase.
   - `frontend/src/store/cart.ts` — Update `addToCart` payload type and property access to camelCase.

7. **Tests**:
   - `src/database/models/__tests__/ProductModel.test.js` — Update model assertion tests to check for new camelCase attributes, field mappings, and getter methods.
   - `src/application/__tests__/DomainEntities.test.ts` — Update Product entity creation test to verify camelCase properties.
   - `src/application/__tests__/CreateProductUseCase.test.ts` — Update inputs and assertions.
   - `src/application/__tests__/GetLatestProductUseCase.test.ts` — Update inputs and assertions.
   - `src/application/__tests__/GetProductByIdUseCase.test.ts` — Update inputs and assertions.
   - `src/application/__tests__/ListProductsUseCase.test.ts` — Update inputs and assertions.
   - `src/application/__tests__/UpdateProductUseCase.test.ts` — Update inputs and assertions.
   - `src/application/__tests__/SyncCartUseCase.test.ts` — Update mocked product construction.
   - `src/application/__tests__/ShoppingCartDTO.test.ts` — Update assertions for the nested `product` object in `ShoppingCartDTO` and product entity instantiations.
   - `src/application/__tests__/GetCartByUserIdUseCase.test.ts` — Update assertions and product entity instantiations.
   - `src/infrastructure/repositories/__tests__/SequelizeProductRepository.test.ts` — Update mocked instances, assertions, inputs to camelCase.
   - `src/services/__tests__/productService.test.js` (Legacy) — Update mocks and assertions.

### Approaches

1. **Complete Naming Refactor including Frontend (Recommended)**
   - Refactor both the backend DTOs/use cases/repositories/model and the frontend Astro files to consume the new camelCase properties.
   - **Pros**: Zero legacy adapters needed. Pure and clean camelCase implementation across the full stack. Ensures the Astro app functions perfectly on launch.
   - **Cons**: Touches frontend pages in the same slice, adding more files to the diff.
   - **Effort**: Medium.
   - **400-line budget risk**: Medium.

2. **Backend Naming Refactor w/ Frontend Compatibility Adapter**
   - Keep the API controller mapping the camelCase DTOs back to PascalCase for the client, OR rely solely on the model's legacy getters if rendering via SSR. But since the client fetches via API and we are standardizing the DTOs, keeping an adapter in the controller is counter-productive to long-term standardization.
   - **Pros**: Keeps the frontend files untouched in this slice.
   - **Cons**: Retains tech debt in the API layer; we would have to remove the adapters later in Slice 2C anyway.
   - **Effort**: Medium.
   - **400-line budget risk**: Medium.

### Recommendation
We recommend **Approach 1 (Complete Naming Refactor including Frontend)**. Standardizing both the backend and frontend at the same time prevents runtime integration issues and aligns the full stack under camelCase. The frontend changes are mechanical property-name adjustments that are low-risk.

### Risks
- **Frontend integration breaks if missed**: Since the frontend loads data asynchronously via API fetches, any missed PascalCase property reference (like `product.Price` instead of `product.price`) will fail silently or display incorrectly. Strict typing verification and E2E verification is key.
- **ShoppingCart Model Association (Slice 2C)**: The `ShoppingCart` model is not yet refactored to camelCase. However, we must ensure `ProductModel.hasMany(ShoppingCartModel, { foreignKey: 'IDProduct' })` in `src/database/models/index.js` remains working by retaining the `IDProduct` foreign key pointing to the new `idProduct` primary key in `ProductModel`.

### Ready for Proposal
Yes
