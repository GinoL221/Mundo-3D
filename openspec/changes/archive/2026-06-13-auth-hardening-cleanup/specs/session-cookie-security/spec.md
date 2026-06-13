# Delta for Session Cookie Security

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Remember-Me Cookie Readability
`cookie-parser` MUST run before `userLoggedMiddleware` and initialize with `SESSION_SECRET` (throw error on startup if unset). Auth middleware MUST verify and read the signed cookie `remember_token` instead of plaintext `userEmail`.
(Previously: Read plaintext `req.cookies.userEmail`.)

#### Scenario: Signed remember-me cookie is verified and parsed
- GIVEN a valid signed `remember_token` cookie
- WHEN a request passes through the middleware pipeline
- THEN `userLoggedMiddleware` SHALL access it via `req.signedCookies.remember_token`

#### Scenario: Middleware reorder does not break other middleware
- GIVEN `cookie-parser` and `userLoggedMiddleware` are swapped
- WHEN the application starts
- THEN all existing session behavior MUST remain unchanged
