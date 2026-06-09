# Specs: audit-gentleman-best-practices

## Non-Regression Requirement

All existing features (user registration, login, product CRUD, shopping cart, admin panel, seed data) MUST continue working after each phase. No phase MUST break any existing route or user flow.

---

# Security Middleware Specification

## Purpose

Protects the Express app from common web vulnerabilities and ensures unhandled errors never crash the server.

## Requirements

### Requirement: Session Secret from Environment

The system MUST read the session secret from `process.env.SESSION_SECRET`. The application MUST NOT start if this variable is absent.

#### Scenario: App starts with valid SESSION_SECRET

- GIVEN `SESSION_SECRET` is set in the environment
- WHEN the Express server initializes
- THEN the session middleware uses that value as the secret

#### Scenario: App fails without SESSION_SECRET

- GIVEN `SESSION_SECRET` is not set
- WHEN the Express server initializes
- THEN the application MUST exit with a descriptive error

### Requirement: Security Headers via Helmet

The system MUST apply `helmet` middleware before all routes to set security HTTP headers.

#### Scenario: Responses include security headers

- GIVEN helmet is configured
- WHEN any route responds
- THEN the response includes headers such as `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`

### Requirement: CSRF Protection

The system MUST require a CSRF token on all state-changing requests (POST, PUT, DELETE). The token MUST be available to EJS templates via `res.locals`.

#### Scenario: Form submission with valid CSRF token

- GIVEN a form includes the CSRF token hidden field
- WHEN the user submits the form
- THEN the request is processed normally

#### Scenario: Form submission without CSRF token

- GIVEN a POST request arrives without a CSRF token
- WHEN the server processes it
- THEN the server responds with 403

### Requirement: Global Error-Handling Middleware

The system MUST register a 4-parameter error-handling middleware as the last middleware. Unhandled errors MUST result in a 500 response, never an uncaught exception crash.

#### Scenario: Unhandled error in a route

- GIVEN a route throws an unhandled error
- WHEN the error propagates to Express
- THEN the error middleware catches it and returns status 500

### Requirement: Login Validation Chain

The system MUST validate `email` (valid format) and `password` (non-empty, min 6 chars) on the POST `/login` route before processing credentials.

#### Scenario: Login with invalid email format

- GIVEN a POST to `/login` with email "not-an-email"
- WHEN validation runs
- THEN the response includes an email validation error

#### Scenario: Login with empty password

- GIVEN a POST to `/login` with empty password
- WHEN validation runs
- THEN the response includes a password validation error

### Requirement: Login Rate Limiting

The system MUST apply rate limiting to the POST `/login` route. After 5 failed attempts from the same IP within 15 minutes, subsequent requests MUST be rejected with 429.

#### Scenario: Exceeded login attempts

- GIVEN 5 login attempts from the same IP within 15 minutes
- WHEN a 6th attempt arrives
- THEN the server responds with 429

### Requirement: Cookie User Lookup Excludes Password

The `userLoggedMiddleware` MUST exclude the `PasswordUser` field when querying a user from the cookie email.

#### Scenario: User found by cookie email

- GIVEN a cookie with `userEmail` is present
- WHEN `userLoggedMiddleware` queries the database
- THEN the returned user object does NOT contain `PasswordUser`

---

# Service Layer Specification

## Purpose

Thin service functions encapsulate business logic between controllers and Sequelize models, enabling testability and reuse.

## Requirements

### Requirement: Product Service

The system MUST provide a `ProductService` module in `src/services/` exposing: `findAll()`, `findById(id)`, `create(data)`, `update(id, data)`, `remove(id)`. Each function MUST delegate to Sequelize models and return domain data only (no HTTP concerns).

#### Scenario: Find all products

- GIVEN products exist in the database
- WHEN `ProductService.findAll()` is called
- THEN it returns an array of product objects

#### Scenario: Create product

- GIVEN valid product data
- WHEN `ProductService.create(data)` is called
- THEN a new product row is created and returned

### Requirement: User Service

The system MUST provide a `UserService` module in `src/services/` exposing: `findAll()`, `findByEmail(email)`, `findById(id)`, `create(data)`, `remove(id)`. `findByEmail` MUST exclude the password field from the result.

#### Scenario: Find user by email without password

- GIVEN a user with email "test@test.com" exists
- WHEN `UserService.findByEmail("test@test.com")` is called
- THEN the returned object does NOT contain `PasswordUser`

#### Scenario: Find user by email for authentication

- GIVEN a user exists
- WHEN `UserService.findByEmail(email, { includePassword: true })` is called
- THEN the returned object DOES contain `PasswordUser` for bcrypt comparison

### Requirement: Controllers Delegate to Services

Controllers MUST NOT import Sequelize models directly. They MUST call service functions and handle only HTTP concerns (req, res, status codes, redirects).

#### Scenario: Controller calls service

- GIVEN the product creation controller
- WHEN it processes a request
- THEN it calls `ProductService.create()` and does not call `Product.create()` directly

---

# API Routes Specification

## Purpose

API endpoints live under a dedicated `/api` router with their own middleware chain, separated from web (EJS) routes.

## Requirements

### Requirement: API Router Mount Point

The system MUST mount a separate Express router at `/api` in `app.js`. API routes currently inline in `userRoutes.js` and `productsRoutes.js` MUST move to `src/routes/api/`.

#### Scenario: API endpoint accessible at /api prefix

- GIVEN the API router is mounted at `/api`
- WHEN a GET request to `/api/products` arrives
- THEN the API product list handler responds with JSON

#### Scenario: Web routes unaffected

- GIVEN web routes remain on the root router
- WHEN a GET request to `/products` arrives
- THEN the EJS product list view renders

### Requirement: API Responses Exclude Sensitive Fields

API endpoints returning user data MUST exclude `PasswordUser` from JSON responses.

#### Scenario: API user list excludes passwords

- GIVEN a GET to `/api/users`
- WHEN the response is returned
- THEN no user object contains `PasswordUser`

---

# Developer Quality Specification

## Purpose

Establishes automated testing, linting, formatting, and CI to prevent regressions and enforce code standards.

## Requirements

### Requirement: Jest Test Framework

The system MUST configure Jest as the test runner. `npm test` MUST execute all tests under `src/**/*.test.js`. At least one service test MUST exist and pass.

#### Scenario: Running tests

- GIVEN Jest is configured
- WHEN `npm test` is executed
- THEN Jest discovers and runs test files, reporting pass/fail results

### Requirement: ESLint Configuration

The system MUST include an ESLint configuration file. `npm run lint` MUST validate all `src/` files. Lint errors MUST cause a non-zero exit code.

#### Scenario: Lint passes

- GIVEN code conforms to ESLint rules
- WHEN `npm run lint` is executed
- THEN the command exits with code 0

#### Scenario: Lint fails

- GIVEN code violates an ESLint rule
- WHEN `npm run lint` is executed
- THEN the command exits with a non-zero code

### Requirement: Prettier Configuration

The system MUST include a Prettier configuration file. `npm run format` MUST format all `src/` files.

#### Scenario: Format command runs

- GIVEN Prettier is configured
- WHEN `npm run format` is executed
- THEN all source files are reformatted per the config

### Requirement: GitHub Actions CI

The system MUST include a CI workflow at `.github/workflows/ci.yml` that runs on push to `main` and on pull requests. It MUST execute `npm run lint` and `npm test`.

#### Scenario: CI runs on push

- GIVEN a push to `main`
- WHEN the CI workflow triggers
- THEN lint and test steps execute in order

#### Scenario: CI fails on test failure

- GIVEN a test fails
- WHEN the CI workflow runs
- THEN the workflow marks the run as failed

### Requirement: Environment Variable Template

The system MUST include `.env.example` listing all required environment variables with comments. The file MUST NOT contain actual secrets. Required variables: `PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `SESSION_SECRET`.

#### Scenario: Developer copies .env.example

- GIVEN `.env.example` exists with all 6 required variables listed with placeholder values and comments
- WHEN a developer copies it to `.env` and fills in real values
- THEN they can start the application successfully without missing-variable errors
