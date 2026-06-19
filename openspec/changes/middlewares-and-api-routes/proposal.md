# Proposal: Middlewares and API Routes Migration

## Intent
Migrate legacy JavaScript middlewares and API routes/controllers to TypeScript and Hexagonal Architecture to clean up technical debt and decouple HTTP controllers from business logic.

## Scope

### In Scope
- Move Express middlewares from `src/middlewares/` to `src/infrastructure/middlewares/` and convert them to TypeScript.
- Reorganize API routing under `src/infrastructure/routes/api/` (Product API routes and User API routes separated).
- Secure User API endpoints `/api/users` and `/api/users/:id` with `adminGuard` middleware (admin role restriction).
- Make Login rate-limiting dynamic using `process.env.LOGIN_LIMIT_MAX` (default 5 attempts) and `process.env.LOGIN_LIMIT_WINDOW` (default 15 minutes).
- Set JWT token expiration to 2 hours (`2h`).

### Out of Scope
- Adding new write/modify capabilities to Product API routes.
- Refactoring frontend code consuming these endpoints.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `admin-route-guard`: Protect User API routes `/api/users` and `/api/users/:id` by restricting access to admin roles.
- `api-jwt-auth`: Enable configurable login rate-limiting via env vars and set token expiration to `2h`.
- `middleware-pipeline`: Migrate Express middlewares to `src/infrastructure/middlewares/` and convert them to TypeScript.

## Approach
- Relocate and convert all JS middlewares to TypeScript in `src/infrastructure/middlewares/`.
- Declare types/interfaces for Request objects in `src/types/` (e.g., extending Express Request with session, user, or token info).
- Define modular routing handlers under `src/infrastructure/routes/api/` utilizing migrated controllers.
- Apply `adminGuard` on protected user paths. Use configured env vars for rate-limiting.
- Update `src/app.js` (or converted entry point) to mount routes and middlewares from new infrastructure paths.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/middlewares/` | Removed | Moved to `src/infrastructure/middlewares/` as TS. |
| `src/infrastructure/middlewares/` | New | Location of migrated TypeScript middlewares. |
| `src/routes/api/` | Removed | Legacy JS routes removed. |
| `src/infrastructure/routes/api/` | New | Structured TS routes for Users and Products. |
| `src/app.js` | Modified | Update references to middlewares and routing endpoints. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Route registration order breaks middleware chain | Low | Maintain identical order of middleware registration in App entry point. |
| Missing properties on Express Request type | Medium | Use declaration merging to extend Express Request globally. |

## Rollback Plan
Discard git changes, checkout legacy files from the starting commit on `feature/pixel-art-foundation`, and run test suites to verify system restores to previous green state.

## Dependencies
- None
- [ ] Core Express middleware registration order is preserved.
- [ ] API User endpoints reject non-admin users with 403 Forbidden.
- [ ] Login rate limits and JWT expiration behavior align with new configurations.
- [ ] All unit and integration tests pass successfully.
