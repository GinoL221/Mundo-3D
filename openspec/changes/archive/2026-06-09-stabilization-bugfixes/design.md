# Design: Stabilization Bugfixes

## Technical Approach

Four sequential patches to fix production-visible bugs and remove dead code. Each patch is independently revertable. No logic changes — only ordering, path correction, error propagation, and dead code removal.

## Architecture Decisions

### Decision: Middleware Order

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Move only cookie-parser before userLoggedMiddleware | Minimal change, but helmet/cors still wrong order | Rejected — fix all ordering at once |
| Reorder all middleware per spec | Larger diff, but correct security posture | **Accepted** — one-time reorder |
| Leave as-is and add cookie-parser duplicate | No reorder risk, but redundant middleware | Rejected — wasteful |

**Rationale**: The spec defines a canonical order. Doing it once prevents future confusion.

### Decision: Error Propagation Pattern

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Replace `res.status(500)` with `next(err)` | ErrorHandler returns JSON to HTML routes | **Accepted** — known risk, documented |
| Keep inline 500 for HTML routes, next(err) for API | Inconsistent, more complex | Rejected — defeats purpose |
| Modify errorHandler to detect Accept header | Scope creep for stabilization | Rejected — separate change |

**Rationale**: ErrorHandler already exists and is registered. Activating it is the stabilization goal. JSON responses for HTML routes is a known limitation to address separately.

### Decision: mainController.js Graceful Degradation

**Choice**: Leave mainController catch block unchanged (renders with `products: []`).
**Rationale**: This is intentional graceful degradation, not a bug. The homepage should still render even if the product service fails.

## Patch 1: Middleware Reordering (src/app.js)

### BEFORE (current order, lines 26-61)

```js
server.use(session({ ... }));        // line 26
server.use(userLoggedMiddleware);     // line 39
server.use(cartCountMiddleware);      // line 40
server.use(cookies());                // line 42
server.use(morgan('dev'));            // line 43
server.set('view engine', 'ejs');     // line 44
server.use(express.urlencoded(...));  // line 47
server.use(express.json());           // line 48
server.use(methodOverride('_method'));// line 51
server.use(express.static(...));      // line 53
server.use(cors());                   // line 55
server.use(helmet());                 // line 58
server.use(csrfProtection);           // line 61
```

### AFTER (new order)

```js
// 1. Security headers (first)
server.use(helmet());

// 2. CORS headers
server.use(cors());

// 3. Static files
server.use(express.static(path.join(__dirname, '../public')));

// 4. Request logging
server.use(morgan('dev'));

// 5. Body parsing
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

// 6. Method override
server.use(methodOverride('_method'));

// 7. Cookie parsing (MUST be before session and auth)
server.use(cookies());

// 8. Session management
server.use(session({ ... }));

// 9. Auth middleware (reads req.cookies.userEmail)
server.use(userLoggedMiddleware);
server.use(cartCountMiddleware);

// 10. View engine
server.set('view engine', 'ejs');

// 11. CSRF (after session + cookie-parser + body parser)
server.use(csrfProtection);
```

**Key changes**:
- `helmet()` and `cors()` move to top (before static files)
- `cookies()` moves before `session()` and `userLoggedMiddleware`
- `express.static()` moves before body parsing (standard convention)
- `cartCountMiddleware` stays with `userLoggedMiddleware` (depends on session)

## Patch 2: Cart Image Path (src/views/products/productCart.ejs)

### BEFORE (line 17)

```ejs
<img src="/img/<%= cartItem.product.Image %>" alt="" class="imagen-producto" />
```

### AFTER

```ejs
<img src="/img/products/<%= cartItem.product.Image %>" alt="" class="imagen-producto" />
```

**Rationale**: Product images are stored in `public/img/products/` (confirmed by multer config in productsRoutes.js line 13). The current path `/img/` produces 404s.

## Patch 3: Error Handler Activation

### Pattern: What to Replace

Every controller catch block with inline 500 response:

```js
// BEFORE (generic pattern)
catch (error) {
  console.error('...', error);
  res.status(500).send('Error interno del servidor');
  // OR: res.status(500).json({ error: '...' });
  // OR: res.status(500).send(`Error: ${error.message}`);  ← security leak!
}
```

```js
// AFTER
catch (error) {
  console.error('...', error);
  next(error);
}
```

**Important**: The `next` parameter must be added to the function signature if not present.

### Affected Controllers (11 files)

| File | Current Pattern | Signature Change Needed |
|------|----------------|------------------------|
| `src/controllers/products/viewShoppingCart.js:23-26` | `.catch((error) => { res.status(500).send(...) })` | No — uses `.then().catch()` chain, pass `next` into catch |
| `src/controllers/products/postNewProduct.js:43-46` | `catch (error) { res.status(500).send(...) }` | Yes — add `next` param |
| `src/controllers/products/deleteProduct.js:14-17` | `catch (error) { res.status(500).send(...) }` | Yes — add `next` param |
| `src/controllers/products/confirmModifyProduct.js:20-23` | `catch (error) { res.status(500).send(...) }` | Yes — add `next` param |
| `src/controllers/products/getProductById.js:17-20` | `catch (error) { res.status(500).send(...) }` | Yes — add `next` param |
| `src/controllers/products/getAllProducts.js:11-14` | `catch (error) { res.status(500).send(...) }` | Yes — add `next` param |
| `src/controllers/users/processLogin.js:66-69` | `catch (error) { res.status(500).json(...) }` | Yes — add `next` param |
| `src/controllers/users/postNewUser.js:42-45` | `catch (error) { res.status(500).json(...) }` | Yes — add `next` param |
| `src/controllers/users/deleteUser.js:15-18` | `catch (error) { res.status(500).send(\`Error: ${error.message}\`) }` | Yes — add `next` param |
| `src/controllers/users/getUserById.js:18-21` | `catch (error) { res.status(500).send(...) }` | Yes — add `next` param |
| `src/controllers/users/getAllUsers.js:11-14` | `catch (error) { res.status(500).send(...) }` | Yes — add `next` param |

### Special Case: viewShoppingCart.js (Promise chain)

This controller uses `.then().catch()` instead of async/await:

```js
// BEFORE
const viewShoppingCart = (req, res) => {
  CartService.findByUserId(userId)
    .then((userShoppingCart) => { ... })
    .catch((error) => {
      res.status(500).send('Error interno del servidor');
    });
};

// AFTER — must capture `next` in closure
const viewShoppingCart = (req, res, next) => {
  CartService.findByUserId(userId)
    .then((userShoppingCart) => { ... })
    .catch((error) => {
      next(error);
    });
};
```

### Special Case: deleteUser.js (Security Fix)

The current code leaks internal error messages to the client:

```js
// BEFORE — security vulnerability
res.status(500).send(`Error: ${error.message}`);

// AFTER — error message hidden by errorHandler
next(error);
```

The errorHandler already masks messages in production (line 15-17 of errorHandler.js).

### NOT Changed: mainController.js

```js
// Keep as-is — intentional graceful degradation
catch (error) {
  console.error('Error loading homepage:', error);
  const ruta = path.join(__dirname, '../views/index');
  res.render(ruta, { products: [] });
}
```

### NOT Changed: API routes (src/routes/api/*.js)

Out of scope per proposal. Addressed in a separate change.

## Patch 4: Dead Code Removal

### Files to Delete

| File | Reason |
|------|--------|
| `src/views/products/product.ejs` | MongoDB `_id` references, pre-Sequelize remnant |
| `src/views/products/productMenu.ejs` | Hardcoded static content, no route renders it |
| `src/views/users/newUser.ejs` | Duplicates `register.ejs`, no route renders it |

### Imports to Remove

**src/routes/productsRoutes.js (line 5)**:
```js
// BEFORE
const { isUser, guestMiddleware } = require('../middlewares/auth');

// AFTER
const { isUser } = require('../middlewares/auth');
```
`guestMiddleware` is imported but never used in productsRoutes. It remains exported from `auth.js` and is used in `userRoutes.js`.

**src/controllers/products/viewShoppingCart.js (line 2)**:
```js
// BEFORE
const { CartService } = require('../../services');
const { User } = require('../../database/models/db');
const path = require('path');

// AFTER
const { CartService } = require('../../services');
const path = require('path');
```
`User` is imported but never referenced in the file.

### Debug Statement to Remove

**src/controllers/products/viewShoppingCart.js (line 18)**:
```js
// DELETE this line:
console.log('Carrito de compras:', userShoppingCart);
```

## Data Flow

```
Request
  │
  ▼
helmet() ──→ cors() ──→ static() ──→ morgan()
  │
  ▼
body parsers ──→ cookie-parser() ──→ session()
  │
  ▼
userLoggedMiddleware ──→ cartCountMiddleware
  │
  ▼
csrfProtection ──→ Routes ──→ Controllers
  │                                    │
  │              ┌─────────────────────┘
  │              │ error?
  ▼              ▼
404 handler ← next(err)
  │
  ▼
errorHandler (last) ──→ JSON response
```

## Interfaces / Contracts

No new interfaces. The errorHandler contract remains:

```js
// errorHandler.js — existing contract
(err, req, res, next) => {
  // err.status or err.statusCode for custom status
  // In production: generic message
  // In development: err.message + stack
  // Always returns JSON
}
```

Controllers now delegate to this contract via `next(err)` instead of bypassing it.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `next(err)` propagation in each controller | Mock `res` and `next`, verify `next` called with error object |
| Unit | viewShoppingCart promise chain catches error | Mock CartService.reject(), verify `next(error)` called |
| Unit | deleteUser no longer leaks error message | Mock service error, verify response does not contain error.message |
| Integration | Middleware order: cookie-parser before userLoggedMiddleware | supertest: set cookie, hit route, verify `req.session.userLogged` populated |
| Integration | Middleware order: helmet before cors | supertest: GET any route, verify response headers order |
| Integration | Cart image path renders correctly | supertest: GET /productCart, verify HTML contains `/img/products/` |
| Integration | Dead files deleted, no broken imports | `npm start` should not throw module resolution errors |
| E2E | Remember-me login flow works end-to-end | Browser test: login with "remember me", close browser, reopen, verify session restored |

### Key Test: Middleware Order (supertest)

```js
// Verify cookie-parser runs before userLoggedMiddleware
it('should read userEmail cookie in auth middleware', async () => {
  const agent = request.agent(app);
  // Set a cookie
  agent.jar.setCookie('userEmail=test@example.com');
  const res = await agent.get('/');
  // If cookie-parser is before userLoggedMiddleware, session should work
  expect(res.status).toBe(200);
});
```

### Key Test: Error Propagation

```js
// Verify controller calls next(err) instead of res.status(500)
it('should propagate errors to errorHandler', async () => {
  // Mock service to throw
  jest.spyOn(CartService, 'findByUserId').mockRejectedValue(new Error('DB error'));
  const res = await request(app).get('/productCart');
  // errorHandler returns JSON
  expect(res.status).toBe(500);
  expect(res.body).toHaveProperty('error');
});
```

## Migration / Rollout

No migration required. All changes are code-level only:
- No database schema changes
- No environment variable changes
- No feature flags needed

**Rollback**: Each patch is one commit. Reverse order: (4) restore dead code → (3) revert error handlers → (2) revert image path → (1) revert middleware order.

## Open Questions

- [ ] None — all technical decisions are scoped and resolved
