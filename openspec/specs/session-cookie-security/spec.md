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

CORS configuration MUST restrict cross-origin requests using `process.env.CORS_ORIGIN`. If unset, default to the known frontend dev origins. Because the auth cookie now travels with credentialed cross-origin requests, the server MUST echo the exact matched request origin (never a wildcard `*`) and MUST set `Access-Control-Allow-Credentials: true` whenever the request origin is allowed.

#### Scenario: Request from whitelisted or default origin is allowed

- GIVEN `CORS_ORIGIN` is configured or unset
- WHEN a request is received from a whitelisted or default origin
- THEN the response MUST allow the request
- AND `Access-Control-Allow-Origin` MUST echo that exact origin, not `*`

#### Scenario: Request from non-whitelisted origin is rejected

- GIVEN `CORS_ORIGIN` is configured
- WHEN a request is received from an origin not in the whitelist
- THEN the response headers SHALL NOT allow the request

#### Scenario: Credentialed request from allowed origin retains the cookie

- GIVEN a browser sends a cross-origin request with credentials from an allowed origin
- WHEN the server responds
- THEN `Access-Control-Allow-Credentials` MUST be `true`
- AND the browser MUST be able to read the response and retain the auth cookie

### Requirement: Product Update Expansion

`ProductService.update` MUST persist `Image`, `IDCategory`, and `IDFranchise` to the database.

#### Scenario: Update product details persists all fields

- GIVEN a product update request
- WHEN `ProductService.update` is executed
- THEN it SHALL save `Image`, `IDCategory`, and `IDFranchise` values in the DB

### Requirement: Auth Cookie Security Flags

The JWT auth cookie MUST be set with `httpOnly: true` so client-side JavaScript cannot read it. It MUST include a `secure` flag that is `true` in production and MAY be `false` in local development, and a `SameSite` attribute compatible with the frontend and backend being cross-origin.

#### Scenario: Auth cookie is not readable from JavaScript

- GIVEN a successful login response
- WHEN the browser stores the `Set-Cookie` response
- THEN `document.cookie` MUST NOT expose the auth cookie's value

#### Scenario: Secure flag enforced in production

- GIVEN `NODE_ENV=production`
- WHEN the auth cookie is set
- THEN the cookie's `secure` attribute MUST be `true`

### Requirement: Per-Cookie Lifetime Split

All four session cookies MUST use the refresh-token lifetime (2h / 30d per "remember me"), so the UI does not appear logged out while the underlying session is still alive.

**`m3d_auth` is deliberately included.** What stays short is the JWT *inside* it, whose `exp` MUST equal the access-token TTL (fixed, env-tunable, default 30 minutes) and which `apiAuthMiddleware` MUST reject once expired. The cookie must outlive that token so `logout` can still read `familyId` from it and revoke the refresh family; giving the cookie the token's TTL made the browser delete it, and logout then had nothing to revoke from — silently leaving the session alive for up to 30 days.

A stale `m3d_auth` therefore authenticates nothing. Its only remaining capability is revoking its own family, which removes authority rather than granting it.

#### Scenario: The auth cookie outlives the token it carries
- GIVEN a successful login
- WHEN `m3d_auth` is issued
- THEN its `maxAge` MUST equal the refresh-token lifetime for that "remember me" value
- AND the JWT inside it MUST carry an `exp` of exactly the access-token TTL

#### Scenario: An expired access token is still rejected for authentication
- GIVEN an `m3d_auth` cookie whose JWT has passed its `exp`
- WHEN it is presented to a route behind `apiAuthMiddleware`
- THEN the request MUST be rejected with 401

#### Scenario: CSRF and display cookies expire with the refresh token
- GIVEN a successful login with a given "remember me" value
- WHEN `m3d_csrf` and `m3d_user` are issued
- THEN their `maxAge` MUST equal the refresh-token lifetime for that "remember me" value (2h or 30d), not the access-token TTL

### Requirement: Refresh Cookie Path Scoping

The refresh cookie MUST be issued with `path: '/api/users/refresh'`, distinct from the default `path: '/'` used by `m3d_auth`, `m3d_csrf`, and `m3d_user`, so it is never sent on any other request.

#### Scenario: Refresh cookie is scoped to the refresh route
- GIVEN a successful login
- WHEN the refresh cookie is set
- THEN its `Set-Cookie` attributes MUST include `Path=/api/users/refresh`

#### Scenario: Refresh cookie is not sent to other endpoints
- GIVEN a client holds the refresh cookie
- WHEN it requests any endpoint other than `/api/users/refresh`
- THEN the browser MUST NOT attach the refresh cookie to that request

