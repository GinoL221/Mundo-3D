# Proposal: API Surface Hardening

## Intent

Close low-effort, high-risk backend gaps in one reviewable slice: orphaned session middlewares, a JWT secret with a `test_jwt_secret` fallback, no register rate limit, no cart-sync validation, a duplicate `POST /users` route, an error handler bypassing Pino, and a magic `idRole !== 1` admin check. Prioritized security-first because each item is exploitable today and fixable with a small diff; kept backend-only to stay decoupled from the Astro migration and from the pending auth-token-model product decision.

## Scope

### In Scope
- Delete orphaned session middlewares (`csrf.ts`, `userLogged.ts`, `cartCount.ts`) after grep confirms no caller.
- Centralize JWT secret in one module that hard-throws when `JWT_SECRET` is missing; remove the fallback.
- Add `express-rate-limit` to `POST /users/register` (configurable window, test-env exempt).
- Add an `express-validator` schema for cart sync `items`; bound `quantity`; throw `CartValidationException`.
- Delete the duplicate `POST /users` route (keep `POST /users/register`).
- Route `errorHandler` through Pino, not `console.error`.
- Add a `Request.user` TS augmentation for typed auth middleware.
- Introduce `Role.ADMIN`; replace `idRole !== 1` in `adminGuard`.

### Out of Scope
- JWT → httpOnly `SameSite=Strict` cookie migration (Phase 2; needs product decision on token model).
- Refresh-token rotation and revocation list (Phase 2).
- Replacing `sequelize.sync({ alter: true })` with Sequelize migrations (Phase 2).
- Frontend `import.meta.env.PUBLIC_API_URL` and CSP `<meta>` in Astro layout (later frontend slice).
- Composition root / DI for tests.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `api-jwt-auth`: secret MUST come from one module that hard-fails when absent; `Request.user` typing added.
- `user-registration-role`: register MUST be rate-limited; duplicate `POST /users` removed.
- `cart-service`: cart sync `items` MUST pass `express-validator`; `quantity` MUST be bounded; invalid input MUST throw `CartValidationException`.
- `middleware-pipeline`: orphaned session middlewares MUST be removed.
- `admin-route-guard`: `adminGuard` MUST use `Role.ADMIN`, not a magic id.
- `structured-logging`: `errorHandler` MUST log through Pino, not `console.error`.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/infrastructure/middlewares/{csrf,userLogged,cartCount}.ts` | Removed |
| `src/infrastructure/security/JwtSecret.ts` | New |
| `src/infrastructure/middlewares/{auth,adminGuard,errorHandler}.ts` | Modified |
| `src/infrastructure/controllers/{UserApiController,CartApiController}.ts` | Modified |
| `src/application/use-cases/SyncCartUseCase.ts` | Modified |
| `src/infrastructure/routes/api/users.ts` | Modified |
| `src/domain/Role.ts`, `src/types/express-request-user.ts` | New |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Removing middlewares breaks a hidden caller | Low | Grep `req.session` / `req.signedCookies`; confirm no route outside `routes/api/*` mounts them. |
| Register rate limit blocks test flows | Med | Configurable window via env; exempt test env. |
| Cart validation rejects legacy payloads | Med | Mirror current field shape; test against existing fixtures. |
| Missing `JWT_SECRET` breaks local dev | Med | Document in README; fail fast with a clear message. |

## Rollback Plan

`git revert` the commit. No DB schema or auth-model change is involved, so revert restores the prior pipeline. Re-adding deleted middlewares is unnecessary once orphaned (verified by grep).

## Dependencies

- `express-rate-limit`, `express-validator` (both already in the stack).

## Success Criteria

- [ ] `grep -r "test_jwt_secret"` returns no hits.
- [ ] `POST /users/register` returns 429 when the rate window is exceeded.
- [ ] Cart sync with out-of-range `quantity` returns 400.
- [ ] Duplicate `POST /users` is gone; only `POST /users/register` remains.
- [ ] `errorHandler` logs through Pino (no `console.error`).
- [ ] `adminGuard` references `Role.ADMIN`, not a literal `1`.
- [ ] `npm test` passes with coverage >= 50%.
