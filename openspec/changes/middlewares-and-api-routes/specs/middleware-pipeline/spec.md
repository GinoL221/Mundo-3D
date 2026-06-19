# Delta for middleware-pipeline

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
(Previously: Middleware registered in order in `src/app.js`.)

#### Scenario: Helmet headers appear before CORS headers
- GIVEN `helmet()` is registered before `cors()`
- WHEN a response is sent
- THEN helmet security headers SHALL be present
- AND helmet headers MUST be set before CORS headers in the response

#### Scenario: Cookie-parser populates cookies before auth middleware
- GIVEN `cookie-parser` is registered before `userLoggedMiddleware`
- WHEN a request with a `userEmail` cookie arrives
- THEN `req.cookies.userEmail` SHALL be available to `userLoggedMiddleware`

### Requirement: Auth Middleware Uses UserService

The auth middleware (`src/infrastructure/middlewares/userLogged.ts`) MUST NOT call `User.findOne` directly or import database models directly. It SHALL use `UserService.findByEmail(email)` to look up users from the remember-me cookie. The middleware MUST be written in TypeScript.
(Previously: `userLogged.js` MUST NOT call `User.findOne` directly. It SHALL use `UserService.findByEmail(email)`.)

#### Scenario: userLogged finds user via UserService
- GIVEN a request with `req.cookies.userEmail` set to a valid email
- WHEN `userLoggedMiddleware` executes
- THEN it SHALL call `UserService.findByEmail(emailInCookie)`
- AND the result SHALL be assigned to `res.locals.userLogged`

#### Scenario: userLogged does not import User model
- GIVEN `userLogged.ts` after refactoring
- WHEN the file is inspected
- THEN it MUST NOT import database model classes directly
- AND it MUST NOT call `User.findOne` directly

#### Scenario: Cookie lookup failure does not block request
- GIVEN `UserService.findByEmail` returns null
- WHEN `userLoggedMiddleware` executes
- THEN `res.locals.userLogged` SHALL remain unset
- AND `next()` SHALL be called without error

### Requirement: Global Error Handler Activation

The `errorHandler` middleware (located at `src/infrastructure/middlewares/errorHandler.ts`) MUST be registered as the last middleware in the Express stack and MUST catch all unhandled errors propagated through `next(err)`. The middleware MUST be written in TypeScript.
(Previously: The `errorHandler` middleware exported from `src/middlewares/errorHandler.js` MUST be registered as the last middleware in the Express stack.)

#### Scenario: Error handler returns JSON for API routes
- GIVEN an error is propagated via `next(err)` from an API-route controller
- WHEN the error handler receives it and the request accepts JSON
- THEN the response SHALL have status 500
- AND the response body SHALL be JSON

#### Scenario: Error handler catches all controller errors
- GIVEN all controllers use `next(err)` instead of inline 500 responses
- WHEN any controller throws an unhandled error
- THEN the global error handler SHALL produce a consistent error response
