# Delta for session-cookie-security

## ADDED Requirements

### Requirement: Per-Cookie Lifetime Split

All four session cookies MUST use the refresh-token lifetime (2h / 30d per "remember me"), so the UI does not appear logged out while the underlying session is still alive.

**`m3d_auth` is deliberately included.** What stays short is the JWT *inside* it, whose `exp` MUST equal the access-token TTL (fixed, env-tunable, default 30 minutes) and which `apiAuthMiddleware` MUST reject once expired. The cookie must outlive that token so `logout` can still read `familyId` from it and revoke the refresh family; giving the cookie the token's TTL made the browser delete it, and logout then had nothing to revoke from — silently leaving the session alive for up to 30 days.

A stale `m3d_auth` therefore authenticates nothing. Its only remaining capability is revoking its own family, which removes authority rather than granting it.

#### Scenario: The auth cookie outlives the token it carries
- GIVEN a successful login
- WHEN `m3d_auth` is issued
- THEN its `maxAge` MUST equal the refresh-token lifetime for that "remember me" value
- AND the JWT inside it MUST carry an `exp` of exactly the access-token TTL

#### Scenario: An expired access token is still rejected for authentication
- GIVEN an `m3d_auth` cookie whose JWT has passed its `exp`
- WHEN it is presented to a route behind `apiAuthMiddleware`
- THEN the request MUST be rejected with 401

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
