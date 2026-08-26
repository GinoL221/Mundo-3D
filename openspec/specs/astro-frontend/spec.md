# Astro Frontend Specification

This specification defines the architectural rules, file organization, routing, layouts, and component standards for the migrated Astro frontend.

## Requirements

### Requirement: Astro Project Structure and Decoupled Architecture
The Astro frontend MUST be organized in a decoupled directory structure under `/frontend` in the project root. It MUST contain distinct directories for layouts, pages, and components.

#### Scenario: Astro workspace initialization
- GIVEN the project directory structure
- WHEN the Astro frontend is compiled or built
- THEN the codebase MUST be located inside the `frontend/` directory
- AND the source files MUST follow the structure:
  - `frontend/src/pages/` for page routes
  - `frontend/src/components/` for reusable components
  - `frontend/src/layouts/` for pages layouts
  - `frontend/public/` for static assets

### Requirement: Astro Global Layout and Styling Integration
The frontend MUST utilize a reusable layout component that loads global styles from the shared Vanilla CSS stylesheet, ensuring visual consistency across all pages.

#### Scenario: Global layout imports Vanilla CSS
- GIVEN a layout file at `frontend/src/layouts/Layout.astro`
- WHEN a page uses this layout
- THEN the rendered HTML page MUST link the global stylesheet `public/css/styles.css` (or equivalent Vanilla CSS file)
- AND render pages within a unified layout header, nav, and footer structure

### Requirement: Static Page Pre-rendering (SSG)
Static pages (`/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`) MUST be configured to pre-render at build time (SSG) to ensure rapid loading.

#### Scenario: SSG pages build static HTML files
- GIVEN the Astro build command is run
- WHEN pre-rendering static routes
- THEN Astro MUST compile `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` into static HTML files
- AND these files MUST NOT require active backend database connections or use dynamic runtime queries on load

### Requirement: Dynamic Content Fetching
For dynamic views (such as the homepage `/` product list or product detail pages), Astro components MUST fetch JSON data from the Express REST API.

#### Scenario: Homepage renders products from API fetch
- GIVEN a client requests the homepage `/`
- WHEN the homepage component renders
- THEN the component MUST make a fetch request to `/api/products` on the Express backend
- AND parse the JSON response to render the dynamic list of product components

### Requirement: Corrected Fetch Handling and camelCase Property Mapping
The Astro pages fetching products from `/api/products` MUST correctly extract the products array from the response envelope (`resData.products`) and consume camelCase product properties.

#### Scenario: Products Catalog and Home fetching
- GIVEN the Astro client-side script running on `/` or `/products`
- WHEN it performs a fetch to `http://localhost:3000/api/products`
- THEN it MUST parse the JSON response as an object envelope (e.g., `resData`)
- AND it MUST extract the products list from `resData.products`
- AND it MUST render each product using camelCase properties:
  - `product.idProduct` (instead of `product.IDProduct`)
  - `product.nameProduct` (instead of `product.NameProduct`)
  - `product.price` (instead of `product.Price`)
  - `product.Category` (as a flat string representation of the category name, e.g. mapping `product.Category || 'Otras'`)

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
