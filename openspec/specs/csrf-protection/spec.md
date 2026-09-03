# CSRF Protection Specification

## Purpose

Protects state-changing API requests made under cookie-based authentication from cross-site request forgery, since the browser now attaches the auth cookie automatically to same-site and cross-site requests alike.

## Requirements

### Requirement: CSRF Token Issuance

The system MUST make a CSRF token available to an authenticated client so the frontend can attach it to subsequent state-changing requests. The token MUST be bound to the client's active auth session.

#### Scenario: Token retrievable after authentication

- GIVEN a client holds a valid auth cookie from a successful login
- WHEN the client requests its CSRF token
- THEN the system MUST return a token scoped to that session

#### Scenario: Token not usable across sessions

- GIVEN a CSRF token issued for one session
- WHEN a request presents that token alongside a different or absent auth cookie
- THEN the system MUST reject the request

### Requirement: CSRF Enforcement on State-Changing Requests

The system MUST reject with HTTP 403 any authenticated state-changing request (POST, PUT, PATCH, DELETE) that does not present a valid CSRF token matching the requester's session. Safe methods (GET, HEAD, OPTIONS) MUST NOT require a CSRF token.

#### Scenario: Valid token allows the request

- GIVEN an authenticated client with a valid CSRF token for its session
- WHEN it sends a state-changing request including that token
- THEN the request MUST proceed to the handler

#### Scenario: Missing token rejected

- GIVEN an authenticated client
- WHEN it sends a state-changing request without a CSRF token
- THEN the response MUST be HTTP 403 with a JSON error body

#### Scenario: Invalid or mismatched token rejected

- GIVEN an authenticated client
- WHEN it sends a state-changing request with a CSRF token that fails validation or does not match its session
- THEN the response MUST be HTTP 403 with a JSON error body

#### Scenario: Safe-method requests unaffected

- GIVEN an authenticated client
- WHEN it sends a GET, HEAD, or OPTIONS request without a CSRF token
- THEN the request MUST proceed normally

### Requirement: Refresh Endpoint CSRF Exemption

`POST /api/users/refresh` MUST be exempt from `csrfGuard`, even though it is a state-changing request that grants authority (unlike logout's fail-safe exemption, which only removes authority). This is safe because: the refresh cookie is `httpOnly` with `sameSite: 'lax'`, which is not attached to a cross-site POST; the refresh cookie is scoped to `path: '/api/users/refresh'` and sent nowhere else; rotation makes a forged or replayed refresh self-revealing; and the route is rate-limited.

#### Scenario: Refresh request without a CSRF token succeeds
- GIVEN an authenticated client with a valid refresh cookie and no CSRF header
- WHEN it sends `POST /api/users/refresh`
- THEN the request MUST NOT be rejected for a missing or invalid CSRF token

#### Scenario: Refresh route bypasses the guard entirely
- GIVEN `req.user` may be unset or stale because the access token can be expired when refresh is called
- WHEN `POST /api/users/refresh` is routed
- THEN `csrfGuard` MUST NOT run on this path
