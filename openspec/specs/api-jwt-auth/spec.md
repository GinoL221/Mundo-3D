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

### Requirement: Bearer Token Authorization for User API Endpoints
All API endpoints matching the pattern `/api/users*` (excluding `/api/users/login`) MUST require a valid JWT token passed via the HTTP `Authorization` header as `Bearer <token>`.

#### Scenario: Request to protected user API without token
- GIVEN a GET request is made to `/api/users`
- WHEN no `Authorization` header is provided
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected user API with invalid token
- GIVEN a GET request is made to `/api/users`
- WHEN the `Authorization` header contains an invalid or expired token
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected user API with valid token
- GIVEN a GET request is made to `/api/users`
- WHEN the `Authorization` header contains a valid `Bearer <token>` signed with the application secret
- THEN the response status MUST be 200 OK
- AND the response MUST contain the requested user data
