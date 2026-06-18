# Admin Route Guard Specification

## Purpose
Restricts access to administrative web routes (such as product creation, editing, deletion, and user deletion) to users with administrator privileges (`IDRole === 1` or role `'Admin'`).

## Requirements

### Requirement: Authentication and Role Verification
The administrative routes MUST be guarded by middleware that verifies whether the user is logged in and possesses administrator privileges (`IDRole === 1`).

#### Scenario: Guest user on GET request redirects to login
- GIVEN a guest user (unauthenticated session)
- WHEN a GET request is sent to any administrative route (e.g., `/new-product`)
- THEN the application MUST redirect the user to `/login`

#### Scenario: Guest user on state-changing request is rejected by CSRF protection
- GIVEN a guest user (unauthenticated session, no valid CSRF token)
- WHEN a POST/PUT/DELETE request is sent to any administrative route (e.g., `/product/delete/:id`, or `/users/delete/:id`)
- THEN the global CSRF middleware MUST reject the request with HTTP 403 before the route reaches `adminGuard`
- AND the net effect MUST still be that the guest cannot perform the administrative action

#### Scenario: Authenticated non-admin user redirected to 403
- GIVEN an authenticated user with `IDRole === 2` (standard user)
- WHEN a GET/POST/PUT/DELETE request is sent to any administrative route (e.g., `/new-product`, `/product/:id/edit`, `/product/delete/:id`, or `/users/delete/:id`)
- THEN the application MUST redirect the user to a custom 403 Forbidden error page
- AND the HTTP response status code MUST be 403 Forbidden

#### Scenario: Authenticated admin user permitted
- GIVEN an authenticated user with `IDRole === 1` (administrator)
- WHEN a request is sent to an administrative route
- THEN the application MUST allow the request to proceed to the controller
