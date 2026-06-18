# Design: API Security and Admin Guard

This document details the design and implementation strategy for securing Mundo-3D's administrative actions and APIs using Role-Based Access Control (RBAC), JWT Authentication, and UI control visibility.

## Technical Approach
We will introduce `IDRole` and `Category` attributes to the User database model. Registered users default to a standard role (`IDRole = 2`, `Category = 'User'`), while administrative access requires `IDRole = 1`. 

JWT tokens will be signed and verified using `jsonwebtoken`. An API login endpoint `/api/users/login` will authenticate API clients and yield tokens. The `apiAuthMiddleware` handles token extraction and signature verification. A dual-purpose `adminGuard` protects administrative endpoints.

## Architecture Decisions
The architecture decisions for the role-based access control and security endpoints are structured as follows:

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| **Role Modeling** | Add `IDRole` (integer) and `Category` (string) fields to existing User table. | Build a separate `Role` table and establish associations. | Simplifies the schema while fulfilling requirements. A full Role table is overkill since roles are static (1 for Admin, 2 for User). |
| **Admin Seeding** | Update `users.json` seed data to include an admin user and allow Sequelize sync to handle the structure. | Write raw SQL scripts or separate Sequelize migrations. | `index.js` already runs `sequelize.sync()` followed by `seed.js` parsing `users.json`. Updating `users.json` fits existing startup seeding flows naturally. |
| **Token Verification** | Express middleware `apiAuthMiddleware` validating headers and verifying JWTs using `jsonwebtoken`. | Storing JWTs in cookies or using passport-jwt. | The API needs to serve non-browser clients using standard `Authorization: Bearer <token>` headers. Middleware is lightweight and easily testable. |
| **Admin Route Guarding** | Single `adminGuard` middleware handling both web sessions and API tokens. | Separate `webAdminGuard` and `apiAdminGuard` files. | Reduces duplicate auth checking logic. The route guard can check path prefix (`/api`) to decide whether to return JSON or redirect/render EJS. |

## Data Flow
The authentication and authorization workflows are represented below:

### API JWT Authentication Flow
```text
Client                        API Router (users.js)            UserService
  |                                   |                             |
  |--- POST /api/users/login -------->|                             |
  |    {Email, Password}              |--- findByEmail() ---------->|
  |                                   |<-- User (hashed password) --|
  |                                   |                             |
  |                                   |--- verifyPassword() ------->|
  |                                   |<-- Valid (true) ------------|
  |                                   |                             |
  |                                   |--- Sign JWT token ----------|
  |<-- 200 OK {token} ----------------|                             |
```

### Route Authorization Flow (adminGuard)
```text
Request                        adminGuard                         Controller
  |                                |                                  |
  |--- Access admin route -------->|                                  |
  |                                |--- Is Admin? (IDRole === 1)      |
  |                                |    |                             |
  |                                |    +-- YES: next() ------------->|
  |                                |    |                             |
  |                                |    +-- NO:                       |
  |                                |        |                         |
  |                                |        |-- Path /api?            |
  |<-- 403 Forbidden (JSON) -------|        |   +-- YES               |
  |                                |        |                         |
  |<-- Redirect or 403 (EJS) ------|        |   +-- NO                |
```

## File Changes
The affected codebase files and the corresponding modifications are listed below:

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | Add `jsonwebtoken` package as a project dependency. |
| `src/database/models/User.js` | Modify | Add `IDRole` (default: 2) and `Category` (default: 'User') to User model. |
| `src/database/models/db.d.ts` | Modify | Update `UserAttributes` definition to include optional `IDRole` and `Category`. |
| `src/database/data/users.json` | Modify | Add an administrator user record (`IDRole: 1`, `Category: 'Admin'`). |
| `src/middlewares/auth.js` | Modify | Define and export `apiAuthMiddleware` and `adminGuard`. |
| `src/routes/api/users.js` | Modify | Mount `apiAuthMiddleware` on `/api/users*` and implement POST `/api/users/login`. |
| `src/infrastructure/routes/productRoutes.ts` | Modify | Replace `isUser` with `adminGuard` on admin routes. |
| `src/infrastructure/routes/userRoutes.ts` | Modify | Use `adminGuard` to protect `/users/delete/:id`. |
| `src/infrastructure/controllers/UserController.ts` | Modify | Save `IDRole` and `Category` inside `req.session.userLogged` on login. |
| `src/views/partials/header.ejs` | Modify | Update "Nuevo producto" link condition to `locals.userLogged.IDRole === 1`. |
| `src/views/users/users.ejs` | Modify | Wrap user deletion `<form>` in `locals.userLogged.IDRole === 1` check. |

## Interfaces / Contracts

### JWT Payload
```typescript
interface JWTPayload {
  userID: number;
  Email: string;
  Category: string;
  IDRole: number;
}
```

### Route Guard Contract
```typescript
// req.user is set after verification
interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}
```

## Testing Strategy
We will implement dedicated tests inside `src/infrastructure/controllers/__tests__` and `src/__tests__` layers:

| Layer | What to Test | Approach |
|---|---|---|
| **Middleware Unit** | `apiAuthMiddleware` & `adminGuard` | Mock `req`, `res`, and `next`. Assert correct HTTP status codes (401, 403), JSON messages, redirects, and EJS rendering. |
| **Controller Unit** | `/api/users/login` endpoint | Mock `UserService` methods. Assert 200 with signed token on success, 401 with error JSON on failure. |
| **Integration** | E2E API Route Protection | Use `supertest` to issue request to GET `/api/users`. Verify 401 without token or with invalid tokens. Verify 200 with valid JWT. |

## Migration / Rollout
1. Run `npm install jsonwebtoken` and save to dependencies.
2. The automatic Sequelize synchronization (`db.sequelize.sync()` in `index.js`) handles altering existing local databases.
3. Adding the admin record to `users.json` ensures that it automatically seeds on application start if database is empty.
4. Ensure `JWT_SECRET` is set in the environment variables (e.g. `.env`).

## Open Questions
- [ ] Do we need a script to update roles of existing users in database production environments?
- [ ] Should the JWT token have a custom expiration length other than 1 hour?
