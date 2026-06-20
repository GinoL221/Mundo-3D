# Tasks: Standardize Naming Conventions (Slice 2A)

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

This document breaks down the work required to standardize Category and Franchise models to camelCase attributes and snake_case database columns.

## Phase 1: Database & Model Refactoring
- [x] Rename Category and Franchise columns in database/migrations if any, or prepare sequelize alter sync. (Note: using `sequelize.sync({ alter: true })` in development).
- [x] Refactor [Category.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/Category.js):
  - Rename `IDCategory` -> `idCategory` (with `field: 'id_category'`).
  - Rename `NameCategory` -> `nameCategory` (with `field: 'name_category'`).
  - Add `getterMethods` for backward compatibility (`IDCategory`, `NameCategory`).
- [x] Refactor [Franchise.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/Franchise.js):
  - Rename `IDFranchise` -> `idFranchise` (with `field: 'id_franchise'`).
  - Rename `NameFranchise` -> `nameFranchise` (with `field: 'name_franchise'`).
  - Add `getterMethods` for backward compatibility (`IDFranchise`, `NameFranchise`).
- [x] Refactor [Product.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/Product.js) foreign keys:
  - Update `IDCategory` -> `idCategory` (with `field: 'id_category'`).
  - Update `IDFranchise` -> `idFranchise` (with `field: 'id_franchise'`).
  - Add `getterMethods` for backward compatibility (`IDCategory`, `IDFranchise`).
- [x] Update [index.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/index.js) associations to use camelCase foreign keys (`idCategory`, `idFranchise`).
- [x] Update [db.d.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/models/db.d.ts) types to support both camelCase and legacy PascalCase (getters) attributes.

## Phase 2: Domain, Ports, and Infrastructure Refactoring
- [x] Refactor [Category.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/domain/entities/Category.ts) to use `idCategory` and `nameCategory`.
- [x] Refactor [Franchise.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/domain/entities/Franchise.ts) to use `idFranchise` and `nameFranchise`.
- [x] Refactor [Product.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/domain/entities/Product.ts) references: constructor parameters for category and franchise.
- [x] Update repository interfaces [ICategoryRepository.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/domain/ports/ICategoryRepository.ts) & [IFranchiseRepository.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/domain/ports/IFranchiseRepository.ts).
- [x] Refactor [SequelizeCategoryRepository.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/repositories/SequelizeCategoryRepository.ts) to map snake_case attributes and entity instantiation to camelCase.
- [x] Refactor [SequelizeFranchiseRepository.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/repositories/SequelizeFranchiseRepository.ts) to map snake_case attributes and entity instantiation to camelCase.
- [x] Refactor [CategoryDTO.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/dtos/CategoryDTO.ts) fields to `idCategory` and `nameCategory`.
- [x] Refactor [ProductDTO.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/dtos/ProductDTO.ts) fields to use `idCategory` and `idFranchise`.

## Phase 3: Use Cases & Legacy Services Refactoring
- [x] Refactor use cases referencing Category and Franchise:
  - [CreateProductUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/CreateProductUseCase.ts)
  - [UpdateProductUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/UpdateProductUseCase.ts)
  - [GetLatestProductUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/GetLatestProductUseCase.ts)
  - [GetProductByIdUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/GetProductByIdUseCase.ts)
  - [ListProductsUseCase.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/use-cases/ListProductsUseCase.ts)
- [x] Refactor [seed.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/seed.js) to insert data with updated model keys.
- [x] Check if [categoryService.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/services/categoryService.js) and [franchiseService.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/services/franchiseService.js) under `src/services/` need any adapter logic or update.

## Phase 4: Test Refactoring & Verification
- [x] Update domain unit tests: [DomainEntities.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/__tests__/DomainEntities.test.ts).
- [x] Update repository unit tests:
  - [SequelizeCategoryRepository.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/repositories/__tests__/SequelizeCategoryRepository.test.ts)
  - [SequelizeFranchiseRepository.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/repositories/__tests__/SequelizeFranchiseRepository.test.ts)
- [x] Update services unit tests:
  - [categoryService.test.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/services/__tests__/categoryService.test.js)
  - [franchiseService.test.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/services/__tests__/franchiseService.test.js)
- [x] Update use case unit tests:
  - [CreateProductUseCase.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/__tests__/CreateProductUseCase.test.ts)
  - [UpdateProductUseCase.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/application/__tests__/UpdateProductUseCase.test.ts)
  - Any other use case tests accessing Category/Franchise properties.
- [x] Run test suite (`npm test`) and verify all tests pass.
- [x] Run linter (`npm run lint`) to ensure no syntax/TypeScript issues.
