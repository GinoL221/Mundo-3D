# Tasks: API Security and Admin Guard

## Review Workload Forecast
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

| Field | Value |
|---|---|
| Estimated changed lines | 350-450 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR #1: Foundation; PR #2: JWT login & API middleware; PR #3: Web adminGuard & EJS |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

### Suggested Work Units
| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| Unit 1 | Package install + Database Schema + Admin seeding | PR #1 | Package dependencies, model additions, seed data. |
| Unit 2 | JWT Login endpoint + apiAuthMiddleware | PR #2 | API auth logic, JWT generation/verification, and API tests. |
| Unit 3 | Web adminGuard + EJS view hiding + test coverage | PR #3 | Route protection, EJS template checks, and integration tests. |

## Phase 1: Foundation / Infrastructure
- [x] 1.1 Add `jsonwebtoken` and `@types/jsonwebtoken` to `package.json` and install.
- [x] 1.2 Modify `src/database/models/User.js` to add `IDRole` (default: 2) and `Category` (default: 'User').
- [x] 1.3 Add `IDRole` and `Category` attributes to `UserAttributes` in `src/database/models/db.d.ts`.
- [x] 1.4 Add admin user (`IDRole: 1`, `Category: 'Admin'`) to `src/database/data/users.json`.

## Phase 2: Core Implementation
- [x] 2.1 Implement `apiAuthMiddleware` in `src/middlewares/auth.js` to verify Bearer JWT tokens.
- [x] 2.2 Implement `adminGuard` in `src/middlewares/auth.js` checking `IDRole === 1`.
- [x] 2.3 Implement POST `/api/users/login` to authenticate credentials and issue JWTs in `src/routes/api/users.js`.
- [x] 2.4 Update login in `src/infrastructure/controllers/UserController.ts` to include `IDRole` and `Category` in session.

## Phase 3: Integration / Wiring
- [x] 3.1 Mount `apiAuthMiddleware` on `/api/users` and `/api/users/:id` in `src/routes/api/users.js`.
- [x] 3.2 Update `src/infrastructure/routes/productRoutes.ts` to replace `isUser` with `adminGuard` (keep `isUser` on `/productCart`).
- [x] 3.3 Protect `/users/delete/:id` using `adminGuard` in `src/infrastructure/routes/userRoutes.ts`.
- [x] 3.4 Conditionally render views in `src/views/partials/header.ejs` and `src/views/users/users.ejs` using `IDRole === 1`.

## Phase 4: Testing
- [x] 4.1 Write unit tests for `apiAuthMiddleware` and `adminGuard` in `src/__tests__/authMiddleware.test.js`.
- [x] 4.2 Add integration tests for API endpoints and web guards in `src/__tests__/apiSecurity.test.js`.
- [x] 4.3 Run `npm test` to verify all test suites pass.

## Phase 5: Cleanup
- [x] 5.1 Remove unused imports and verify correct routing behaviors for non-admin users.

## Post-verify fix (CRITICAL-1 from sdd-verify FAIL)
- [x] PV.1 Add failing tests proving `RegisterUserUseCase` trusted caller-supplied `IDRole`/`Category` (RED).
- [x] PV.2 Hardcode `IDRole: 2, Category: 'User'` in `RegisterUserUseCase.execute()`, ignoring input role fields (GREEN).
- [x] PV.3 Remove `IDRole`/`Category` from `RegisterUserInput` interface (no caller depended on them).
- [x] PV.4 Run full `npm test` to confirm zero regressions.

See `apply-progress.md` → "Post-verify fix: CRITICAL-1" for full TDD evidence.
