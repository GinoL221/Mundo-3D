# Session Cookie Security

## Purpose

Defines the security and ordering requirements for the session and cookie middleware in the Express app, including SameSite/secure flags, dead-import cleanup, and the ordering contract that makes the "remember me" cookie readable by the auth middleware.

## Requirements

### Requirement: SameSite Cookie Flag

The session cookie configuration MUST include `sameSite: 'lax'` in the `cookie` options of `express-session` configuration.

#### Scenario: Session cookie includes SameSite attribute

- GIVEN the session middleware is configured in `app.js`
- WHEN a session cookie is set in the response
- THEN the `Set-Cookie` header MUST include `SameSite=Lax`

#### Scenario: SameSite lax allows safe cross-origin navigation

- GIVEN `sameSite` is set to `'lax'`
- WHEN a user navigates to the site via a top-level GET request from another origin (e.g., following a link)
- THEN the session cookie SHALL be sent with the request
- AND the user SHALL remain logged in

### Requirement: Conditional Secure Cookie Flag

The session cookie configuration MUST include a `secure` flag that is `true` in production (`NODE_ENV=production`) and `false` in other environments.

#### Scenario: Secure flag in production environment

- GIVEN `NODE_ENV` is set to `'production'`
- WHEN the session middleware initialization runs
- THEN the session cookie `secure` option SHALL be `true`
- AND browsers MUST only send the cookie over HTTPS

#### Scenario: Secure flag in development environment

- GIVEN `NODE_ENV` is not set or set to a value other than `'production'`
- WHEN the session middleware initialization runs
- THEN the session cookie `secure` option SHALL be `false`
- AND the session cookie SHALL be sent over HTTP in local development

### Requirement: Remember-Me Cookie Readability

`cookie-parser` MUST run before `userLoggedMiddleware` and initialize with `SESSION_SECRET` (throw error on startup if unset). Auth middleware MUST verify and read the signed cookie `remember_token` instead of plaintext `userEmail`.

#### Scenario: Signed remember-me cookie is verified and parsed

- GIVEN a valid signed `remember_token` cookie
- WHEN a request passes through the middleware pipeline
- THEN `userLoggedMiddleware` SHALL access it via `req.signedCookies.remember_token`

#### Scenario: Middleware reorder does not break other middleware

- GIVEN `cookie-parser` and `userLoggedMiddleware` are swapped
- WHEN the application starts
- THEN all existing session behavior MUST remain unchanged

### Requirement: Dead Code Removal from Route Imports

The system MUST remove unused route imports: `authMiddleware` from `src/routes/userRoutes.js` and `src/routes/productsRoutes.js`, `guestMiddleware` from `src/routes/productsRoutes.js`, and the unused `User` model import from `src/controllers/users/viewShoppingCart.js`. A debug `console.log` statement at `viewShoppingCart.js:18` MUST also be removed.

#### Scenario: userRoutes no longer imports authMiddleware

- GIVEN `src/routes/userRoutes.js` currently imports `authMiddleware`
- WHEN the dead import is removed
- THEN the import line SHALL NOT include `authMiddleware`
- AND all existing route definitions MUST continue to function identically

#### Scenario: productsRoutes no longer imports authMiddleware or guestMiddleware

- GIVEN `src/routes/productsRoutes.js` currently imports both `authMiddleware` and `guestMiddleware`
- WHEN the dead imports are removed
- THEN the import line SHALL NOT include either `authMiddleware` or `guestMiddleware`
- AND `guestMiddleware` MUST still be exported from `src/middlewares/auth.js` and used in `userRoutes`

#### Scenario: viewShoppingCart no longer imports User model

- GIVEN `src/controllers/users/viewShoppingCart.js` imports `User` from the models but never uses it
- WHEN the unused import is removed
- THEN the file SHALL NOT import `User`
- AND the cart view controller MUST function identically

#### Scenario: Debug console.log removed from viewShoppingCart

- GIVEN `src/controllers/users/viewShoppingCart.js` contains a debug `console.log` at line 18
- WHEN the statement is removed
- THEN no `console.log` debug statements SHALL remain in the file

### Requirement: CORS Hardening

CORS configuration MUST restrict cross-origin requests using `process.env.CORS_ORIGIN`. If unset, default to `http://localhost:3000`.

#### Scenario: Request from whitelisted or default origin is allowed

- GIVEN `CORS_ORIGIN` is configured to `https://trusted.com` or unset
- WHEN a request is received from a whitelisted origin or `http://localhost:3000`
- THEN the response headers SHALL allow the request

#### Scenario: Request from non-whitelisted origin is rejected

- GIVEN `CORS_ORIGIN` is configured
- WHEN a request is received from an origin not in the whitelist
- THEN the response headers SHALL NOT allow the request

### Requirement: Product Update Expansion

`ProductService.update` MUST persist `Image`, `IDCategory`, and `IDFranchise` to the database.

#### Scenario: Update product details persists all fields

- GIVEN a product update request
- WHEN `ProductService.update` is executed
- THEN it SHALL save `Image`, `IDCategory`, and `IDFranchise` values in the DB

