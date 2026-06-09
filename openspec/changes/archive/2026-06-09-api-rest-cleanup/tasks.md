# Tasks: api-rest-cleanup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380–420 (additions + deletions) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (P1): Services + controller refactors; PR 2 (P2+P3+P4): Cookie config, dead imports, CSRF fix, Jest coverage |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Services + controller refactors | PR 1 | Base = feature/api-rest-cleanup; 3 new services + 3 controllers updated + 3 service test files |
| 2 | Security + cleanup + coverage | PR 2 | Base = PR 1 branch; session cookie, dead imports removed, CSRF fix, Jest config |

---

## P1 — Services + Controller Refactors (PR 1)

- [x] P1.1 Create `src/services/cartService.js` — export singleton with `findByUserId(userId)` calling `ShoppingCart.findAll({ where: { IDUser: userId }, include: [{ model: Product, as: 'product' }] })` and `findAll()` calling `ShoppingCart.findAll()`
- [x] P1.2 Create `src/services/categoryService.js` — export singleton with `findAll()` and `findById(id)` methods wrapping Category model
- [x] P1.3 Create `src/services/franchiseService.js` — export singleton with `findAll()` and `findById(id)` methods wrapping Franchise model
- [x] P1.4 Modify `src/services/index.js` — add requires for CartService, CategoryService, FranchiseService and export them alongside existing services
- [x] P1.5 Modify `src/controllers/products/formNewProduct.js` — replace `const { Category, Franchise } = require('../../database/models/db')` + direct calls with `const { CategoryService, FranchiseService } = require('../../services')` + service calls
- [x] P1.6 Modify `src/controllers/products/viewShoppingCart.js` — replace direct ShoppingCart.findAll + Product import with `const { CartService } = require('../../services')` and `CartService.findByUserId(userId)`. Keep `calcularTotal` function and `.then()` chain intact
- [x] P1.7 Modify `src/controllers/products/postNewProduct.js` — replace `const { Category, Franchise } = require('../../database/models/db')` + direct calls with service calls (CategoryService.findAll, FranchiseService.findAll) — keep rest of controller unchanged
- [x] P1.8 Create `src/services/__tests__/cartService.test.js` — mock ShoppingCart.findAll and Product; test `findByUserId` returns cart items, `findAll` returns all items, empty array for non-existent user
- [x] P1.9 Create `src/services/__tests__/categoryService.test.js` — mock Category; test `findAll` returns categories, `findById` returns category or null
- [x] P1.10 Create `src/services/__tests__/franchiseService.test.js` — mock Franchise; test `findAll` returns franchises, `findById` returns franchise or null

## P2 — Session Cookie Security + Dead Code Removal (PR 2)

- [x] P2.1 Modify `src/app.js` — add `sameSite: 'lax'` and `secure: process.env.NODE_ENV === 'production'` to the session cookie config object inside `session({ cookie: { ... } })`
- [x] P2.2 Modify `src/routes/userRoutes.js` — remove `authMiddleware` from destructured import on line 4: change `{ isUser, guestMiddleware, authMiddleware }` to `{ isUser, guestMiddleware }`
- [x] P2.3 Modify `src/routes/productsRoutes.js` — remove `authMiddleware` from destructured import on line 5: change `{ isUser, guestMiddleware, authMiddleware }` to `{ isUser, guestMiddleware }`

## P3 — CSRF Error Page Fix (PR 2)

- [x] P3.1 Create `src/views/403Forbidden.ejs` — new EJS template with `<%= message %>` display and "403 Forbidden" heading. Copy layout from `404NotFound.ejs` (header/footer includes)
- [x] P3.2 Modify `src/middlewares/csrf.js` — replace all 3 occurrences of `require('path').join(__dirname, '../views/404NotFound.ejs')` with `require('path').join(__dirname, '../views/403Forbidden.ejs')` (lines 49, 62, 68). Keep the `res.status(403)` calls unchanged

## P4 — Jest Coverage Config (PR 2)

- [x] P4.1 Modify `jest.config.js` — add `collectCoverageFrom`, `coverageDirectory: 'coverage'`, and `coverageThreshold` with `global: { branches: 50, functions: 50, lines: 50, statements: 50 }`

---

## Implementation Notes

- All services follow the `const Service = { async method() { return Model.method() } }; module.exports = Service;` pattern
- viewShoppingCart uses `.then()` chain — convert only the model call, keep the promise chain as-is
- postNewProduct already imports ProductService — add CategoryService and FranchiseService to the same destructured require
- 403Forbidden.ejs should reuse existing partials (head, header, footer) for consistency
- CSRF fix: only change the template path, keep status code 403
- Jest coverage excludes `src/database/seed.js` and `src/app.js` per spec