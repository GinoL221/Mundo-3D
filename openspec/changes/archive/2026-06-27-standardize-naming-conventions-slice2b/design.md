# Technical Design: Product Model Naming Convention Standardization (Slice 2B)

## Overview
This document details the technical design and architectural approach for standardizing the core `Product` model casing conventions in `mundo-3d`. The goal is to align database columns to snake_case while maintaining camelCase properties at the application level (Domain, DTOs, Use Cases, Controller, Frontend) and providing legacy PascalCase getters for backward compatibility with unrefactored models (like `ShoppingCart`).

## Architectural Decisions & Data Flow

### 1. Database Mapping Casing Standardization
- **Database Layer**: All columns in the `Product` table must follow `snake_case` naming rules.
- **Sequelize Layer**: The `Product` model attributes will be defined in `camelCase`, and the `field` option will map them to their corresponding `snake_case` columns in the database.
- **Legacy Support**: We preserve PascalCase getters (`IDProduct`, `NameProduct`, etc.) on both the Sequelize model and the domain entity to support backward compatibility.

### 2. Domain Validation Rule
- The `Product` domain entity constructor (`src/domain/entities/Product.ts`) will enforce that the `price` property is strictly positive (`price > 0.00`). If it is not, an error will be thrown to prevent invalid instances from propagating through the application.

### 3. API Response Payload Casing Transition
- The REST API will expose standard camelCase properties for `ProductDTO`.
- Specifically, the category name property returned in API payloads is updated from capitalized `Category` to lowercase `category` to align with camelCase conventions.

### 4. Astro Frontend Image Fallback Handling
- The Astro templates (`index.astro`, `products.astro`) will consume camelCase properties from the API.
- For visual resilience, templates must handle missing categories by mapping them to `'Otras'` (using `/images/illustrations/Otras.png` illustration).
- To handle broken links or missing custom illustrations, `img` tags will implement inline `onerror` fallback handlers pointing to `/images/illustrations/Otras.png`.

---

## Database Migration Design
A new migration file `src/database/migrations/20260627-rename-product-columns.sql` will be created to rename existing columns in the database.

```sql
-- Disable foreign key checks to prevent lock/constraint errors during column rename
SET FOREIGN_KEY_CHECKS = 0;

-- Rename Product table columns
ALTER TABLE `Product` RENAME COLUMN `IDProduct` TO `id_product`;
ALTER TABLE `Product` RENAME COLUMN `NameProduct` TO `name_product`;
ALTER TABLE `Product` RENAME COLUMN `Price` TO `price`;
ALTER TABLE `Product` RENAME COLUMN `DescriptionProduct` TO `description_product`;
ALTER TABLE `Product` RENAME COLUMN `Image` TO `image`;

-- Rename foreign key column in ShoppingCart table
ALTER TABLE `ShoppingCart` RENAME COLUMN `IDProduct` TO `id_product`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
```

---

## Detailed File Modifications

### 1. Domain Layer

#### `src/domain/entities/Product.ts`
- Add validation logic to the constructor of the `Product` entity:
```typescript
constructor(
  public readonly idProduct: number,
  public readonly nameProduct: string,
  public readonly price: number,
  public readonly descriptionProduct: string | null,
  public readonly image: string | null,
  public readonly idCategory: number,
  public readonly idFranchise: number,
  public readonly Category?: Category,
  public readonly Franchise?: Franchise
) {
  if (price <= 0.00) {
    throw new Error('Price must be greater than 0.00');
  }
}
```

### 2. Frontend Layer

#### `frontend/src/pages/products.astro`
- Update the dynamically generated product card template in the script tag to support an `onerror` event handler on category images:
```diff
       const cards = products.map((product: any) => {
         const catName = product.category || 'Otras';
         const catImg = getCategoryImg(catName);
         return `
           <article class="product-card">
             <a href="/product?id=${product.idProduct}">
-              <img src="/images/illustrations/${catImg}.png" alt="${catName}" class="product-card__category-img" />
+              <img src="/images/illustrations/${catImg}.png" alt="${catName}" class="product-card__category-img" onerror="this.onerror=null; this.src='/images/illustrations/Otras.png';" />
               <div class="product-card__body">
                 <h3>${product.nameProduct}</h3>
                 <p class="price">$${product.price}</p>
```

### 3. Testing Layer

#### `src/application/__tests__/DomainEntities.test.ts`
- Add test assertions to verify that invalid product price values throw an error:
```typescript
it('should throw an error when price is less than or equal to 0.00', () => {
  expect(() => {
    new Product(1, 'Test Product', 0.00, 'Desc', 'img.png', 1, 2);
  }).toThrow('Price must be greater than 0.00');

  expect(() => {
    new Product(1, 'Test Product', -1.50, 'Desc', 'img.png', 1, 2);
  }).toThrow('Price must be greater than 0.00');
});
```

---

## Verification Plan

### Manual Verification
1. Run local development servers for backend and frontend.
2. Visit `http://localhost:4321/` and check product rendering.
3. Test that products with missing category strings display the 'Otras' illustration.
4. Test image fallback rendering by simulating a broken image source or testing with custom illustrations that do not exist in the public folder.

### Automated Testing
- Run all tests using `npm run test` to verify domain logic, repositories, use cases, API controllers, and mock expectations.
```bash
npm run test
```
