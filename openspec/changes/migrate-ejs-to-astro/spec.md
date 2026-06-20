# Combined Change Specification: Migrate EJS to Astro

This document consolidates the new and modified specifications for the `migrate-ejs-to-astro` change, refactoring the frontend to Astro and Express into a headless JSON REST API.

---

## 1. astro-frontend (New Capability)

This specification defines the architectural rules, file organization, routing, layouts, and component standards for the migrated Astro frontend.

### Requirements

#### Requirement: Astro Project Structure and Decoupled Architecture
The Astro frontend MUST be organized in a decoupled directory structure under `/frontend` in the project root. It MUST contain distinct directories for layouts, pages, and components.

##### Scenario: Astro workspace initialization
- GIVEN the project directory structure
- WHEN the Astro frontend is compiled or built
- THEN the codebase MUST be located inside the `frontend/` directory
- AND the source files MUST follow the structure:
  - `frontend/src/pages/` for page routes
  - `frontend/src/components/` for reusable components
  - `frontend/src/layouts/` for pages layouts
  - `frontend/public/` for static assets

#### Requirement: Astro Global Layout and Styling Integration
The frontend MUST utilize a reusable layout component that loads global styles from the shared Vanilla CSS stylesheet, ensuring visual consistency across all pages.

##### Scenario: Global layout imports Vanilla CSS
- GIVEN a layout file at `frontend/src/layouts/Layout.astro`
- WHEN a page uses this layout
- THEN the rendered HTML page MUST link the global stylesheet `public/css/styles.css` (or equivalent Vanilla CSS file)
- AND render pages within a unified layout header, nav, and footer structure

#### Requirement: Static Page Pre-rendering (SSG)
Static pages (`/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`) MUST be configured to pre-render at build time (SSG) to ensure rapid loading.

##### Scenario: SSG pages build static HTML files
- GIVEN the Astro build command is run
- WHEN pre-rendering static routes
- THEN Astro MUST compile `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` into static HTML files
- AND these files MUST NOT require active backend database connections or use dynamic runtime queries on load

#### Requirement: Dynamic Content Fetching
For dynamic views (such as the homepage `/` product list or product detail pages), Astro components MUST fetch JSON data from the Express REST API.

##### Scenario: Homepage renders products from API fetch
- GIVEN a client requests the homepage `/`
- WHEN the homepage component renders
- THEN the component MUST make a fetch request to `/api/products` on the Express backend
- AND parse the JSON response to render the dynamic list of product components

---

## 2. nano-stores-cart (New Capability)

This specification defines the client-side cart state management using Nano Stores and its asynchronous, non-blocking synchronization with the Express backend API.

### Requirements

#### Requirement: Client-side Cart State with Nano Stores
The frontend MUST manage cart state locally using Nano Stores to allow immediate, reactive UI updates.

##### Scenario: Cart item addition updates local state instantly
- GIVEN a user clicks "Add to Cart" on a product
- WHEN the local Nano Store cart action executes
- THEN the cart count and items list in the UI MUST update immediately
- AND the store state MUST reflect the added product without waiting for server confirmation

#### Requirement: Asynchronous, Non-blocking API Synchronization
Local cart changes MUST trigger background asynchronous fetch requests to `/api/cart` to persist changes on the server. The UI must remain responsive and not block the user during synchronization.

##### Scenario: Background sync of cart item to backend
- GIVEN the local Nano Store state has updated
- WHEN the sync effect triggers in the background
- THEN a non-blocking asynchronous POST/PUT request MUST be dispatched to `/api/cart`
- AND the user MUST be able to continue interacting with the page during the network exchange

##### Scenario: Backend sync failure handles errors gracefully
- GIVEN the background fetch request to `/api/cart` fails (e.g., due to network loss or server error)
- WHEN the synchronization attempt fails
- THEN the system MUST revert the local Nano Store to its previous valid state
- AND display a non-blocking UI alert indicating the synchronization failure

---

## 3. user-auth (Modified Capability)

This delta specification modifies the user and authentication specification to transition from server-rendered EJS sessions to client-side JWT-based authentication.

### 1. Structural Layering Rules

- **Infrastructure Layer (`src/infrastructure`)**:
  - **Controllers/Middlewares**: 
    (Previously: MUST handle HTTP mapping using camelCase keys (e.g., `req.body.email`). They MUST instantiate adapters, inject them into Use Cases, and handle domain exceptions to return appropriate HTTP responses or render relative views.)
    MUST handle HTTP mapping using camelCase keys (e.g., `req.body.email`). They MUST instantiate adapters, inject them into Use Cases, and handle domain exceptions to return appropriate HTTP responses in JSON format, containing JWT access tokens on success. They MUST NOT render views or issue session cookies.

### 2. BDD Scenarios

#### Scenario 4: Controller Dependency Injection and API JSON Authentication
(Previously: Given an Express Controller handling user registration or login
When an HTTP request is received
Then the controller MUST validate syntactic inputs
And it MUST call the appropriate Use Case by injecting the correct infrastructure adapters (Sequelize repositories, Bcrypt/SHA-256 security services)
And it MUST catch Domain Exceptions to render views using relative path syntax (e.g., `res.render('users/login')` or `res.render('users/register')`) without using `path.join` or absolute paths)

Given an Express Controller handling user registration or login
When an HTTP request is received
Then the controller MUST validate syntactic inputs
And it MUST call the appropriate Use Case by injecting the correct infrastructure adapters (Sequelize repositories, Bcrypt/SHA-256 security services)
And it MUST catch Domain Exceptions to return structured JSON responses with an appropriate HTTP status (e.g., 400 Bad Request, 401 Unauthorized)
And on successful authentication (login or register), the response MUST contain the generated JWT token in the JSON body, and the controller MUST NOT issue session cookies or render HTML views

---

## 4. api-jwt-auth (Modified Capability)

This delta specification defines updates to the API token validation rules to secure write operations, admin views, and profile endpoints using Bearer JWT tokens.

### Requirements

#### Requirement: Bearer Token Authorization for Protected API Endpoints
(Previously: All API endpoints matching the pattern `/api/users*` (excluding `/api/users/login`) MUST require a valid JWT token passed via the HTTP `Authorization` header as `Bearer <token>`.)

All API endpoints matching the pattern `/api/users*` (excluding `/api/users/login`), all API write actions (POST, PUT, DELETE) on any resources, profile endpoints, and admin-restricted API views MUST require a valid JWT token passed via the HTTP `Authorization` header as `Bearer <token>`.

##### Scenario: Request to protected API without token
(Previously: 
- GIVEN a GET request is made to `/api/users`
- WHEN no `Authorization` header is provided
- THEN the response status MUST be 401 Unauthorized)

- GIVEN a request is made to a protected API endpoint (e.g., GET `/api/users`, GET `/api/profile`, or POST/PUT/DELETE to `/api/products`)
- WHEN no `Authorization` header is provided
- THEN the response status MUST be 401 Unauthorized

##### Scenario: Request to protected API with invalid token
(Previously: 
- GIVEN a GET request is made to `/api/users`
- WHEN the `Authorization` header contains an invalid or expired token
- THEN the response status MUST be 401 Unauthorized)

- GIVEN a request is made to a protected API endpoint
- WHEN the `Authorization` header contains an invalid or expired token
- THEN the response status MUST be 401 Unauthorized

##### Scenario: Request to protected API with valid token
(Previously: 
- GIVEN a GET request is made to `/api/users`
- WHEN the `Authorization` header contains a valid `Bearer <token>` signed with the application secret
- THEN the response status MUST be 200 OK
- AND the response MUST contain the requested user data)

- GIVEN a request is made to a protected API endpoint
- WHEN the `Authorization` header contains a valid `Bearer <token>` signed with the application secret
- THEN the response status MUST be 200 OK (or 201 Created for write actions)
- AND the response MUST contain the requested payload data

##### Scenario: Request to admin-only API view with non-admin token
- GIVEN a request is made to an admin-restricted API endpoint (e.g., `/api/admin/dashboard` or other admin views)
- WHEN the `Authorization` header contains a valid `Bearer <token>` of a user who is not an admin
- THEN the response status MUST be 403 Forbidden

---

## 5. static-pages-controller (Modified Capability)

This delta specification defines the retirement of Express server-side rendering (SSR) for static routes and the homepage, transitioning them to the Astro frontend.

### Requirements

#### Requirement: Pure-Render Static Page Retirement from Express
(Previously: The system MUST serve `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` via `StaticPagesController` (TypeScript), each rendering the same view it rendered before migration, with identical HTTP status and no behavioral change.)

The Express backend MUST NOT serve or render HTML views for `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help`. These routes are retired from Express and will be pre-rendered using SSG on the Astro frontend.

##### Scenario: Express backend returns 404 for retired static routes
- GIVEN a request to `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, or `/help` on the Express port
- WHEN the request is received by the Express application
- THEN the Express application MUST NOT route it to a view engine and MUST return a 404 Not Found

#### Requirement: Home Route SSR Retirement from Express
(Previously: The system MUST serve `/` by rendering the `index` view with products obtained from `ListProductsUseCase`, replacing the legacy direct call to `productService.js`.)

The Express backend MUST NOT render the `index` view or serve the `/` homepage route. The homepage route is retired from Express SSR and transitioned to Astro. The Express backend will only serve products as JSON via `/api/products`.

##### Scenario: Express backend does not render EJS for home route
- GIVEN a request to `/` on the Express application port
- WHEN the request is received by the Express application
- THEN it MUST NOT call `ListProductsUseCase` to render an HTML page
- AND it MUST NOT use the EJS view engine

#### Requirement: Test Suite Retargeting
(Previously: The migration MUST keep `footerPages.test.js` passing without modification, and MUST update (not delete) the brittle path/content assertions in `backendLayeringPR3.test.js` so they reference the new TypeScript structure instead of the removed legacy files.)

The Express test suite (`footerPages.test.js`, `backendLayeringPR3.test.js`) MUST be retired or adapted to test the REST API endpoints and behavior rather than HTML page rendering.

##### Scenario: Retired Express view tests are removed or adapted
- GIVEN view-related test suites on the Express backend
- WHEN the EJS engine and views are retired
- THEN all tests verifying EJS rendering MUST be deleted or migrated to verify JSON outputs on `/api` endpoints

---

## 6. upload-middleware (Modified Capability)

This delta specification defines updates to the upload middleware to support and validate fetch-based multipart form-data requests, returning JSON error or success responses.

### Requirements

#### Requirement: Parameterizable Upload Factory for Fetch-based Multipart Data
(Previously: `src/middlewares/upload.js` MUST export a factory function that accepts a `dest` option and returns a configured multer instance with uuid-based filenames. The factory SHALL accept an options object `{ dest: string }`.)

The parameterizable upload factory MUST process multipart form-data requests sent via client-side `fetch` from the Astro frontend. The Express middleware MUST parse the uploaded files, validate constraints (such as max file size and allowed image formats), and handle upload errors by returning structured JSON error responses rather than rendering HTML error pages.

##### Scenario: Factory handles successful upload via fetch
(Previously: 
- GIVEN `upload({ dest: 'public/img/products' })` is called
- THEN the returned multer instance SHALL store files in `public/img/products`
- AND filenames SHALL use `uuidv4() + extension`)

- GIVEN an endpoint configured with `upload({ dest: 'public/img/products' })`
- WHEN a fetch-based multipart form-data request containing a valid image is received
- THEN the middleware MUST save the file to `public/img/products` using `uuidv4() + extension`
- AND the controller/route handler MUST return a JSON response containing the saved file details

##### Scenario: Factory handles file format and size validation errors
- GIVEN an endpoint configured with `upload({ dest: 'public/img/products' })`
- WHEN a client sends a fetch-based request with an invalid file format (e.g. text file) or a file exceeding size limits
- THEN the upload middleware / error handling middleware MUST catch the multer error
- AND return a 400 Bad Request JSON response with a clear error payload (e.g., `{ error: "Invalid file format or size limit exceeded" }`)
