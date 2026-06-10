# Tasks: Stabilization Bugfixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~165-210 (implementation ~92 + tests ~80-120) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR — all 4 patches are independently revertable |
| Delivery strategy | ask-always |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 4 patches + tests | PR 1 | All patches are small, independently revertable, and safe to ship together |

## Phase 1: Tests for All Patches (TDD — tests FIRST)

- [x] 1.1 Create `src/__tests__/middlewareOrder.test.js` — assert `helmet()` before `cors()` and `cookies()` before `userLoggedMiddleware` via header inspection or middleware stack ordering
- [x] 1.2 Create `src/__tests__/errorPropagation.test.js` — mock service to reject, verify controller calls `next(error)` and errorHandler returns JSON with status 500
- [x] 1.3 Create `src/__tests__/cartImagePath.test.js` — supertest GET /productCart (or mock res.render), verify rendered HTML contains `/img/products/`
- [x] 1.4 Create `src/__tests__/deadCodeRemoval.test.js` — verify deleted EJS files return 404, verify `console.log` gone from viewShoppingCart, verify `User` import removed
- [x] 1.5 Create `src/__tests__/productsRoutesImports.test.js` — verify `productsRoutes.js` no longer imports `guestMiddleware` or `authMiddleware`

## Phase 2: Patch 1 — Middleware Reorder (src/app.js)

- [x] 2.1 Move `helmet()` to line 1 (before `cors()`, before `express.static`)
- [x] 2.2 Move `cors()` after `helmet()`, before `express.static`
- [x] 2.3 Move `express.static()` after `cors()`, before `morgan()`
- [x] 2.4 Move `cookies()` before `session()` and `userLoggedMiddleware`
- [x] 2.5 Verify `cartCountMiddleware` stays with `userLoggedMiddleware` (depends on session)
- [x] 2.6 Run Phase 1 middleware order tests — all must pass

## Phase 3: Patch 2 — Cart Image Path (src/views/products/productCart.ejs)

- [x] 3.1 Change line 17: `src="/img/<%= cartItem.product.Image %>"` → `src="/img/products/<%= cartItem.product.Image %>"`
- [x] 3.2 Run Phase 1 cart image path test — must pass

## Phase 4: Patch 3 — Error Handler Activation (11 Controllers)

**RED phase** (each controller: write test, verify it fails because controller still uses `res.status(500)`):
- [x] 4.1  `src/controllers/products/viewShoppingCart.js` — add `next` param to function signature; replace catch block `res.status(500).send(...)` with `next(error)`
- [x] 4.2  `src/controllers/products/deleteProduct.js` — add `next` param; replace `res.status(500).send(...)` with `next(error)`
- [x] 4.3  `src/controllers/products/confirmModifyProduct.js` — add `next` param; replace catch block
- [x] 4.4  `src/controllers/products/getProductById.js` — add `next` param; replace catch block
- [x] 4.5  `src/controllers/products/getAllProducts.js` — add `next` param; replace catch block
- [x] 4.6  `src/controllers/products/postNewProduct.js` — add `next` param; replace catch block
- [x] 4.7  `src/controllers/users/processLogin.js` — add `next` param; replace `res.status(500).json(...)` with `next(error)`
- [x] 4.8  `src/controllers/users/postNewUser.js` — add `next` param; replace `res.status(500).json(...)` with `next(error)`
- [x] 4.9  `src/controllers/users/deleteUser.js` — add `next` param; replace `res.status(500).send(\`Error: ${error.message}\`)` with `next(error)` (fixes security leak)
- [x] 4.10 `src/controllers/users/getUserById.js` — add `next` param; replace catch block
- [x] 4.11 `src/controllers/users/getAllUsers.js` — add `next` param; replace catch block

**GREEN phase**:
- [x] 4.12 Run Phase 1 error propagation tests — all 11 controllers must call `next(error)`
- [x] 4.13 Run `npm test` — all tests pass, coverage threshold maintained

## Phase 5: Patch 4 — Dead Code Removal

- [x] 5.1 DELETE `src/views/products/product.ejs`
- [x] 5.2 DELETE `src/views/products/productMenu.ejs`
- [x] 5.3 DELETE `src/views/users/newUser.ejs`
- [x] 5.4 In `src/routes/productsRoutes.js` line 5: remove `guestMiddleware` from destructure (keep `isUser`)
- [x] 5.5 In `src/controllers/products/viewShoppingCart.js` line 2: remove `const { User } = require('../../database/models/db')`
- [x] 5.6 In `src/controllers/products/viewShoppingCart.js` line 18: remove `console.log('Carrito de compras:', userShoppingCart)`
- [x] 5.7 Run Phase 1 dead code removal tests — all must pass
- [x] 5.8 Run `npm test` — no regressions, coverage maintained

## Phase 6: Verification

- [x] 6.1 Run full `npm test` — 100% pass
- [x] 6.2 `grep -r "product.ejs" src/` — zero matches
- [x] 6.3 `grep -r "productMenu.ejs" src/` — zero matches
- [x] 6.4 `grep -r "newUser.ejs" src/` — zero matches
- [x] 6.5 `grep -n "console.log" src/controllers/products/viewShoppingCart.js` — zero matches
- [x] 6.6 `grep -n "guestMiddleware" src/routes/productsRoutes.js` — zero matches
- [x] 6.7 `grep -n "User" src/controllers/products/viewShoppingCart.js` — zero matches (only `userLogged` or similar session references)
