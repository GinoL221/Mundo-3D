# Tasks: Standardize Naming Conventions for ShoppingCart Model (Slice 2C)

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

This document outlines the concrete, actionable steps required to standardize the `ShoppingCart` model and related DTO, repository, domain, and API layers to use standard camelCase properties on the application side while mapping to snake_case columns in the database.

## Tasks Breakdown

### Phase 1: Database Model & Associations (Estimated 40 lines changed)
- [x] **T1.1 Refactor Sequelize Model `ShoppingCart.js`**
  - Path: `src/database/models/ShoppingCart.js`
  - Change model attribute keys to camelCase: `idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `cartStatus`.
  - Add explicit `field` mapping for each: `id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, `cart_status`.
  - Add `getterMethods` option to preserve backward compatibility for legacy PascalCase fields (`IDCart`, `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, `CartStatus`).
- [x] **T1.2 Update Model Associations in `index.js`**
  - Path: `src/database/models/index.js`
  - Update association foreign keys between `User`, `Product`, and `ShoppingCart` to use camelCase foreign keys (`idUser`, `idProduct`).
- [x] **T1.3 Update TypeScript Types in `db.d.ts`**
  - Path: `src/database/models/db.d.ts`
  - Refactor `ShoppingCartAttributes` and `ShoppingCartInstance` to use camelCase attributes.
  - Define optional legacy PascalCase properties in `ShoppingCartAttributes` for backward compatibility.

### Phase 2: Domain Entity & DTO Layers (Estimated 30 lines changed)
- [x] **T2.1 Add Legacy Getters to Domain Entity `ShoppingCart.ts`**
  - Path: `src/domain/entities/ShoppingCart.ts`
  - Add legacy getter methods for PascalCase properties (`IDCart`, `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, `CartStatus`) that return their camelCase equivalents.
- [x] **T2.2 Refactor DTO attributes in `ShoppingCartDTO.ts`**
  - Path: `src/application/dtos/ShoppingCartDTO.ts`
  - Update `ShoppingCartDTO` interface properties to camelCase (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `status`).
  - Refactor `mapToShoppingCartDTO` mapper function to map entity attributes to the new camelCase DTO fields.

### Phase 3: Infrastructure, Controller & Frontend Store (Estimated 40 lines changed)
- [x] **T3.1 Refactor Repository mapping and queries in `SequelizeShoppingCartRepository.ts`**
  - Path: `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts`
  - Update `toEntity` helper to read from camelCase model instance properties.
  - Update query filters in `findByUserId`, `getDistinctCount`, and `syncCart` to use camelCase keys (`idUser`, `cartStatus`, `idProduct`, `quantity`, `unitPrice`).
- [x] **T3.2 Update API Controller payload mapping in `CartApiController.ts`**
  - Path: `src/infrastructure/controllers/CartApiController.ts`
  - Ensure payload items extracted from `req.body.items` are safely mapped supporting both `idProduct` (per spec) and `productId` (for backward-compatibility fallback) before passing to `SyncCartUseCase`.
- [x] **T3.3 Refactor Frontend Store sync in `cart.ts`**
  - Path: `frontend/src/store/cart.ts`
  - Refactor `syncToBackend` request payload formatting to send `idProduct` instead of `productId` to align with the camelCase API payload specification.

### Phase 4: Verification and Testing (Estimated 100 lines changed)
- [x] **T4.1 Create Database Model Unit Test `ShoppingCartModel.test.js`**
  - Path: `src/database/models/__tests__/ShoppingCartModel.test.js`
  - Write assertions verifying attribute mapping, snake_case table columns, and functional legacy getter methods.
- [x] **T4.2 Update Model Associations Test `index.test.js`**
  - Path: `src/database/models/__tests__/index.test.js`
  - Add assertions confirming that User-to-ShoppingCart and Product-to-ShoppingCart associations use `idUser` and `idProduct` foreign keys.
- [x] **T4.3 Update Domain Entity Unit Test `ShoppingCart.test.ts`**
  - Path: `src/application/__tests__/ShoppingCart.test.ts`
  - Add assertions for legacy getters on the domain entity.
- [x] **T4.4 Update DTO Unit Test `ShoppingCartDTO.test.ts`**
  - Path: `src/application/__tests__/ShoppingCartDTO.test.ts`
  - Update tests to expect camelCase properties in the output DTO.
- [x] **T4.5 Update Repository & Use Cases Tests**
  - Paths:
    - `src/infrastructure/repositories/__tests__/SequelizeShoppingCartRepository.test.ts`
    - `src/application/__tests__/GetCartByUserIdUseCase.test.ts`
  - Update mock instances and expected query options to match standardized camelCase attributes.
- [x] **T4.6 Update Controller integration test `CartApiController.test.ts`**
  - Path: `src/infrastructure/controllers/__tests__/CartApiController.test.ts`
  - Update assertions and mocks to match camelCase API payload contracts.
- [x] **T4.7 Execute local test suite**
  - Run `npm test` and verify that all 100% of unit/integration tests pass.
