# mundo-3d Audit Report — Gentleman Book Best Practices

## Executive Summary

mundo-3d is a course-project e-commerce application built with Express 4.x, Sequelize 6.x, MySQL, and EJS. It follows a basic MVC pattern but has **significant architectural, security, and quality gaps** when measured against the Gentleman Book's principles.

**Biggest concerns:**
1. **CRITICAL**: Hardcoded session secret (`"secret"`) — trivially exploitable
2. **HIGH**: No separation of concerns — controllers directly access DB, handle validation, and render views (violates Clean Architecture layers, Ch 7)
3. **HIGH**: No error-handling middleware, no CSRF, no rate limiting, no input validation on login
4. **MEDIUM**: No tests, no linter, no CI — zero safety net for refactoring

**Top 3 priorities:** Fix session secret → Add error middleware + validation → Extract service layer

---

## Findings by Category

### 1. Clean Code & Communication (Ch 1-2)

#### Finding 1.1: Corrupted controller code
- **Finding**: `src/controllers/products/postNewProduct.js` lines 66-74 contain login error handling code pasted into a product controller — dead code that will never execute and confuses readers.
- **Gentleman Book Principle**: "El código de calidad también se relaciona con el nivel de comunicación que puedes proporcionar a tus compañeros de equipo con una simple mirada" (Ch 1) — code must communicate intent clearly.
- **Current Code**: `src/controllers/products/postNewProduct.js:66-74` — orphaned `email: { msg: "El email o la contraseña no coinciden" }` block inside a product creation flow.
- **Recommendation**: Remove the dead code block. Each file should have a single, clear responsibility.
- **Severity**: **High**

#### Finding 1.2: Inconsistent naming conventions
- **Finding**: Mixed naming — `NameProduct`, `FirstName`, `PasswordUser` (PascalCase for DB columns) vs `productName`, `firstName`, `password` (camelCase for form fields). No adapter layer to translate.
- **Gentleman Book Principle**: "Metáfora: tener el mismo nombre exacto para describir un elemento en particular brindará un mayor nivel de comprensión" (Ch 1, XP metaphor).
- **Current Code**: `src/database/models/Product.js:20` (`NameProduct`) vs `src/routes/productsRoutes.js:34` (`productName`).
- **Recommendation**: Use a consistent naming strategy. Either normalize at the model level (Sequelize `field` option) or use an adapter layer (Ch 13).
- **Severity**: **Medium**

#### Finding 1.3: Empty/unused files
- **Finding**: `src/controllers/index.js` and `src/controllers/mainController.js` are empty (0 lines). Dead files add noise.
- **Gentleman Book Principle**: "Simple Design" — work in small, meaningful pieces (Ch 1).
- **Recommendation**: Delete empty files. If `mainController.js` was intended for the home/about routes, those are currently inline in `mainRoutes.js`.
- **Severity**: **Low**

#### Finding 1.4: Path construction in every controller
- **Finding**: Every controller repeats `const ruta = path.join(__dirname, "../../views/...")` pattern. No abstraction.
- **Gentleman Book Principle**: "Programación Funcional... dividimos nuestra lógica en métodos declarativos, sin efectos secundarios" (Ch 1).
- **Current Code**: Found in `getAllProducts.js:21`, `loginUsers.js:4`, `userProfile.js:5`, `postNewProduct.js:41`, etc.
- **Recommendation**: Create a `renderView(viewName, data)` helper that resolves paths automatically.
- **Severity**: **Low**

---

### 2. Architecture (Ch 3, 7, 18)

#### Finding 2.1: No hexagonal architecture — controllers are coupled to everything
- **Finding**: Controllers directly `require("../../database/models/db")`, call Sequelize methods, handle validation, and render views. There is no port/interface abstraction, no service layer, no use-case layer.
- **Gentleman Book Principle**: "La arquitectura hexagonal defiende la separación de preocupaciones... la lógica de negocios se divide en diferentes servicios" (Ch 3). Clean Architecture: "El dominio no sabe que existe el mundo exterior" (Ch 18).
- **Current Code**: `src/controllers/products/postNewProduct.js:2` — direct DB import; `src/controllers/products/postNewProduct.js:29` — `Product.create()` directly in controller.
- **Recommendation**: Introduce a service/use-case layer:
  ```
  Controller → ProductService.create() → ProductRepository.save()
  ```
  Controllers should only handle HTTP concerns (request parsing, response formatting).
- **Severity**: **Critical**

#### Finding 2.2: API routes inline in web route files
- **Finding**: API endpoints (`/api/products`, `/api/users`) are defined inline in `productsRoutes.js:122-226` and `userRoutes.js:126-165` — mixed with web routes, no separation.
- **Gentleman Book Principle**: "Separación de preocupaciones... cada parte del sistema se ocupa solo de lo suyo" (Ch 7, Cap 2).
- **Current Code**: `src/routes/productsRoutes.js:122` — `router.get("/api/products", ...)` in the same file as web routes.
- **Recommendation**: Separate API routes into `src/routes/api/` with their own router, middleware, and response format.
- **Severity**: **High**

#### Finding 2.3: Duplicate association definitions
- **Finding**: Associations are defined BOTH in `src/database/models/index.js:35-58` AND in individual model files (e.g., `User.js:39-44`, `Product.js:42-52`). This creates confusion and potential conflicts.
- **Gentleman Book Principle**: "Una fuente de verdad" — single source of truth (Ch 2).
- **Current Code**: `User.associate` in `User.js:39-44` duplicates `UserModel.hasMany` in `index.js:35-36`.
- **Recommendation**: Define associations in ONE place only — either all in `index.js` (recommended for centralized visibility) or all in individual model files.
- **Severity**: **Medium**

#### Finding 2.4: No dependency direction control
- **Finding**: Everything depends on everything. Controllers import models, routes import controllers AND models directly, middlewares import models. No dependency rule (Ch 7).
- **Gentleman Book Principle**: "La regla del dominio... el dominio es autónomo y no debe depender de nada más allá de sí mismo" (Ch 7, Cap 8).
- **Recommendation**: Establish dependency direction: `routes → controllers → services → repositories → models`. Outer layers depend on inner, never the reverse.
- **Severity**: **High**

---

### 3. Security

#### Finding 3.1: CRITICAL — Hardcoded session secret
- **Finding**: Session secret is the literal string `"secret"` in `src/app.js:23`.
- **Gentleman Book Principle**: "Validación y Sanitización de Datos... proteger nuestra aplicación de entradas maliciosas" (Ch 7, Cap 15).
- **Current Code**: `src/app.js:22-29`:
  ```js
  server.use(session({
    secret: "secret",  // ← HARDCODED
    resave: false,
    ...
  }));
  ```
- **Recommendation**: Use `process.env.SESSION_SECRET` with a strong random value. Add to `.env.example`.
- **Severity**: **Critical**

#### Finding 3.2: No login validation
- **Finding**: The login POST route (`router.post("/login", processLogin)`) has NO express-validator chain. No rate limiting. Brute-forceable.
- **Gentleman Book Principle**: "Validación y Sanitización de Datos" (Ch 7, Cap 15).
- **Current Code**: `src/routes/userRoutes.js:109` — `router.post("/login", processLogin)` with no validation middleware.
- **Recommendation**: Add `express-validator` chain for email format + password presence. Add rate limiting (e.g., `express-rate-limit`).
- **Severity**: **Critical**

#### Finding 3.3: Multer filename uses req.body (race condition)
- **Finding**: Multer's `filename` callback accesses `req.body.productName` and `req.body.lastName`, but multer parses the file BEFORE the body parser runs. These values may be `undefined`.
- **Gentleman Book Principle**: "Principio de Menor Sorpresa... las cosas deben comportarse como uno espera" (Ch 18).
- **Current Code**: `src/routes/productsRoutes.js:25` — `${uuidv4()}_${req.body.productName}`; `src/routes/userRoutes.js:22` — `${uuidv4()}_avatar${req.body.lastName}`.
- **Recommendation**: Use only the UUID for filenames. Store original name separately if needed.
- **Severity**: **High**

#### Finding 3.4: No CSRF protection
- **Finding**: All POST/PUT/DELETE routes have no CSRF token validation.
- **Recommendation**: Add `csurf` middleware or implement token-based CSRF protection.
- **Severity**: **High**

#### Finding 3.5: Password exposed in cookie
- **Finding**: `userLoggedMiddleware` queries the full user from DB using only email from cookie (`adminMiddlewares.js:30-32`), and `res.locals.userLogged` could include the password if not carefully filtered.
- **Current Code**: `src/middlewares/adminMiddlewares.js:30-35` — `User.findOne({ where: { email: emailInCookie } })` without attribute filtering.
- **Recommendation**: Add `attributes: { exclude: ['PasswordUser'] }` to the cookie lookup query.
- **Severity**: **High**

#### Finding 3.6: No file upload size limit
- **Finding**: Multer has no `limits` configuration — unlimited file size upload.
- **Recommendation**: Add `limits: { fileSize: 5 * 1024 * 1024 }` (5MB max).
- **Severity**: **Medium**

---

### 4. Testing & Quality

#### Finding 4.1: No tests
- **Finding**: `package.json:9` — `"test": "echo \"Error: no test specified\" && exit 1"`. Zero test coverage.
- **Gentleman Book Principle**: "TDD... escribimos nuestras pruebas antes de codificar una sola línea" (Ch 1). "Pruebas Automatizadas: implementar un sólido conjunto de pruebas automatizadas es fundamental" (Ch 7, Cap 11).
- **Recommendation**: Start with unit tests for services (once extracted), then integration tests for routes. Use Jest or Mocha + Supertest.
- **Severity**: **Critical**

#### Finding 4.2: No linter or formatter
- **Finding**: No ESLint, no Prettier, no `.editorconfig`. Code style is inconsistent.
- **Gentleman Book Principle**: "Integración Continua... hacer cambios lo más rápido posible entregará comentarios a tus compañeros de equipo" (Ch 1).
- **Recommendation**: Add ESLint + Prettier with a shared config. Add `npm run lint` script.
- **Severity**: **Medium**

#### Finding 4.3: No CI/CD
- **Finding**: No GitHub Actions, no automated checks on PR.
- **Recommendation**: Add a basic CI workflow: lint → test → build.
- **Severity**: **Medium**

---

### 5. REST & API Design

#### Finding 5.1: Inconsistent REST conventions
- **Finding**: 
  - DELETE: `/product/delete/:id` (productsRoutes.js:118) — should be `DELETE /products/:id`
  - PUT: `/product/:id/edit` (productsRoutes.js:115) — should be `PUT /products/:id`
  - POST: `/products` (correct) but `/users` for registration (should be `/register` or `/users`)
- **Gentleman Book Principle**: "Principio de Menor Sorpresa... GET lee, POST crea, PUT reemplaza, PATCH modifica, DELETE borra" (Ch 18).
- **Recommendation**: Standardize to RESTful conventions:
  ```
  GET    /products       → list
  GET    /products/:id   → detail
  POST   /products       → create
  PUT    /products/:id   → update
  DELETE /products/:id   → delete
  ```
- **Severity**: **Medium**

#### Finding 5.2: Wrong HTTP methods
- **Finding**: Product edit uses `PUT` but it's actually a confirmation action that modifies and redirects — not a proper REST update.
- **Current Code**: `src/routes/productsRoutes.js:115` — `router.put("/product/:id/edit", isUser, confirmModifyProduct)`.
- **Recommendation**: Use `PATCH /products/:id` for partial updates, or separate the edit form (`GET /products/:id/edit`) from the update action (`PUT /products/:id`).
- **Severity**: **Medium**

#### Finding 5.3: API responses inconsistent
- **Finding**: API routes return different response structures:
  - `/api/products` → `{ count, countByCategory, products: [...] }`
  - `/api/product/:id` → `{ error: "..." }` or raw product
  - `/api/users` → `{ count, users: [...] }`
- **Recommendation**: Standardize API response envelope:
  ```json
  { "data": {...}, "meta": { "count": 10 }, "error": null }
  ```
- **Severity**: **Low**

---

### 6. Error Handling & Logging

#### Finding 6.1: No error-handling middleware
- **Finding**: `src/app.js` has a 404 handler (line 54-57) but NO 4-parameter error-handling middleware (`(err, req, res, next) => {...}`). Unhandled async errors crash the server.
- **Gentleman Book Principle**: "Manejo de Errores: implementar un manejo de errores robusto puede prevenir la propagación de errores" (Ch 7, Cap 15).
- **Current Code**: `src/app.js:54-57` — only 404, no general error handler.
- **Recommendation**: Add error middleware at the end of the middleware chain:
  ```js
  server.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).render('error', { message: err.message });
  });
  ```
- **Severity**: **Critical**

#### Finding 6.2: Inconsistent error responses
- **Finding**: Some controllers return `res.status(500).send("Error interno del servidor")` (string), others return `res.status(500).json({ error: "..." })` (JSON), others return `res.status(404).send("Producto no encontrado")`.
- **Current Code**: `deleteProduct.js:11` vs `postNewProduct.js:51` vs `getAllProducts.js:26`.
- **Recommendation**: Standardize: web routes render error views, API routes return JSON with consistent structure.
- **Severity**: **Medium**

#### Finding 6.3: Console.log as logging
- **Finding**: All logging is `console.log` / `console.error`. No structured logging, no log levels, no log rotation.
- **Gentleman Book Principle**: Morgan is used (`app.js:35`) but only for HTTP requests. Application errors use `console.error`.
- **Recommendation**: Use a proper logger (Winston, Pino) with levels (info, warn, error) and structured output.
- **Severity**: **Low**

---

### 7. Configuration & Environment

#### Finding 7.1: No .env file or .env.example
- **Finding**: No `.env` file exists. `config.js` is gitignored but no template is provided. New developers can't run the project without manually creating the config.
- **Gentleman Book Principle**: "Minimizar la fricción en la configuración del ambiente de trabajo, tener documentación y algún tipo de guía" (Ch 2).
- **Recommendation**: Create `.env.example` with all required variables:
  ```
  PORT=3031
  NODE_ENV=development
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=root
  DB_PASSWORD=
  DB_NAME=mundo3d
  SESSION_SECRET=change-me-to-random-string
  ```
- **Severity**: **High**

#### Finding 7.2: Session secret not from environment
- **Finding**: See Finding 3.1. The session secret should come from `process.env.SESSION_SECRET`.
- **Severity**: **Critical**

#### Finding 7.3: Database config not from environment
- **Finding**: `src/database/models/index.js:2-4` reads from `config.js` which is gitignored. No fallback to environment variables.
- **Recommendation**: Use `dotenv` variables as primary source, with `config.js` as optional override.
- **Severity**: **Medium**

---

## Priority Action Items

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | **Fix hardcoded session secret** — move to `.env` | S | Critical security fix |
| 2 | **Add `.env.example`** with all required variables | S | Developer experience |
| 3 | **Add error-handling middleware** — 4-param function at end of chain | S | Prevents server crashes |
| 4 | **Add login validation** — express-validator chain + rate limiting | M | Brute-force protection |
| 5 | **Remove corrupted code** in `postNewProduct.js` | S | Code clarity |
| 6 | **Fix multer filename race condition** — use UUID only | S | Prevents undefined filenames |
| 7 | **Add CSRF protection** | M | Security |
| 8 | **Standardize REST routes** — consistent naming and methods | M | API predictability |
| 9 | **Deduplicate model associations** — single source of truth | M | Maintainability |
| 10 | **Extract service layer** — separate business logic from controllers | L | Architecture alignment |
| 11 | **Add ESLint + Prettier** | M | Code quality |
| 12 | **Add test framework** — Jest + Supertest | L | Safety net for refactoring |
| 13 | **Add CI workflow** — GitHub Actions | M | Automated quality checks |
| 14 | **Separate API routes** into dedicated router | M | Separation of concerns |
| 15 | **Add structured logging** — Winston/Pino | L | Observability |

---

## Gentleman Book Alignment Summary

| Principle | Current State | Target State |
|-----------|--------------|--------------|
| Clean Code (Ch 1) | ❌ Mixed naming, dead code, no tests | ✅ Consistent naming, tested, atomic functions |
| Communication (Ch 2) | ❌ No docs, no .env.example | ✅ Self-documenting code, setup guide |
| Hexagonal Architecture (Ch 3) | ❌ No ports, no adapters, controllers do everything | ✅ Services with ports, repository adapters |
| Clean Architecture (Ch 7) | ❌ No layer separation, everything coupled | ✅ Entities → Use Cases → Adapters → Frameworks |
| Software Architecture (Ch 18) | ❌ Monolith with no boundaries | ✅ Clear module boundaries, dependency rule |
