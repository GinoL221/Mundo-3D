# Refresh Token Rotation Specification

## Purpose

Introduces a revocable, rotating refresh token alongside the short-lived JWT access token, so that logout and future revocation are real, not a client-side illusion.

## Requirements

### Requirement: Refresh Endpoint

The system MUST expose `POST /api/users/refresh` that authenticates solely via the refresh cookie and issues a new access token. It MUST NOT require the current access token (`m3d_auth`) to be valid or unexpired. The route MUST NOT be mounted behind `apiAuthMiddleware`, MUST be exempt from `csrfGuard`, and MUST be rate-limited.

#### Scenario: Refresh succeeds with an expired access token
- GIVEN a client holds an expired `m3d_auth` cookie and a valid, unexpired refresh cookie
- WHEN it sends `POST /api/users/refresh`
- THEN the response MUST be 200 OK with a freshly issued access token cookie

#### Scenario: Refresh rejected without a valid refresh cookie
- GIVEN the refresh cookie is absent, expired, revoked, or malformed
- WHEN `POST /api/users/refresh` is sent
- THEN the response MUST be 401 Unauthorized

#### Scenario: Cross-site refresh request is rejected
- GIVEN a cross-site POST to `/api/users/refresh` where the browser does not attach the `sameSite: lax` refresh cookie
- WHEN the request reaches the server
- THEN it MUST be treated as missing the refresh cookie and rejected 401

#### Scenario: Refresh rate limit
- GIVEN a client exceeds the configured refresh rate limit
- WHEN it sends further `POST /api/users/refresh` requests
- THEN the response MUST be 429 Too Many Requests

### Requirement: Refresh Token Carries the Remember Distinction

The refresh token's lifetime MUST be 2 hours by default and 30 days when the originating login requested "remember me". The access token's lifetime MUST NOT vary with "remember me" (see `api-jwt-auth`).

#### Scenario: Remembered session issues a 30-day refresh token
- GIVEN a login with `remember: true`
- WHEN session cookies are issued
- THEN the refresh token's expiration MUST be 30 days

#### Scenario: Default session issues a 2-hour refresh token
- GIVEN a login without `remember`
- WHEN session cookies are issued
- THEN the refresh token's expiration MUST be 2 hours

### Requirement: Rotation on Every Use With a Grace Window

Every successful refresh MUST rotate the presented token: its row MUST be marked superseded (`superseded_at`, `successor_hash` set) and a new row MUST be created in the same `family_id`. Presenting a token superseded less than 30 seconds ago MUST succeed WITHOUT rotating again, issuing only a fresh access cookie and setting **no** refresh cookie. Presenting a token superseded 30+ seconds ago MUST fail.

`successor_hash` is a SHA-256 digest and the plaintext token is never stored, so a grace hit **cannot** return the successor token — it must not try. Omitting the refresh cookie is a correctness requirement, not an optimisation: both tabs share one cookie jar, the rotation winner's `Set-Cookie` has already installed the successor, and a losing response that also wrote a refresh cookie would overwrite it with the superseded value and pin the session to a token expiring in 30 seconds. Only the rotation winner may write the refresh cookie.

#### Scenario: Successful refresh rotates the token
- GIVEN a current, non-superseded refresh token
- WHEN `POST /api/users/refresh` succeeds
- THEN the used row is marked superseded with a `successor_hash`
- AND a new row in the same `family_id` is created as current

#### Scenario: Grace hit issues an access cookie only, without re-rotating
- GIVEN a refresh token superseded less than 30s ago
- WHEN it is presented again to `POST /api/users/refresh`
- THEN the response MUST succeed and set a fresh access cookie
- AND the response MUST NOT set a refresh cookie
- AND no additional rotation MUST occur

#### Scenario: Replay past the grace window fails
- GIVEN a refresh token superseded more than 30s ago
- WHEN it is presented again to `POST /api/users/refresh`
- THEN the response MUST be 401

#### Scenario: Family id is populated on every row
- GIVEN any `RememberToken` row created by login or rotation
- WHEN the row is inspected
- THEN `family_id` MUST be a non-null value shared with every other row from the same login

### Requirement: Concurrent Refresh From Multiple Tabs

Two tabs refreshing at nearly the same moment using the token valid at that instant MUST both end up authenticated, relying on the grace window rather than client-side coordination.

#### Scenario: Two tabs refresh concurrently and both stay logged in
- GIVEN two browser tabs share the same refresh cookie and both trigger a refresh within the grace window of each other
- WHEN both requests are processed
- THEN both tabs MUST end up with a valid access token and neither MUST be logged out

### Requirement: Retention on Rotation

Each refresh that **rotates** MUST delete rows from that token's family that are already superseded past the grace window, bounding storage growth without a scheduled job.

A grace hit deliberately reaps nothing. It writes no row and takes no lock, and keeping that path free of side effects is what lets concurrent tabs resolve against one another without contending — see "Rotation on Every Use With a Grace Window". Since only rotation creates rows, tying reaping to rotation still bounds the family: every row added is matched by a pass that can remove its predecessors.

#### Scenario: Old superseded rows are reaped on rotation
- GIVEN a family has rows superseded more than 30s ago
- WHEN a refresh in that family rotates
- THEN those past-grace superseded rows MUST be deleted

#### Scenario: A grace hit leaves the family untouched
- GIVEN a refresh token superseded less than 30s ago
- WHEN it is presented and served from the grace window
- THEN no row in that family MUST be deleted, created or modified
- AND the current row and any in-grace superseded row MUST remain
