# Tasks: Cart Module Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700-800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Domain/Port) -> PR 2 (Use Cases/Repo) -> PR 3 (Routes/Controller) -> PR 4 (Cleanup) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Migrate Core Domain & Exception | PR 1 | Base: feature/pixel-art-foundation. Contains unit tests. |
| 2 | Use Cases & Repository Adapter | PR 2 | Base: PR 1 branch. Exposes queries & Sequelize repo. |
| 3 | HTTP routing & UI Integration | PR 3 | Base: PR 2 branch. Mounts router, middleware in app.js. |
| 4 | Legacy removal and references | PR 4 | Base: PR 3 branch. Cleans up JS code and spied tests. |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Create `src/domain/exceptions/CartValidationException.ts` extending `Error`.
- [x] 1.2 Create `src/domain/entities/ShoppingCart.ts` with `CartStatus` enum, quantity limits validation, and `hasPriceDrift` method.
- [x] 1.3 Create `src/domain/ports/IShoppingCartRepository.ts` interface with `findByUserId` and `getDistinctCount` methods.
- [x] 1.4 Declare TS declarations for `ShoppingCart` in `src/database/models/db.d.ts`.
- [x] 1.5 Implement `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` query interface.

## Phase 2: Core Implementation

- [x] 2.1 Create `src/application/dtos/ShoppingCartDTO.ts` with `ShoppingCartDTO` and `GetCartResult` interfaces, mapping entities to PascalCase.
- [x] 2.2 Create `src/application/use-cases/GetCartByUserIdUseCase.ts` computing total and detecting price drift.
- [x] 2.3 Create `src/application/use-cases/GetCartDistinctCountUseCase.ts` returning distinct count.
- [x] 2.4 Create `src/infrastructure/controllers/CartController.ts` rendering `products/productCart` relative views.
- [x] 2.5 Create `src/infrastructure/routes/cartRoutes.ts` with DI and router paths.
- [x] 2.6 Create `src/infrastructure/middlewares/cartCount.ts` setting `res.locals.cartDistinctCount`.

## Phase 3: Integration / Wiring

- [x] 3.1 Mount `cartRoutes` router and import/register `cartCount` in `src/app.js`.
- [x] 3.2 Remove legacy `/productCart` route from `src/infrastructure/routes/productRoutes.ts`.
- [x] 3.3 Modify `src/__tests__/errorPropagation.test.js` to spy on use cases or controller instead of `CartService.findByUserId`.

## Phase 4: Testing / Verification

- [x] 4.1 Unit test `ShoppingCart.ts` for limits (qty > 10 throws) and `hasPriceDrift`.
- [x] 4.2 Unit test `GetCartByUserIdUseCase.ts` and `GetCartDistinctCountUseCase.ts`.
- [x] 4.3 Integration test `CartController.ts` checking rendered EJS parameters.
- [x] 4.4 Test `cartCount.ts` middleware setting local variable.
- [x] 4.5 End-to-end route tests for `/productCart` checking authentication logic.

## Phase 5: Cleanup

- [x] 5.1 Delete legacy `src/services/cartService.js` and `src/services/__tests__/cartService.test.js`.
- [x] 5.2 Remove legacy controller `src/controllers/products/viewShoppingCart.js` and middleware `src/middlewares/cartCount.js`.
- [x] 5.3 Remove references from exports in `src/services/index.js` and `src/controllers/products/index.js`.
