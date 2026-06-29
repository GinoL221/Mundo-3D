# Tasks: Gentleman Architecture Alignment

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Breakdown

### Phase 1: Backend Barrels
- [x] Create `backend/src/domain/entities/index.ts` to export all backend domain entities.
- [x] Create `backend/src/domain/ports/index.ts` to export all backend domain ports.
- [x] Create `backend/src/application/use-cases/index.ts` to export all backend application use cases.

### Phase 2: Frontend Auth Domain
- [x] Create `frontend/src/domains/auth/adapters/auth.adapter.ts` to map authentication network schemas.
- [x] Create `frontend/src/domains/auth/services/auth.service.ts` to handle API login and registration.
- [x] Extract login UI to `frontend/src/domains/auth/components/LoginForm.astro`.
- [x] Extract registration UI to `frontend/src/domains/auth/components/RegisterForm.astro`.
- [x] Create `frontend/src/domains/auth/index.ts` barrel file to expose components, services, and adapters.
- [x] Modify `frontend/src/pages/login.astro` to delegate to the new `LoginForm` component.
- [x] Modify `frontend/src/pages/register.astro` to delegate to the new `RegisterForm` component.

### Phase 3: Frontend Products Domain
- [x] Create `frontend/src/domains/products/adapters/product.adapter.ts` to map database products to frontend models.
- [x] Create `frontend/src/domains/products/components/ProductCard.astro` as the Astro template component.
- [x] Create `frontend/src/domains/products/index.ts` barrel file to expose products adapters and components.
- [x] Refactor `frontend/src/pages/product.astro` using products adapters and safe DOM bindings.
- [x] Refactor `frontend/src/pages/products.astro` using Astro templates and products adapters.

### Phase 4: Frontend Cart Domain
- [x] Create `frontend/src/domains/cart/services/CartService.ts` encapsulating state, sync, and storage.
- [x] Create `frontend/src/domains/cart/components/CartList.astro` for cart UI rendering and templates.
- [x] Create `frontend/src/domains/cart/index.ts` barrel file exporting the cart service and list component.
- [x] Modify `frontend/src/pages/cart.astro` to delegate to `domains/cart`.
- [x] Update `frontend/src/components/Header.astro` to import from the barrel and use `CartService`.
- [x] Delete legacy `frontend/src/store/cart.ts` file.

### Phase 5: Verification
- [x] Verify zero TypeScript compilation errors across backend and frontend directories.
- [x] Run ESLint to ensure strict linting compliance with no warnings or errors.
- [x] Execute Playwright E2E tests to validate complete cart and authentication flows.
