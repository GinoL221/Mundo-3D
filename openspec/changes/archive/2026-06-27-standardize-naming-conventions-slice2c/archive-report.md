# Archive Report: Standardize Naming Conventions — ShoppingCart (Slice 2C)

## Metadata
- **Change Name:** `standardize-naming-conventions-slice2c`
- **Archive Date:** 2026-06-27
- **Artifact Store Mode:** hybrid
- **Status:** Archived

## Executive Summary
This change completes the standardization of the naming conventions in the `ShoppingCart` module by moving completely to camelCase properties in the application layers (backend controllers, Astro frontend stores, tests) and snake_case mapping in the database, with legacy PascalCase getters annotated as `@deprecated` to maintain backward compatibility where necessary.

## Slipped Specs Sync
The following delta specifications have been successfully merged into their main counterparts in `openspec/specs/`:
1. **Cart Domain Specification (`openspec/specs/cart-domain/spec.md`):**
   - Integrated the `Requirement: Physical MySQL Database Migration to snake_case` specifying that the database columns must be physically renamed to snake_case (`id_cart`, `id_user`, `id_product`, `quantity`, `unit_price`, `cart_status`) and FK constraints preserved.
2. **Cart Service Specification (`openspec/specs/cart-service/spec.md`):**
   - Integrated the `Requirement: Standardized Sync API Request Payload` requiring strict camelCase properties (specifically `productId` and `quantity`), removing `idProduct` fallback processing, and enforcing validation rejection (HTTP 400).
   - Integrated the `Requirement: Astro Frontend Cart Store Standardized Sync Payload` specifying that `frontend/src/store/cart.ts` must use `productId` instead of `idProduct` in the `syncToBackend` request.

## Completed Tasks Verification
All tasks listed in `tasks.md` were confirmed as completed (`[x]`):
- **TASK-01:** Added `@deprecated` JSDoc to PascalCase getters in `src/database/models/ShoppingCart.js`.
- **TASK-02:** Added `@deprecated` JSDoc to PascalCase getters in `src/domain/entities/ShoppingCart.ts`.
- **TASK-03:** Removed legacy `idProduct` fallback from `src/infrastructure/controllers/CartApiController.ts` and introduced `CartSyncItem`.
- **TASK-04:** Updated frontend cart store sync payload key in `frontend/src/store/cart.ts`.
- **TASK-05:** Updated `CartApiController` tests to assert `productId` and verify removal of `RawCartItem`.
- **TASK-06:** Verified `cartValidators` tests cover `idProduct` rejection.
- **TASK-07:** Verified `apiSecurity` tests have no `idProduct` references.

## Verification Evidence
The verification pass (`verify-report.md`) was completed on 2026-06-27 with **PASS** status:
- Static analysis & linting: Passed (`npm run lint`).
- TypeScript compilation: Passed (`npx tsc --noEmit`).
- Astro Frontend Build: Passed (`npm run build`).
- Unit/Integration tests: 244/244 tests passed (`npm test` including `ShoppingCartModel.test.js`, `DomainEntities.test.ts`, `CartApiController.test.ts`, `cartValidators.test.ts`, and `apiSecurity.test.js`).

## Final Archive Location
- `/home/ginopc/Desarrollo/Mundo-3D/openspec/changes/archive/2026-06-27-standardize-naming-conventions-slice2c`
