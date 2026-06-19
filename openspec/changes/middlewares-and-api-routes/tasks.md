# Tasks: Middlewares and API Routes Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 600-800 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Request Typings & Repo Ports -> PR 2: Middleware Migration -> PR 3: API Controllers & Routes -> PR 4: Entrypoint Wiring & Cleanup |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Express typings and user repository port updates | PR 1 | Base branch: feature/pixel-art-foundation |
| 2 | Migrate legacy middlewares to TypeScript in infrastructure | PR 2 | Depends on PR 1 |
| 3 | API controllers and route modules implementation | PR 3 | Depends on PR 2 |
| 4 | Mount routes in app.js and delete legacy JS files | PR 4 | Depends on PR 3 |

## Phase 1: Infrastructure / Foundation

- [x] 1.1 Create `src/types/express.d.ts` with global declaration merging for Express Request and Session.
- [x] 1.2 Modify `src/domain/ports/IUserRepository.ts` to add the `findAll(): Promise<User[]>` port signature.
- [x] 1.3 Modify `src/infrastructure/repositories/SequelizeUserRepository.ts` to implement the `findAll()` method mapping users.
- [x] 1.4 Create `src/application/use-cases/ListUsersUseCase.ts` to fetch all users and map to `UserDTO[]`.
- [x] 1.5 Create `src/application/use-cases/GetUserByIdUseCase.ts` to retrieve a single user and map to `UserDTO`.
- [x] 1.6 Create `src/application/use-cases/GetLatestProductUseCase.ts` to retrieve the latest product and map to `ProductDTO`.

## Phase 2: Core Implementation

- [ ] 2.1 Create `src/infrastructure/middlewares/auth.ts` containing TS auth, guest, apiAuth, and adminGuard.
- [ ] 2.2 Create `src/infrastructure/middlewares/csrf.ts` with TS session-based CSRF protection.
- [ ] 2.3 Create `src/infrastructure/middlewares/errorHandler.ts` with global TS error handling logic.
- [ ] 2.4 Create `src/infrastructure/middlewares/loginLimiter.ts` using dynamic `LOGIN_LIMIT_MAX` & `LOGIN_LIMIT_WINDOW` env vars.
- [ ] 2.5 Create `src/infrastructure/middlewares/upload.ts` for file uploading using multer.
- [ ] 2.6 Create `src/infrastructure/middlewares/validators/productValidators.ts` & `userValidators.ts` using express-validator.
- [ ] 2.7 Create `src/infrastructure/controllers/ProductApiController.ts` implementing product routes endpoints using use-cases.
- [ ] 2.8 Create `src/infrastructure/controllers/UserApiController.ts` implementing user routes endpoints using use-cases.

## Phase 3: Integration / Wiring

- [ ] 3.1 Create `src/infrastructure/routes/api/products.ts` linking endpoints to `ProductApiController`.
- [ ] 3.2 Create `src/infrastructure/routes/api/users.ts` linking endpoints to `UserApiController` with `adminGuard` where needed.
- [ ] 3.3 Create `src/infrastructure/routes/api/index.ts` to aggregate API routes into a single router.
- [ ] 3.4 Modify `src/app.js` to import/wire new TS middlewares and routes in the specified top-to-bottom registration order.

## Phase 4: Testing / Verification

- [ ] 4.1 Write integration tests in `__tests__/apiSecurity.test.js` verifying `adminGuard` protects user endpoints.
- [ ] 4.2 Write integration tests in `__tests__/apiUsersLogin.test.js` verifying rate limiting and 2h JWT expiration.
- [ ] 4.3 Write unit tests for new middlewares in `src/infrastructure/middlewares/__tests__/` verifying correct redirects and error handling.
- [ ] 4.4 Run all integration and unit tests (`npm test`) ensuring all pass.

## Phase 5: Cleanup

- [ ] 5.1 Delete legacy JS middlewares from `src/middlewares/` (excluding `cartCount.ts` and others already in infrastructure).
- [ ] 5.2 Delete legacy JS routes from `src/routes/api/`.
- [ ] 5.3 Run git status and verify clean tree before final PR slice reviews.
