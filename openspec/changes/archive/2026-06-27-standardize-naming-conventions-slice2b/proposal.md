# Proposal: Standardize Naming Conventions for Product Model (Slice 2B)

## Intent
Standardize the casing conventions for the core Product model in `mundo-3d` by mapping snake_case database columns to camelCase JavaScript/TypeScript properties, updating related domain entities, repositories, DTOs, use cases, and frontend Astro catalog pages. This ensures consistent coding standards across the project and maintains backward compatibility via temporary legacy PascalCase getters.

## Scope

### In Scope
- **Database & Model Schema Mapping**: Map database columns for `Product` to snake_case (`id_product`, `name_product`, `price`, `description_product`, `image`, `id_category`, `id_franchise`) and model properties to camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`) via database field mappings in `src/database/models/Product.js`.
- **Legacy Compatibility Getters**: Retain PascalCase getters (`IDProduct`, `NameProduct`, `Price`, `DescriptionProduct`, `Image`, `IDCategory`, `IDFranchise`) on both the Sequelize model and the `Product` domain entity to support unrefactored models (such as `ShoppingCart`).
- **Domain Validation**: Enforce that the product price must be strictly greater than 0.00 in the domain layer (`Product` entity validation or constructor logic, and validator functions).
- **API Response Payload Transition**: Perform a clean break to camelCase on JSON API payloads returned from `/api/products` and update the Astro frontend components to handle camelCase properties directly.
- **Astro Frontend Updates**: Update `frontend/src/pages/index.astro`, `frontend/src/pages/products.astro`, and other frontend files to access camelCase product properties and implement visual fallback rendering for missing product images (i.e. no default fallback image is enforced in the backend).
- **Sequelize Foreign Key Mapping**: Map the foreign key `IDProduct` to `field: 'id_product'` in `ShoppingCart` model definition and associations for backward compatibility during the transition.
- **TypeScript Model Declarations**: Align `src/database/models/db.d.ts` interfaces (`ProductAttributes` and `ProductInstance`) to use camelCase while including optional legacy PascalCase keys.
- **Tests**: Adjust all unit and integration tests (models, repositories, use cases, API controllers) to expect camelCase properties and verify domain validations.

### Out of Scope
- Refactoring the transactional `ShoppingCart` model and its domain properties (deferred to Slice 2C).
- Permanent deletion of legacy PascalCase getters (deferred to post-Slice 2C cleanup).

## Capabilities

### Modified Capabilities
- `product-domain`: Standardizes the `Product` domain entity, repository port, DTOs, and use cases to use camelCase attributes and enforce core validation.
- `database-mapping`: Standardizes database column mapping for the `Product` table using snake_case names.
- `astro-catalog`: Direct migration of the Astro product catalog UI to consume standard camelCase APIs.

## Approach
1. **Model and Database Migration**: Renaming database columns for `Product` to snake_case. Adding Sequelize mappings to map fields to camelCase properties, retaining the legacy getters on `Product.js`.
2. **Domain Entity Refactoring**: Ensuring `src/domain/entities/Product.ts` attributes are in camelCase, adding domain validation to reject prices `<= 0.00`, and preserving legacy getters.
3. **Foreign Key Bridging**: Update `ShoppingCart.js` FK mapping to map `IDProduct` to `field: 'id_product'` so that the database join association remains intact during the transition.
4. **Use Case and DTO Adaptation**: Transitioning input interfaces and outputs in `ListProductsUseCase`, `CreateProductUseCase`, `UpdateProductUseCase`, `GetProductByIdUseCase`, etc., to use camelCase fields.
5. **API & Frontend Update**: Adjusting Astro templates (`index.astro`, `products.astro`, `product.astro`) to read camelCase properties from API responses and adding local image fallbacks if the image is missing.
6. **Tests**: Updating Jest tests and asserting correct camelCase response shapes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/database/models/Product.js` | Modified | Map database snake_case fields to Sequelize camelCase attributes and preserve legacy getters. |
| `src/database/models/ShoppingCart.js` | Modified | Update `IDProduct` association field mapping to `id_product`. |
| `src/database/models/db.d.ts` | Modified | Update Product typings to camelCase. |
| `src/domain/entities/Product.ts` | Modified | Convert constructor properties to camelCase, add price validation (`> 0.00`), and preserve legacy getters. |
| `src/application/dtos/ProductDTO.ts` | Modified | Convert properties to camelCase. |
| `src/application/dtos/ShoppingCartDTO.ts` | Modified | Convert nested product properties to camelCase. |
| `src/application/use-cases/` | Modified | Update `CreateProductUseCase`, `UpdateProductUseCase`, `GetLatestProductUseCase`, `GetProductByIdUseCase`, `ListProductsUseCase`, and `SyncCartUseCase`. |
| `src/infrastructure/repositories/SequelizeProductRepository.ts` | Modified | Update repository queries and data mapping to camelCase. |
| `frontend/src/pages/index.astro` | Modified | Reference camelCase attributes, handle image fallback locally. |
| `frontend/src/pages/products.astro` | Modified | Reference camelCase attributes, handle image fallback locally. |
| `src/database/models/__tests__/ProductModel.test.js` | Modified | Assert camelCase property mappings, legacy getters, and associations. |
| `src/application/__tests__/DomainEntities.test.ts` | Modified | Verify camelCase constructor properties and price validation. |
| `src/application/__tests__/CreateProductUseCase.test.ts` | Modified | Assert camelCase inputs/outputs and mock product entities. |
| `src/application/__tests__/UpdateProductUseCase.test.ts` | Modified | Assert camelCase inputs/outputs and mock product entities. |
| `src/application/__tests__/GetProductByIdUseCase.test.ts` | Modified | Assert camelCase inputs/outputs and mock product entities. |
| `src/application/__tests__/ListProductsUseCase.test.ts` | Modified | Assert camelCase inputs/outputs and mock product entities. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cart functionality breaks | Medium | Map `ShoppingCart` foreign key `IDProduct` explicitly to `id_product` database column. |
| Missing image breaks UI | Low | Astro frontend template will provide a visual placeholder fallback if the image property is null/empty. |
| Validation failures on legacy data | Low | Verify that database seeding and existing records satisfy price validation requirements (`price > 0.00`). |

## Rollback Plan
Restore the modified files to their original state using `git restore`. Revert database migration scripts using the migrate down script.

## Success Criteria
- [ ] Database columns for the `Product` table are updated to snake_case.
- [ ] Model attributes for `Product` map database columns to camelCase attributes.
- [ ] Domain entity `Product` validates that prices are strictly greater than `0.00`.
- [ ] API responses are converted to camelCase.
- [ ] Astro frontend compiles and successfully renders product listings with local image fallbacks.
- [ ] All unit, repository, integration, and E2E tests pass.
