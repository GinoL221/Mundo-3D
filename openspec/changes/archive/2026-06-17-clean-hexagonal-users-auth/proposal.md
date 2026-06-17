# Proposal: Clean Hexagonal Users & Auth Migration

## Intent
Migrate the legacy user and authentication logic to a strict Hexagonal Architecture. This decouples business logic from Sequelize and external security dependencies (bcryptjs, crypto), ensuring high testability and alignment with clean architecture rules.

## Scope
* **In Scope**:
  * Core domain entities (`User`, `RememberToken`) and port interfaces.
  * Hashing ports (`IPasswordHasher`, `ITokenHasher`) and infrastructure adapters.
  * Use Cases: Register, Authenticate, Create/Verify/Delete Remember Token.
  * Preserving PascalCase properties in `UserDTO`.
  * Multi-session remember tokens and custom domain exceptions.
* **Out of Scope**:
  * Normalizing database fields or DTOs to camelCase.
  * Implementing token rolling expiration.

## Capabilities
* **New**: Hashing ports, custom domain exceptions, and distinct Use Cases for authentication.
* **Modified**: User controllers and `userLogged` middleware adapted to inject dependencies into Use Cases.

## Approach
Implement strict hexagonal layers:
1. **Domain**: Define `User` & `RememberToken` entities, repositories (`IUserRepository`, `IRememberTokenRepository`), and hashers (`IPasswordHasher`, `ITokenHasher`).
2. **Application**: Business actions encapsulated in Use Cases, returning a legacy PascalCase-friendly `UserDTO`.
3. **Infrastructure**: Implement Sequelize adapters and Bcrypt/Sha256 security adapters. Controllers manually instantiate adapters and inject them into Use Cases.

## Affected Areas
* `src/domain/entities/` & `src/domain/ports/` (New)
* `src/application/use-cases/` & `src/application/dtos/` (New)
* `src/infrastructure/repositories/` & `src/infrastructure/security/` (New)
* `src/controllers/users/` (processLogin, postNewUser, logout) (Modified)
* `src/middlewares/userLogged.js` (Modified)

## Risks and Mitigation
| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| Break EJS templates due to attribute casing | Low | Ensure `UserDTO` preserves exact PascalCase attributes. |
| Multi-session tokens clean up | Medium | Ensure logout deletes only the active device's token. |

## Rollback Plan
Keep `src/services/userService.js` intact until verification passes. Roll back controllers and middleware to import `UserService` if issues occur.

## Dependencies
* Sequelize database models and BCryptJS configuration.

## Success Criteria
* 100% test coverage on all new Use Cases without mocking database connection directly.
* EJS templates load and display user details successfully.
* Authentication and remember me functionality work exactly as before.
