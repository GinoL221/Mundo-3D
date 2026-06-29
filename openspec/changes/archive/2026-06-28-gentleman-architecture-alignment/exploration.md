# Exploration: Gentleman Architecture Alignment

This exploration details the plan to align the Mundo-3D codebase with Gentleman Programming architecture and clean code principles.

## 1. Barrel Files (index.ts) in Backend & Frontend

### Current State
Backend imports currently target individual files directly (e.g., `import { IUserRepository } from '../../domain/ports/IUserRepository'`).
Frontend imports target flat files like `../store/cart` or `../components/Header.astro`.

### Proposed Alignment
Introduce `index.ts` files to simplify module exports and import statements across standard directories:
- **Backend layers**:
  - `backend/src/domain/entities/index.ts` (exporting all domain entities)
  - `backend/src/domain/ports/index.ts` (exporting all repositories and utility ports)
  - `backend/src/application/use-cases/index.ts` (exporting all application use cases)
- **Frontend folders**:
  - `frontend/src/components/index.ts` (exporting shared layout components)
  - `frontend/src/store/index.ts` (exporting store systems)

---

## 2. Modular Domain Structure in Frontend

### Current State
The frontend is flat, split by technical types (`components/`, `pages/`, `store/`). This leads to low cohesion and high coupling, violating Domain-Driven Design (DDD) principles.

### Proposed Alignment
Establish a `domains/` folder under `frontend/src/` to group code by functional modules:
1. **`src/domains/auth/`**:
   - `pages/Login.astro`, `pages/Register.astro`
   - `services/auth.service.ts`
   - `adapters/auth.adapter.ts`
2. **`src/domains/products/`**:
   - `pages/Products.astro`, `pages/ProductDetail.astro`
   - `components/ProductCard.astro`
   - `services/products.service.ts`
   - `adapters/products.adapter.ts`
3. **`src/domains/cart/`**:
   - `pages/Cart.astro`
   - `components/CartItem.astro`
   - `store/cart.store.ts` (relocated from `src/store/cart.ts`)
   - `services/cart.service.ts`
   - `adapters/cart.adapter.ts`

Astro's file-based routing will remain active by keeping routing wrappers in `src/pages/` that import and render pages from the corresponding domain folders.

---

## 3. Type-Safe Adapter Layer in Frontend

### Current State
Frontend requests parse API responses inline or pass raw backend models (e.g., matching database schemas like `idProduct`, `nameProduct`) directly to store helpers and templates. This couples the client directly to backend naming schemes and lacks type safety.

### Proposed Alignment
Introduce type-safe adapters (e.g., `productAdapter`, `userAdapter`) inside the `adapters/` folder of each domain.
- Define pure interfaces for the client domain entities (`Product`, `User`, `CartItem`) using standard camelCase.
- Map incoming API contracts to these interfaces.
- Ensure that the typescript anti-pattern `any` is strictly avoided; write explicit type contracts for raw API shapes.

---

## 4. Replacing Raw innerHTML with Astro Component Patterns

### Current State
Pages like `index.astro`, `products.astro`, and `cart.astro` inject dynamic content by building raw HTML template strings client-side and setting `container.innerHTML = cards`. This creates XSS risks, scatters presentation logic into client scripts, and compromises component reusability.

### Proposed Alignment
Utilize HTML `<template>` tags coupled with clean Astro components:
- Define Astro components like `ProductCard.astro` and `CartItem.astro`.
- Render these components inside `<template>` elements on the page (e.g., `<template id="product-card-template"><ProductCard isTemplate={true} /></template>`).
- On the client side, clone the template structure (`cloneNode(true)`) and update properties programmatically using `textContent`, `src`, and `href`.
- This keeps visual markup centralized in Astro components while preserving dynamic client hydration.

---

## Technical Options & Tradeoffs

### Approach A: Wrapper Pages with Domain Delegation (Recommended)
- **Description**: Encapsulate pages, components, services, and adapters under `src/domains/<domain>/` and keep thin wrappers in `src/pages/` for routing. Use HTML templates for dynamic client rendering.
- **Pros**: Highly modular, high cohesion, zero configuration hacks, safe from HTML injection vulnerabilities.
- **Cons**: Requires minor boilerplate in routing wrappers.
- **Effort**: Medium

### Approach B: Astro Custom Server Routing
- **Description**: Configure Astro endpoints or middleware to rewrite URLs to target custom directories.
- **Pros**: Keeps all pages entirely outside `src/pages`.
- **Cons**: Extremely complex, fragile during static builds, deviates from standard Astro conventions.
- **Effort**: High

---

## Risks & Mitigation
1. **TypeScript compilation & ESLint strictness**: Since `any` is banned by project rules, all raw API shapes must be typed, and unused variables must be cleaned.
   - *Mitigation*: Define type guard functions and precise TypeScript interfaces for all network responses.
2. **Path Resolution**: Relative import adjustments could break paths.
   - *Mitigation*: Leverage TSConfig aliases or double-check imports via automated tests.
