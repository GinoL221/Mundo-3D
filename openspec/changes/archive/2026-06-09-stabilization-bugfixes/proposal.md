# Proposal: Stabilization Bugfixes

## Intent

Fix production-visible bugs and dead code before any refactoring. Small diffs, low risk, immediate value — "stop the bleeding" so future changes start from a known-good baseline.

## Scope

### In Scope
- Reorder middleware in `src/app.js` so `cookie-parser` runs before `userLoggedMiddleware` and `helmet()` runs before `cors()`
- Fix cart image path in `src/views/products/productCart.ejs` (`/img/` → `/img/products/`)
- Activate global `errorHandler` by replacing inline `res.status(500).send/json` in all controllers with `next(err)`
- Remove dead code: 3 unreachable EJS views, 2 unused imports, 1 debug `console.log`

### Out of Scope
- API error response format changes (errorHandler already returns JSON)
- New features or UI changes
- `fix-desktop-layout` change (separate scope)

## Capabilities

### New Capabilities
- `middleware-pipeline`: Correct ordering and registration of Express middleware (cookie-parser, helmet, cors, session, auth)

### Modified Capabilities
- `session-cookie-security`: "Remember me" cookie auth now actually works — requirement changes from "cookie-parser present" to "cookie-parser must execute before auth middleware"
- `csrf-error-pages`: Error responses now flow through the global error handler instead of inline handlers

## Approach

Four focused patches applied in order:

1. **Middleware reordering** — swap lines in `src/app.js`. No logic changes.
2. **Cart image fix** — single-line change in `productCart.ejs`.
3. **Error handler activation** — replace `res.status(500).send/json(...)` with `next(err)` in 10 controller catch blocks. Also fix `deleteUser.js` error message leak (`${error.message}` exposed to client).
4. **Dead code removal** — delete 3 EJS files, remove 2 unused imports, remove 1 `console.log`.

Each patch is independently revertable via single-commit revert.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app.js` | Modified | Middleware registration order |
| `src/views/products/productCart.ejs` | Modified | Image path fix |
| `src/controllers/products/*.js` (6 files) | Modified | Replace inline error with `next(err)` |
| `src/controllers/users/*.js` (4 files) | Modified | Replace inline error with `next(err)` |
| `src/controllers/mainController.js` | Modified | Replace inline error with `next(err)` |
| `src/views/products/product.ejs` | Removed | Dead — MongoDB `_id` reference |
| `src/views/products/productMenu.ejs` | Removed | Dead — hardcoded static content |
| `src/views/users/newUser.ejs` | Removed | Dead — duplicates register.ejs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Middleware reorder changes request timing | Low | Order-only change; each middleware is idempotent |
| Error handler returns JSON to HTML routes | Med | ErrorHandler already returns JSON — document as known behavior, address in separate change |
| Dead EJS file is referenced somewhere undetected | Low | Grep confirmed zero references across src/ and routes/ |
| `guestMiddleware` import removal breaks if re-exported | Low | Only unused in productsRoutes; still exported from auth.js and used in userRoutes |

## Rollback Plan

Each patch is one commit. Revert sequence: (4) dead code → (3) error handler → (2) image path → (1) middleware order. Full rollback = 4 `git revert` commands in reverse order.

## Dependencies

- All existing tests must pass after each patch
- Jest coverage threshold (50% on services) must remain met

## Success Criteria

- [ ] `req.cookies.userEmail` is readable in `userLoggedMiddleware` (remember-me works)
- [ ] Helmet headers appear before CORS headers in responses
- [ ] Cart product images load from `/img/products/` path
- [ ] Unhandled controller errors reach `errorHandler` (not inline 500 responses)
- [ ] Zero references to deleted dead files remain in codebase
- [ ] `npm test` passes with no regressions