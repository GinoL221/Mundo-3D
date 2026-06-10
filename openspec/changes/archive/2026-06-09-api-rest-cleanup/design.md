# Design: API REST Cleanup

## Technical Approach

Complete the thin service layer by creating CartService, CategoryService, and FranchiseService following the existing ProductService/UserService pattern (plain object with async methods, exported as singleton). Refactor 3 controllers to use services instead of direct model imports. Add session cookie security flags, remove dead imports, fix CSRF error page, and add Jest coverage thresholds.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|----------|-------------|-----------|
| CartService wraps `ShoppingCart.findAll({ where, include })` exactly as controller does | Extract into generic repository | Keep thin service pattern consistent; no abstraction needed yet |
| CategoryService/FranchiseService expose only `findAll()` | Add `findById`, `create`, etc. | Controllers only need `findAll()` now; YAGNI |
| Session `secure: true` only when `NODE_ENV=production` | Always secure or always off | localhost HTTP breaks with `secure: true`; conditional is standard |
| CSRF renders new `403Forbidden.ejs` template | Reuse 404 template with different status | 404 page is semantically wrong for 403; separate template is clearer |
| Jest coverage at 50% | 70% or no threshold | 50% is realistic for existing codebase; can raise later |
| `authMiddleware` import removed (not used in routes) | Keep for future use | Dead code creates confusion; git history preserves it |

## Data Flow

### Cart Operations (Before → After)

```
BEFORE (direct model import):
  Controller ──→ ShoppingCart Model ──→ Database
       │                                    │
       └── include: Product ────────────────┘

AFTER (service layer):
  Controller ──→ CartService.findByUserId() ──→ ShoppingCart Model ──→ Database
                                                    │
                                                    └── include: Product
```

### Product Form Flow

```
  Controller ──→ CategoryService.findAll() ──→ Category Model
              ──→ FranchiseService.findAll() ──→ Franchise Model
              ──→ render(newProduct.ejs, { categories, franchises })
```

## File Changes

### P1 — Service Creation + Controller Refactors

| File | Action | Description |
|------|--------|-------------|
| `src/services/cartService.js` | Create | CartService with `findByUserId(userId)` method |
| `src/services/categoryService.js` | Create | CategoryService with `findAll()` method |
| `src/services/franchiseService.js` | Create | FranchiseService with `findAll()` method |
| `src/services/index.js` | Modify | Export 3 new services |
| `src/controllers/products/formNewProduct.js` | Modify | Replace direct Category/Franchise imports with service calls |
| `src/controllers/products/viewShoppingCart.js` | Modify | Replace direct ShoppingCart/Product imports with CartService |
| `src/controllers/products/postNewProduct.js` | Modify | Replace direct Category/Franchise imports with service calls |

### P2 — Session Cookie Security + Dead Code Removal

| File | Action | Description |
|------|--------|-------------|
| `src/app.js` | Modify | Add `sameSite: 'lax'` and conditional `secure` to session cookie config |
| `src/routes/userRoutes.js` | Modify | Remove unused `authMiddleware` from destructured import |
| `src/routes/productsRoutes.js` | Modify | Remove unused `authMiddleware` from destructured import |

### P3 — CSRF Error Page Fix

| File | Action | Description |
|------|--------|-------------|
| `src/views/403Forbidden.ejs` | Create | New 403 error page template |
| `src/middlewares/csrf.js` | Modify | Render `403Forbidden.ejs` instead of `404NotFound.ejs` on CSRF failure |

### P4 — Jest Coverage Config

| File | Action | Description |
|------|--------|-------------|
| `jest.config.js` | Modify | Add `collectCoverageFrom`, `coverageThreshold`, `coverageDirectory` |

## Interfaces / Contracts

### CartService

```javascript
const { ShoppingCart, Product } = require('../database/models/db');

const CartService = {
  async findByUserId(userId) {
    return ShoppingCart.findAll({
      where: { IDUser: userId },
      include: [{ model: Product, as: 'product' }],
    });
  },
};

module.exports = CartService;
```

### CategoryService

```javascript
const { Category } = require('../database/models/db');

const CategoryService = {
  async findAll() {
    return Category.findAll();
  },
};

module.exports = CategoryService;
```

### FranchiseService

```javascript
const { Franchise } = require('../database/models/db');

const FranchiseService = {
  async findAll() {
    return Franchise.findAll();
  },
};

module.exports = FranchiseService;
```

### Controller Changes (Before/After)

**formNewProduct.js** — Before:
```javascript
const { Category, Franchise } = require('../../database/models/db');
const categories = await Category.findAll();
const franchises = await Franchise.findAll();
```

After:
```javascript
const { CategoryService, FranchiseService } = require('../../services');
const categories = await CategoryService.findAll();
const franchises = await FranchiseService.findAll();
```

**viewShoppingCart.js** — Before:
```javascript
const { ShoppingCart, Product, User } = require('../../database/models/db');
ShoppingCart.findAll({ where: { IDUser: userId }, include: [{ model: Product, as: 'product' }] })
```

After:
```javascript
const { CartService } = require('../../services');
const userShoppingCart = await CartService.findByUserId(userId);
```

**postNewProduct.js** — Before:
```javascript
const { Category, Franchise } = require('../../database/models/db');
const categories = await Category.findAll();
const franchises = await Franchise.findAll();
```

After:
```javascript
const { CategoryService, FranchiseService } = require('../../services');
const categories = await CategoryService.findAll();
const franchises = await FranchiseService.findAll();
```

### Session Cookie Config

```javascript
// src/app.js — session config
server.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  }),
);
```

### CSRF Fix

Replace all 3 occurrences of `require('path').join(__dirname, '../views/404NotFound.ejs')` with `require('path').join(__dirname, '../views/403Forbidden.ejs')` in `src/middlewares/csrf.js`.

### Jest Coverage Config

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/database/**/*.js', '!src/app.js'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — CartService | `findByUserId` returns cart items with products | Mock ShoppingCart.findAll, verify query params |
| Unit — CategoryService | `findAll` returns all categories | Mock Category.findAll |
| Unit — FranchiseService | `findAll` returns all franchises | Mock Franchise.findAll |
| Unit — CSRF middleware | 403 status on invalid token, 403 template rendered | Mock req/res/next, verify render call |
| Integration — Controllers | formNewProduct renders with categories/franchises | Mock services, verify render args |
| Coverage | `npm test -- --coverage` passes ≥50% | Run with new jest.config.js thresholds |

## Migration / Rollout

No migration required. All changes are code-only, reversible via git revert. No database changes, no feature flags needed.

## Open Questions

- [ ] None — all technical decisions resolved.
