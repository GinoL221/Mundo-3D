# Static Pages Controller Specification

## Purpose

Define the HTTP-level contract for the static/main routes (`/`, `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`) after their controllers and routing are migrated from plain JavaScript (`src/controllers/main/*.js`, `src/routes/mainRoutes.js`) to TypeScript infrastructure (`StaticPagesController.ts`, `staticPagesRoutes.ts`). This spec governs architecture and behavior parity, not visual/CSS concerns (those are covered by `footer-pages` and `dynamic-homepage`).

## Requirements

### Requirement: Pure-Render Static Page Parity

The system MUST serve `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` via `StaticPagesController` (TypeScript), each rendering the same view it rendered before migration, with identical HTTP status and no behavioral change.

#### Scenario: Static page renders unchanged

- GIVEN a client requests one of `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`
- WHEN the request is handled by `StaticPagesController`
- THEN the response MUST be HTTP 200
- AND the response MUST render the same view name that the legacy `main/*.js` controller rendered for that path

#### Scenario: No domain or application layer for pure-render pages

- GIVEN any of the five pure-render pages (`aboutUs`, `faq`, `help`, `privacy`, `stepByStep`, `terms`)
- WHEN its controller method executes
- THEN it MUST perform only a view render (no use-case invocation, no domain entity, no repository call)

### Requirement: Home Route Product Listing

The system MUST serve `/` by rendering the `index` view with products obtained from `ListProductsUseCase`, replacing the legacy direct call to `productService.js`.

#### Scenario: Home renders products on success

- GIVEN `ListProductsUseCase.execute()` resolves with a list of products
- WHEN a client requests `/`
- THEN the response MUST be HTTP 200
- AND the response MUST render the `index` view with the resolved products

### Requirement: Home Degrade-to-Empty Resilience

The home route MUST degrade gracefully on `ListProductsUseCase` failure: it MUST catch the error, MUST NOT propagate it via `next(error)`, and MUST still render `index` with an empty products array.

(This is a closed decision, not a TBD: home intentionally diverges from `ProductController.getAllProducts`'s fail-fast `next(error)` pattern because the homepage has a broad purpose beyond the product listing.)

#### Scenario: Home degrades to empty list on use-case failure

- GIVEN `ListProductsUseCase.execute()` rejects with an error
- WHEN a client requests `/`
- THEN the response MUST still be HTTP 200
- AND the response MUST render the `index` view with `products: []`
- AND the error MUST NOT be passed to `next(error)`

### Requirement: Out-of-Scope Boundaries

The migration MUST NOT modify `src/services/productService.js`, `src/controllers/products/getAllProducts.js`, or `src/routes/productsRoutes.js`. `productService.js` remains the live dependency of `productApiController.js` at `/api/products`; the other two are dead-on-disk and scheduled for a later cleanup change.

#### Scenario: productService.js remains untouched and functional

- GIVEN the migration is complete
- WHEN `/api/products` is requested
- THEN `productApiController.js` MUST still serve the response via the unmodified `productService.js`

#### Scenario: getAllProducts.js and productsRoutes.js are not deleted

- GIVEN the migration is complete
- WHEN inspecting the repository
- THEN `src/controllers/products/getAllProducts.js` and `src/routes/productsRoutes.js` MUST still exist on disk, unchanged

### Requirement: Test Suite Parity and Retargeting

The migration MUST keep `footerPages.test.js` passing without modification, and MUST update (not delete) the brittle path/content assertions in `backendLayeringPR3.test.js` so they reference the new TypeScript structure instead of the removed legacy files.

#### Scenario: footerPages.test.js passes unchanged

- GIVEN the migration is complete
- WHEN `footerPages.test.js` runs
- THEN all its assertions MUST pass without any modification to that test file

#### Scenario: backendLayeringPR3.test.js assertions retarget to TS paths

- GIVEN the migration removes `src/controllers/main/*.js`, the barrel `index.js`, and `src/routes/mainRoutes.js`
- WHEN `backendLayeringPR3.test.js` runs
- THEN its assertions MUST reference `src/infrastructure/controllers/StaticPagesController.ts` and `src/infrastructure/routes/staticPagesRoutes.ts` in place of the removed legacy paths
- AND the test MUST pass without relying on compatibility shims

### Requirement: Legacy Removal After Parity Verification

The system MUST remove `src/controllers/main/*.js` (including the barrel `index.js`) and `src/routes/mainRoutes.js` only after the TypeScript replacements are verified to produce identical HTTP behavior.

#### Scenario: Legacy files absent after migration

- GIVEN the migration is complete and parity is verified
- WHEN inspecting the repository
- THEN `src/controllers/main/` and `src/routes/mainRoutes.js` MUST NOT exist
- AND `src/app.js` MUST mount `src/infrastructure/routes/staticPagesRoutes.ts` in their place
