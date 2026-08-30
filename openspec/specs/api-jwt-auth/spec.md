# API JWT Authentication Specification

## Purpose
Secures API endpoints under `/api/users*` using Bearer JWT tokens, and introduces `/api/users/login` to authenticate and issue the token.

## Requirements

### Requirement: API JWT Login Endpoint
The application MUST expose a POST endpoint at `/api/users/login` to allow clients to authenticate. On success, the system MUST set the signed JWT as an httpOnly cookie on the response and MUST NOT include the raw token in the JSON response body. The issued JWT MUST have a default expiration of exactly `2h` unless an extended session is requested (see Remember-Me Extended Session). This login endpoint MUST remain protected by the rate limiter configured via `process.env.LOGIN_LIMIT_MAX` and `process.env.LOGIN_LIMIT_WINDOW`.

#### Scenario: Successful login sets an auth cookie
- GIVEN a registered user with valid credentials
- WHEN a POST request is made to `/api/users/login`
- THEN the response status MUST be 200 OK
- AND the response MUST set an httpOnly cookie carrying the signed JWT
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

### Requirement: Cookie-Based Authorization for Protected API Endpoints
All API endpoints matching `/api/users*` (excluding `/api/users/login` and `/api/users/register`), all API write actions, profile endpoints, and admin-restricted API views MUST require a valid JWT transmitted via the httpOnly auth cookie. An `Authorization: Bearer` header MUST NOT be accepted as an authentication source.

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
- WHEN a valid auth cookie is present
- THEN the response status MUST be 200 OK (or 201 for write actions)

#### Scenario: Bearer header alone is rejected
- GIVEN a request carries a valid JWT only in an `Authorization: Bearer` header, with no auth cookie
- WHEN the request reaches a protected endpoint
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to admin-only API view with non-admin cookie
- GIVEN a request carries a valid auth cookie for a non-admin user
- WHEN it targets an admin-restricted endpoint
- THEN the response status MUST be 403 Forbidden

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

The application MUST expose `POST /api/users/logout` that clears the auth cookie server-side, ending the session.

#### Scenario: Logout clears the auth cookie

- GIVEN an authenticated client with a valid auth cookie
- WHEN it sends `POST /api/users/logout`
- THEN the response MUST clear the auth cookie
- AND subsequent requests with the old cookie value MUST be rejected as unauthenticated

#### Scenario: Logout without an active session

- GIVEN a client with no auth cookie
- WHEN it sends `POST /api/users/logout`
- THEN the response MUST NOT error and MUST leave the client unauthenticated

### Requirement: Remember-Me Extended Session

When the client's login request indicates "remember me", the system MUST issue an auth cookie with an expiration longer than the default `2h`, bounded to a fixed maximum lifetime. When not indicated, the default `2h` expiration MUST apply.

#### Scenario: Remember-me requested extends session lifetime

- GIVEN a login request that indicates "remember me"
- WHEN the login succeeds
- THEN the issued auth cookie's expiration MUST exceed `2h`

#### Scenario: Remember-me not requested keeps default lifetime

- GIVEN a login request that does not indicate "remember me"
- WHEN the login succeeds
- THEN the issued auth cookie's expiration MUST be exactly `2h`

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
