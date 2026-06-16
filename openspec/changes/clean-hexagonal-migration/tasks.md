# Tasks: Clean & Hexagonal Architecture Migration

## Review Workload Forecast
- **Estimated changed lines**: ~650 lines (Additions + Deletions)
- **Decision needed before apply**: No
- **Chained PRs recommended**: Yes
- **Chain strategy**: stacked-to-main
- **400-line budget risk**: High
- **Delivery Strategy**: ask-on-risk

### Recommended PR Split
1. **PR 1**: TS Setup, Compiler config, Domain Entities, and Repository Ports.
2. **PR 2**: Application Use Cases, DTO definitions, and Mock Use Case Tests.
3. **PR 3**: Infrastructure Sequelize Repositories, Express Controllers, Routes, and Integration Tests.

---

## Phase 1: Foundation
- [x] **Task 1.1**: Install development dependencies: `typescript`, `ts-node`, `ts-jest`, `@types/express`, `@types/jest`, `@types/sequelize`.
- [x] **Task 1.2**: Create `tsconfig.json` with strict type checks (`"strict": true`, `"noImplicitAny": true`).
- [x] **Task 1.3**: Configure `jest.config.js` to support `ts-jest` for executing `.ts` files under `src/`.

## Phase 2: Domain Layer
- [x] **Task 2.1**: Implement `Category` domain entity in `src/domain/entities/Category.ts`.
- [x] **Task 2.2**: Implement `Franchise` domain entity in `src/domain/entities/Franchise.ts`.
- [x] **Task 2.3**: Implement `Product` domain entity in `src/domain/entities/Product.ts` with association mappings.
- [x] **Task 2.4**: Define repository ports: `IProductRepository.ts`, `ICategoryRepository.ts`, `IFranchiseRepository.ts` in `src/domain/ports/`.

## Phase 3: Application Layer & Unit Tests
- [x] **Task 3.1**: Define data transfer objects (`ProductDTO.ts`, `CategoryDTO.ts`) in `src/application/dtos/`.
- [x] **Task 3.2**: Implement `ListProducts` use case mapping domain entities to DTOs and calculating category counters.
- [x] **Task 3.3**: Implement `GetProductById` use case returning product details DTO or throwing exception if not found.
- [x] **Task 3.4**: Implement use cases for product creation, modification, and deletion.
- [x] **Task 3.5**: Write unit tests for domain entities and use cases using mocked repositories in `src/application/__tests__/`.

## Phase 4: Infrastructure Layer & Integration Tests
- [x] **Task 4.1**: Implement database repository adapters in `src/infrastructure/repositories/` using Sequelize models (mapping to domain entities).
- [x] **Task 4.2**: Write integration tests for Sequelize repository adapters using SQLite in-memory DB or mocked Sequelize models in `src/infrastructure/repositories/__tests__/`.
- [x] **Task 4.3**: Implement `ProductController` in `src/infrastructure/controllers/ProductController.ts` with syntactic validations.
- [x] **Task 4.4**: Integrate Express routes inside `src/infrastructure/routes/productRoutes.ts` with dependency injection.

## Phase 5: Verification & Cleanup
- [x] **Task 5.1**: Run full test suite with coverage checks (coverage threshold >= 80%).
- [x] **Task 5.2**: Update docs/comments and clean up any unused legacy files in the Product domain.
