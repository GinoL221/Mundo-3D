# Design: Audit Gentleman Best Practices

## Technical Approach

3-phase incremental refactoring of mundo-3d Express.js e-commerce app. Phase 1 adds security middleware (additive, low regression risk). Phase 2 extracts a thin service layer and separates API routes (structural, mechanical delegation). Phase 3 adds quality tooling (Jest, ESLint, Prettier, CI). Each phase is independently deployable; all existing features must work after each phase.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Session secret validation | Fail at startup vs lazy check | Lazy check risks runtime exposure | **Fail at startup** — `index.js` validates `SESSION_SECRET` before `require('./src/app')` |
| CSRF library | `csurf` (deprecated) vs `@edge-csrf` vs manual | `csurf` unmaintained but works; manual = more code | **`csurf`** — small project, proven pattern, low overhead |
| Rate limiter scope | Global vs login-only | Global adds overhead to all routes | **Login-only** — mount on `POST /login` route only |
| Association location | Keep in models + index (current) vs index only | Duplicates cause warnings; models already define `associate` | **Remove from models, keep in index.js** — single source of truth |
| Service layer depth | Full hexagonal vs thin delegation | Hexagonal = overkill for small project | **Thin delegation** — services wrap Sequelize calls, controllers call services |
| API response format | Envelope standardization vs current inline | Envelope = breaking change for consumers | **Keep current format** — out of scope per proposal |

## Data Flow

### Phase 2 — Request Flow (after service extraction)

```
  Client Request
       │
       ▼
  app.js (helmet, CSRF, session, body parser)
       │
       ▼
  Route Router (web or /api)
       │
       ▼
  Controller (HTTP concerns: req/res/render/redirect)
       │
       ▼
  Service (business logic: validation helpers, DB delegation)
       │
       ▼
  Sequelize Model (data access)
       │
       ▼
  MySQL Database
```

### Login Flow (Phase 1 + 2)

```
  POST /login
       │
       ▼
  rate-limiter (5/15min per IP) → 429 if exceeded
       │
       ▼
  validation chain (email format, password min 6) → re-render if invalid
       │
       ▼
  CSRF check → 403 if missing
       │
       ▼
  processLogin controller
       │
       ▼
  UserService.findByEmail(email, { includePassword: true })
       │
       ▼
  bcrypt.compare → session set → redirect /profile
```

## File Changes

### Phase 1: Security + Critical Cleanup

| File | Action | Description |
|------|--------|-------------|
| `index.js` | Modify | Validate `SESSION_SECRET` before starting app |
| `src/app.js` | Modify | Session secret from env, add helmet, CSRF, error middleware |
| `src/middlewares/errorHandler.js` | Create | 4-param error handler (500 response) |
| `src/middlewares/csrf.js` | Create | CSRF middleware + `res.locals.csrfToken` |
| `src/middlewares/adminMiddlewares.js` | Modify | `userLoggedMiddleware` excludes `PasswordUser` in cookie lookup |
| `src/routes/userRoutes.js` | Modify | Add validation chain to `POST /login`, add rate limiter |
| `src/views/users/login.ejs` | Modify | Add CSRF hidden field |
| `src/views/users/register.ejs` | Modify | Add CSRF hidden field |
| `src/views/users/newUser.ejs` | Modify | Add CSRF hidden field |
| `src/views/users/users.ejs` | Modify | Add CSRF hidden field (delete form) |
| `src/views/products/newProduct.ejs` | Modify | Add CSRF hidden field |
| `src/views/products/product.ejs` | Modify | Add CSRF hidden field (edit form) |
| `src/controllers/products/postNewProduct.js` | Modify | Remove dead code, keep clean flow |
| `.env.example` | Create | Template with 6 vars: PORT, DB_USER, DB_PASS, DB_NAME, DB_HOST, SESSION_SECRET |

### Phase 2: Layer Separation + Organization

| File | Action | Description |
|------|--------|-------------|
| `src/services/productService.js` | Create | `findAll`, `findById`, `create`, `update`, `remove` |
| `src/services/userService.js` | Create | `findAll`, `findByEmail`, `findById`, `create`, `remove` |
| `src/services/index.js` | Create | Barrel export for services |
| `src/routes/api/index.js` | Create | API router mounted at `/api` |
| `src/routes/api/products.js` | Create | API product endpoints (moved from productsRoutes) |
| `src/routes/api/users.js` | Create | API user endpoints (moved from userRoutes) |
| `src/routes/productsRoutes.js` | Modify | Remove API routes, fix multer filename (UUID only) |
| `src/routes/userRoutes.js` | Modify | Remove API routes |
| `src/controllers/products/*.js` | Modify | Import from `services/` instead of `database/models/db` |
| `src/controllers/users/*.js` | Modify | Import from `services/` instead of `database/models/db` |
| `src/database/models/index.js` | Modify | Remove duplicate associations (keep only index.js definitions) |
| `src/database/models/User.js` | Modify | Remove `User.associate` |
| `src/database/models/Product.js` | Modify | Remove `Product.associate` and `Product.findById` |

### Phase 3: Quality + DX

| File | Action | Description |
|------|--------|-------------|
| `jest.config.js` | Create | Jest config, testMatch `**/*.test.js` |
| `.eslintrc.json` | Create | ESLint config for Node.js |
| `.prettierrc` | Create | Prettier config |
| `.eslintignore` | Create | Ignore `node_modules/`, `public/` |
| `.prettierignore` | Create | Ignore `node_modules/`, `public/` |
| `.github/workflows/ci.yml` | Create | CI: lint + test on push/PR |
| `src/services/__tests__/productService.test.js` | Create | At least one passing service test |
| `package.json` | Modify | Add scripts: `test`, `lint`, `format`; add dev deps |

## Interfaces / Contracts

### ProductService

```js
// src/services/productService.js
const ProductService = {
  async findAll(),           // → Product[] with Category + Franchise includes
  async findById(id),        // → Product | null
  async create(data),        // → Product (data: { NameProduct, Price, DescriptionProduct, Image, IDCategory, IDFranchise })
  async update(id, data),    // → Product | null
  async remove(id),          // → boolean (true if deleted)
};
```

### UserService

```js
// src/services/userService.js
const UserService = {
  async findAll(),                          // → User[] (PasswordUser excluded)
  async findByEmail(email, opts),           // → User | null; opts.includePassword controls PasswordUser
  async findById(id),                       // → User | null (PasswordUser excluded)
  async create(data),                       // → User (data: { FirstName, LastName, Email, PasswordUser, Image })
  async remove(id),                         // → boolean
};
```

### API Response Shape (unchanged from current)

```js
// GET /api/products → { count, countByCategory, products: [...] }
// GET /api/users    → { count, users: [...] }  // PasswordUser excluded
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `ProductService.findAll()` returns array, `UserService.findByEmail()` excludes password | Jest with mocked Sequelize models |
| Unit | `UserService.findByEmail(email, { includePassword: true })` includes password | Jest mock |
| Integration | POST /login with valid credentials → redirect | supertest against test app |
| Integration | POST /login without CSRF → 403 | supertest |
| Integration | GET /api/users → no PasswordUser in response | supertest |

## Migration / Rollout

**Phase 1 (Security)**: All changes are additive. CSRF requires all 6 EJS forms to be updated in the same commit — test each form manually after applying. No data migration needed.

**Phase 2 (Layer Separation)**: Mechanical delegation. Each controller file changes one import (`database/models/db` → `services/`) and one call (`Model.method()` → `Service.method()`). API routes move to new files but keep same URL paths. No data migration needed.

**Phase 3 (Quality)**: Config files only. No runtime changes. No data migration needed.

## Open Questions

- [ ] Should `csurf` be replaced with `@edge-csrf` given `csurf` is deprecated? (Recommendation: use `csurf` for now, track upgrade separately)
- [ ] Should the multer filename race condition be fixed with UUID-only (losing product name in filename) or UUID + timestamp? (Recommendation: UUID only — product name is already in DB)
