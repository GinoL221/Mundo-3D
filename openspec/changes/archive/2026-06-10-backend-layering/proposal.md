# Proposal: Backend Layering

## Intent

Eradicate scattered business logic from routes and controllers. The codebase leaks crypto, domain math, ORM queries, and inline validation into layers that should only declare or orchestrate — making tests harder, changes riskier, and responsibilities blurry. This change drives every backend file toward the clean-architecture rule: **routes declare, controllers orchestrate, services own business logic**.

## Scope

### In Scope

1. **Auth Encapsulation** — `bcrypt.compareSync` in `processLogin.js` → `UserService.verifyPassword(plain, hash)`
2. **Cart Logic** — `calcularTotal` in `viewShoppingCart.js` → `CartService.computeTotal(cartItems)`
3. **Middleware via Service** — `userLogged.js` stops direct `User.findOne`; uses `UserService.findByEmail()`
4. **Upload Shared** — Deduplicate multer+uuid config from `productsRoutes.js` and `userRoutes.js` → `src/middlewares/upload.js` (factory)
5. **Own Validators** — Extract `validationsForm`, `validationsUsers`, `loginValidation` from route files → `src/middlewares/validators/productValidators.js` and `src/middlewares/validators/userValidators.js`
6. **API Layered** — Inline countByCategory+mapping logic in `routes/api/products.js` → controller + service methods
7. **Consistency** — `mainController.js` → one-file-per-action + barrel; `/aboutUs` inline handler → controller; controllers use `res.render('viewName')` not `path.join(__dirname, '...')`
8. **Double Validation** — Remove duplicate image check in `postNewProduct.js` (express-validator already covers it in route)

### Out of Scope

- Auth on `/api` endpoints (security feature, not refactoring)
- Admin role guard (security feature, not refactoring)
- Database schema or model changes
- Frontend or EJS template changes

## Capabilities

### New Capabilities

- `user-auth`: UserService.verifyPassword for credential verification
- `cart-computation`: CartService.computeTotal for cart total calculation
- `upload-middleware`: Parameterizable multer factory for file uploads
- `product-validators`: Express-validator chains for product forms
- `user-validators`: Express-validator chains for user forms
- `api-products-controller`: Controller+service layer for API product endpoints

### Modified Capabilities

- `cart-service`: Adding `computeTotal` method to existing spec
- `session-cookie-security`: Middleware `userLogged` changes data source from direct ORM to UserService

## Approach

Pure refactoring — no new features. Each item preserves existing behavior while moving logic to the correct layer. **TDD-first**: write failing tests for `UserService.verifyPassword` and `CartService.computeTotal`, then implement. All existing tests must remain green without modifying their `db.js` mocks.

Order: (1) service methods (tests first), (2) controller updates, (3) middleware extraction, (4) route cleanup, (5) consistency pass.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/services/userService.js` | Modified | Add `verifyPassword` method |
| `src/services/cartService.js` | Modified | Add `computeTotal` method |
| `src/controllers/users/processLogin.js` | Modified | Replace bcrypt direct call with UserService |
| `src/controllers/products/viewShoppingCart.js` | Modified | Replace `calcularTotal` with CartService call; remove `path.join` render |
| `src/middlewares/userLogged.js` | Modified | Use UserService instead of direct `User.findOne` |
| `src/middlewares/upload.js` | New | Parameterizable multer factory |
| `src/middlewares/validators/` | New | Product and user validator modules |
| `src/routes/productsRoutes.js` | Modified | Remove inline validators + multer config |
| `src/routes/userRoutes.js` | Modified | Remove inline validators + multer config |
| `src/routes/api/products.js` | Modified | Extract to controller+service |
| `src/controllers/api/` | New | API product controller |
| `src/controllers/main/` | New | One-file-per-action for main routes |
| `src/controllers/mainController.js` | Removed | Replaced by `main/` barrel |
| `src/routes/mainRoutes.js` | Modified | Inline `/aboutUs` handler → controller |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Circular imports from barrel restructure | Low | Verify import graph after each step; Jest catches circular deps |
| Render path breakage changing from `path.join` to view name | Med | EJS view resolution must be configured; manual browser check per changed controller |
| Validator extraction changes error shape | Low | Keep identical validator chains; diff test output |
| Multer destination mismatch in factory | Low | Factory takes explicit `dest` param; unit test confirms path |
| Existing service test mocks break | Low | New methods don't touch `db.js` models (pure functions); existing mock shape unchanged |

## Rollback Plan

Each item is independently revertable via git. If `UserService.verifyPassword` breaks login, revert `processLogin.js` to call `bcrypt.compareSync` directly. If `CartService.computeTotal` misbehaves, revert `viewShoppingCart.js` to inline `calcularTotal`. All other extractions follow the same pattern — original inline code is the fallback.

## Dependencies

- Existing test suite (`npm test`) must be green before starting
- Jest mock pattern for `db.js` must remain unchanged

## Success Criteria

- [ ] `UserService.verifyPassword(plain, hash)` returns correct boolean; 0 direct `bcrypt.compareSync` calls in controllers
- [ ] `CartService.computeTotal(cartItems)` returns correct sum; `calcularTotal` function removed from controller
- [ ] `userLogged.js` uses `UserService.findByEmail`; 0 direct `User.findOne` calls
- [ ] Single `upload.js` factory replaces both multer configs; routes import from factory
- [ ] Validator chains live in `src/middlewares/validators/`; routes only reference imports
- [ ] API products route has no inline business logic; all in controller+service
- [ ] `mainController.js` replaced by `main/` barrel; all render calls use view names not `path.join`
- [ ] `/aboutUs` handled by controller, not inline route handler
- [ ] Duplicate image validation removed from `postNewProduct.js`
- [ ] All existing tests green; new service tests pass; coverage ≥ 50%