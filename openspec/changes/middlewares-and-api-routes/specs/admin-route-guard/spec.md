# Delta for admin-route-guard

## MODIFIED Requirements

### Requirement: Authentication and Role Verification

Administrative and User API routes (`/api/users`, `/api/users/:id`) MUST be guarded by middleware that verifies whether the user is logged in and possesses administrator privileges (`IDRole === 1`). For web routes, unauthenticated users MUST redirect to `/login`, and authenticated non-admin users MUST redirect to a custom 403 Forbidden page. For API routes, unauthenticated requests MUST return HTTP 401 JSON, and authenticated non-admin requests MUST return HTTP 403 JSON.
(Previously: Administrative routes must be guarded to verify login and administrator role.)

#### Scenario: Guest user on GET request redirects to login
- GIVEN a guest user (unauthenticated session)
- WHEN a GET request is sent to any administrative web route (e.g., `/new-product`)
- THEN the application MUST redirect the user to `/login`

#### Scenario: Guest user on state-changing request is rejected by CSRF protection
- GIVEN a guest user (unauthenticated session, no valid CSRF token)
- WHEN a POST/PUT/DELETE request is sent to any administrative web route
- THEN the global CSRF middleware MUST reject the request with HTTP 403 before `adminGuard`
- AND the guest cannot perform the administrative action

#### Scenario: Authenticated non-admin user redirected to 403
- GIVEN an authenticated user with `IDRole === 2` (standard user)
- WHEN a GET/POST/PUT/DELETE request is sent to any administrative web route
- THEN the application MUST redirect the user to a custom 403 Forbidden error page
- AND the HTTP response status code MUST be 403 Forbidden

#### Scenario: Authenticated admin user permitted
- GIVEN an authenticated user with `IDRole === 1` (administrator)
- WHEN a request is sent to any administrative route
- THEN the application MUST allow the request to proceed to the controller

#### Scenario: Authenticated non-admin User API request rejected
- GIVEN an authenticated user with `IDRole === 2` (standard user)
- WHEN a GET/POST/PUT/DELETE request is made to `/api/users` or `/api/users/:id`
- THEN the response status MUST be 403 Forbidden
- AND the response body MUST contain an error JSON object
