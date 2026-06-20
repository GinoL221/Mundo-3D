# API JWT Authentication Specification Delta

This delta specification defines updates to the API token validation rules to secure write operations, admin views, and profile endpoints using Bearer JWT tokens.

## Requirements

### Requirement: Bearer Token Authorization for Protected API Endpoints
(Previously: All API endpoints matching the pattern `/api/users*` (excluding `/api/users/login`) MUST require a valid JWT token passed via the HTTP `Authorization` header as `Bearer <token>`.)

All API endpoints matching the pattern `/api/users*` (excluding `/api/users/login`), all API write actions (POST, PUT, DELETE) on any resources, profile endpoints, and admin-restricted API views MUST require a valid JWT token passed via the HTTP `Authorization` header as `Bearer <token>`.

#### Scenario: Request to protected API without token
(Previously: 
- GIVEN a GET request is made to `/api/users`
- WHEN no `Authorization` header is provided
- THEN the response status MUST be 401 Unauthorized)

- GIVEN a request is made to a protected API endpoint (e.g., GET `/api/users`, GET `/api/profile`, or POST/PUT/DELETE to `/api/products`)
- WHEN no `Authorization` header is provided
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected API with invalid token
(Previously: 
- GIVEN a GET request is made to `/api/users`
- WHEN the `Authorization` header contains an invalid or expired token
- THEN the response status MUST be 401 Unauthorized)

- GIVEN a request is made to a protected API endpoint
- WHEN the `Authorization` header contains an invalid or expired token
- THEN the response status MUST be 401 Unauthorized

#### Scenario: Request to protected API with valid token
(Previously: 
- GIVEN a GET request is made to `/api/users`
- WHEN the `Authorization` header contains a valid `Bearer <token>` signed with the application secret
- THEN the response status MUST be 200 OK
- AND the response MUST contain the requested user data)

- GIVEN a request is made to a protected API endpoint
- WHEN the `Authorization` header contains a valid `Bearer <token>` signed with the application secret
- THEN the response status MUST be 200 OK (or 201 Created for write actions)
- AND the response MUST contain the requested payload data

#### Scenario: Request to admin-only API view with non-admin token
- GIVEN a request is made to an admin-restricted API endpoint (e.g., `/api/admin/dashboard` or other admin views)
- WHEN the `Authorization` header contains a valid `Bearer <token>` of a user who is not an admin
- THEN the response status MUST be 403 Forbidden
