# Proposal: Specialize Mundo-3D for 3D Printing

## Intent

Extend the product catalog to support custom 3D printing specifications (material, dimensions, finish, and production time) to transition Mundo-3D into a specialized 3D printing e-commerce platform.

## Scope

### In Scope
- Add properties (`material`, `height`, `width`, `depth`, `finish`, `productionTime`) to `Product` domain entity and database schema.
- Validate `material` to accept: 'PLA', 'Resina', 'PETG', 'Flex' or strings starting with 'Otros: '.
- Validate `productionTime` with a maximum limit of 30 days.
- Update frontend adapter (`product.adapter.ts`) to format specs; missing dimensions display as "no definida" if at least one is defined, otherwise fallback to "A consultar".
- Render specs table on product details page.

### Out of Scope
- Database migrations (database uses Sequelize `sync({ alter: true })`).
- Multi-currency or shipping cost calculator based on dimensions.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `product`: Extend product schema, validation rules (material, production time), and frontend formatting/fallbacks for dimensions.
- `product-validators`: Update request/form validators for products to allow 3D printing attributes.

## Approach

1. **Domain Entity**: Update `Product.ts` to include 3D printing properties and validations (`productionTime <= 30`, `material` in allowed list or prefix `'Otros: '`).
2. **Sequelize Model**: Add columns to `Product.js` model and update `db.d.ts` and repository.
3. **Frontend Adapter**: Update `product.adapter.ts` to implement the fallback conditional logic for dimensions.
4. **UI Components**: Embed specs table inside product details (`product.astro`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/domain/entities/Product.ts` | Modified | Add validation logic for material and productionTime. |
| `backend/src/database/models/Product.js` | Modified | Add column configurations for 3D properties. |
| `backend/src/infrastructure/repositories/SequelizeProductRepository.ts` | Modified | Map 3D properties to/from database. |
| `frontend/src/domains/products/adapters/product.adapter.ts` | Modified | Adapt dimensions fallback and format strings. |
| `frontend/src/pages/product.astro` | Modified | Render the specifications UI panel. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Invalid input via forms | Low | Express validators align with Domain constraints. |
| DB Sync Failure | Low | Verify column structure using tests. |

## Rollback Plan

Revert git changes to previous commit (clean working directory using `git restore` / `git checkout`).

## Dependencies

None

## Success Criteria

- [ ] Domain entity validates material (`PLA`, `Resina`, `PETG`, `Flex`, or `Otros: *`) and production time (<= 30 days).
- [ ] Frontend displays missing dimensions as "no definida" if at least one dimension is present, else "A consultar".
- [ ] Product page renders 3D specifications cleanly.
