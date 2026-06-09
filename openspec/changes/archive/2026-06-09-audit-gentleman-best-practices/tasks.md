# Tasks: audit-gentleman-best-practices

> **Archive-time reconciliation (2026-06-09)**: All 24 tasks below are now marked `[x]`. The 13 stale unchecked boxes for P1-01..P1-10 and P3-01..P3-03 were reconciled by `sdd-archive` based on `apply-progress` and `verify-report` evidence — both show all 24 tasks complete. No live `sdd-apply` work was performed; this is a mechanical checkbox fix so the archived audit trail does not contain stale unchecked tasks for completed work.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750 (P1: ~300, P2: ~330, P3: ~120) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | chained PRs |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phase 1: Security + Critical Cleanup | PR 1 | Base = main; self-contained security layer |
| 2 | Phase 2: Layer Separation + Organization | PR 2 | Base = PR 1; service layer + API routes |
| 3 | Phase 3: Quality + DX | PR 3 | Base = PR 2; tests + tooling |

---

## Phase 1: Security + Critical Cleanup

- [x] **P1-01**: Validate `SESSION_SECRET` env var before app starts
  - **Files**: `index.js` (modify)
  - **What**: Read `SESSION_SECRET` from env; `process.exit(1)` with descriptive message if absent. Move `dotenv.config()` above all imports.
  - **Scenarios**: App fails without SESSION_SECRET
  - **Acceptance**: `node index.js` with no `SESSION_SECRET` env prints error and exits non-zero; with env set, app starts normally
  - **Size**: S
  - **Deps**: —

- [x] **P1-02**: Move session secret from hardcoded string to `process.env.SESSION_SECRET`
  - **Files**: `src/app.js` (modify)
  - **What**: Replace `"secret"` in `express-session` config with `process.env.SESSION_SECRET`
  - **Scenarios**: App starts with valid SESSION_SECRET
  - **Acceptance**: Session uses env var value; no fallback to hardcoded string
  - **Size**: S
  - **Deps**: P1-01 (index.js validates env first)

- [x] **P1-03**: Add global error-handling middleware (4-param Express pattern)
  - **Files**: `src/middlewares/errorHandler.js` (create), `src/app.js` (modify)
  - **What**: Create `errorHandler(err, req, res, next)` → `res.status(500).json({ error: "Error interno del servidor" })`. Register as last middleware in app.js.
  - **Scenarios**: Unhandled error in a route
  - **Acceptance**: Throwing in any route returns 500 JSON instead of crashing process
  - **Size**: S
  - **Deps**: P1-02

- [x] **P1-04**: Add helmet for security headers
  - **Files**: `src/app.js` (modify)
  - **What**: `const helmet = require("helmet")`; `server.use(helmet())` before routes
  - **Scenarios**: Responses include security headers
  - **Acceptance**: Responses include `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
  - **Size**: S
  - **Deps**: P1-03

- [x] **P1-05**: Add CSRF protection with csurf (token via `res.locals`)
  - **Files**: `src/middlewares/csrf.js` (create), `src/app.js` (modify)
  - **What**: Create `csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: 'strict' } })`. Export `{ csrfToken: (req, res) => res.locals.csrfToken = req.csrfToken() }`. In app.js: `server.use(csrfToken)` after session so `res.locals.csrfToken` is available to all EJS templates.
  - **Scenarios**: Form submission with valid CSRF token; Form submission without CSRF token
  - **Acceptance**: POST without `_csrf` field returns 403; EJS templates have access to `csrfToken` in `res.locals`
  - **Size**: M
  - **Deps**: P1-04

- [x] **P1-06**: Add CSRF hidden field to all 6 EJS forms
  - **Files**: `src/views/users/login.ejs`, `src/views/users/register.ejs`, `src/views/users/newUser.ejs`, `src/views/users/users.ejs`, `src/views/products/newProduct.ejs`, `src/views/products/product.ejs` (modify)
  - **What**: Add `<input type="hidden" name="_csrf" value="<%= csrfToken %>">` inside each `<form>` tag. For login.ejs also remove the stray `console.log` line.
  - **Scenarios**: Form submission with valid CSRF token
  - **Acceptance**: All 6 forms submit successfully with token; each form tested manually
  - **Size**: M
  - **Deps**: P1-05

- [x] **P1-07**: Add express-validator to login route (email format, password min 6)
  - **Files**: `src/routes/userRoutes.js` (modify)
  - **What**: Create `loginValidations` array: `body("email").isEmail().trim()`, `body("password").isLength({ min: 6 })`. Apply to `router.post("/login", loginValidations, processLogin)`.
  - **Scenarios**: Login with invalid email format; Login with empty password
  - **Acceptance**: POST /login with "not-an-email" → validation error; POST /login with "" → validation error; existing login flow unchanged
  - **Size**: S
  - **Deps**: P1-06

- [x] **P1-08**: Add express-rate-limit to login route (5 attempts / 15 min per IP)
  - **Files**: `src/routes/userRoutes.js` (modify)
  - **What**: `const rateLimit = require("express-rate-limit"); const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });`. Apply to `router.post("/login", loginLimiter, ...)`
  - **Scenarios**: Exceeded login attempts
  - **Acceptance**: 6th request from same IP within 15 min → 429 response
  - **Size**: S
  - **Deps**: P1-07

- [x] **P1-09**: Fix cookie user lookup to exclude PasswordUser
  - **Files**: `src/middlewares/adminMiddlewares.js` (modify)
  - **What**: In `userLoggedMiddleware`, add `attributes: { exclude: ["PasswordUser"] }` to the `User.findOne` call. Import `initializeModels` only once at top (already done). No other changes.
  - **Scenarios**: User found by cookie email
  - **Acceptance**: `res.locals.userLogged` from cookie never contains `PasswordUser` field
  - **Size**: S
  - **Deps**: P1-05 (csrf module needed for test context)

- [x] **P1-10**: Create `.env.example` with all 6 required variables
  - **Files**: `.env.example` (create)
  - **What**: Create file with: `PORT=3031`, `DB_USER=your_user`, `DB_PASS=your_password`, `DB_NAME=mundo3d`, `DB_HOST=localhost`, `SESSION_SECRET=your_secret_here`. Add comments describing each variable. NO real values.
  - **Scenarios**: Developer copies .env.example
  - **Acceptance**: File has all 6 vars with placeholder values and comments; no secrets
  - **Size**: S
  - **Deps**: P1-02

---

## Phase 2: Layer Separation + Organization

- [x] **P2-01**: Create `src/services/productService.js`
  - **Files**: `src/services/productService.js` (create)
  - **What**: Implement `ProductService` with: `findAll()` → `Product.findAll({ include: [{ model: Category, as: "Category" }, { model: Franchise, as: "Franchise" }] })`, `findById(id)`, `create(data)` → `Product.create({ NameProduct, Price, DescriptionProduct, Image, IDCategory, IDFranchise })`, `update(id, data)`, `remove(id)`. Import models via `require("../../database/models/db")`.
  - **Scenarios**: Find all products; Create product
  - **Acceptance**: All 5 methods exported and working; no HTTP concerns (no res/req/redirect)
  - **Size**: M
  - **Deps**: P1-10

- [x] **P2-02**: Create `src/services/userService.js`
  - **Files**: `src/services/userService.js` (create)
  - **What**: Implement `UserService` with: `findAll()` → `User.findAll({ attributes: { exclude: ["PasswordUser"] } })`, `findByEmail(email, opts)` → excludes PasswordUser by default, accepts `{ includePassword: true }` to include it, `findById(id)` → excludes PasswordUser, `create(data)`, `remove(id)`. Import bcryptjs only for `create` (hash password before create).
  - **Scenarios**: Find user by email without password; Find user by email for authentication
  - **Acceptance**: `findByEmail("test@test.com")` never returns PasswordUser; `findByEmail("x", { includePassword: true })` includes PasswordUser
  - **Size**: M
  - **Deps**: P2-01

- [x] **P2-03**: Create `src/services/index.js` barrel export
  - **Files**: `src/services/index.js` (create)
  - **What**: Export `{ ProductService, UserService }` from respective service files
  - **Scenarios**: Controllers delegate to services
  - **Acceptance**: `const { ProductService } = require("../../services")` works
  - **Size**: S
  - **Deps**: P2-02

- [x] **P2-04**: Create `src/routes/api/index.js` API router mounted at `/api`
  - **Files**: `src/routes/api/index.js` (create), `src/app.js` (modify)
  - **What**: Create `const apiRouter = express.Router()`. In `app.js`: import `apiRouter` and `server.use("/api", apiRouter)` before web routes. Mount API routes in Phase 2 tasks (P2-05, P2-06).
  - **Scenarios**: API endpoint accessible at /api prefix; Web routes unaffected
  - **Acceptance**: `GET /api/products` returns JSON; `GET /products` still renders EJS
  - **Size**: S
  - **Deps**: P2-03

- [x] **P2-05**: Create `src/routes/api/products.js` (move from productsRoutes.js)
  - **Files**: `src/routes/api/products.js` (create), `src/routes/productsRoutes.js` (modify)
  - **What**: Move inline API handlers (`GET /api/products`, `GET /api/product/:id`, `GET /api/products/latest`) to `src/routes/api/products.js`. Export router. In `productsRoutes.js`: remove all 3 inline handlers and replace with `const apiProductsRouter = require("./api/products"); router.use(apiProductsRouter);`
  - **Scenarios**: API product list; API user list excludes passwords
  - **Acceptance**: `GET /api/products` → `{ count, countByCategory, products }`; `GET /api/product/:id` → product JSON; `GET /api/products/latest` → latest product JSON
  - **Size**: M
  - **Deps**: P2-04

- [x] **P2-06**: Create `src/routes/api/users.js` (move from userRoutes.js)
  - **Files**: `src/routes/api/users.js` (create), `src/routes/userRoutes.js` (modify)
  - **What**: Move inline API handlers (`GET /api/users`, `GET /api/users/:id`) to `src/routes/api/users.js`. Export router. In `userRoutes.js`: remove both inline handlers and replace with `const apiUsersRouter = require("./api/users"); router.use(apiUsersRouter);`
  - **Scenarios**: API user list; API user by ID
  - **Acceptance**: `GET /api/users` → `{ count, users }` (no PasswordUser); `GET /api/users/:id` → user JSON (no PasswordUser)
  - **Size**: M
  - **Deps**: P2-05

- [x] **P2-07**: Update product controllers to use services (no direct model imports)
  - **Files**: `src/controllers/products/getAllProducts.js`, `src/controllers/products/getProductById.js`, `src/controllers/products/postNewProduct.js`, `src/controllers/products/deleteProduct.js`, `src/controllers/products/confirmModifyProduct.js`, `src/controllers/products/formNewProduct.js`, `src/controllers/products/viewShoppingCart.js` (modify)
  - **What**: Replace `require("../../database/models/db")` with `require("../../services")`. Replace `Product.findAll(...)` → `ProductService.findAll()`, etc. Keep HTTP concerns (req, res, render, redirect) in controllers. For `formNewProduct.js`: still import Category, Franchise directly (service scope only covers CRUD). For `viewShoppingCart.js`: still import ShoppingCart, Product, User (shopping cart logic is view-only).
  - **Scenarios**: Controller calls service
  - **Acceptance**: All product routes still work (list, detail, create, delete, edit, form, cart); no controller imports models directly
  - **Size**: M
  - **Deps**: P2-03

- [x] **P2-08**: Update user controllers to use services (no direct model imports)
  - **Files**: `src/controllers/users/getAllUsers.js`, `src/controllers/users/getUserById.js`, `src/controllers/users/deleteUser.js`, `src/controllers/users/postNewUser.js`, `src/controllers/users/processLogin.js` (modify)
  - **What**: Replace `require("../../database/models/db")` with `require("../../services")`. Replace direct model calls with service calls. `processLogin` uses `UserService.findByEmail(email, { includePassword: true })` for auth. `postNewUser` uses `UserService.create(...)`.
  - **Scenarios**: Controller calls service
  - **Acceptance**: All user routes still work (list, detail, delete, register, login); no controller imports models directly
  - **Size**: M
  - **Deps**: P2-07

- [x] **P2-09**: Fix multer filename race conditions (UUID only)
  - **Files**: `src/routes/userRoutes.js` (modify), `src/routes/productsRoutes.js` (modify)
  - **What**: In both route files: change `callback(null, `${uuidv4()}_avatar${req.body.lastName}${...}`)` → `callback(null, `${uuidv4()}${path.extname(file.originalname)}`)`. Same for product: `callback(null, `${uuidv4()}${path.extname(file.originalname)}`)`. Move `require("uuid")` outside storage config.
  - **Scenarios**: File upload with UUID filename
  - **Acceptance**: Uploaded files named as `{uuid}.{ext}`; no race condition from req.body
  - **Size**: S
  - **Deps**: P2-06

- [x] **P2-10**: Remove duplicate model associations (keep in index.js only)
  - **Files**: `src/database/models/User.js` (modify), `src/database/models/Product.js` (modify), `src/database/models/Category.js` (modify), `src/database/models/Franchise.js` (modify), `src/database/models/ShoppingCart.js` (modify)
  - **What**: Remove `User.associate`, `Product.associate` + `Product.findById`, `Category.associate`, `Franchise.associate`, `ShoppingCart.belongsTo` calls from individual model files. Associations stay only in `src/database/models/index.js`.
  - **Scenarios**: Associations defined in one place only
  - **Acceptance**: No Sequelize "Warning: use of undefined association" messages on startup; app functions normally
  - **Size**: M
  - **Deps**: P2-08

- [x] **P2-11**: Clean up postNewProduct.js (remove console.log, ensure clean flow)
  - **Files**: `src/controllers/products/postNewProduct.js` (modify)
  - **What**: Remove `console.log("Datos del formulario:", req.body)` and `console.log("entre")`. Keep `console.log("Producto creado:", newProduct)` or replace with structured logger. Keep all business logic intact.
  - **Scenarios**: No dead/corrupted code
  - **Acceptance**: File has no debug console.log calls; business logic unchanged
  - **Size**: S
  - **Deps**: P2-07

---

## Phase 3: Quality + DX

- [x] **P3-01**: Configure Jest and write service tests
  - **Files**: `jest.config.js` (create), `src/services/__tests__/productService.test.js` (create), `src/services/__tests__/userService.test.js` (create), `package.json` (modify)
  - **What**: Create `jest.config.js` with `testMatch: ["**/*.test.js"]`, `testEnvironment: "node"`. Add dev deps: `jest`, `supertest`. Write at least one passing test per service: `ProductService.findAll() returns array`, `UserService.findByEmail() excludes password`, `UserService.findByEmail() with includePassword includes password`. Use Jest mocks for Sequelize.
  - **Scenarios**: Running tests
  - **Acceptance**: `npm test` runs and reports pass; no "no tests" error
  - **Size**: M
  - **Deps**: P2-10

- [x] **P3-02**: Configure ESLint + Prettier
  - **Files**: `.eslintrc.json` (create), `.prettierrc` (create), `.eslintignore` (create), `.prettierignore` (create), `package.json` (modify)
  - **What**: ESLint for Node.js (extends `eslint:recommended`, env `node`). `.prettierrc`: `semi: true, singleQuote: true, trailingComma: "all"`. Ignore `node_modules/`, `public/`. Add scripts: `"lint": "eslint src/"`, `"format": "prettier --write src/"`.
  - **Scenarios**: Lint passes; Format command runs
  - **Acceptance**: `npm run lint` exits 0; `npm run format` reformats src files
  - **Size**: S
  - **Deps**: P3-01

- [x] **P3-03**: Create GitHub Actions CI workflow
  - **Files**: `.github/workflows/ci.yml` (create)
  - **What**: Create workflow with `on: push` (branch main) + `on: pull_request`. Jobs: `lint` (runs `npm run lint`) and `test` (runs `npm test`). Run in sequence; fail fast.
  - **Scenarios**: CI runs on push; CI fails on test failure
  - **Acceptance**: Workflow file valid YAML; lint and test steps defined; triggers on push to main and PR
  - **Size**: S
  - **Deps**: P3-02

---

## Implementation Order

**P1 → P2 → P3** (sequential, each phase builds on the previous):

1. **Phase 1 first** because all changes are additive and low-risk. Start with P1-01/P1-02 (env validation) — these are the foundation. Then P1-03/P1-04/P1-05 (security middleware stack). Then P1-06 (EJS forms — needs CSRF token available first). Then P1-07/P1-08 (login hardening). P1-09 (cookie fix) and P1-10 (.env.example) are independent but come last in phase for logical grouping.

2. **Phase 2 second** because layer separation is mechanical but numerous file changes. P2-01/P2-02/P2-03 (services) are prerequisites for controller changes. P2-04/P2-05/P2-06 (API routes) are independent of services but logically grouped. P2-07/P2-08 (controller delegation) is the bulk of work. P2-09/P2-10/P2-11 are cleanup tasks.

3. **Phase 3 last** because tooling is config-only and doesn't affect runtime behavior. Run in any order within the phase.

---

## Non-Regression Contract

After each phase, all existing features must work:
- Registration (form + DB create + redirect)
- Login (email/password + session + cookie)
- Product CRUD (list, detail, create, edit, delete)
- Shopping cart (view, items)
- Admin panel (user list/delete)
- Seed data (loads on startup)
- API endpoints (JSON responses)