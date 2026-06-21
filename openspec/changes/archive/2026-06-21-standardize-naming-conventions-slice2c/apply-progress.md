# Apply Progress: Standardize Naming Conventions for ShoppingCart Model (Slice 2C)

## Status
- **Status:** COMPLETED
- **Branch:** `change/standardize-naming-conventions-slice2c`
- **Testing:** 100% passing tests (54 test suites, 278 tests)

## Refactored Files
- `src/database/models/ShoppingCart.js`: Renamed attributes to camelCase, defined snake_case field mappings and legacy PascalCase getterMethods.
- `src/database/models/index.js`: Updated associations to use camelCase foreign keys (`idUser`, `idProduct`).
- `src/database/models/db.d.ts`: Refactored `ShoppingCartAttributes` and `ShoppingCartInstance` to camelCase, kept legacy properties optional.
- `src/domain/entities/ShoppingCart.ts`: Added legacy getters returning camelCase equivalents.
- `src/application/dtos/ShoppingCartDTO.ts`: Standardized interface properties and mapper output to camelCase (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `status`).
- `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts`: Updated query options and entity mapping to match standardized camelCase attributes.
- `src/infrastructure/controllers/CartApiController.ts`: Updated request body extraction to support both `idProduct` (per spec) and `productId` (fallback).
- `frontend/src/store/cart.ts`: Refactored payload mapping in frontend sync to send `idProduct` instead of `productId`.

## Test Enhancements
- `src/database/models/__tests__/ShoppingCartModel.test.js`: Created new database model unit test validating mappings and legacy getters.
- `src/database/models/__tests__/index.test.js`: Added model association tests verifying `idUser` and `idProduct` foreign keys.
- `src/application/__tests__/ShoppingCart.test.ts`: Added test assertions checking legacy getters on the entity.
- `src/application/__tests__/ShoppingCartDTO.test.ts`: Updated expectations to camelCase properties.
- `src/infrastructure/repositories/__tests__/SequelizeShoppingCartRepository.test.ts`: Updated mocks and queries.
- `src/application/__tests__/GetCartByUserIdUseCase.test.ts`: Adjusted expectations.
- `src/infrastructure/controllers/__tests__/CartApiController.test.ts`: Configured tests to map `idProduct` / `productId` and assert camelCase.
