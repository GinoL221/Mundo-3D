# Admin Route Guard Specification

## Purpose

Defines capability-aware role-based access control for guarded API routes, distinguishing between unauthenticated (401) and authenticated-but-unauthorized (403) responses via JSON, and specifying the routes that require ADMIN and/or STAFF roles.

## Requirements

### Requirement: Capability-Aware Role Guard

Guarded API routes MUST be protected by a guard middleware that accepts a per-route allow-list of roles and MUST reference the `Role` enum constants (e.g. `Role.ADMIN`, `Role.STAFF`) — never magic numeric literals. The guard MUST distinguish between an unauthenticated request (no valid principal) and an authenticated request whose role is not permitted for that route.

#### Scenario: Missing or invalid Bearer token rejected as unauthenticated

- GIVEN a request to a guarded route with no `Authorization` header, or a Bearer token that is missing, malformed, or fails verification
- WHEN the guard middleware processes the request
- THEN the response MUST be HTTP 401 with a JSON error body
- AND the request MUST NOT reach the controller

#### Scenario: Authenticated role outside the route allow-list rejected

- GIVEN an authenticated request with a valid Bearer token whose decoded role is not included in the route's allowed roles
- WHEN the guard middleware processes the request
- THEN the response MUST be HTTP 403 with a JSON error body
- AND the request MUST NOT reach the controller

#### Scenario: Authenticated role within the route allow-list proceeds

- GIVEN an authenticated request with a valid Bearer token whose decoded role is included in the route's allowed roles
- WHEN the guard middleware processes the request
- THEN the request MUST be allowed to proceed to the controller

### Requirement: Route Capability Matrix

The following routes MUST be guarded with the stated role allow-lists:

| Route | Allowed Roles |
|-------|---------------|
| `POST /api/products` | `Role.ADMIN`, `Role.STAFF` |
| `PUT /api/products/:id` | `Role.ADMIN`, `Role.STAFF` |
| `PATCH /api/products/:id/stock` | `Role.ADMIN`, `Role.STAFF` |
| `DELETE /api/products/:id` | `Role.ADMIN` only |
| `/api/users` (all methods) | `Role.ADMIN` only |
| `/api/users/:id` (all methods) | `Role.ADMIN` only |

#### Scenario: STAFF permitted on product create, update, and stock routes

- GIVEN an authenticated request with role `Role.STAFF`
- WHEN the request targets `POST /api/products`, `PUT /api/products/:id`, or `PATCH /api/products/:id/stock`
- THEN the request MUST be allowed to proceed to the controller

#### Scenario: STAFF rejected on product delete and all user routes

- GIVEN an authenticated request with role `Role.STAFF`
- WHEN the request targets `DELETE /api/products/:id`, `/api/users`, or `/api/users/:id`
- THEN the response MUST be HTTP 403 with a JSON error body
