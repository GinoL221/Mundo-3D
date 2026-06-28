# Proposal: Standardize Naming Conventions for ShoppingCart Model (Slice 2C)

## Intent

Standardize casing conventions for the ShoppingCart model in `mundo-3d` by mapping snake_case database columns to camelCase JavaScript/TypeScript properties, updating related use cases, DTOs, and REST API controllers, and updating the Astro frontend cart store to use the standardized payloads. Backward compatibility will be temporarily maintained via `@deprecated` PascalCase getters.

## Scope

### In Scope
- Rename `ShoppingCart` table columns to snake_case (`id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, `cart_status`) in database.
- Map Sequelize properties to camelCase (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `cartStatus`) via database field mapping.
- Maintain legacy PascalCase getters (`IDCart`, `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, `CartStatus`) marked as `@deprecated` on the model and domain entity.
- Refactor `ShoppingCartDTO` and API endpoints (`GET /api/cart`, `PUT /api/cart`) directly to camelCase payloads.
- Strictly require camelCase (`productId`, `quantity`) in request body payloads for the synchronization endpoint, deprecating the legacy `idProduct` fallback.
- Update the Astro frontend (`frontend/src/store/cart.ts`) background sync payload to send `productId` instead of `idProduct`.
- Retain uppercase `CartStatus` enum values (`ACTIVE`, `ORDERED`, `ABANDONED`) in both database records and domain logic.
- Update Sequelize model associations and TypeScript definitions.
- Adapt repository and use cases to use camelCase properties.
- Keep existing validation limits (1 to 10 quantity, unit price greater than 0) without introducing new validation rules.

### Out of Scope
- Migrating other database models (already completed in Slices 2A and 2B).
- Modifying frontend localStorage schema (which already uses camelCase internally).

## Capabilities

### Modified Capabilities
- `cart-domain`: Standardizes cart entity properties, repo ports, and use cases to camelCase.
- `database-mapping`: Standardizes the `ShoppingCart` database table to use snake_case columns.
- `cart-api`: Standardizes REST API requests and responses to use camelCase payloads.
- `frontend-integration`: Aligns the Astro cart store sync payload with the standardized API contract.

## Approach

1. **Database Schema & Sequelize Model**:
   - Map snake_case columns (`id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, `cart_status`) to camelCase attributes (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `cartStatus`) in `ShoppingCart.js`.
   - Add `@deprecated` PascalCase getter methods on the Sequelize model for backward compatibility.
   - Update associations in `src/database/models/index.js` to use camelCase.
   - Update typings in `src/database/models/db.d.ts`.
2. **Domain Entity**:
   - Update `src/domain/entities/ShoppingCart.ts` to use camelCase properties.
   - Annotate legacy PascalCase getters with `@deprecated` comments.
3. **Application & DTOs**:
   - Refactor `ShoppingCartDTO` interfaces and mapping functions to camelCase.
   - Update `GetCartByUserIdUseCase` and `SyncCartUseCase` to use camelCase attributes.
4. **Repository Layer**:
   - Update `SequelizeShoppingCartRepository` to use camelCase fields for entity mapping and query criteria.
5. **Controller & Routes**:
   - Update `CartApiController` and request validators (`cartValidators.ts`) to expect camelCase attributes (`productId`, `quantity`).
   - Deprecate parsing of legacy `idProduct` fallback in sync endpoint body.
6. **Frontend Astro Cart Store**:
   - Refactor `frontend/src/store/cart.ts` `syncToBackend` function to send `productId` instead of `idProduct` in the request body.
7. **Test Suites**:
   - Update all corresponding backend unit, integration, and security tests to match the camelCase mappings.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/database/models/ShoppingCart.js` | Modified | Map database snake_case fields to Sequelize camelCase attributes; add `@deprecated` legacy getters. |
| `src/database/models/index.js` | Modified | Update associations between `User`, `Product`, and `ShoppingCart` to use camelCase. |
| `src/database/models/db.d.ts` | Modified | Update TypeScript interfaces/typings for `ShoppingCartAttributes` and `ShoppingCartInstance`. |
| `src/domain/entities/ShoppingCart.ts` | Modified | Convert constructor properties to camelCase; add `@deprecated` annotations to legacy getters. |
| `src/application/dtos/ShoppingCartDTO.ts` | Modified | Update DTO interfaces and mapping functions to use camelCase. |
| `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` | Modified | Align query and conversion mapping logic to camelCase. |
| `src/infrastructure/controllers/CartApiController.ts` | Modified | Standardize response payload, validation, and request parsing to camelCase. |
| `src/infrastructure/middlewares/validators/cartValidators.ts` | Modified | Update cart request validation rules to enforce camelCase. |
| `frontend/src/store/cart.ts` | Modified | Update sync API call payload from `idProduct` to `productId`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Development DB Sync issues | Medium | Local database schema sync in development will use Sequelize's `sync({ alter: true })` or migration scripts as appropriate. |
| API integration break with Frontend | Low | Astro frontend store is updated concurrently to use `productId` payload. Existing Astro components already use camelCase internally. |

## Rollback Plan

Restore Sequelize mappings, DTO structures, and repository methods to PascalCase, revert database column alterations, and revert the frontend sync request payload to `idProduct`.

## Dependencies

None.

## Success Criteria

- [ ] Database sync/migration creates the `ShoppingCart` table with snake_case columns.
- [ ] Backend tests for ShoppingCart model, DTOs, use cases, repository, and controller pass.
- [ ] Integration and E2E tests for `/api/cart` run successfully.
- [ ] Legacy PascalCase getters continue to function correctly and log deprecation warnings or carry `@deprecated` annotations.
- [ ] Astro frontend background sync works seamlessly with the new camelCase request contract.
