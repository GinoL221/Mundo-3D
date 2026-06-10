# Exploration: api-rest-cleanup

## Current State

Mundo-3D is an Express.js MVC application with a thin service layer just started. The architecture uses routes → controllers → services (partial) → Sequelize models. Two services exist (ProductService, UserService) covering CRUD for their domains. The API layer (`/api/*`) has 5 endpoints (3 products, 2 users) that already use services properly. However, the web controller layer still has 3 files importing models directly, bypassing the service layer. Jest was recently added with 15 unit tests for the two services, but no coverage thresholds are configured.

## Affected Areas

### Controllers importing models directly

- `src/controllers/products/formNewProduct.js` — imports `Category` and `Franchise` models directly for `findAll()` calls to populate form dropdowns
- `src/controllers/products/viewShoppingCart.js` — imports `ShoppingCart`, `Product`, and `User` models directly; performs `ShoppingCart.findAll()` with includes inline
- `src/controllers/products/postNewProduct.js` — imports `Category` and `Franchise` models directly (lines 10-11) for form re-render on validation error; already uses `ProductService.create()` for the actual creation

### Unused middleware/imports

- `src/routes/userRoutes.js:4` — `authMiddleware` is imported from `../middlewares/auth` but **never used** in any route. Only `isUser` and `guestMiddleware` are applied.
- `src/routes/productsRoutes.js:5` — `authMiddleware` is also imported but **never used**. Only `isUser` and `guestMiddleware` are applied.
- Note: `authMiddleware` and `isUser` are functionally similar (both redirect to `/login` if no session). `authMiddleware` checks `req.session.userLogged`, `isUser` checks `res.locals.isLogged`. This duplication is a separate concern.

### API response patterns

The `/api/*` routes have **mostly consistent** patterns but with minor inconsistencies:

| Endpoint | Success Response | Error Response |
|---|---|---|
| `GET /api/products` | `{ count, countByCategory, products: [...] }` | `{ error: "..." }` (500) |
| `GET /api/product/:id` | Raw product object (no wrapper) | `{ error: "..." }` (404/500) |
| `GET /api/products/latest` | Raw mapped product object (no wrapper) | `{ error: "..." }` (404/500) |
| `GET /api/users` | `{ count, users: [...] }` | `{ error: "..." }` (500) |
| `GET /api/users/:id` | Raw user object (no wrapper) | `{ error: "..." }` (404/500) |

**Inconsistency**: Collection endpoints wrap in `{ count, items }` but single-item endpoints return raw objects without a `{ data: ... }` wrapper. Error format is consistent (`{ error: "message" }`).

### Jest coverage config

`jest.config.js` has **no coverage configuration at all**:
```js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.js"],
};
```
Missing: `collectCoverageFrom`, `coverageThreshold`, `coverageDirectory`.

### CSRF implementation

`src/middlewares/csrf.js` is a **reasonably solid** custom implementation:
- Uses `crypto.randomBytes(32)` for token generation (cryptographically secure)
- Uses `crypto.timingSafeEqual` for constant-time comparison (prevents timing attacks)
- Token rotation on each request (one-time use pattern)
- Skips `/api/*` routes (appropriate for token-based auth APIs)
- Accepts token from `req.body._csrf`, `req.headers['x-csrf-token']`, or `req.query._csrf`

**Issues found**:
1. **404 page for CSRF errors** (lines 49, 62, 68): Returns a 403 status but renders `404NotFound.ejs` — misleading UX. Should render a dedicated 403 error page.
2. **No SameSite cookie attribute**: Session cookie config in `app.js` (line 30-32) doesn't set `sameSite` or `secure` flags.
3. **API routes skip CSRF entirely** (line 30): This is by design but means API endpoints have no CSRF protection — should rely on auth tokens instead (currently they don't require auth).

### Service layer current state

**ProductService** (`src/services/productService.js`): `findAll`, `findById`, `create`, `update`, `remove`, `findLatest`
**UserService** (`src/services/userService.js`): `findAll`, `findByEmail`, `findById`, `create`, `remove`

Both follow the same pattern: async methods, direct Sequelize calls, return raw model instances or booleans. No DTOs/mappers in the service layer (mapping happens in controllers/API routes).

**Missing services**: `CartService` (for ShoppingCart operations), `CategoryService` (for Category lookups), `FranchiseService` (for Franchise lookups).

### Tests current state

15 tests total across 2 files:
- `src/services/__tests__/productService.test.js` — 7 tests (findAll, findById, create, remove)
- `src/services/__tests__/userService.test.js` — 8 tests (findAll, findByEmail, create, remove)

All tests use `jest.mock()` for database models. No controller tests, no route tests, no integration tests.

## Approaches

### Approach 1: Incremental service layer completion + cleanup (Recommended)

Create missing services (CartService, CategoryService, FranchiseService), refactor the 3 controllers to use them, remove unused imports, add Jest coverage thresholds, and fix CSRF error page.

- **Pros**: Clean architecture, consistent patterns, low risk per change, builds on existing conventions
- **Cons**: More files to create, requires careful testing of each new service
- **Effort**: Medium

### Approach 2: Big-bang refactor

Do everything in one pass: all services, all controllers, all config changes.

- **Pros**: Single PR, done faster in theory
- **Cons**: Large diff, hard to review, higher risk of regressions, harder to rollback
- **Effort**: Medium (but high review cost)

### Approach 3: Minimal cleanup only

Only remove unused imports and add coverage thresholds. Defer service completion.

- **Pros**: Very low risk, quick wins
- **Cons**: Doesn't address the core architectural inconsistency (controllers importing models)
- **Effort**: Low

## Recommendation

**Approach 1** — incremental service layer completion. The work naturally splits into independent units:

1. Create CategoryService + FranchiseService (simple `findAll` methods)
2. Create CartService (wrap the ShoppingCart query logic from `viewShoppingCart`)
3. Refactor the 3 controllers to use services
4. Remove unused `authMiddleware` imports
5. Add Jest coverage thresholds (50%)
6. Fix CSRF error page rendering

Each unit is independently testable and reviewable.

## Risks

- **Session cookie security**: `express-session` config lacks `sameSite` and `secure` flags. This is outside the current scope but should be flagged as a follow-up.
- **API endpoints have no authentication**: `/api/*` routes are completely public. CSRF is skipped for them. Any client can access all user/product data. This is a separate security concern.
- **`isUser` vs `authMiddleware` duplication**: Both check login status but use different session properties (`res.locals.isLogged` vs `req.session.userLogged`). This could cause subtle bugs if one is set but not the other. Worth investigating but out of scope.
- **CSRF token on every GET**: A new token is generated on every GET request. This is fine but means the token changes on each page load — if a user has multiple tabs open, submitting a form in one tab after loading another tab could fail.

## Ready for Proposal

**Yes** — the scope is well-defined, the codebase has been thoroughly analyzed, and the approach is clear. The orchestrator should present the 4 sub-scopes to the user:
1. Service layer completion (CartService, CategoryService, FranchiseService + controller refactors)
2. Dead code removal (unused `authMiddleware` imports)
3. Jest coverage configuration (50% threshold)
4. CSRF error page fix (403 → proper error page)
