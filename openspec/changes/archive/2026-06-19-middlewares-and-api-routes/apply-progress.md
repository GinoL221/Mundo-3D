# Middlewares and API Routes Migration Cumulative Apply Progress

## Intent
Migrate Express middlewares and API routes/controllers to TypeScript.

## Completed Tasks
- [x] Task 1.1: Create `src/types/express.d.ts` with global declaration merging for Express Request and Session.
- [x] Task 1.2: Modify `src/domain/ports/IUserRepository.ts` to add the `findAll(): Promise<User[]>` port signature.
- [x] Task 1.3: Modify `src/infrastructure/repositories/SequelizeUserRepository.ts` to implement the `findAll()` method mapping users.
- [x] Task 1.4: Create `src/application/use-cases/ListUsersUseCase.ts` to fetch all users and map to `UserDTO[]`.
- [x] Task 1.5: Create `src/application/use-cases/GetUserByIdUseCase.ts` to retrieve a single user and map to `UserDTO`.
- [x] Task 1.6: Create `src/application/use-cases/GetLatestProductUseCase.ts` to retrieve the latest product and map to `ProductDTO`.
- [x] Task 2.1: Create `src/infrastructure/middlewares/auth.ts` containing TS auth, guest, apiAuth, and adminGuard.
- [x] Task 2.2: Create `src/infrastructure/middlewares/csrf.ts` with TS session-based CSRF protection.
- [x] Task 2.3: Create `src/infrastructure/middlewares/errorHandler.ts` with global TS error handling logic.
- [x] Task 2.4: Create `src/infrastructure/middlewares/loginLimiter.ts` using dynamic `LOGIN_LIMIT_MAX` & `LOGIN_LIMIT_WINDOW` env vars.
- [x] Task 2.5: Create `src/infrastructure/middlewares/upload.ts` for file uploading using multer.
- [x] Task 2.6: Create `src/infrastructure/middlewares/validators/productValidators.ts` & `userValidators.ts` using express-validator.
- [x] Task 2.7: Create `src/infrastructure/controllers/ProductApiController.ts` implementing product routes endpoints using use-cases.
- [x] Task 2.8: Create `src/infrastructure/controllers/UserApiController.ts` implementing user routes endpoints using use-cases.
- [x] Task 3.1: Create `src/infrastructure/routes/api/products.ts` linking endpoints to `ProductApiController`.
- [x] Task 3.2: Create `src/infrastructure/routes/api/users.ts` linking endpoints to `UserApiController`.
- [x] Task 3.3: Create `src/infrastructure/routes/api/index.ts` to aggregate API routes into a single router.
- [x] Task 3.4: Modify `src/app.js` to import/wire new TS middlewares and routes in the specified top-to-bottom registration order.
- [x] Task 4.1-4.4: Implement unit and integration tests and verify that the test suite passes successfully.
- [x] Task 5.1: Delete legacy JS middlewares from `src/middlewares/` (keeping only the `userLogged.js` bridge wrapper).
- [x] Task 5.2: Delete legacy empty JS routes directory `src/routes/api/`.
- [x] Task 5.3: Verify git status is clean and structured.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | N/A | Unit | N/A (new) | ➖ None | ➖ None | ➖ Skipped: structural type merging | ➖ None needed |
| 1.2 | N/A | Unit | N/A (new) | ➖ None | ➖ None | ➖ Skipped: structural interface | ➖ None needed |
| 1.3 | `src/infrastructure/repositories/__tests__/SequelizeUserRepository.test.ts` | Integration | ✅ Passed | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 1.4 | `src/application/__tests__/ListUsersUseCase.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 1.5 | `src/application/__tests__/GetUserByIdUseCase.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 1.6 | `src/application/__tests__/GetLatestProductUseCase.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |
| 2.1 | `src/infrastructure/middlewares/__tests__/auth.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 6 cases | ➖ None needed |
| 2.2 | `src/infrastructure/middlewares/__tests__/csrf.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases | ➖ None needed |
| 2.3 | `src/infrastructure/middlewares/__tests__/errorHandler.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |
| 2.4 | `src/infrastructure/middlewares/__tests__/loginLimiter.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 2.5 | `src/infrastructure/middlewares/__tests__/upload.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |
| 2.6 | `src/infrastructure/middlewares/__tests__/validators.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 7 cases | ➖ None needed |
| 2.7 | `src/__tests__/backendLayeringPR3.test.js` | Integration | ✅ Passed | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |
| 2.8 | `src/__tests__/apiUsersLogin.test.js` | Integration | ✅ Passed | ✅ Written | ✅ Passed | ✅ 6 cases | ➖ None needed |
| 3.1 | `src/__tests__/backendLayeringPR3.test.js` | Integration | ✅ Passed | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 3.2 | `src/__tests__/apiUsersLogin.test.js` | Integration | ✅ Passed | ✅ Written | ✅ Passed | ✅ 6 cases | ➖ None needed |
| 3.3 | `src/__tests__/apiUsersLogin.test.js` | Integration | ✅ Passed | ✅ Written | ✅ Passed | ✅ 6 cases | ➖ None needed |
| 3.4 | `src/__tests__/apiSecurity.test.js` | Integration | ✅ Passed | ✅ Written | ✅ Passed | ✅ All cases | ➖ None needed |

### Test Summary
- **Total tests written**: 55
- **Total tests passing**: 321
- **Layers used**: Unit, Integration
- **Approval tests**: None
- **Pure functions created**: 0

## Quality Adjustments (2026-06-19)
- **Mock-only/Ghost test in loginLimiter**: Refactored `src/infrastructure/middlewares/__tests__/loginLimiter.test.ts` to mock `express-rate-limit` using `jest.mock`. Verified options (default max/windowMs vs custom environment values) and verified the middleware behaves as an express middleware function calling `next()`.
- **Insufficient validator test coverage**: Added tests to `src/infrastructure/middlewares/__tests__/validators.test.ts` for `validationsUsers` to verify `image` field custom validation errors are thrown when `req.file` is undefined ("Tienes que subir una imagen") or has a disallowed extension ("Las extensiones de archivos permitidas son .jpg, .png").
- **API Test Suite Alignment**: Updated `src/__tests__/apiUsersLogin.test.js` to mock AuthenticateUserUseCase, ListUsersUseCase, and GetUserByIdUseCase rather than legacy Services, asserting on the correct clean architecture ports and ensuring the test suite is 100% green.

