# Proposal: Standardize Naming Conventions for Product Model (Slice 2B)

## Intent

Standardize the casing conventions for the Product model in `mundo-3d` by mapping snake_case database columns to camelCase JavaScript/TypeScript properties, resolving frontend client-side parsing issues, and ensuring backward compatibility with legacy getters.

## Scope

### In Scope
- Rename database columns in `Product` table to snake_case (`id_product`, `name_product`, `price`, `description_product`, `image`, `id_category`, `id_franchise`).
- Map Sequelize properties to camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`) via database field mapping.
- Maintain legacy PascalCase/camelCase getters on the `Product` model/entity for backward compatibility.
- Map `ShoppingCart` foreign key `IDProduct` to `field: 'id_product'` temporarily.
- Correct client-side scripts in Astro pages (`products.astro` and `index.astro`) to handle the `{ count, products, countByCategory }` response format.
- Adjust associated use cases, repositories, models, and validator tests.

### Out of Scope
- Migrating `ShoppingCart` model structure or fields (Slice 2C task).
- Rewriting full backend API to completely drop legacy properties (must retain getters).

## Capabilities

### Modified Capabilities
- `product-domain`: Estandariza la entidad y repositorio de `Product` a camelCase/snake_case.
- `database-mapping`: Estandariza la tabla `Product` con nombres snake_case.
- `astro-catalog`: Corrige la respuesta esperada de `/api/products` en la UI de Astro.

## Approach

Rename `Product` table columns to snake_case (`id_product`, etc.). Configure Sequelize's `Product` model to map these fields to camelCase properties. Keep legacy getters (`IDProduct`, `NameProduct`, etc.) on the domain entity. In `ShoppingCart.js`, map `IDProduct` to the database field `id_product` to keep associations working. Update client-side fetch calls in `products.astro` and `index.astro` to read from `resData.products`. Keep image as filename only, and price as number type in TS.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/entities/Product.ts` | Modified | Update properties to camelCase and add backward-compatible getters. |
| `src/database/models/Product.js` | Modified | Map database snake_case fields to Sequelize camelCase attributes. |
| `src/database/models/ShoppingCart.js` | Modified | Update `IDProduct` field mapping to `id_product`. |
| `src/infrastructure/repositories/SequelizeProductRepository.ts` | Modified | Update query/persistence mapping for camelCase fields. |
| `frontend/src/pages/products.astro` | Modified | Parse `resData.products` array and adapt attribute usage. |
| `frontend/src/pages/index.astro` | Modified | Parse `resData.products` array and adapt attribute usage. |
| `src/application/use-cases/` | Modified | Adjust `ListProductsUseCase`, `CreateProductUseCase`, etc., for camelCase fields. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cart functionality breakage | Med | Explicitly map `ShoppingCart.js` FK `IDProduct` to `id_product`. |
| Astro page rendering failure | Med | Update all client-side scripts referencing `/api/products`. |

## Rollback Plan

Revert database migrations, restore Sequelize mappings to legacy names, and revert Astro files.

## Dependencies

None.

## Success Criteria

- [ ] Database migration runs successfully.
- [ ] Backend tests for products and categories pass.
- [ ] Frontend Astro catalog page renders products list correctly.
- [ ] `ShoppingCart` relation remains intact.
