# Delta for csrf-protection

## ADDED Requirements

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
