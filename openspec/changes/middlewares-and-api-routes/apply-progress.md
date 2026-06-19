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

### Test Summary
- **Total tests written**: 43
- **Total tests passing**: 43
- **Layers used**: Unit (41), Integration (2)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: 0

## Quality Adjustments (2026-06-19)
- **Mock-only/Ghost test in loginLimiter**: Refactored `src/infrastructure/middlewares/__tests__/loginLimiter.test.ts` to mock `express-rate-limit` using `jest.mock`. Verified options (default max/windowMs vs custom environment values) and verified the middleware behaves as an express middleware function calling `next()`.
- **Insufficient validator test coverage**: Added tests to `src/infrastructure/middlewares/__tests__/validators.test.ts` for `validationsUsers` to verify `image` field custom validation errors are thrown when `req.file` is undefined ("Tienes que subir una imagen") or has a disallowed extension ("Las extensiones de archivos permitidas son .jpg, .png").
