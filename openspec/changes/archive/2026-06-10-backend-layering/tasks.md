# Tasks: Backend Layering

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650-750 (service methods + tests + route refactoring) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Phase 1-2 → PR 1 (Foundation + Services) / Phase 3-4 → PR 2 (Controllers + Middleware) / Phase 5-7 → PR 3 (Extractions + API + Consistency) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes (resolved: feature-branch-chain)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phase 0 (views config) + Phase 2 (service methods with tests) | PR 1 | Base branch = main; TDD tests for verifyPassword, computeTotal, transformWithCategoryCount |
| 2 | Phase 3 (controller updates) + Phase 4 (userLogged middleware) | PR 2 | Depends on PR 1; processLogin, viewShoppingCart, postNewProduct, userLogged |
| 3 | Phase 5 (upload factory + validators) + Phase 6 (API controller) + Phase 7 (mainController split) | PR 3 | Depends on PR 2; 6 new files, 4 route files, barrel pattern |

## Phase 0: Prerequisite — Views Configuration

- [x] 0.1 Add `server.set('views', path.join(__dirname, 'views'))` in `src/app.js` after line 18 (`const server = express();`) and before line 66 (`server.set('view engine', 'ejs')`)
- [x] 0.2 Remove `path.join(__dirname, './views/404NotFound.ejs')` from 404 handler (line 80), replace with `'404NotFound'`

## Phase 1: Service Methods — TDD First

### Item 1: UserService.verifyPassword

- [x] 1.1 Create `src/__tests__/services/userService.test.js` with tests for `verifyPassword(plain, hash)` — correct password returns true, incorrect returns false, uses bcryptjs directly
- [x] 1.2 Run tests — expect FAIL (method not exists)
- [x] 1.3 Add `verifyPassword(plainPassword, hashedPassword)` method to `src/services/userService.js` — sync, delegates to `bcryptjs.compareSync`
- [x] 1.4 Run tests — expect PASS

### Item 2: CartService.computeTotal

- [x] 2.1 Create `src/__tests__/services/cartService.test.js` with tests for `computeTotal(cartItems)` — empty array returns 0, single item returns price*qty, multiple items returns correct sum
- [x] 2.2 Run tests — expect FAIL
- [x] 2.3 Add `computeTotal(cartItems)` method to `src/services/cartService.js` — sync, pure function, iterates items multiplying `product.Price * Quantity`
- [x] 2.4 Run tests — expect PASS

### Item 6: ProductService.transformWithCategoryCount

- [x] 6.1 Create `src/__tests__/services/productService.test.js` with tests for `transformWithCategoryCount(products)` — returns { count, countByCategory, products }
- [x] 6.2 Run tests — expect FAIL
- [x] 6.3 Add `transformWithCategoryCount(products)` method to `src/services/productService.js` — sync, pure transformation (see design.md section "Interfaces / Contracts")
- [x] 6.4 Run tests — expect PASS

## Phase 2: Controller Updates

### Item 1: processLogin.js (bcrypt → UserService)

- [x] 1.5 Update `src/controllers/users/processLogin.js` — replace `bcrypt.compareSync` (line 18) with `UserService.verifyPassword(password, userToLogin.PasswordUser)`
- [x] 1.6 Remove `const bcrypt = require('bcryptjs');` import (line 2)
- [x] 1.7 Replace all `path.join(__dirname, '../../views/...')` renders with view names: `'users/login'`
- [x] 1.8 Run `npm test` — expect all pass

### Item 2: viewShoppingCart.js (calcularTotal → CartService)

- [x] 2.5 Remove inline `calcularTotal` function from `src/controllers/products/viewShoppingCart.js` (lines 4-10)
- [x] 2.6 Replace `res.render(ruta, { userShoppingCart, calcularTotal })` with `res.render('products/productCart', { userShoppingCart, total: CartService.computeTotal(userShoppingCart) })`
- [x] 2.7 Remove `const path = require('path');` import (line 2)
- [x] 2.8 Run `npm test` — expect all pass

### Item 8: postNewProduct.js (validation dedup)

- [x] 8.1 Remove duplicate `if (!req.file)` check in `src/controllers/products/postNewProduct.js` (lines 20-22) — express-validator already handles this in route
- [x] 8.2 Replace `path.join(__dirname, '../../views/...')` with view name `'products/newProduct'`
- [x] 8.3 Remove `const path = require('path');` import (line 3)
- [x] 8.4 Run `npm test` — expect all pass

### Item 9: ProductService coverage gap (update + findLatest)

- [x] 9.1 Add test for `ProductService.update(id, data)` — mock Product.findByPk
- [x] 9.2 Add test for `ProductService.findLatest()` — mock Product.findOne
- [x] 9.3 Run tests — expect all pass

## Phase 3: Middleware — userLogged via Service

### Item 3: userLogged.js

- [x] 3.1 Update `src/middlewares/userLogged.js` — replace `User.findOne` (lines 11-14) with `UserService.findByEmail(emailInCookie)`
- [x] 3.2 Remove `const { initializeModels } = require('../database/models');` and `const { User } = db;` (lines 1-3)
- [x] 3.3 Add test for userLogged middleware — mock UserService.findByEmail, verify middleware calls it and attaches user to session
- [x] 3.4 Run `npm test` — expect all pass

## Phase 4: Extraction — Upload Factory + Validators

### Item 4: Upload Factory

- [x] 4.1 Create `src/middlewares/upload.js` — factory `createUpload(dest)` that returns configured multer instance
- [x] 4.2 Create `src/__tests__/backendLayeringPR3.test.js` — test factory returns configured multer, verify dest and filename
- [x] 4.3 Update `src/routes/productsRoutes.js` — remove inline multer config (lines 11-20), import `createUpload`, use `createUpload('products')`
- [x] 4.4 Update `src/routes/userRoutes.js` — remove inline multer config (lines 13-22), import `createUpload`, use `createUpload('users')`
- [x] 4.5 Run `npm test` — expect all pass

### Item 5: Validator Modules

- [x] 5.1 Create `src/middlewares/validators/productValidators.js` — extract `validationsForm` array from `productsRoutes.js`
- [x] 5.2 Create `src/middlewares/validators/userValidators.js` — extract `validationsUsers` and `loginValidation` arrays from `userRoutes.js`
- [x] 5.3 Update `src/routes/productsRoutes.js` — remove inline `validationsForm`, import from validators
- [x] 5.4 Update `src/routes/userRoutes.js` — remove inline validators, import from validators
- [x] 5.5 Run `npm test` — expect all pass

## Phase 5: API Layer — Controller + Service

### Item 6: API Products Controller

- [x] 6.5 Create `src/controllers/api/productApiController.js` — `index`, `show`, `latest` handlers calling ProductService
- [x] 6.6 Update `src/routes/api/products.js` — replace inline logic with controller delegation
- [x] 6.7 Run `npm test` — expect all pass

## Phase 6: Consistency — mainController Split

### Item 7: Barrel Pattern

- [x] 7.1 Create `src/controllers/main/home.js` — move `index` action from `mainController.js`
- [x] 7.2 Create `src/controllers/main/aboutUs.js` — new controller for about page
- [x] 7.3 Create `src/controllers/main/index.js` — barrel re-exporting `{ home, aboutUs }`
- [x] 7.4 Update `src/routes/mainRoutes.js` — import from barrel, remove inline `/aboutUs` handler
- [x] 7.5 Delete `src/controllers/mainController.js`
- [x] 7.6 Update `app.js` 404 handler — already done in Phase 0 task 0.2
- [x] 7.7 Run `npm test` — expect all pass

## Phase 7: Integration Tests

- [x] 7.1 File assertion: verify no `bcrypt.compareSync` in any controller
- [x] 7.2 File assertion: verify no `path.join` for renders in controllers touched by this change
- [x] 7.3 File assertion: verify `upload.js` factory exists and routes import it
- [x] 7.4 File assertion: verify validator modules exist and routes import them
- [x] 7.5 Run full `npm test` suite — all pass (90/90), coverage ≥ 50% on services

## Implementation Order

1. **Phase 0** (views config) — unblocks all path→viewName changes
2. **Phase 1** (service methods) — TDD tests first, implement after FAIL
3. **Phase 2** (controller updates) — depends on Phase 1 service methods + Phase 0
4. **Phase 3** (userLogged) — independent, can run parallel to Phase 2
5. **Phase 4** (upload + validators) — independent extraction, both touch routes
6. **Phase 5** (API controller) — depends on Phase 1 service method
7. **Phase 6** (mainController split) — barrel pattern, independent
8. **Phase 7** (integration) — verify everything works together

## Notes

- Phase 0 MUST come before any controller using `path.join` for views
- Items 1-3 need service methods written FIRST (Phase 1)
- After Phase 0, items 1-8 can be interleaved per dependency graph
- Each item is independently committable for rollback safety
- TDD: write failing test → implement → green test → next
