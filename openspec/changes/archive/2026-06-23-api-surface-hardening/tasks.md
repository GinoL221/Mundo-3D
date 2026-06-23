# Tasks: API Surface Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~580 strict (additions+deletions); ~260 substantive |
| 400-line budget risk | High (strict count); Low (substantive review surface) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (stacked) |
| Delivery strategy | ask-on-risk / ask-always |
| Chain strategy | pending (user must choose) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base branch | Notes |
|------|------|-----------|-------------|-------|
| 1 | Domain + security foundation (Role, JwtSecret, auth refactor) | PR 1 | main | New: Role.ts, JwtSecret.ts; modify: auth.ts, UserApiController.ts, auth.test.ts, apiUsersLogin.test.js, apiSecurity.test.js |
| 2 | Validation + rate limit + route wiring; drop duplicate POST /users | PR 2 | main (stacked on PR 1) | New: cartValidators.ts, registerLimiter.ts; modify: routes/api/users.ts, routes/api/cart.ts |
| 3 | Pino migration + delete orphaned middlewares | PR 3 | main (stacked on PR 2) | Modify: errorHandler.ts, errorHandler.test.ts, deadCodeRemoval.test.js; delete 5 files |

## Phase 1: Foundation (Role + JwtSecret)

- [x] 1.1 RED — Test `src/domain/Role.ts` exports `Role.ADMIN === 1` and `Role.USER === 2`.
- [x] 1.2 GREEN — Create `src/domain/Role.ts` with `enum Role { ADMIN = 1, USER = 2 }`.
- [x] 1.3 RED — Test `src/infrastructure/security/JwtSecret.ts` (throws missing, returns env, test-env fallback).
- [x] 1.4 GREEN — Create `JwtSecret.ts` with `getJwtSecret()` (throws if `JWT_SECRET` empty/unset; `NODE_ENV === 'test'` returns deterministic test secret).

## Phase 2: Auth refactor (uses Role + JwtSecret)

- [x] 2.1 RED — Update `src/infrastructure/middlewares/__tests__/auth.test.ts` to assert `JwtSecret` import and `Role.ADMIN` usage.
- [x] 2.2 GREEN — Update `src/infrastructure/middlewares/auth.ts`: import `JwtSecret` and `Role`; replace `idRole !== 1` with `idRole !== Role.ADMIN` (adminGuard).
- [x] 2.3 GREEN — Update `src/infrastructure/controllers/UserApiController.ts`: replace 2× inline `process.env.JWT_SECRET || 'test_jwt_secret'` with `getJwtSecret()`.
- [x] 2.4 GREEN — Update `src/__tests__/apiUsersLogin.test.js` + `apiSecurity.test.js`: import `getJwtSecret()`; drop `'test_jwt_secret'` fallback (success criterion: grep returns no hits).

## Phase 3: Validation & Rate Limiting (route layer)

- [x] 3.1 RED — Test `src/infrastructure/middlewares/__tests__/validators/cartValidators.test.ts` (valid pass; qty=0 / missing productId / qty>99 → CartValidationException).
- [x] 3.2 GREEN — Create `src/infrastructure/middlewares/validators/cartValidators.ts`: chain validates `items` array non-empty, `items[].productId` (int, required), `items[].quantity` (int 1–99); throws `CartValidationException` → 400.
- [x] 3.3 RED — Test `src/infrastructure/middlewares/__tests__/registerLimiter.test.ts` (env-configurable via `REGISTER_LIMIT_*`; test-env passthrough).
- [x] 3.4 GREEN — Create `registerLimiter.ts` mirroring `loginLimiter.ts`; bypass when `NODE_ENV === 'test'`.
- [x] 3.5 GREEN — Update `src/infrastructure/routes/api/users.ts`: mount `registerLimiter` on POST /users/register; DELETE duplicate POST /users route block.
- [x] 3.6 GREEN — Update `src/infrastructure/routes/api/cart.ts`: add `cartSyncValidation` middleware to PUT /cart.

## Phase 4: errorHandler → Pino (structured logging)

- [x] 4.1 RED — Update `__tests__/errorHandler.test.ts`: assert Pino `logger.error` is called; `console.error` is NOT called.
- [x] 4.2 GREEN — Update `src/infrastructure/middlewares/errorHandler.ts`: replace 2× `console.error` with `logger.error` from `infrastructure/logging/logger`.

## Phase 5: Delete orphaned middlewares

- [x] 5.1 — Delete `src/infrastructure/middlewares/csrf.ts` and `__tests__/csrf.test.ts`.
- [x] 5.2 — Delete `src/infrastructure/middlewares/userLogged.ts`.
- [x] 5.3 — Delete `src/infrastructure/middlewares/cartCount.ts` and `__tests__/cartCount.test.ts`.
- [x] 5.4 — Update `src/__tests__/deadCodeRemoval.test.js`: assert the three orphaned middleware files are gone.

## Phase 6: E2E & Verification

- [x] 6.1 E2E — supertest: PUT /api/cart with `quantity: 0` returns 400 (cart-service spec).
- [x] 6.2 E2E — supertest: POST /api/users returns 404 (duplicate removed; migration note covered).
- [x] 6.3 E2E — supertest: errorHandler routes through Pino `logger.error` on uncaught exception (structured-logging spec).
- [x] 6.4 Verify — `npm test` passes; coverage >= 50% (per `openspec/config.yaml`).
- [x] 6.5 Verify — `grep -r "test_jwt_secret" src` and `grep -r "idRole !== 1" src` return no hits (success criteria).
- [x] 6.6 Smoke — `npm start` boots; no orphaned middleware imports; `POST /users/register` returns 429 when window exceeded (registerLimiter scenario).

## Implementation Order

Foundation (P1) first because every later phase imports `Role` or `JwtSecret`. Auth refactor (P2) next: removing the `test_jwt_secret` fallback in source is a prerequisite for the global grep to be clean. Validation + rate limit (P3) is independent route-layer wiring. Pino migration (P4) is a one-handler change. Deletions (P5) are last, only after a fresh grep confirms zero callers. E2E (P6) gates the slice against every spec scenario.
