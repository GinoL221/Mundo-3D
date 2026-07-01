## Exploration: Specialize Mundo-3D for 3D Printing

### Current State
Today, the system features a classic e-commerce model where products have a name, description, price, category, franchise, and image. However, since Mundo-3D is an e-commerce platform specializing in custom 3D printed items (figures, keychains, busts, masks, etc.), the product catalog needs to display additional manufacturing specifications such as material, dimensions (height, width, depth), post-processing finish, and production time.

The current implementation in the working tree has already extended:
1. The domain entity (`Product.ts`) with corresponding validation rules.
2. The database schema definition in Sequelize (`Product.js`) to add new columns (`material`, `height`, `width`, `depth`, `finish`, `productionTime`).
3. The repository (`SequelizeProductRepository.ts`) and use cases to map and transport these specifications.
4. The database seed files to include 17 real products (up from the original sample) representing 3D items with proper dimensions and materials.
5. The Astro frontend to fetch, adapt, and render these specs in a JRPG retro-themed table panel inside the product details page.

### Affected Areas
- `backend/src/domain/entities/Product.ts` — Added properties, validation for height/width/depth/productionTime, and getters.
- `backend/src/database/models/Product.js` — Expanded database attributes mapping to SQLite/MySQL fields.
- `backend/src/database/models/db.d.ts` — Added TypeScript typings for new database attributes.
- `backend/src/infrastructure/repositories/SequelizeProductRepository.ts` — Maps new fields in `toEntity` and database queries.
- `backend/src/application/dtos/ProductDTO.ts` — Updated the DTO interface to include 3D printing properties.
- `backend/src/application/use-cases/` — `CreateProductUseCase.ts`, `UpdateProductUseCase.ts`, `GetLatestProductUseCase.ts`, `GetProductByIdUseCase.ts`, and `ListProductsUseCase.ts` pass and expose 3D printing specs.
- `backend/src/database/seed.js` & `backend/src/database/data/products.json` — Expanded seed files with new categories, franchises, and real 3D product specifications.
- `frontend/src/domains/products/adapters/product.adapter.ts` — Maps 3D details to presentable display strings with fallbacks (e.g. "A consultar") and units ("cm", "días").
- `frontend/src/pages/product.astro` — Renders the "Especificaciones 3D" specs table.
- `frontend/src/pages/products.astro` & `frontend/src/pages/index.astro` — Updates product card height and fallback illustration logic for products with missing images.
- `frontend/src/styles/components/` — Modifies card, grid, and product details styles to accommodate new sizes and spec panels.
- `DB.md` — Need to document the new schema columns (currently missing modification in the workspace).

### Approaches
1. **Direct Attributes on Product Entity (Implemented)** — Adding `material`, `height`, `width`, `depth`, `finish`, and `productionTime` directly to the `Product` schema and domain entity.
   - Pros: Simple, fast querying, clean entity design, maps directly to Sequelize model columns.
   - Cons: Columns are nullable/optional; if the shop lists non-3D-printed items in the future, these fields will be null.
   - Effort: Low (already implemented).

2. **JSON Metadata Column or Specialized Specs Sub-table** — Creating a separate schema / entity table or storing them in a `specifications` JSON block.
   - Pros: Normalizes schema; keeps non-3D-printing attributes segregated.
   - Cons: Higher query complexity (requires joins or JSON parsing), harder to write direct validation rules at the DB level, and deviates from the current clean-architecture repository implementation.
   - Effort: Medium.

### Recommendation
Proceed with **Approach 1 (Direct Attributes)**. Since Mundo-3D is fundamentally specialized in 3D printing, having these fields as first-class attributes on the `Product` entity is architecturally cleaner, aligns with the domain definition, and is already fully coded and verified by passing unit tests.

### Risks
- **Seeding and Migrations**: In production environments, running seed updates might cause conflicts or require migrations if table schemas are not synced manually.
- **Null Safety in UI**: Missing or partially missing values must not break page rendering (handled by the adapter fallback "A consultar").

### Ready for Proposal
Yes. The changes are fully modeled, implemented, and covered by tests. We are ready to propose this change as the official specification.
