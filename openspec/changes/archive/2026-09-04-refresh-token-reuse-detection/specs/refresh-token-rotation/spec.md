# Delta for refresh-token-rotation

## ADDED Requirements

### Requirement: Refresh Token Reuse Detection

Following a family revocation triggered by a past-grace token replay (see "Rotation on Every Use With a Grace Window"), every other row in that family, including the current one, MUST be rejected on any later refresh attempt. The reuse event MUST be logged server-side with the family id. The HTTP response MUST remain 401 Unauthorized, indistinguishable from an ordinary invalid-refresh-token rejection — no extra field, header, or status code may reveal that detection fired.

Placement: `refresh-token-rotation`, not `api-jwt-auth` — the aftermath (family-wide rejection, indistinguishable response, logging) is rotation-state behavior this spec already owns; `api-jwt-auth`'s Logout Endpoint is a different trigger (explicit user action).

#### Scenario: Every family member is rejected after detection
- GIVEN a family was revoked by a detected reuse
- WHEN any token from that family, including the current one, is later presented to `POST /api/users/refresh`
- THEN the response MUST be 401 Unauthorized

#### Scenario: The reuse response is indistinguishable from an ordinary rejection
- GIVEN a detected reuse and, separately, an ordinary invalid/expired/revoked refresh token
- WHEN each is presented to `POST /api/users/refresh`
- THEN both responses MUST have the same status code and body

#### Scenario: Reuse is logged server-side
- GIVEN a detected reuse
- WHEN the family is revoked
- THEN a log entry MUST be recorded server-side identifying the family id

## MODIFIED Requirements

### Requirement: Retention on Rotation

Each refresh that **rotates** MUST delete rows from that token's family superseded more than 24 hours ago, bounding storage growth without a scheduled job. This cutoff is independent of the 30-second grace window in "Rotation on Every Use With a Grace Window": grace decides accept-vs-reject; retention decides how long a superseded row survives for later inspection, including reuse detection.

A grace hit deliberately reaps nothing. It writes no row and takes no lock, and keeping that path free of side effects is what lets concurrent tabs resolve against one another without contending — see "Rotation on Every Use With a Grace Window". Since only rotation creates rows, tying reaping to rotation still bounds the family: every row added is matched by a pass that can remove predecessors older than the cutoff. At the ~30-minute rotation cadence, a family reaches steady state around 48 rows (24h ÷ 30min) versus ~2 rows under the old 30-second cutoff.
(Previously: reaped rows superseded past the 30-second grace window on every rotation, coupling retention to grace and destroying reuse evidence before it could be inspected.)

#### Scenario: Rows past the retention cutoff are reaped
- GIVEN a family has rows superseded more than 24 hours ago
- WHEN a refresh in that family rotates
- THEN those rows MUST be deleted

#### Scenario: A row survives well past the old cutoff
- GIVEN a refresh token row superseded at time T
- WHEN a rotation in the same family occurs at T + 1 hour
- THEN that row MUST still be present, proving the retention cutoff is no longer 30 seconds

#### Scenario: A grace hit leaves the family untouched
- GIVEN a refresh token superseded less than 30s ago
- WHEN it is presented and served from the grace window
- THEN no row in that family MUST be deleted, created or modified
- AND the current row and any in-grace superseded row MUST remain
- AND the family MUST NOT be revoked

### Requirement: Rotation on Every Use With a Grace Window

Every successful refresh MUST rotate the presented token: its row MUST be marked superseded (`superseded_at`, `successor_hash` set) and a new row MUST be created in the same `family_id`. Presenting a token superseded less than 30 seconds ago MUST succeed WITHOUT rotating again, issuing only a fresh access cookie and setting **no** refresh cookie. Presenting a token superseded 30+ seconds ago MUST fail; if that token's row is still within the 24-hour retention cutoff (see "Retention on Rotation"), the rejection MUST also revoke every row in the token's family (see "Refresh Token Reuse Detection").

`successor_hash` is a SHA-256 digest and the plaintext token is never stored, so a grace hit **cannot** return the successor token — it must not try. Omitting the refresh cookie is a correctness requirement, not an optimisation: both tabs share one cookie jar, the rotation winner's `Set-Cookie` has already installed the successor, and a losing response that also wrote a refresh cookie would overwrite it with the superseded value and pin the session to a token expiring in 30 seconds. Only the rotation winner may write the refresh cookie.
(Previously: a replay past the grace window returned 401 with no other effect; the family survived and could be replayed again indefinitely.)

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

#### Scenario: A past-grace replay revokes the family
- GIVEN a refresh token superseded more than 30s ago but less than 24 hours ago
- WHEN it is presented again to `POST /api/users/refresh`
- THEN the response MUST be 401
- AND every row sharing that token's `family_id` MUST be revoked

### Requirement: Concurrent Refresh From Multiple Tabs

Two tabs refreshing at nearly the same moment using the token valid at that instant MUST both end up authenticated, relying on the grace window rather than client-side coordination. Reuse detection MUST NOT interfere with this: it fires only on a past-grace replay (see "Rotation on Every Use With a Grace Window"), never on a grace hit.
(Previously: did not state how this guarantee interacts with reuse detection, since reuse detection did not exist.)

#### Scenario: Two tabs refresh concurrently and both stay logged in
- GIVEN two browser tabs share the same refresh cookie and both trigger a refresh within the grace window of each other
- WHEN both requests are processed
- THEN both tabs MUST end up with a valid access token and neither MUST be logged out

#### Scenario: A losing tab's grace hit never triggers reuse detection
- GIVEN two tabs race and the losing tab's request is served from the grace window (a row-5 grace hit)
- WHEN that request is processed
- THEN the family MUST NOT be revoked and no reuse event MUST be logged
