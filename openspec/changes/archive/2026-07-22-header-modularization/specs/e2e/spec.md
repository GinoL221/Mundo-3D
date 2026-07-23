# Delta for e2e

## MODIFIED Requirements

### Requirement: E2E Authentication Verification

E2E suite MUST validate registration, login, invalid credentials, and logout. Logout MUST verify session destruction and redirection to `/login` as guest.
(Previously: Logout verification expected redirection to the homepage.)

#### Scenario: Successful User Registration

- GIVEN a guest is on registration
- WHEN valid details are submitted
- THEN the user MUST reach the authenticated homepage

#### Scenario: Successful User Login

- GIVEN a registered user is on login
- WHEN correct credentials are submitted
- THEN the user MUST reach the homepage and Header MUST show authenticated status

#### Scenario: Invalid Credentials Handling

- GIVEN a user is on login
- WHEN invalid credentials are submitted
- THEN the session MUST remain unauthenticated and an error MUST display

#### Scenario: User Logout

- GIVEN an authenticated user is on any application page
- WHEN they click Header logout
- THEN the session MUST be destroyed and the user redirected to `/login` as guest
