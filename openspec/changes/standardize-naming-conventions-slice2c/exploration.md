## Exploration: Standardize Naming Conventions (Slice 2C - Transactional Cart Model)

### Current State
Following the standardization of naming conventions for lookup models (Category and Franchise in Slice 2A) and the core Product model (in Slice 2B), Slice 2C targets the `ShoppingCart` model.
Currently, `ShoppingCart.js` defines properties using legacy PascalCase (`IDCart`, `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, `CartStatus`) that map directly to the PascalCase columns in the database. The TypeScript typings, repository, DTO, use cases, API controllers, and their unit/integration tests all use these legacy PascalCase properties.
The frontend store (`frontend/src/store/cart.ts`) already utilizes a clean camelCase structure for its `CartItem` state but needs alignment with the updated backend DTO response.

### Affected Areas

1. **Database & Typings**:
   - `src/database/models/ShoppingCart.js` — Refactor property names to camelCase (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `cartStatus`) and map them to snake_case column names (`id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, `cart_status`) in the database. Add legacy getterMethods (`IDCart`, `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, `CartStatus`) returning their camelCase counterparts for backwards compatibility.
   - `src/database/models/index.js` — Update associations between `User`, `Product`, and `ShoppingCart` to use camelCase foreign keys (`idUser`, `idProduct`).
   - `src/database/models/db.d.ts` — Update `ShoppingCartAttributes` and `ShoppingCartInstance` to use camelCase and define optional legacy properties for backward compatibility.

2. **DTOs & Mappers**:
   - `src/application/dtos/ShoppingCartDTO.ts` — Update `ShoppingCartDTO` interface to use camelCase properties (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `cartStatus`). Update the mapping function `mapToShoppingCartDTO` to map directly to these camelCase fields.

3. **Use Cases**:
   - `src/application/use-cases/GetCartByUserIdUseCase.ts` — Update access to entity properties and DTO mapping.
   - `src/application/use-cases/SyncCartUseCase.ts` — Align calls to the repository signature.

4. **Infrastructure Repositories & Controllers**:
   - `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` — Update property mappings from Sequelize instance to domain entity, and database queries/mutations (`findByUserId`, `getDistinctCount`, `syncCart`) to use camelCase properties and associations.
   - `src/infrastructure/controllers/CartApiController.ts` — Verify correct return of camelCase DTOs in response JSON.

5. **Tests**:
   - `src/database/models/__tests__/ShoppingCartModel.test.js` — Create new model definition test file to verify attributes, snake_case field mappings, and legacy getters.
   - `src/database/models/__tests__/index.test.js` — Add test cases to assert `ShoppingCart` associations with `User` and `Product`.
   - `src/application/__tests__/ShoppingCartDTO.test.ts` — Update assertions to match camelCase DTO output.
   - `src/application/__tests__/GetCartByUserIdUseCase.test.ts` — Update mocked instances and DTO assertions.
   - `src/infrastructure/repositories/__tests__/SequelizeShoppingCartRepository.test.ts` — Update mock database instances to camelCase and verify query params.
   - `src/infrastructure/controllers/__tests__/CartApiController.test.ts` — Update mocked DTO data to camelCase and verify JSON response shapes.

### Approaches

1. **Complete Naming Refactor (Recommended)**
   - Transition the `ShoppingCart` model, DTOs, repository, controllers, and tests completely to camelCase properties.
   - **Pros**: Maintains consistent full-stack styling across the codebase.
   - **Cons**: Touches multiple backend layers (model, repository, DTO, controller, tests).
   - **Effort**: Medium.
   - **400-line budget risk**: Low. Total line changes are estimated at ~250 lines, well within the 400-line limit.

### Recommendation
We recommend **Approach 1 (Complete Naming Refactor)**. Since the other models (User, RememberToken, Category, Franchise, Product) have already transitioned, keeping `ShoppingCart` in PascalCase introduces unwanted inconsistency. This completes the naming convention standardization across the backend codebase.

### Risks & Mitigations
- **Database Schema Sync**: Changes to Sequelize column mappings (`field: '...'`) will alter columns to snake_case. In the dev environment, this is handled via `sequelize.sync({ alter: true })` or resetting/re-seeding tables.
- **Frontend Compatibility**: Although `cart.astro` reads from localStorage and `cart.ts` only syncs to backend without consuming the response body directly, we must ensure any future API consumers are aware of the payload transition to camelCase.
