# Tasks: Auth Hardening and Cleanup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450-550 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Auth Hardening) → PR 2 (Cleanups) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Auth hardening (Obs A & D) | PR 1 | Base branch; databases, middlewares, logic, tests |
| 2 | Cleanups & CORS (Obs B, C & E) | PR 2 | Stacked on PR 1; CORS, services, view paths, tests |

## PR 1: Auth Hardening (Obs A & D)

### Phase 1: Foundation & DB Schema
- [x] 1.1 Create `src/database/models/RememberToken.js` with columns (`id`, `IDUser`, `TokenHash`, `ExpiresAt`)
- [x] 1.2 Import and associate `RememberToken` in `src/database/models/index.js` as `User.hasMany(RememberToken)`
- [x] 1.3 Update `.env.example` and documentation to declare `COOKIE_SECRET` and `SESSION_SECRET` variables

### Phase 2: Core Implementation
- [x] 2.1 Implement `createRememberToken`, `verifyRememberToken`, `deleteRememberToken` in `src/services/userService.js`
- [x] 2.2 Configure `cookie-parser` with `process.env.COOKIE_SECRET` in `src/app.js` (throw error on startup if unset)
- [x] 2.3 Update `src/middlewares/userLogged.js` to parse/verify signed cookie, SHA-256 hash, and validate with DB
- [x] 2.4 Update `src/controllers/users/processLogin.js` to create/hash token, set signed cookie on remember-me check
- [x] 2.5 Refactor `processLogin.js` credential check to use a single render helper to prevent user existence leak
- [x] 2.6 Update `src/controllers/users/logout.js` to delete remember token in DB and clear `remember_token` cookie

### Phase 3: Verification
- [x] 3.1 Write unit tests for `UserService` token hashing, database creation, validation, and auto-deletion
- [x] 3.2 Write integration tests for `userLogged` middleware validation and auto-login flows
- [x] 3.3 Verify manual/auto-login multi-device tokens are successfully stored, verified, and cleaned up on logout

---

## PR 2: Cleanups (Obs B, C & E)

### Phase 4: Core Implementation & Integration
- [x] 4.1 Restrict CORS origin in `src/app.js` using `process.env.CORS_ORIGIN` (default to `http://localhost:3000`)
- [x] 4.2 Update `ProductService.update` in `src/services/productService.js` to persist `Image`, `IDCategory`, and `IDFranchise`
- [x] 4.3 Correct view path in `src/controllers/products/getAllProducts.js` to use relative path `'products/products'`

### Phase 5: Verification & Cleanup
- [x] 5.1 Write integration tests for CORS restriction and origin whitelist validations
- [x] 5.2 Write unit tests for expanded `ProductService.update` to verify missing fields are correctly persisted
- [x] 5.3 Verify that all application views load without absolute pathing or `path.join`
