# API JWT Authentication Specification

## Purpose
Secures API endpoints under `/api/users*` using Bearer JWT tokens, and introduces `/api/users/login` to authenticate and issue the token.

## Requirements

### Requirement: API JWT Login Endpoint

The application MUST expose a POST endpoint at `/api/users/login` to allow clients to authenticate. On success, the system MUST set the signed JWT as an httpOnly cookie on the response and MUST NOT include the raw token in the JSON response body. The issued access-token JWT MUST have a fixed expiration, defaulting to `30m`, configurable via an environment variable, independent of "remember me" (see Remember-Me Extended Session and `refresh-token-rotation`). This login endpoint MUST remain protected by the rate limiter configured via `process.env.LOGIN_LIMIT_MAX` and `process.env.LOGIN_LIMIT_WINDOW`.
(Previously: default `2h`, extended when "remember me" was requested.)

#### Scenario: Successful login sets an auth cookie
- GIVEN a registered user with valid credentials
- WHEN a POST request is made to `/api/users/login`
- THEN the response status MUST be 200 OK
- AND the response MUST set an httpOnly cookie carrying the signed access-token JWT
- AND the JSON response body MUST NOT contain the raw token

#### Scenario: API login with invalid credentials
- GIVEN a POST request is made to `/api/users/login` with incorrect credentials
- THEN the response status MUST be 401 Unauthorized
- AND the response body MUST contain an error message

#### Scenario: API login exceeds rate limit
- GIVEN a login rate limiter configured with environment variables
- WHEN a client sends requests exceeding `process.env.LOGIN_LIMIT_MAX` within `process.env.LOGIN_LIMIT_WINDOW`
- THEN the response status MUST be 429 Too Many Requests
- AND the response body MUST contain a rate limit error message

#### Scenario: Access token TTL is fixed regardless of remember
- GIVEN a login request with `remember: true`
- WHEN the access token is issued
- THEN its expiration MUST still be the configured default (`30m`), not extended

### Requirement: Cookie-Based Authorization for Protected API Endpoints

All API endpoints matching `/api/users*` (excluding `/api/users/login`, `/api/users/register`, and `/api/users/refresh`), all API write actions, profile endpoints, and admin-restricted API views MUST require a valid JWT transmitted via the httpOnly auth cookie AND carrying the claim `typ: "access"`. An `Authorization: Bearer` header MUST NOT be accepted as an authentication source. A token that is validly signed and unexpired but lacks `typ: "access"` (or carries a different value) MUST be rejected.
(Previously: did not require or check a `typ` claim.)

#### Scenario: Request to protected API without cookie
- GIVEN a request is made to a protected API endpoint
- WHEN no auth cookie is present
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected API with invalid or expired cookie
- GIVEN a request is made to a protected API endpoint
- WHEN the auth cookie contains an invalid or expired token
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected API with valid cookie
- GIVEN a request is made to a protected API endpoint
- WHEN a valid auth cookie carrying `typ: "access"` is present
- THEN the response status MUST be 200 OK (or 201 for write actions)

#### Scenario: Bearer header alone is rejected
- GIVEN a request carries a valid JWT only in an `Authorization: Bearer` header, with no auth cookie
- WHEN the request reaches a protected endpoint
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to admin-only API view with non-admin cookie
- GIVEN a request carries a valid auth cookie for a non-admin user
- WHEN it targets an admin-restricted endpoint
- THEN the response status MUST be 403 Forbidden

#### Scenario: Pre-deploy JWT without typ claim is rejected
- GIVEN a validly-signed, unexpired 30-day JWT issued before this change (no `typ` claim)
- WHEN it is presented to a protected endpoint after deploy
- THEN the response status MUST be 401 Unauthorized

### Requirement: Centralized JWT Secret Module

The system MUST provide a single module that resolves the JWT signing secret exclusively from `process.env.JWT_SECRET`. The module MUST throw an unrecoverable error at application startup when the environment variable is absent or empty. No hardcoded fallback values (including `"test_jwt_secret"`) SHALL be permitted anywhere in the codebase.

#### Scenario: Application starts with valid JWT_SECRET

- GIVEN `process.env.JWT_SECRET` is set to a non-empty string
- WHEN the application bootstraps and imports the secret module
- THEN the module MUST export the configured secret value
- AND no error SHALL be thrown

#### Scenario: Application fails fast when JWT_SECRET is missing

- GIVEN `process.env.JWT_SECRET` is undefined or empty
- WHEN the application bootstraps and imports the secret module
- THEN the module MUST throw an error with a descriptive message
- AND the application MUST NOT start

### Requirement: Request User Type Augmentation

The Express `Request` object MUST be augmented with an optional `user` property whose shape carries at least `id`, `email`, and `role`. The auth middleware MUST assign the decoded JWT payload to `req.user` after successful verification.

#### Scenario: Auth middleware populates req.user

- GIVEN a valid auth cookie is provided in the request
- WHEN the auth middleware verifies the cookie
- THEN `req.user` MUST be populated with `{ id, email, role }` from the JWT payload
- AND downstream handlers MUST be able to access `req.user` without type errors

#### Scenario: req.user is undefined on unauthenticated request

- GIVEN no auth cookie is provided
- WHEN a request reaches a handler on a non-protected route
- THEN `req.user` SHOULD be undefined or absent

### Requirement: Logout Endpoint

The application MUST expose `POST /api/users/logout` that clears the session cookies and revokes the associated refresh token family (every row sharing its `family_id` marked `revoked_at`), ending the session server-side, not only client-side.
(Previously: only cleared cookies; the JWT itself remained valid until its own `exp`.)

#### Scenario: Logout clears the session cookies
- GIVEN an authenticated client with a valid auth cookie
- WHEN it sends `POST /api/users/logout`
- THEN the response MUST clear the auth, CSRF, display, and refresh cookies

#### Scenario: Logout revokes the refresh family
- GIVEN an authenticated client whose refresh token belongs to family `F`
- WHEN it sends `POST /api/users/logout`
- THEN every row in family `F` MUST be marked revoked
- AND a subsequent `POST /api/users/refresh` using any token from family `F` MUST be rejected 401

#### Scenario: Prior access token cannot be renewed after logout
- GIVEN a client logged out, revoking its refresh family
- WHEN it later attempts `POST /api/users/refresh` using the prior refresh token to obtain a new access token
- THEN the refresh attempt MUST be rejected 401
- AND no new access token MUST be issued, so the prior access token cannot outlive its own short TTL

#### Scenario: Logout without an active session
- GIVEN a client with no auth cookie
- WHEN it sends `POST /api/users/logout`
- THEN the response MUST NOT error and MUST leave the client unauthenticated

### Requirement: Remember-Me Extended Session

When the client's login request indicates "remember me", the system MUST extend the refresh **token's** lifetime (see `refresh-token-rotation`), NOT the access token's. The access token's own `exp` MUST always equal the fixed access-token TTL regardless of "remember me".

The `m3d_auth` **cookie** does follow the remember-me lifetime, unlike the token it carries — see `session-cookie-security` for why logout depends on the cookie outliving its token.
(Previously: "remember me" extended the single auth-cookie/JWT lifetime up to 30 days.)

#### Scenario: Remember-me requested extends the refresh token, not the access token
- GIVEN a login request that indicates "remember me"
- WHEN the login succeeds
- THEN the refresh token's expiration MUST exceed the default 2h
- AND the access **token**'s own `exp` MUST remain the fixed access-token TTL, while its cookie's `maxAge` follows the extended session (see `session-cookie-security`)

#### Scenario: Remember-me not requested keeps default refresh lifetime
- GIVEN a login request that does not indicate "remember me"
- WHEN the login succeeds
- THEN the refresh token's expiration MUST be exactly 2 hours

### Requirement: Proxy-Aware Login Rate Limiting

When the application runs behind exactly one proxy hop, the login rate limiter MUST key on the real client IP taken from the forwarded client address, not on the proxy's own IP. A single client that exhausts `process.env.LOGIN_LIMIT_MAX` failed attempts within `process.env.LOGIN_LIMIT_WINDOW` MUST NOT cause requests from other clients (different source IPs) to receive `429 Too Many Requests`.

#### Scenario: One client's rate limit does not lock out other clients

- GIVEN the app runs behind one proxy hop and client A has exceeded `LOGIN_LIMIT_MAX` within `LOGIN_LIMIT_WINDOW`
- WHEN client B, from a different source IP, sends its first login request
- THEN client B MUST NOT receive `429`
- AND client A MUST receive `429`

#### Scenario: Rate limiting buckets by the forwarded client IP

- GIVEN login requests arrive through the edge proxy carrying an `X-Forwarded-For` client IP
- WHEN the login limiter counts attempts
- THEN it MUST bucket attempts by the forwarded client IP rather than the proxy's IP
