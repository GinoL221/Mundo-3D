# Proposal: api-rest-cleanup

## Intent

Complete the service layer to eliminate direct model imports in controllers, remove dead code, enforce test coverage thresholds, and fix the misleading CSRF error page. This enforces architectural consistency (routes → controllers → services → models) and reduces developer confusion when onboarding.

## Scope

### In Scope
- Create CartService, CategoryService, FranchiseService following existing patterns
- Refactor 3 controllers to use new services instead of direct model imports
- Remove unused `authMiddleware` imports from `userRoutes.js` and `productsRoutes.js`
- Add `sameSite`/`secure` flags to session cookie configuration
- Add Jest coverage thresholds (50% branches, functions, lines, statements)
- Fix CSRF middleware to render a 403 error page instead of 404 on forbidden errors

### Out of Scope
- API response wrapper standardization (single-item endpoints) — future change
- API endpoint authentication — **tech debt**, tracked via TODO comment in API router
- `isUser` vs `authMiddleware` deduplication — separate refactor
- CSRF token rotation handling for multiple tabs — known limitation, no fix planned

## Capabilities

### New Capabilities
- `cart-service`: Service layer for ShoppingCart CRUD operations, replacing direct model access in controllers
- `category-service`: Service layer for Category lookups, replacing direct model imports
- `franchise-service`: Service layer for Franchise lookups, replacing direct model imports
- `coverage-thresholds`: Jest coverage enforcement configuration preventing regressions in test coverage
- `csrf-error-pages`: Proper error page rendering for CSRF 403 errors
- `session-cookie-security`: SameSite and Secure cookie flags on session configuration

### Modified Capabilities
*(None — no existing specs to modify)*

## Approach

Incremental delivery in 4 independent units, each testable and reviewable alone:

1. **P1 — Service creation + controller refactors**: Create 3 services (CartService, CategoryService, FranchiseService) following the ProductService/UserService pattern. Refactor `formNewProduct`, `viewShoppingCart`, and `postNewProduct` controllers to call services instead of importing models directly.
2. **P2 — SameSite/secure cookies + dead code removal**: Add `sameSite: 'lax'` and `secure` flag to session cookie config. Delete unused `authMiddleware` imports from both route files.
3. **P3 — CSRF error page fix**: Change `res.render('404NotFound')` to render a proper 403 page or use `res.status(403).render('error', { status: 403 })` in `src/middlewares/csrf.js`.
4. **P4 — Jest coverage config**: Add `collectCoverageFrom`, `coverageThreshold` (50%), and `coverageDirectory` to `jest.config.js`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/services/cartService.js` | New | CartService for ShoppingCart operations |
| `src/services/categoryService.js` | New | CategoryService for Category lookups |
| `src/services/franchiseService.js` | New | FranchiseService for Franchise lookups |
| `src/controllers/products/formNewProduct.js` | Modified | Replace direct Category/Franchise imports with service calls |
| `src/controllers/products/viewShoppingCart.js` | Modified | Replace direct ShoppingCart/Product/User imports with CartService |
| `src/controllers/products/postNewProduct.js` | Modified | Replace direct Category/Franchise imports with service calls |
| `src/routes/userRoutes.js` | Modified | Remove unused authMiddleware import (line 4) |
| `src/routes/productsRoutes.js` | Modified | Remove unused authMiddleware import (line 5) |
| `src/app.js` or session config | Modified | Add sameSite/secure flags to session cookie |
| `jest.config.js` | Modified | Add coverage thresholds and collection config |
| `src/middlewares/csrf.js` | Modified | Fix 403 error page rendering |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CartService query logic differs from inline controller logic | Low | Extract exact Sequelize queries from controller into service, test thoroughly |
| Coverage threshold blocks CI on existing code | Medium | Start at 50% (well below current service test coverage), adjust up incrementally |
| CSRF 403 page template doesn't exist yet | Low | Create a minimal 403 template or reuse existing error template with status code |

## Rollback Plan

Each unit is independent and reversible:
1. **Services**: Revert controller imports to direct model access, delete service files
2. **Dead imports**: Restore the two import lines (trivial)
3. **Coverage config**: Remove the 3 config keys from `jest.config.js`
4. **CSRF fix**: Revert to rendering `404NotFound.ejs`

Full rollback: `git revert` the relevant commit(s). No database migrations or external dependencies involved.

## Dependencies

- Existing ProductService and UserService as reference implementations
- Existing test infrastructure (Jest + mocks) for new service tests
- EJS view engine for 403 error template

## Success Criteria

- [ ] Zero direct model imports remain in controller files (except via services)
- [ ] 3 new service files follow ProductService/UserService conventions
- [ ] Unused `authMiddleware` imports removed from both route files
- [ ] Session cookie has `sameSite: 'lax'` and conditional `secure` flag
- [ ] `npm test` enforces ≥50% coverage across branches, functions, lines, statements
- [ ] CSRF 403 errors render a 403 page (not 404)
- [ ] All existing tests pass; new service tests added for each service