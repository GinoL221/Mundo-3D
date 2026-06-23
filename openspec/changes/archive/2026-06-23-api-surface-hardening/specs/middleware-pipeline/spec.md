# Delta for Middleware Pipeline

## ADDED Requirements

### Requirement: Remove Orphaned Session Middlewares

The system MUST remove middleware files that have no active callers: `csrf.ts`, `userLogged.ts`, and `cartCount.ts` from `src/infrastructure/middlewares/`. Before removal, a codebase grep MUST confirm no route, controller, or other middleware imports or references these files.

#### Scenario: Orphaned middleware files are deleted

- GIVEN `csrf.ts`, `userLogged.ts`, and `cartCount.ts` exist in `src/infrastructure/middlewares/`
- AND a codebase-wide grep confirms no active imports or references
- WHEN the hardening change is applied
- THEN these files MUST be deleted from the codebase

#### Scenario: Application starts without orphaned middlewares

- GIVEN the orphaned middleware files have been removed
- WHEN the application starts and the middleware pipeline initializes
- THEN the application MUST start without errors
- AND all remaining middleware MUST function correctly

## MODIFIED Requirements

### Requirement: Middleware Registration Order

The middleware in the main application entry point (e.g. `src/app.ts`) MUST be registered in the following top-to-bottom order:

1. `helmet()` — security headers
2. `cors()` — cross-origin headers
3. Static file serving (`express.static`)
4. `morgan()` — request logging
5. `express.urlencoded()` + `express.json()` — body parsing
6. `cookie-parser()` — cookie parsing
7. `express-session()` — session management
8. `userLoggedMiddleware` — auth check (reads `req.cookies`)

All custom Express middlewares MUST reside in `src/infrastructure/middlewares/` and be migrated to TypeScript.

(Previously: Listed `userLoggedMiddleware` in the pipeline; orphaned middlewares are now removed.)

#### Scenario: Helmet headers appear before CORS headers

- GIVEN `helmet()` is registered before `cors()`
- WHEN a response is sent
- THEN helmet security headers (e.g., `X-Content-Type-Options`, `Cross-Origin-Resource-Policy`) SHALL be present
- AND helmet headers MUST be set before CORS headers in the response

#### Scenario: Cookie-parser populates cookies before auth middleware

- GIVEN `cookie-parser` is registered before `userLoggedMiddleware`
- WHEN a request with a `userEmail` cookie arrives
- THEN `req.cookies.userEmail` SHALL be available to `userLoggedMiddleware`
