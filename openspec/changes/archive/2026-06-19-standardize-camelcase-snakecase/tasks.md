# Tasks: Standardize Naming Conventions to camelCase and snake_case

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300-350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Not needed |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Standardize User and RememberToken properties | PR 1 | Single slice, all layers and tests |

## Phase 1: Database and Types

- [x] 1.1 Update `src/database/models/User.js` using explicit `field` options mapping snake_case db columns to camelCase properties.
- [x] 1.2 Update `src/database/models/RememberToken.js` using explicit `field` options mapping snake_case db columns to camelCase properties.
- [x] 1.3 Update types (`UserAttributes`, `RememberTokenAttributes`) in `src/database/models/db.d.ts` to camelCase properties.
- [x] 1.4 Update association foreign key definitions in `src/database/models/index.js` to match camelCase models/properties.
- [x] 1.5 Verify database schema creation and alter logic in dev/test environment.

## Phase 2: Core Domain, Application, and Infrastructure

- [x] 2.1 Refactor properties in `src/domain/entities/User.ts` and `src/domain/entities/RememberToken.ts` to camelCase.
- [x] 2.2 Refactor structures in `src/application/dtos/UserDTO.ts` and `src/application/dtos/RememberTokenDTO.ts` to camelCase.
- [x] 2.3 Update mapper logic in `src/infrastructure/repositories/SequelizeUserRepository.ts` and `src/infrastructure/repositories/SequelizeRememberTokenRepository.ts` to camelCase attributes.
- [x] 2.4 Refactor use cases `RegisterUserUseCase.ts`, `AuthenticateUserUseCase.ts`, `CreateRememberTokenUseCase.ts`, and `VerifyRememberTokenUseCase.ts` payloads to camelCase.
- [x] 2.5 Refactor `UserController.ts` and `UserApiController.ts` to align login, register, and API response fields with camelCase.
- [x] 2.6 Refactor `src/infrastructure/middlewares/userLogged.ts` session checks to use camelCase attributes.

## Phase 3: Tests Updates

- [x] 3.1 Update unit tests asserting camelCase serialization on domain entities.
- [x] 3.2 Update repository integration tests validating Sequelize to domain mapping.
- [x] 3.3 Update controller and API integration tests checking camelCase request-response fields.
