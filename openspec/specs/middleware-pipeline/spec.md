# Middleware Pipeline Specification

## Purpose

Defines the correct ordering and registration of Express middleware in the main application entry point (`src/app.ts`), the migration of custom middlewares to TypeScript, and the error propagation contract that all controllers MUST follow so that unhandled errors reach the global error handler.

## Requirements

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

#### Scenario: Helmet headers appear before CORS headers

- GIVEN `helmet()` is registered before `cors()`
- WHEN a response is sent
- THEN helmet security headers (e.g., `X-Content-Type-Options`, `Cross-Origin-Resource-Policy`) SHALL be present
- AND helmet headers MUST be set before CORS headers in the response

#### Scenario: Cookie-parser populates cookies before auth middleware

- GIVEN `cookie-parser` is registered before `userLoggedMiddleware`
- WHEN a request with a `userEmail` cookie arrives
- THEN `req.cookies.userEmail` SHALL be available to `userLoggedMiddleware`

### Requirement: Controller Error Propagation

All controller catch blocks MUST propagate errors to the global error handler via `next(err)` instead of returning inline `res.status(500).send(...)` or `res.status(500).json(...)`.

#### Scenario: Controller catch block calls next(err)

- GIVEN a controller catch block previously used `res.status(500).send(error.message)`
- WHEN an unhandled error occurs in that controller
- THEN the controller SHALL call `next(err)`
- AND the global `errorHandler` middleware SHALL receive the error

#### Scenario: Error message not leaked to client

- GIVEN the `deleteUser` controller previously sent `${error.message}` in the 500 response
- WHEN an error occurs during user deletion
- THEN `next(err)` SHALL be called instead
- AND the client MUST NOT receive the raw `error.message` in the response body

### Requirement: Auth Middleware Uses UserService

The auth middleware (`src/infrastructure/middlewares/userLogged.ts`) MUST NOT call `User.findOne` directly or import database models directly. It SHALL use `UserService.findByEmail(email)` to look up users from the remember-me cookie. The middleware MUST be written in TypeScript.

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

- GIVEN `UserService.findByEmail` returns null (no user for cookie email)
- WHEN `userLoggedMiddleware` executes
- THEN `res.locals.userLogged` SHALL remain unset
- AND `next()` SHALL be called without error

### Requirement: Global Error Handler Activation

The `errorHandler` middleware (located at `src/infrastructure/middlewares/errorHandler.ts`) MUST be registered as the last middleware in the Express stack and MUST catch all unhandled errors propagated through `next(err)`. The middleware MUST be written in TypeScript.

#### Scenario: Error handler returns JSON for API routes

- GIVEN an error is propagated via `next(err)` from an API-route controller
- WHEN the error handler receives it and the request accepts JSON
- THEN the response SHALL have status 500
- AND the response body SHALL be JSON

#### Scenario: Error handler catches all controller errors

- GIVEN all controllers use `next(err)` instead of inline 500 responses
- WHEN any controller throws an unhandled error
- THEN the global error handler SHALL produce a consistent error response
