# Tasks: Standardize Naming Conventions for Product Model (Slice 2B)

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

This task list breaks down the standardization of the `Product` model in `mundo-3d`, mapping snake_case database columns to camelCase runtime properties while maintaining legacy PascalCase compatibility getters.

## 1. Database & Models
- [x] **Task 1.1: Refactor Sequelize Product Model**
  - Update [Product.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/Product.js) attributes to camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`).
  - Configure each attribute with the `field` property pointing to the database snake_case columns (`id_product`, `name_product`, `price`, `description_product`, `image`, `id_category`, `id_franchise`).
  - Implement legacy compatibility getters in the model's `getterMethods` configuration returning the camelCase properties: `IDProduct`, `NameProduct`, `Price`, `DescriptionProduct`, `Image`, `IDCategory`, `IDFranchise`.
- [x] **Task 1.2: Update Sequelize ShoppingCart Model Mapping**
  - Update [ShoppingCart.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/ShoppingCart.js) to map the `IDProduct` attribute explicitly using the `field: 'id_product'` option.
- [x] **Task 1.3: Update TypeScript DB Definitions**
  - Modify [db.d.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/db.d.ts) to rename `ProductAttributes` and `ProductInstance` to use camelCase attributes.
  - Expose optional PascalCase attributes (`IDProduct`, `NameProduct`, etc.) for legacy support.

## 2. Domain & Ports
- [x] **Task 2.1: Refactor Domain Product Entity**
  - Modify [Product.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/domain/entities/Product.ts) constructor parameters to use camelCase: `idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`.
  - Expose legacy PascalCase getters returning the camelCase properties for backward compatibility.
- [x] **Task 2.2: Standardize Repository Port**
  - Update [IProductRepository.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/domain/ports/IProductRepository.ts) method signatures to reflect the updated `Product` properties where applicable.

## 3. Use Cases & DTOs
- [x] **Task 3.1: Standardize Product DTO Casing**
  - Update [ProductDTO.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/dtos/ProductDTO.ts) to define camelCase properties.
- [x] **Task 3.2: Refactor ShoppingCart DTO Mapping**
  - Update nested product properties in [ShoppingCartDTO.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/dtos/ShoppingCartDTO.ts) to map `idProduct`, `nameProduct`, `price`, `image`.
- [x] **Task 3.3: Refactor Product Use Cases**
  - Update input contracts, mapper functions, and property references to camelCase in the following use cases:
    - [ListProductsUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/ListProductsUseCase.ts)
    - [CreateProductUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/CreateProductUseCase.ts)
    - [GetLatestProductUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/GetLatestProductUseCase.ts)
    - [GetProductByIdUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/GetProductByIdUseCase.ts)
    - [UpdateProductUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/UpdateProductUseCase.ts)
    - [SyncCartUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/SyncCartUseCase.ts)

## 4. Infrastructure & Services
- [x] **Task 4.1: Refactor Sequelize Product Repository**
  - Update [SequelizeProductRepository.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/repositories/SequelizeProductRepository.ts) to map Sequelize model attributes to Domain Product properties inside `toEntity()`.
  - Standardize queries, inserts (`create`), updates (`update`), and deletions (`delete`) to use camelCase attributes.
- [x] **Task 4.2: Update Legacy Product Service**
  - Modify [productService.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/services/productService.js) to retrieve camelCase properties and format DTO envelopes accordingly (especially in `transformWithCategoryCount`).

## 5. Frontend Integration
- [x] **Task 5.1: Update index.astro Page**
  - Update [index.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/pages/index.astro) to extract `products` array from the `resData.products` response envelope.
  - Read `product.idProduct`, `product.nameProduct`, `product.price`, and flat string `product.Category` during rendering.
- [x] **Task 5.2: Update products.astro Page**
  - Update [products.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/pages/products.astro) to extract the products list from the response envelope (`resData.products`) and render with camelCase properties.
- [x] **Task 5.3: Update product.astro Page**
  - Update [product.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/pages/product.astro) client-side load, render, and `localStorage` cart synchronization to use camelCase variables.
- [x] **Task 5.4: Align Cart Nanostores Actions**
  - Update payload parameters and properties consumed in [cart.ts](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/store/cart.ts) actions (e.g. `addToCart`) to camelCase.

## 6. Testing & Verification
- [x] **Task 6.1: Run Database Schema Sync & Reset**
  - Execute database sync scripts (`npm run db:reset` or manual runner) to verify database creation with snake_case column names.
- [x] **Task 6.2: Refactor Test Suites**
  - Adapt mocks and assertions in the product-related test files:
    - [ProductModel.test.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/__tests__/ProductModel.test.js)
    - [DomainEntities.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/__tests__/DomainEntities.test.ts)
    - [SequelizeProductRepository.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/repositories/__tests__/SequelizeProductRepository.test.ts)
    - Product use case test files.
- [x] **Task 6.3: Implement Legacy Compatibility Assertions**
  - Add explicit test assertions validating that the PascalCase legacy getters work on both Domain and Sequelize instances.
- [x] **Task 6.4: Execute All Tests**
  - Verify all tests pass by running:
    ```bash
    npm run test
    ```
