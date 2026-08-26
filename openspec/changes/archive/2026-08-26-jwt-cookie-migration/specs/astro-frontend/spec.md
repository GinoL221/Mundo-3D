# Delta for Astro Frontend

## ADDED Requirements

### Requirement: No Script-Readable Auth Token Storage

The frontend MUST NOT persist the JWT in `localStorage`, `sessionStorage`, or any other script-readable storage. Requests to protected API endpoints MUST rely on the browser automatically sending the httpOnly auth cookie, using credentialed requests (e.g. `credentials: 'include'`) instead of a manually attached `Authorization: Bearer` header.

#### Scenario: No token persisted after login

- GIVEN a user submits valid login credentials
- WHEN the login request succeeds
- THEN no JWT value MUST be written to `localStorage`, `sessionStorage`, or any cookie readable via `document.cookie`

#### Scenario: Protected requests send credentials instead of a header

- GIVEN a logged-in user's browser holds the auth cookie
- WHEN the frontend calls a protected API endpoint (e.g. cart, admin product management)
- THEN the request MUST be sent with credentials included
- AND the request MUST NOT set a manual `Authorization: Bearer` header

### Requirement: Non-Sensitive Session Data for UI Gating

Since the auth cookie is not readable by JavaScript, the system MUST provide the frontend a way to obtain non-sensitive session data (at least role/admin-access status) needed to gate navbar and admin UI, without exposing the raw JWT.

#### Scenario: Frontend determines admin-area access without reading the token

- GIVEN a logged-in ADMIN or STAFF user
- WHEN the frontend evaluates whether to show admin navigation
- THEN it MUST be able to determine admin-area access from non-sensitive session data
- AND the JWT itself MUST remain inaccessible to that check

#### Scenario: Guest sees no admin gating

- GIVEN a client with no active session
- WHEN the frontend evaluates admin-area access
- THEN it MUST resolve to "no admin access" without erroring

### Requirement: Cross-Tab Session Synchronization

The system MUST notify other open tabs of a login or logout so navbar/admin gating updates without a page reload, since an httpOnly cookie change does not fire the browser `storage` event.

#### Scenario: Logout in one tab updates gating in another open tab

- GIVEN a user is logged in across two open tabs
- WHEN the user logs out in one tab
- THEN the other tab MUST reflect the logged-out state without a manual reload

#### Scenario: Login in one tab updates gating in another open tab

- GIVEN a guest has two open tabs
- WHEN the user logs in via one tab
- THEN the other tab MUST reflect the logged-in state without a manual reload

### Requirement: Functional Remember-Me Selection

The login form's "Recuérdame" checkbox MUST be read on submit and communicated to the login request. Checking it MUST result in an extended-lifetime session; leaving it unchecked MUST keep the default `2h` session.

#### Scenario: Checking Recuérdame extends the session

- GIVEN a user checks "Recuérdame" before submitting login
- WHEN the login succeeds
- THEN the resulting session MUST outlive the default `2h` expiration

#### Scenario: Leaving Recuérdame unchecked keeps the default session

- GIVEN a user submits login without checking "Recuérdame"
- WHEN the login succeeds
- THEN the resulting session MUST expire at the default `2h`
