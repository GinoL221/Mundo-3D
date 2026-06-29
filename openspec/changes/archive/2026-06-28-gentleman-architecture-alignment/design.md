# Technical Design: Gentleman Architecture Alignment

This document outlines the technical design for aligning the Mundo-3D codebase with Gentleman Programming architecture.

## Technical Approach

We will restructure the application by delegating routing pages to thin wrappers, segregating codebase features into distinct domain modules under `frontend/src/domains/`, and implementing type-safe data adapters to insulate the UI from the database schema. Dynamic template rendering on the client will use Astro `<template>` tags and safe DOM modification.

## Architecture Decisions

| Option | Tradeoff | Decision |
| :--- | :--- | :--- |
| **Barrel exports (`index.ts`)** vs Direct imports | Simplifies imports, but can cause circular dependencies. | Use barrel exports (`index.ts`) with named exports to prevent circular/dead code references. |
| **Page wrappers with domain delegation** vs Monolithic routing | Increases file count slightly, but keeps route controllers separated from implementation. | Implement pages under `src/pages/` as thin layouts delegating to `src/domains/`. |
| **HTML `<template>` cloning** vs `innerHTML` | Eliminates XSS and centralizes CSS, but requires more DOM query selectors. | Swap all `innerHTML` injections for template cloning and `textContent`/`src`/`href` hydration. |

## Data Flow

```
[API Endpoint] 
      │ (Raw API Model: idProduct, nameProduct)
      ▼
[API Adapter] 
      │ (Maps to Frontend Model: id, name)
      ▼
[CartService / State] (Nanostores / LocalStorage)
      │
      ▼
[Astro Templates (cloned Node)] ──► [DOM rendering (textContent)]
```

## File Changes

### New Files
- `backend/src/domain/entities/index.ts` - Exports all backend domain entities.
- `backend/src/domain/ports/index.ts` - Exports all backend domain ports.
- `backend/src/application/use-cases/index.ts` - Exports all backend application use cases.
- `frontend/src/domains/auth/index.ts` - Barrel file for authentication domain.
- `frontend/src/domains/auth/adapters/auth.adapter.ts` - Maps authentication network schemas.
- `frontend/src/domains/auth/services/auth.service.ts` - Handles API requests for login/register.
- `frontend/src/domains/auth/components/LoginForm.astro` - Extracted login form component.
- `frontend/src/domains/auth/components/RegisterForm.astro` - Extracted register form component.
- `frontend/src/domains/products/index.ts` - Barrel file for products domain.
- `frontend/src/domains/products/adapters/product.adapter.ts` - Maps database-style products to client models.
- `frontend/src/domains/products/components/ProductCard.astro` - Astro template component for a product.
- `frontend/src/domains/cart/index.ts` - Barrel file for cart domain.
- `frontend/src/domains/cart/services/CartService.ts` - Encapsulates Nanostores state, backend sync, and local storage.
- `frontend/src/domains/cart/components/CartList.astro` - List rendering container and Astro template definitions.

### Modified Files
- `frontend/src/pages/cart.astro` - Delegates rendering to `domains/cart`.
- `frontend/src/pages/login.astro` - Renders `LoginForm` component from `domains/auth`.
- `frontend/src/pages/register.astro` - Renders `RegisterForm` component from `domains/auth`.
- `frontend/src/pages/product.astro` - Uses type-safe product adapter and safe DOM text bindings.
- `frontend/src/pages/products.astro` - Uses `<template id="product-card-template">` and adapter.
- `frontend/src/components/Header.astro` - Uses standard barrel imports and central `CartService`.

### Deleted Files
- `frontend/src/store/cart.ts` - Extracted and relocated to `domains/cart/services/CartService.ts`.

## Interfaces / Contracts

```typescript
// frontend/src/domains/products/adapters/product.adapter.ts
export interface APIProduct {
  idProduct: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
  category?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
}

// frontend/src/domains/cart/services/CartService.ts
export interface CartItem {
  productId: number;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
}

export interface APICartSyncPayload {
  items: {
    productId: number;
    quantity: number;
  }[];
}
```

## Testing Strategy

- **Unit Tests**:
  - Test product and auth adapters mapping with valid, empty, and malformed inputs.
  - Test `CartService` state operations (add, remove, clear, sync revert).
- **Integration Tests**:
  - Verify template cloning selectors mapping to Astro template IDs.
- **End-to-End Tests**:
  - Verify cart flow (add item, view cart, adjust quantities, sync network success/failure) using Playwright.

## Migration / Rollout

1. Implement backend barrels.
2. Build frontend domains folders, code adapters, services, and new Astro components.
3. Migrate `cart.ts` store logic into `CartService.ts`.
4. Refactor routing pages (`src/pages/*`) to act as thin delegation wrappers.
5. Replace DOM raw HTML updates with safe template-cloning client-side script blocks.
6. Verify code compiles with zero ESLint/TS errors and run the test suite.
