## Exploration: Migrating Cart Module to TypeScript and Hexagonal Architecture

### Current State
The cart module currently operates using legacy JavaScript patterns within an MVC structure:
- **Database Model**: `src/database/models/ShoppingCart.js` defines the `ShoppingCart` model with fields: `IDCart` (primary key), `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, and `CartStatus`.
- **Service Layer**: `src/services/cartService.js` acts as an active record/helper service with methods `findByUserId(userId)` (includes the `Product` model), `findAll()`, and `computeTotal(cartItems)` (domain logic mixed in).
- **Controller Layer**: `src/controllers/products/viewShoppingCart.js` coordinates the flow. It retrieves `req.session.userLogged.IDUser`, calls `CartService.findByUserId`, and renders `products/productCart.ejs` with the cart items and total.
- **Middleware**: `src/middlewares/cartCount.js` calculates the distinct product count in the active user's cart to display a badge on the navbar.
- **Routes**: `src/infrastructure/routes/productRoutes.ts` maps `/productCart` through legacy controller `viewShoppingCart.js`.

### Affected Areas
- `src/domain/entities/ShoppingCart.ts` — **NEW** — Core domain entity representing a cart item.
- `src/domain/ports/IShoppingCartRepository.ts` — **NEW** — Interface for database cart operations.
- `src/application/use-cases/GetCartByUserIdUseCase.ts` — **NEW** — Fetches items for a specific user and returns them.
- `src/application/use-cases/GetCartDistinctCountUseCase.ts` — **NEW** — Retrieves distinct item count.
- `src/application/use-cases/ListAllCartItemsUseCase.ts` — **NEW** — Retrieves all cart items (if keeping parity with `CartService.findAll`).
- `src/application/dtos/ShoppingCartDTO.ts` — **NEW** — Data transfer objects for cart items.
- `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` — **NEW** — Adapter implementing `IShoppingCartRepository` using Sequelize.
- `src/infrastructure/controllers/CartController.ts` — **NEW** — Handles HTTP requests, calls use cases, and renders EJS views.
- `src/infrastructure/routes/cartRoutes.ts` — **NEW** — Dedicated routing file for the cart module.
- `src/infrastructure/middlewares/cartCount.ts` — **NEW** — Ported TypeScript middleware for cart distinct count badge.
- `src/infrastructure/routes/productRoutes.ts` — **MODIFIED** — Remove `/productCart` route.
- `src/app.js` — **MODIFIED** — Register `cartRoutes` and the new `cartCount` middleware.
- `src/database/models/db.d.ts` — **MODIFIED** — Include type definitions for `ShoppingCart` instance and class.
- `src/services/index.js` — **MODIFIED** — Clean up the export of the legacy `CartService`.
- `src/controllers/products/index.js` — **MODIFIED** — Remove export of `viewShoppingCart`.
- `src/services/cartService.js` — **DELETED** — Removed legacy service.
- `src/controllers/products/viewShoppingCart.js` — **DELETED** — Removed legacy controller.
- `src/__tests__/errorPropagation.test.js` — **MODIFIED** — Adapt tests to spy on the new cart use cases/controller.

### Approaches

1. **Approach A: Separate Router and Modular Routing (Dedicated `cartRoutes.ts`)**
   - **Description**: Move the cart route out of `productRoutes.ts` and create a dedicated `src/infrastructure/routes/cartRoutes.ts` file. Inject dependencies (repository, use cases, controller) inside the new route file and mount it in `src/app.js`.
   - **Pros**:
     - Complete separation of concerns: Cart routing and dependencies are isolated from Product routing.
     - Simpler, shorter routing files.
     - Better alignment with Hexagonal Architecture.
   - **Cons**:
     - Requires modifying `src/app.js` to mount the new router.
   - **Effort**: Medium

2. **Approach B: Embedded Controller in existing `productRoutes.ts`**
   - **Description**: Keep the `/productCart` route definition in `src/infrastructure/routes/productRoutes.ts`. Instantiate the `SequelizeShoppingCartRepository`, use cases, and `CartController` inside `productRoutes.ts`.
   - **Pros**:
     - No modification needed in `src/app.js` for new route mounting.
     - Avoids adding a new routing file.
   - **Cons**:
     - Clutters `productRoutes.ts` with unrelated dependencies (cart repository, cart use cases, cart controller).
     - Violates Single Responsibility Principle for the routes module.
   - **Effort**: Low

### Recommendation
**Approach A** is recommended. The cart is its own business domain with its own Sequelize database model, domain entity, and repository port. Keeping it inside `productRoutes.ts` couples the product routing to the cart routing. Creating a dedicated `cartRoutes.ts` will keep the modules modular and clean, maintaining architectural alignment with the rest of the application.

### Risks
- **EJS Template Compatibility**: EJS templates reference properties from legacy Sequelize instances like `cartItem.product.NameProduct` or `cartItem.UnitPrice` directly. The DTOs returned by the use case MUST preserve or translate these property paths to avoid breaking EJS views.
- **Integration Test Rewrites**: Tests in `src/__tests__/errorPropagation.test.js` mock-spy on `CartService.findByUserId`. Replacing `CartService` requires rewriting or adapting these integration tests to mock the new use cases or repository methods.
- **TypeScript definitions in db.d.ts**: The `ShoppingCart` model details and types need to be added to `src/database/models/db.d.ts`. Missing properties or incorrect typing here could lead to compile-time or runtime errors.

### Ready for Proposal
Yes. The orchestrator should proceed to define the proposal (`sdd-propose`) using Approach A to ensure complete decoupling.
