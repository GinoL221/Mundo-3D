# Delta for Admin Route Guard

## MODIFIED Requirements

### Requirement: Capability-Aware Role Guard

Guarded API routes MUST be protected by a guard middleware that accepts a per-route allow-list of roles and MUST reference the `Role` enum constants (e.g. `Role.ADMIN`, `Role.STAFF`) — never magic numeric literals. The guard MUST distinguish between an unauthenticated request (no valid auth cookie) and an authenticated request whose role is not permitted for that route.
(Previously: unauthenticated detection was based on a missing/invalid Bearer token.)

#### Scenario: Missing or invalid auth cookie rejected as unauthenticated

- GIVEN a request to a guarded route with no auth cookie, or a cookie whose token is missing, malformed, or fails verification
- WHEN the guard middleware processes the request
- THEN the response MUST be HTTP 401 with a JSON error body
- AND the request MUST NOT reach the controller

#### Scenario: Authenticated role outside the route allow-list rejected

- GIVEN an authenticated request with a valid auth cookie whose decoded role is not included in the route's allowed roles
- WHEN the guard middleware processes the request
- THEN the response MUST be HTTP 403 with a JSON error body
- AND the request MUST NOT reach the controller

#### Scenario: Authenticated role within the route allow-list proceeds

- GIVEN an authenticated request with a valid auth cookie whose decoded role is included in the route's allowed roles
- WHEN the guard middleware processes the request
- THEN the request MUST be allowed to proceed to the controller
