# API JWT Authentication Specification

## Purpose
Secures API endpoints under `/api/users*` using Bearer JWT tokens, and introduces `/api/users/login` to authenticate and issue the token.

## Requirements

### Requirement: API JWT Login Endpoint
The application MUST expose a POST endpoint at `/api/users/login` to allow API clients to authenticate and obtain a JWT token. The response on success MUST include a JSON object containing the signed `token`. The issued JWT token MUST have an expiration time of exactly `2h`. Furthermore, this login endpoint MUST be protected by a rate limiter configured dynamically via the environment variables `process.env.LOGIN_LIMIT_MAX` (maximum number of requests) and `process.env.LOGIN_LIMIT_WINDOW` (window size in milliseconds).

#### Scenario: Successful API login returns a token
- GIVEN a registered user with email "user@test.com" and password "password123"
- WHEN a POST request is made to `/api/users/login` with body `{ "Email": "user@test.com", "Password": "password123" }`
- THEN the response status MUST be 200 OK
- AND the response body MUST contain a signed JSON Web Token (JWT) key `token`
- AND the JWT token payload MUST expire in `2h`

#### Scenario: API login with invalid credentials
- GIVEN a POST request is made to `/api/users/login` with incorrect credentials
- THEN the response status MUST be 401 Unauthorized
- AND the response body MUST contain an error message

#### Scenario: API login exceeds rate limit
- GIVEN a login rate limiter configured with environment variables
- WHEN a client sends requests exceeding `process.env.LOGIN_LIMIT_MAX` within `process.env.LOGIN_LIMIT_WINDOW`
- THEN the response status MUST be 429 Too Many Requests
- AND the response body MUST contain a rate limit error message

### Requirement: Bearer Token Authorization for Protected API Endpoints
All API endpoints matching the pattern `/api/users*` (excluding `/api/users/login`), all API write actions (POST, PUT, DELETE) on any resources, profile endpoints, and admin-restricted API views MUST require a valid JWT token passed via the HTTP `Authorization` header as `Bearer <token>`.

#### Scenario: Request to protected API without token
- GIVEN a request is made to a protected API endpoint (e.g., GET `/api/users`, GET `/api/profile`, or POST/PUT/DELETE to `/api/products`)
- WHEN no `Authorization` header is provided
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected API with invalid token
- GIVEN a request is made to a protected API endpoint
- WHEN the `Authorization` header contains an invalid or expired token
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected API with valid token
- GIVEN a request is made to a protected API endpoint
- WHEN the `Authorization` header contains a valid `Bearer <token>` signed with the application secret
- THEN the response status MUST be 200 OK (or 201 Created for write actions)
- AND the response MUST contain the requested payload data

#### Scenario: Request to admin-only API view with non-admin token
- GIVEN a request is made to an admin-restricted API endpoint (e.g., `/api/admin/dashboard` or other admin views)
- WHEN the `Authorization` header contains a valid `Bearer <token>` of a user who is not an admin
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

- GIVEN a valid `Bearer <token>` is provided in the `Authorization` header
- WHEN the auth middleware verifies the token
- THEN `req.user` MUST be populated with `{ id, email, role }` from the JWT payload
- AND downstream handlers MUST be able to access `req.user` without type errors

#### Scenario: req.user is undefined on unauthenticated request

- GIVEN no `Authorization` header is provided
- WHEN a request reaches a handler on a non-protected route
- THEN `req.user` SHOULD be undefined or absent
