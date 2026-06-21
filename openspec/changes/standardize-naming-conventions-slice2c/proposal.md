# Proposal: Standardize Naming Conventions for ShoppingCart Model (Slice 2C)

## Intent

Standardize casing conventions for the ShoppingCart model in `mundo-3d` by mapping snake_case database columns to camelCase JavaScript/TypeScript properties, updating related use cases, DTOs, and REST API controllers, while ensuring backward compatibility via legacy PascalCase getters.

## Scope

### In Scope
- Rename `ShoppingCart` table columns to snake_case (`id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, `cart_status`).
- Map Sequelize properties to camelCase (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `cartStatus`) via database field mapping.
- Maintain legacy PascalCase getters (`IDCart`, `IDUser`, `IDProduct`, `Quantity`, `UnitPrice`, `CartStatus`) on the model and domain entity.
- Refactor `ShoppingCartDTO` and API endpoints (`GET /api/cart`, `PUT /api/cart`) directly to camelCase payloads.
- Retain uppercase `CartStatus` enum values (`ACTIVE`, `ORDERED`, `ABANDONED`).
- Update Sequelize model associations and types.
- Adapt repository and use cases to use camelCase properties.

### Out of Scope
- Migrating other models (already completed in Slices 2A and 2B).
- Changing frontend localStorage schema (already uses camelCase).

## Capabilities

### Modified Capabilities
- `cart-domain`: Standardizes cart entity properties, repo ports, and use cases to camelCase.
- `database-mapping`: Standardizes the `ShoppingCart` database table to use snake_case columns.
- `cart-api`: Standardizes REST API requests and responses to use camelCase payloads.

## Approach

We will map snake_case database fields to camelCase properties in `ShoppingCart.js`. Legacy PascalCase getters will be added for backward compatibility. Associations in `index.js` for `User` and `Product` will be updated to camelCase. `ShoppingCartDTO`, `GetCartByUserIdUseCase`, `SyncCartUseCase`, and `SequelizeShoppingCartRepository` will be refactored to use camelCase. API endpoints will directly consume and return camelCase fields. Development DB schema updates will be applied via `npm run db:reset` and Sequelize `sync({ alter: true })`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/database/models/ShoppingCart.js` | Modified | Map database snake_case fields to Sequelize camelCase attributes; add legacy getters. |
| `src/database/models/index.js` | Modified | Update associations between `User`, `Product`, and `ShoppingCart` to use camelCase. |
| `src/database/models/db.d.ts` | Modified | Update typings for `ShoppingCartAttributes` and `ShoppingCartInstance`. |
| `src/domain/entities/ShoppingCart.ts` | Modified | Convert constructor properties to camelCase; add legacy getters. |
| `src/application/dtos/ShoppingCartDTO.ts` | Modified | Update DTO interfaces and mapping functions to camelCase. |
| `src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` | Modified | Align query and conversion mapping logic to camelCase. |
| `src/infrastructure/controllers/CartApiController.ts` | Modified | Standardize response and payload parsing to camelCase. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Data loss during DB reset | High (dev only) | Reset is standard for local dev; seed scripts will repopulate tables. |
| API integration break | Med | The Astro frontend cart store already uses camelCase locally, reducing risk. |

## Rollback Plan

Restore Sequelize mappings, DTO structures, and repository methods to PascalCase, revert database column changes.

## Dependencies

None.

## Success Criteria

- [ ] Database sync creates the `ShoppingCart` table with snake_case columns.
- [ ] Backend tests for ShoppingCart model, DTOs, use cases, repository, and controller pass.
- [ ] Integration and E2E tests for `/api/cart` run successfully.
- [ ] Legacy PascalCase getters continue to function correctly.
