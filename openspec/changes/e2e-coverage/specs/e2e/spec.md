# Delta for E2E

## MODIFIED Requirements

### Requirement: E2E Authentication Verification

E2E suite MUST validate registration (success and rejection), login, invalid credentials, and logout, verifying session destruction and redirect to `/login` on logout. Registration rejections MUST be asserted via the frontend's error surface, not raw API calls, and MUST NOT create a user.
(Previously: only registration success was covered; rejection paths were untested.)

#### Scenario: Successful User Registration

- GIVEN a guest user is on the registration page
- WHEN they fill in valid details and submit the form
- THEN they MUST be redirected to the homepage
- AND their session MUST show authentication

#### Scenario: Successful User Login

- GIVEN a registered user is on the login page
- WHEN they enter correct credentials and submit
- THEN they MUST be redirected to the homepage
- AND the header MUST display their authenticated status

#### Scenario: Invalid Credentials Handling

- GIVEN a user is on the login page
- WHEN they submit invalid email or password
- THEN the system MUST NOT authenticate the session
- AND the login page MUST display a validation error

#### Scenario: User Logout

- GIVEN an authenticated user is on any page
- WHEN they click the logout button in the header
- THEN their session MUST be destroyed
- AND they MUST be redirected to `/login` as a guest

#### Scenario: Duplicate Email Registration Rejected

- GIVEN a guest submits registration with an email already in use
- WHEN the form is submitted
- THEN the backend MUST respond 400 and no user MUST be created
- AND the page MUST render the rejection

#### Scenario: Missing Image Registration Rejected

- GIVEN a guest submits registration without an image
- WHEN the form is submitted
- THEN the backend MUST respond 400 with message "Tienes que subir una imagen"
- AND the page MUST render that exact message; no user MUST be created

## ADDED Requirements

### Requirement: E2E Admin Product Management Verification

The E2E suite MUST validate role-gated visibility, CRUD, and session-loss handling for the admin product area. Tests MUST create and clean fixture products; seeded rows MUST NOT be touched.

#### Scenario: Role-Based Visibility

- GIVEN ADMIN, STAFF, regular USER, and guest users
- WHEN each navigates to the admin products area
- THEN it MUST be reachable and render only for ADMIN and STAFF

#### Scenario: Delete Restricted to Admin

- GIVEN STAFF and ADMIN each view a product row in the admin area
- WHEN row actions are inspected
- THEN only ADMIN MUST see a delete action

#### Scenario: Full Product CRUD Lifecycle

- GIVEN an ADMIN user in the admin products area
- WHEN they create a product, edit it, then trigger delete
- THEN create and edit MUST persist and reflect in the UI
- AND delete MUST require confirmation, leaving the product intact on decline and removed on confirm

#### Scenario: Stock Adjust Client-Side Double-Click Guard

- GIVEN a stock-adjust request is in flight for a test-created product
- WHEN the ADMIN clicks the control again before it resolves
- THEN the second click MUST have no additional effect
- AND backend atomicity remains out of scope

#### Scenario: 401 Mid-Session Redirects Silently

- GIVEN an ADMIN session becomes invalid server-side in the admin area
- WHEN an action receives a 401
- THEN the client MUST clear the session and redirect to `/login` silently
- AND no message shows and no form state persists

### Requirement: E2E Product Listing/Detail Error & Empty State Verification

The E2E suite MUST validate that listing and detail pages render their error and empty-state branches, via route interception, not backend failure injection.

#### Scenario: Listing Renders Error State on API Failure

- GIVEN the listing API is intercepted to fail
- WHEN a user visits the listing page
- THEN it MUST render its error-state template

#### Scenario: Listing Renders Empty State on Zero Products

- GIVEN the listing API is intercepted to return zero products
- WHEN a user visits the listing page
- THEN it MUST render its empty-state template

#### Scenario: Detail Page Renders Error State for Invalid Product

- GIVEN an invalid or nonexistent product id in the URL
- WHEN the detail page loads
- THEN it MUST render its error state
