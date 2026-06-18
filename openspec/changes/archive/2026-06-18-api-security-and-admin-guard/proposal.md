# Proposal: API Security and Admin Guard

## Intent
Secure user management endpoints and product mutations by implementing role-based access control (RBAC), JWT authentication for API resources, and dynamic UI control visibility.

## Scope
### In Scope
- Add `IDRole` field to user database model (`IDRole = 2` for default users, `1` for admin).
- Introduce JWT authentication with `/api/users/login` using `jsonwebtoken`.
- Add `apiAuthMiddleware` to protect `/api/users*` endpoints.
- Implement `adminGuard` middleware for web/API routes.
- Update EJS views to conditionally hide product actions for non-admins.
- Redirections: unauthenticated to `/login`, authenticated non-admins to custom 403 page.

### Out of Scope
- Web UI for role assignment or management.
- Dynamic role modification through API routes.

## Capabilities
### New Capabilities
- `api-jwt-auth`: Secure API endpoints under `/api/users*` using Bearer JWT tokens.
- `admin-route-guard`: Restrict access to administrative web pages and operations.
### Modified Capabilities
- `user-registration-role`: Default registered users to the standard role.
- `visual-admin-hiding`: Dynamically render product actions based on session role.

## Approach
1. Update User schema to include `IDRole` defaulting to 2.
2. Install `jsonwebtoken` dependency.
3. Implement `/api/users/login` returning signed tokens.
4. Implement JWT validation middleware for `/api/users*`.
5. Implement web admin guard middleware for redirections (to `/login` or 403).
6. Update EJS templates with conditional session checks (`IDRole === 1`).

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| Database/Models | Med | Add `IDRole` to schema and user model |
| Middlewares | High | Create `apiAuthMiddleware` and `adminGuard` |
| Controllers/Routes | High | Add login route, protect user/product routes |
| Views | Low | Hide controls and add custom 403 view |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Token leakage | Low | Use strong signing secret and short expiration |
| Broken access checks | Med | Write automated tests verifying all protected routes |

## Rollback Plan
Revert code changes in routes/controllers/middlewares, remove `jsonwebtoken` package, and remove the `IDRole` column from schema if necessary.

## Dependencies
- `jsonwebtoken` npm package.

## Success Criteria
- [ ] Registered users default to IDRole = 2.
- [ ] `/api/users/login` generates valid JWT.
- [ ] Requests to `/api/users*` without valid token return `401 Unauthorized`.
- [ ] Product mutations fail and redirect to `/login` (guest) or 403 (normal user).
- [ ] EJS templates hide product controls for normal users.
