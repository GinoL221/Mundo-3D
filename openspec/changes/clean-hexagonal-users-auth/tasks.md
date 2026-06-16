# Tasks: Clean Hexagonal Users & Auth Migration

## Review Workload Forecast
* **Estimated lines changed**: ~2200 lines (additions + deletions)
* **Decision needed before apply**: No
* **Chained PRs recommended**: Yes
* **Chain strategy**: stacked-to-main
* **400-line budget risk**: High
* **Recommended PR Split**:
  * **PR 1**: Domain layer entities, custom exceptions, and port interfaces.
  * **PR 2**: Application DTOs, use cases, and their unit tests.
  * **PR 3**: Infrastructure security adapters, repository adapters, and integration tests.
  * **PR 4**: Controllers, middleware, routes integration, and E2E tests.

---

## Phase 1: Domain & Ports (PR 1)
- [ ] Define exceptions `UserAlreadyExistsException.ts` and `InvalidCredentialsException.ts` in `src/domain/`.
- [ ] Create domain entities `User.ts` and `RememberToken.ts` under `src/domain/entities/`.
- [ ] Define interfaces `IUserRepository.ts` and `IRememberTokenRepository.ts` under `src/domain/ports/`.
- [ ] Define interfaces `IPasswordHasher.ts` and `ITokenHasher.ts` under `src/domain/ports/`.

## Phase 2: DTOs & Application Setup (PR 2)
- [ ] Create `UserDTO.ts` and `RememberTokenDTO.ts` in `src/application/dtos/` preserving legacy PascalCase properties.

## Phase 3: Application Use Cases & Unit Tests (PR 2)
- [ ] Implement `RegisterUserUseCase.ts` and unit tests in `src/application/__tests__/RegisterUserUseCase.test.ts`.
- [ ] Implement `AuthenticateUserUseCase.ts` and unit tests in `src/application/__tests__/AuthenticateUserUseCase.test.ts`.
- [ ] Implement `CreateRememberTokenUseCase.ts`, `VerifyRememberTokenUseCase.ts`, `DeleteRememberTokenUseCase.ts`.
- [ ] Implement unit tests for all remember token use cases in `src/application/__tests__/RememberTokenUseCases.test.ts`.

## Phase 4: Infrastructure Adapters & Tests (PR 3 & PR 4)
- [ ] Implement `BcryptPasswordHasher.ts` and `Sha256TokenHasher.ts` in `src/infrastructure/security/`.
- [ ] Write integration tests for security adapters in `src/infrastructure/security/__tests__/SecurityAdapters.test.ts`.
- [ ] Implement repository `SequelizeUserRepository.ts` in `src/infrastructure/repositories/`.
- [ ] Implement repository `SequelizeRememberTokenRepository.ts` in `src/infrastructure/repositories/`.
- [ ] Write integration tests using SQLite in-memory for both repositories in `src/infrastructure/repositories/__tests__/`.
- [ ] Migrate `processLogin.js` to `processLogin.ts` under `src/controllers/users/`, injecting dependencies.
- [ ] Migrate `postNewUser.js` to `postNewUser.ts` and `logout.js` to `logout.ts` under `src/controllers/users/`.
- [ ] Migrate middleware `userLogged.js` to `userLogged.ts` under `src/middlewares/`.
- [ ] Integrate updated controllers and middleware into `src/routes/userRoutes.js` (or convert to `.ts`).
- [ ] Write E2E integration tests for Express routes and session/cookie flows in `src/infrastructure/controllers/__tests__/UserAuth.test.ts`.

## Phase 5: Verification & Clean-up (PR 4)
- [ ] Run test suite (`npm test`) and resolve linting errors.
- [ ] Verify rollback capability by preserving `src/services/userService.js` intact.
