# Delta for session-cookie-security

## ADDED Requirements

### Requirement: Per-Cookie Lifetime Split

`m3d_auth` MUST use the access-token TTL (fixed, env-tunable, default 30 minutes). `m3d_csrf` and `m3d_user` MUST use the refresh-token TTL (2h / 30d per "remember me"), not the access-token TTL, so the UI does not appear logged out while the underlying session (refresh token) is still alive.

#### Scenario: Auth cookie expires with the access token
- GIVEN a successful login
- WHEN `m3d_auth` is issued
- THEN its `maxAge` MUST equal the access-token TTL

#### Scenario: CSRF and display cookies expire with the refresh token
- GIVEN a successful login with a given "remember me" value
- WHEN `m3d_csrf` and `m3d_user` are issued
- THEN their `maxAge` MUST equal the refresh-token lifetime for that "remember me" value (2h or 30d), not the access-token TTL

### Requirement: Refresh Cookie Path Scoping

The refresh cookie MUST be issued with `path: '/api/users/refresh'`, distinct from the default `path: '/'` used by `m3d_auth`, `m3d_csrf`, and `m3d_user`, so it is never sent on any other request.

#### Scenario: Refresh cookie is scoped to the refresh route
- GIVEN a successful login
- WHEN the refresh cookie is set
- THEN its `Set-Cookie` attributes MUST include `Path=/api/users/refresh`

#### Scenario: Refresh cookie is not sent to other endpoints
- GIVEN a client holds the refresh cookie
- WHEN it requests any endpoint other than `/api/users/refresh`
- THEN the browser MUST NOT attach the refresh cookie to that request
