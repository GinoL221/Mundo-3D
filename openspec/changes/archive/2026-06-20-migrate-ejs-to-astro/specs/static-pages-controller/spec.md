# Static Pages Controller Specification Delta

This delta specification defines the retirement of Express server-side rendering (SSR) for static routes and the homepage, transitioning them to the Astro frontend.

## Requirements

### Requirement: Pure-Render Static Page Retirement from Express
(Previously: The system MUST serve `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` via `StaticPagesController` (TypeScript), each rendering the same view it rendered before migration, with identical HTTP status and no behavioral change.)

The Express backend MUST NOT serve or render HTML views for `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help`. These routes are retired from Express and will be pre-rendered using SSG on the Astro frontend.

#### Scenario: Express backend returns 404 for retired static routes
- GIVEN a request to `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, or `/help` on the Express port
- WHEN the request is received by the Express application
- THEN the Express application MUST NOT route it to a view engine and MUST return a 404 Not Found

### Requirement: Home Route SSR Retirement from Express
(Previously: The system MUST serve `/` by rendering the `index` view with products obtained from `ListProductsUseCase`, replacing the legacy direct call to `productService.js`.)

The Express backend MUST NOT render the `index` view or serve the `/` homepage route. The homepage route is retired from Express SSR and transitioned to Astro. The Express backend will only serve products as JSON via `/api/products`.

#### Scenario: Express backend does not render EJS for home route
- GIVEN a request to `/` on the Express application port
- WHEN the request is received by the Express application
- THEN it MUST NOT call `ListProductsUseCase` to render an HTML page
- AND it MUST NOT use the EJS view engine

### Requirement: Test Suite Retargeting
(Previously: The migration MUST keep `footerPages.test.js` passing without modification, and MUST update (not delete) the brittle path/content assertions in `backendLayeringPR3.test.js` so they reference the new TypeScript structure instead of the removed legacy files.)

The Express test suite (`footerPages.test.js`, `backendLayeringPR3.test.js`) MUST be retired or adapted to test the REST API endpoints and behavior rather than HTML page rendering.

#### Scenario: Retired Express view tests are removed or adapted
- GIVEN view-related test suites on the Express backend
- WHEN the EJS engine and views are retired
- THEN all tests verifying EJS rendering MUST be deleted or migrated to verify JSON outputs on `/api` endpoints
