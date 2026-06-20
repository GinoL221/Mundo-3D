# Static Pages Controller Specification

## Purpose

Define the HTTP-level contract for the static/main routes (`/`, `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`) after their controllers and routing are migrated from plain JavaScript (`src/controllers/main/*.js`, `src/routes/mainRoutes.js`) to TypeScript infrastructure (`StaticPagesController.ts`, `staticPagesRoutes.ts`). This spec governs architecture and behavior parity, not visual/CSS concerns (those are covered by `footer-pages` and `dynamic-homepage`).

## Requirements

### Requirement: Pure-Render Static Page Retirement from Express

The Express backend MUST NOT serve or render HTML views for `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help`. These routes are retired from Express and will be pre-rendered using SSG on the Astro frontend.

#### Scenario: Express backend returns 404 for retired static routes
- GIVEN a request to `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, or `/help` on the Express port
- WHEN the request is received by the Express application
- THEN the Express application MUST NOT route it to a view engine and MUST return a 404 Not Found

### Requirement: Home Route SSR Retirement from Express

The Express backend MUST NOT render the `index` view or serve the `/` homepage route. The homepage route is retired from Express SSR and transitioned to Astro. The Express backend will only serve products as JSON via `/api/products`.

#### Scenario: Express backend does not render EJS for home route
- GIVEN a request to `/` on the Express application port
- WHEN the request is received by the Express application
- THEN it MUST NOT call `ListProductsUseCase` to render an HTML page
- AND it MUST NOT use the EJS view engine

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

### Requirement: Test Suite Retargeting

The Express test suite (`footerPages.test.js`, `backendLayeringPR3.test.js`) MUST be retired or adapted to test the REST API endpoints and behavior rather than HTML page rendering.

#### Scenario: Retired Express view tests are removed or adapted
- GIVEN view-related test suites on the Express backend
- WHEN the EJS engine and views are retired
- THEN all tests verifying EJS rendering MUST be deleted or migrated to verify JSON outputs on `/api` endpoints

### Requirement: Legacy Removal After Parity Verification

The system MUST remove `src/controllers/main/*.js` (including the barrel `index.js`) and `src/routes/mainRoutes.js` only after the TypeScript replacements are verified to produce identical HTTP behavior.

#### Scenario: Legacy files absent after migration

- GIVEN the migration is complete and parity is verified
- WHEN inspecting the repository
- THEN `src/controllers/main/` and `src/routes/mainRoutes.js` MUST NOT exist
- AND `src/app.js` MUST mount `src/infrastructure/routes/staticPagesRoutes.ts` in their place
