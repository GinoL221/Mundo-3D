# E2E Testing Specification

## Purpose

Defines end-to-end (E2E) testing specifications for verification of the authentication and shopping cart flows.

## Requirements

### Requirement: E2E Authentication Verification

E2E suite MUST validate registration, login, invalid credentials, and logout. Logout MUST verify session destruction and redirection to `/login` as guest.

#### Scenario: Successful User Registration

- GIVEN a guest user is on the registration page
- WHEN they fill in valid registration details and submit the form
- THEN they MUST be redirected to the homepage
- AND their session state MUST show them as successfully authenticated

#### Scenario: Successful User Login

- GIVEN a registered user is on the login page
- WHEN they enter correct credentials and submit
- THEN they MUST be redirected to the homepage
- AND the header navigation MUST display their authenticated user status

#### Scenario: Invalid Credentials Handling

- GIVEN a user is on the login page
- WHEN they submit invalid email or password details
- THEN the system MUST NOT authenticate the session
- AND the login page MUST display an appropriate validation error message

#### Scenario: User Logout

- GIVEN an authenticated user is on any application page
- WHEN they click the logout button in the header
- THEN their authentication session MUST be destroyed
- AND they MUST be redirected to `/login` as a guest

### Requirement: E2E Cart & Navigation Verification

The E2E testing suite MUST validate guest shopping cart interactions, header cart badge updates, cart page state persistence, and redirect behavior for guests attempting checkout.

#### Scenario: Add Product to Cart as Guest

- GIVEN a guest user is on a product details page
- WHEN they click the "Add to Cart" button
- THEN the product MUST be added to their local cart session
- AND the local Nano Store state MUST update immediately

#### Scenario: Header Badge Updates

- GIVEN a guest user has items in the cart
- WHEN they increment the quantity of a product
- THEN the cart badge in the header navigation MUST immediately update to reflect the new total count

#### Scenario: Persisting Items inside Cart View

- GIVEN a guest user has added multiple products to the cart
- WHEN they navigate directly to the cart page
- THEN the page MUST render all selected items, correct quantities, and the correct calculated total

#### Scenario: Checkout Navigation Guest Redirect

- GIVEN a guest user has items in their cart and is on the cart page
- WHEN they click the "Proceed to Checkout" button
- THEN the system MUST redirect them to the login page to authenticate before completing checkout

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

## Technical Notes & CI Infrastructure

### CI Workflow Warnings (Infrastructure Debt)

- **Deprecation Warning**: The GHA workflow displays a warning regarding Node.js 20 deprecation because actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`, `pnpm/action-setup@v4`) target Node.js 20.
- **Resolution Strategy**: Upgrading these actions to Node.js 24 compatible versions (e.g. `@v5` / `@v6`) is deferred. Specifically, `pnpm/action-setup@v6` has reported issues with monorepo root config parsing. It is advised to keep `@v4` for stability and perform upgrades once newer stable minor versions are released.
