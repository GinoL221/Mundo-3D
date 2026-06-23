# Design: API Surface Hardening

## Technical Approach

Backend-only hardening slice. Seven small, independent changes that close exploitable gaps without touching the auth-token model, DB schema, or frontend. Each change is reversible via `git revert`. Follows the existing hexagonal layout: new domain types in `src/domain/`, new infrastructure adapters in `src/infrastructure/security/`, middleware changes in `src/infrastructure/middlewares/`.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|---|---|---|---|
| JWT secret source | (a) inline `process.env.JWT_SECRET \|\| 'test_jwt_secret'` in each file, (b) centralized `JwtSecret.ts` that hard-throws | (b) single failure point, fails fast, eliminates fallback | **b** |
| Admin role check | (a) keep magic `1`, (b) `Role.ADMIN` enum in `src/domain/Role.ts` | (b) self-documenting, domain-owned, no infra import | **b** |
| Register rate limit | (a) inline in route, (b) separate `registerLimiter.ts` mirroring `loginLimiter.ts` | (b) follows existing convention, independently testable | **b** |
| Cart validation | (a) validate in use case, (b) `express-validator` chain in route + `CartValidationException` | (b) matches existing `userValidators.ts` pattern; exception gives structured 400 | **b** |
| Error handler logging | (a) keep `console.error`, (b) use existing Pino `logger` | (b) structured logs, redaction in prod, already configured | **b** |
| `Request.user` shape | (a) rename to `{id, email, role}`, (b) keep existing `{userId, email, category, idRole}` | (b) zero churn in controllers/tests; spec wording adapted to actual shape | **b** |

## Data Flow

```
Client ──→ helmet/cors/body-parser ──→ /api router
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
        /api/users                  /api/cart                  /api/products
     [registerLimiter]          [apiAuthMiddleware]         [apiAuthMiddleware]
     [validationsUsers]         [cartSyncValidation]
     [apiAuthMiddleware]        [syncCartUseCase]
     [adminGuard]               [getCartByUserIdUseCase]
     [UserApiController]        [CartApiController]
              │                           │
              └───── errorHandler (Pino logger) ─────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/infrastructure/security/JwtSecret.ts` | Create | Centralized JWT secret module; throws if `JWT_SECRET` absent (test-env exempt) |
| `src/domain/Role.ts` | Create | `enum Role { ADMIN = 1, USER = 2 }` |
| `src/infrastructure/middlewares/validators/cartValidators.ts` | Create | `express-validator` chain for cart sync `items`; throws `CartValidationException` |
| `src/infrastructure/middlewares/registerLimiter.ts` | Create | `express-rate-limit` for register; configurable via `REGISTER_LIMIT_*` env; test-env exempt |
| `src/infrastructure/security/__tests__/JwtSecret.test.ts` | Create | Unit tests for JwtSecret |
| `src/infrastructure/middlewares/__tests__/registerLimiter.test.ts` | Create | Unit tests for registerLimiter |
| `src/infrastructure/middlewares/__tests__/validators/cartValidators.test.ts` | Create | Unit tests for cart validation |
| `src/infrastructure/middlewares/auth.ts` | Modify | Import `JwtSecret`; replace `idRole !== 1` with `idRole !== Role.ADMIN` |
| `src/infrastructure/middlewares/errorHandler.ts` | Modify | Replace `console.error` with `logger.error` from `infrastructure/logging/logger` |
| `src/infrastructure/controllers/UserApiController.ts` | Modify | Import `JwtSecret` instead of inline fallback (2 occurrences) |
| `src/infrastructure/routes/api/users.ts` | Modify | Remove duplicate `POST /users`; add `registerLimiter` to `POST /users/register` |
| `src/infrastructure/routes/api/cart.ts` | Modify | Add `cartSyncValidation` middleware to `PUT /cart` |
| `src/infrastructure/middlewares/__tests__/auth.test.ts` | Modify | Mock `JwtSecret` instead of inline env fallback |
| `src/infrastructure/middlewares/csrf.ts` | Delete | Orphaned — no imports in `app.js` or any route |
| `src/infrastructure/middlewares/userLogged.ts` | Delete | Orphaned — no imports in `app.js` or any route |
| `src/infrastructure/middlewares/cartCount.ts` | Delete | Orphaned — no imports in `app.js` or any route |
| `src/infrastructure/middlewares/__tests__/csrf.test.ts` | Delete | Tests for removed file |
| `src/infrastructure/middlewares/__tests__/cartCount.test.ts` | Delete | Tests for removed file |

## Interfaces / Contracts

```typescript
// src/domain/Role.ts
export enum Role {
  ADMIN = 1,
  USER = 2,
}

// src/infrastructure/security/JwtSecret.ts
export function getJwtSecret(): string;
// Throws if JWT_SECRET missing/empty, unless NODE_ENV === 'test'
// In test env, returns a deterministic test-only secret

// src/infrastructure/middlewares/validators/cartValidators.ts
export const cartSyncValidation: RequestHandler[];
// Validates: items (array, non-empty), items[].productId (number, required),
//            items[].quantity (int, min 1, max 99)
// On failure: throws CartValidationException → 400 JSON
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `JwtSecret`, `Role`, `registerLimiter`, `cartSyncValidation` | Jest; mock `process.env`; feed valid/invalid inputs |
| Integration | `auth` middleware with new secret source, `adminGuard` with `Role.ADMIN`, `errorHandler` Pino output | Mount on `supertest(app)`, assert JSON logs |
| E2E | `POST /users/register` 429 after limit; `PUT /cart` 400 on bad payload; `POST /users` 404 (removed route) | `supertest` against `app.js` |

Existing tests for `csrf`, `cartCount` are deleted alongside their files. Existing `auth.test.ts` is updated to mock `JwtSecret` instead of inline env.

## Migration / Rollout

No migration required. No DB schema change. No auth-token model change. The `POST /users` removal is a breaking change for any client using it — mitigated by the spec's migration note ("clients MUST switch to `POST /users/register`"). `JWT_SECRET` hard-fail is already in `app.js`; this change just removes the fallback from the two remaining files.

## Open Questions

- [x] **Resolved**: `userLoggedMiddleware` tension — the middleware-pipeline spec's MODIFIED requirement still lists `userLoggedMiddleware` at position 8, which contradicts the ADDED requirement to delete `userLogged.ts`. **Resolution**: follow the proposal (delete all three orphaned files). The pipeline-order spec's mention of `userLoggedMiddleware` is treated as stale and will be corrected at archive time. Confirmed by grep: `userLogged.ts` is not imported in `app.js` or any route file; `app.js` currently runs an API-only pipeline (no cookie-parser, no express-session, no userLoggedMiddleware wired in).
