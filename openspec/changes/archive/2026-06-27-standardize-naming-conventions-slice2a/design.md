# Technical Design: Naming Conventions Standardization (Slice 2A - Category & Franchise)

This document outlines the technical design for standardizing the `Category` and `Franchise` lookup models and their associations to use camelCase attributes dynamically mapped to snake_case database columns. This includes updating related DTOs, use cases, frontend pages, tests, and defining the physical database migrations.

## Technical Approach

### 1. Database Migration
To transition the database schema on disk to the new standard, we need to physically rename the columns of the `Category`, `Franchise`, and `Product` tables in MySQL/MariaDB.
The migration must:
- Rename existing columns to snake_case (`id_category`, `name_category` for Category; `id_franchise`, `name_franchise` for Franchise).
- Rename foreign keys in the `Product` table to `id_category` and `id_franchise`.
- Preserve existing data.
- Manage foreign key constraints safely during the execution.

#### SQL Migration Script
```sql
-- Disable foreign key checks to prevent lock/constraint errors during column rename
SET FOREIGN_KEY_CHECKS = 0;

-- Rename Category table columns
ALTER TABLE `Category` RENAME COLUMN `IDCategory` TO `id_category`;
ALTER TABLE `Category` RENAME COLUMN `NameCategory` TO `name_category`;

-- Rename Franchise table columns
ALTER TABLE `Franchise` RENAME COLUMN `IDFranchise` TO `id_franchise`;
ALTER TABLE `Franchise` RENAME COLUMN `NameFranchise` TO `name_franchise`;

-- Rename foreign key columns in Product table
ALTER TABLE `Product` RENAME COLUMN `IDCategory` TO `id_category`;
ALTER TABLE `Product` RENAME COLUMN `IDFranchise` TO `id_franchise`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
```

*Note:* In local development environments, Sequelize's automatic schema sync (`sequelize.sync({ alter: true })` in `index.js`) or executing a database reset via `node src/database/reset-db.js` followed by starting the server will automatically align the database schema with the model definitions.

---

### 2. Model Mapping & TypeScript Declarations

- **Category & Franchise Models:**
  `src/database/models/Category.js` and `src/database/models/Franchise.js` are already implemented using camelCase attributes mapped to snake_case fields with legacy getters for transition compatibility.
  
- **Product Model:**
  `src/database/models/Product.js` is also already configured with `idCategory` and `idFranchise` mapped to `id_category` and `id_franchise` fields, and has legacy getters.

- **TypeScript Definitions (`src/database/models/db.d.ts`):**
  The types `CategoryAttributes`, `FranchiseAttributes`, and `ProductAttributes` already define both camelCase and legacy PascalCase attributes as optional. No modifications are needed here.

---

### 3. DTOs & Use Cases (Application Layer)

The main application-level change is changing the flat category name property on the product response payload from PascalCase `Category` to camelCase `category`.

#### File Modifications:

1. **`src/application/dtos/ProductDTO.ts`**
   - Change property `Category: string` to `category: string`.
   - Ensure **no `any` types** are used in this file.

```typescript
export interface ProductDTO {
  idProduct: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
  idCategory: number;
  idFranchise: number;
  category: string; // CamelCase property for category name representation
}
```

2. **Use Cases Mapping Update:**
   We must update the returned object keys in all use cases returning `ProductDTO` to map the category name to `category`:
   - `src/application/use-cases/ListProductsUseCase.ts` (maps `category: categoryName`)
   - `src/application/use-cases/CreateProductUseCase.ts` (maps `category: categoryName`)
   - `src/application/use-cases/GetLatestProductUseCase.ts` (maps `category: categoryName`)
   - `src/application/use-cases/GetProductByIdUseCase.ts` (maps `category: categoryName`)
   - `src/application/use-cases/UpdateProductUseCase.ts` (maps `category: categoryName`)

---

### 4. Frontend Integration

The Astro frontend templates must be updated to consume the new camelCase `product.category` key.

#### File Modifications:

1. **`frontend/src/pages/index.astro`**
   - Line 122: Change `const catName = product.Category || 'Otras';` to `const catName = product.category || 'Otras';`.

2. **`frontend/src/pages/products.astro`**
   - Line 53: Change `const catName = product.Category || 'Otras';` to `const catName = product.category || 'Otras';`.

---

### 5. Domain & Infrastructure layers

- **Domain Entities (`Category.ts`, `Franchise.ts`):** Already using camelCase.
- **Repository Ports (`ICategoryRepository.ts`, `IFranchiseRepository.ts`):** Already using camelCase.
- **Repositories (`SequelizeCategoryRepository.ts`, `SequelizeFranchiseRepository.ts`):** Already using camelCase queries and instance properties.

No changes required here.

---

## Architecture Decisions

- **Keep Legacy Model Getters:** We keep the Sequelize `getterMethods` (`IDCategory`, `NameCategory`, etc.) intact for backward compatibility until all slices are fully migrated and legacy references are eliminated.
- **Strict Compliance with Gentleman-Book Rules:** Avoid any use of `any` in TypeScript files edited or created during this slice. Type parameters cleanly, using `unknown` or specific types/interfaces.

---

## Testing Strategy

All use case tests asserting `ProductDTO` properties must be updated to expect `category` instead of `Category`:

1. **`src/application/__tests__/CreateProductUseCase.test.ts`**
   - Change assertions on `.Category` to `.category`.
2. **`src/application/__tests__/GetLatestProductUseCase.test.ts`**
   - Change assertions on `.Category` to `.category`.
3. **`src/application/__tests__/GetProductByIdUseCase.test.ts`**
   - Change assertions on `.Category` to `.category`.
4. **`src/application/__tests__/ListProductsUseCase.test.ts`**
   - Change assertions on `.Category` to `.category`.
5. **`src/application/__tests__/UpdateProductUseCase.test.ts`**
   - Change assertions on `.Category` to `.category`.

### Execution
Run the tests using the command:
```bash
pnpm test
```

---

## Rollback Plan

In case of failure:
1. Revert all file changes in Git.
2. If MySQL database columns were renamed physically on a production/staging database, run the reverse migration:
```sql
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE `Category` RENAME COLUMN `id_category` TO `IDCategory`;
ALTER TABLE `Category` RENAME COLUMN `name_category` TO `NameCategory`;
ALTER TABLE `Franchise` RENAME COLUMN `id_franchise` TO `IDFranchise`;
ALTER TABLE `Franchise` RENAME COLUMN `name_franchise` TO `NameFranchise`;
ALTER TABLE `Product` RENAME COLUMN `id_category` TO `IDCategory`;
ALTER TABLE `Product` RENAME COLUMN `id_franchise` TO `IDFranchise`;
SET FOREIGN_KEY_CHECKS = 1;
```

---

## Open Questions

None.
