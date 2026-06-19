# Design: Middlewares and API Routes Migration

## Technical Approach

Migrate legacy JavaScript Express middlewares to TypeScript in `src/infrastructure/middlewares/`. Restructure API routes under `src/infrastructure/routes/api/`. API controllers `ProductApiController` and `UserApiController` will be re-implemented in TypeScript and use dependency injection to interact with repositories and use-cases, decoupling business logic from the HTTP layer.

## Architecture Decisions

### Decision: Middleware Relocation & TS Migration
| Option | Tradeoff | Decision |
|---|---|---|
| Keep in legacy location `src/middlewares/` | Backward compatible but preserves technical debt in JavaScript. | Move custom middlewares to `src/infrastructure/middlewares/` and convert them to TypeScript. |

### Decision: Express Request Custom Typing
| Option | Tradeoff | Decision |
|---|---|---|
| Type-casting (`req as any`) | Quick to write but bypasses compiler type safety and IDE autocomplete. | Use `Express.Request` module declaration merging in `src/types/express.d.ts` to support `session.userLogged` and `user`. |

### Decision: API Routing Architecture
| Option | Tradeoff | Decision |
|---|---|---|
| Flat routing file | Simpler structure but violates separation of concerns. | Separate routing into `src/infrastructure/routes/api/users.ts` and `src/infrastructure/routes/api/products.ts`, combined under an API router hub. |

### Decision: Dependency Injection for API Controllers
| Option | Tradeoff | Decision |
|---|---|---|
| Direct Sequelize calls or legacy services | Couples HTTP controllers directly to infrastructure/database. | Inject repositories and use-cases into controllers to decouple from frameworks. |

### Decision: Security Guards on User Endpoints
| Option | Tradeoff | Decision |
|---|---|---|
| Route-level checks inside routes file | Less modular. | Apply `apiAuthMiddleware` followed by `adminGuard` for authentication and permission. |

## Data Flow

```text
HTTP Client ──→ apiAuthMiddleware ──→ adminGuard ──→ UserApiController 
                                                           │
                                                           └──→ ListUsersUseCase
                                                                       │
                                                                       └──→ SequelizeUserRepository ──→ DB
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/domain/ports/IUserRepository.ts` | Modify | Add `findAll(): Promise<User[]>` port signature. |
| `src/infrastructure/repositories/SequelizeUserRepository.ts` | Modify | Implement `findAll` method mapping Sequelize instances to domain `User` entity. |
| `src/application/use-cases/ListUsersUseCase.ts` | Create | Fetch all users and map to `UserDTO[]`. |
| `src/application/use-cases/GetUserByIdUseCase.ts` | Create | Retrieve single user and map to `UserDTO`. |
| `src/application/use-cases/GetLatestProductUseCase.ts` | Create | Retrieve the latest product and map to `ProductDTO`. |
| `src/infrastructure/controllers/ProductApiController.ts` | Create | Product API controller using injected hexagonal use cases. |
| `src/infrastructure/controllers/UserApiController.ts` | Create | User API controller using injected hexagonal use cases. |
| `src/infrastructure/routes/api/products.ts` | Create | Product API routing mount points. |
| `src/infrastructure/routes/api/users.ts` | Create | User API routing mount points. |
| `src/infrastructure/routes/api/index.ts` | Create | API router index merging products and users routes. |
| `src/infrastructure/middlewares/auth.ts` | Create | Migrated TS auth guards (`isUser`, `guestMiddleware`, `authMiddleware`, `apiAuthMiddleware`, `adminGuard`). |
| `src/infrastructure/middlewares/csrf.ts` | Create | Migrated TS CSRF session-based protection middleware. |
| `src/infrastructure/middlewares/errorHandler.ts` | Create | Migrated TS global error handling middleware. |
| `src/infrastructure/middlewares/loginLimiter.ts` | Create | Migrated TS rate limiter using dynamic env vars. |
| `src/infrastructure/middlewares/upload.ts` | Create | Migrated TS multer file upload factory. |
| `src/infrastructure/middlewares/validators/productValidators.ts` | Create | Migrated TS product express-validator schemas. |
| `src/infrastructure/middlewares/validators/userValidators.ts` | Create | Migrated TS user express-validator schemas. |
| `src/types/express.d.ts` | Create | Global declaration merging for `Express.Request` and `Session`. |
| `src/app.js` | Modify | Update middleware and routes require statements and adjust order. |

## Interfaces / Contracts

```typescript
// src/types/express.d.ts
import { UserDTO } from '../application/dtos/UserDTO';
declare global {
  namespace Express {
    interface Request {
      user?: {
        userID: number;
        Email: string;
        Category: string | null;
        IDRole: number;
      };
      session?: {
        userLogged?: UserDTO;
        [key: string]: any;
      };
    }
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Use Cases & Middleware | Mock `IUserRepository`/`IProductRepository` to test `ListUsersUseCase`, `GetUserByIdUseCase`, `GetLatestProductUseCase` and middlewares. |
| Integration | API routes & Controller DI | Exercise API routes (/api/users/login, /api/users, /api/products) via supertest. |

## Migration / Rollout

Apply environment variables configuration:
- `LOGIN_LIMIT_MAX` (default: 5)
- `LOGIN_LIMIT_WINDOW` (default: 900000)
- `JWT_SECRET` (used for signing tokens)

## Open Questions

None
