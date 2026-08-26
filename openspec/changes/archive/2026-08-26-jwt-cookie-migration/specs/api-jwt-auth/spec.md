# Delta for API JWT Authentication

## MODIFIED Requirements

### Requirement: API JWT Login Endpoint

The application MUST expose a POST endpoint at `/api/users/login` to allow clients to authenticate. On success, the system MUST set the signed JWT as an httpOnly cookie on the response and MUST NOT include the raw token in the JSON response body. The issued JWT MUST have a default expiration of exactly `2h` unless an extended session is requested (see Remember-Me Extended Session). This login endpoint MUST remain protected by the rate limiter configured via `process.env.LOGIN_LIMIT_MAX` and `process.env.LOGIN_LIMIT_WINDOW`.
(Previously: the token was returned in the JSON response body; no cookie was set.)

#### Scenario: Successful login sets an auth cookie

- GIVEN a registered user with valid credentials
- WHEN a POST request is made to `/api/users/login`
- THEN the response status MUST be 200 OK
- AND the response MUST set an httpOnly cookie carrying the signed JWT
- AND the JSON response body MUST NOT contain the raw token

#### Scenario: API login with invalid credentials

- GIVEN a POST request is made to `/api/users/login` with incorrect credentials
- THEN the response status MUST be 401 Unauthorized
- AND no auth cookie SHALL be set

#### Scenario: API login exceeds rate limit

- GIVEN requests exceeding `process.env.LOGIN_LIMIT_MAX` within `process.env.LOGIN_LIMIT_WINDOW`
- THEN the response status MUST be 429 Too Many Requests

### Requirement: Cookie-Based Authorization for Protected API Endpoints

All API endpoints matching `/api/users*` (excluding `/api/users/login` and `/api/users/register`), all API write actions, profile endpoints, and admin-restricted API views MUST require a valid JWT transmitted via the httpOnly auth cookie. An `Authorization: Bearer` header MUST NOT be accepted as an authentication source.
(Previously: authenticated via `Authorization: Bearer <token>` header only.)

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

## ADDED Requirements

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
