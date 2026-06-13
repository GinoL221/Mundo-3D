# Proposal: Auth Hardening and Cleanup

## Intent

Resolve security vulnerabilities in the remember-me cookie flow, insecure CORS settings, absolute path view rendering issues, incomplete product updates, and duplicate error rendering in `processLogin`.

## Scope

### In Scope
- Signed remember-me cookie flow with hashed tokens in database supporting multi-device sessions.
- Graceful cleanup of expired/invalid remember-me tokens.
- Secure CORS origin restricting wildcard `*` via environment variables.
- View rendering cleanup (use relative paths, remove absolute paths).
- Expand `ProductService.update` to persist missing fields: `Image`, `IDCategory`, `IDFranchise`.
- Simplify duplicated login error rendering logic in `processLogin`.

### Out of Scope
- Full DB migration system setup (using `alter: true` or manual CLI commands for DB structure update).
- Re-architecting main session store or authentication flow.

## Capabilities

### New Capabilities
- `remember-token-store`: Manages hashed authentication tokens for multiple device sessions.

### Modified Capabilities
- `session-cookie-security`: Harden remember-me cookie, parse signed cookies, restrict CORS origins.
- `user-auth`: Unify login verification error rendering, use helper method for password matching.

## Approach

1. **Multi-device Session Storage**: Introduce `RememberToken` model associated with `User` (`User hasMany RememberToken`). Store SHA-256 hashes of token in database with expiration.
2. **Remember-Me Middleware**: `userLogged` reads signed `remember_token` cookie, matches with hashed DB record, and sets session. If expired/invalid, cookie is silently cleared.
3. **CORS Hardening**: Configure `cors()` in `app.js` using `process.env.CORS_ORIGIN` whitelist instead of default `*`.
4. **Cleanups**: Standardize views using `res.render('path')`, deduplicate validation error logic in controller, and update product fields in service.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/database/models/User.js` | Modified | Add relationship to `RememberToken`. |
| `src/database/models/RememberToken.js` | New | Create table for hashed remember tokens and user ID. |
| `src/database/models/index.js` | Modified | Initialize `RememberToken` and associate with `User`. |
| `src/services/userService.js` | Modified | Add `createRememberToken`, `verifyRememberToken`, `deleteRememberToken`. |
| `src/middlewares/userLogged.js` | Modified | Validate signed cookie against hashed DB token; log in or clear cookie. |
| `src/controllers/users/processLogin.js` | Modified | Set signed cookie and save token hash on login; unify credential errors. |
| `src/controllers/users/logout.js` | Modified | Delete matched token hash from DB and clear cookie. |
| `src/app.js` | Modified | Set cookie-parser secret; restrict CORS by origin whitelist. |
| `src/controllers/products/getAllProducts.js` | Modified | Use `'products/products'` relative path. |
| `src/services/productService.js` | Modified | Include missing fields in update query. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing DB table / columns | High | Run application with `alter: true` temporarily or manually add `RememberToken` table. |
| Environment variables missing | Medium | Default `CORS_ORIGIN` to local dev host, throw helpful error on startup if `SESSION_SECRET` is unset. |

## Rollback Plan

Revert git changes to source files, drop the `RememberToken` table in DB, and restart application.

## Dependencies

- Environment variables `SESSION_SECRET` and `CORS_ORIGIN` defined in `.env`.

## Success Criteria

- [ ] Users can log in and remain authenticated across restarts via secure remember-me cookies on multiple devices.
- [ ] Log out clears the token in the DB and removes the cookie.
- [ ] CORS is restricted to domains specified in `CORS_ORIGIN`.
- [ ] Product service correctly updates all fields.
- [ ] All views render using relative paths.
