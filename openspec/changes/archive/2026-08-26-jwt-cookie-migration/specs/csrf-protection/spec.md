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
