## Exploration: User and Authentication Hexagonal Migration

### Current State
Currently, the User and Authentication domain is implemented in JavaScript:
- Core database models are defined using Sequelize in `src/database/models/User.js` and `src/database/models/RememberToken.js`.
- The database associations and loading are configured globally in `src/database/models/index.js`.
- Business logic is mixed inside `src/services/userService.js`, which handles queries, bcrypt password hashing, and SHA-256 token hashing, directly coupled to Sequelize models.
- Controllers (`processLogin.js`, `postNewUser.js`, `logout.js`) and middlewares (`userLogged.js`) import `UserService` directly, breaching Hexagonal Architecture flow (Entry Point -> Use Case -> Repo).
- Password validation uses synchronous BCrypt operations, and remember-me tokens use Node's `crypto` module.

### Affected Areas
- `src/domain/entities/User.ts` — New file defining the core domain user entity.
- `src/domain/entities/RememberToken.ts` — New file defining the remember token entity.
- `src/domain/ports/IUserRepository.ts` — New port interface defining User repository actions.
- `src/domain/ports/IRememberTokenRepository.ts` — New port interface defining RememberToken repository actions.
- `src/domain/ports/IPasswordHasher.ts` — New port decoupling password security from external libraries.
- `src/domain/ports/ITokenHasher.ts` — New port decoupling token hashing.
- `src/application/dtos/UserDTO.ts` — New DTO mapping user data safely across boundaries.
- `src/application/use-cases/RegisterUserUseCase.ts` — Use case coordinating user creation.
- `src/application/use-cases/AuthenticateUserUseCase.ts` — Use case coordinating credential validation.
- `src/application/use-cases/VerifyRememberTokenUseCase.ts` — Use case coordinating token validations and auto-logins.
- `src/application/use-cases/CreateRememberTokenUseCase.ts` — Use case coordinating remember token generation.
- `src/application/use-cases/DeleteRememberTokenUseCase.ts` — Use case coordinating token deletion.
- `src/infrastructure/repositories/SequelizeUserRepository.ts` — Adapter implementation of `IUserRepository`.
- `src/infrastructure/repositories/SequelizeRememberTokenRepository.ts` — Adapter implementation of `IRememberTokenRepository`.
- `src/infrastructure/security/BcryptPasswordHasher.ts` — Adapter implementation of `IPasswordHasher`.
- `src/infrastructure/security/Sha256TokenHasher.ts` — Adapter implementation of `ITokenHasher`.
- `src/controllers/users/` (or `src/infrastructure/controllers/UserController.ts`) — Controllers updated to instantiate adapters and inject them into use cases.
- `src/middlewares/userLogged.js` (or converted to TS) — Middleware adapted to use use cases.

### Approaches
1. **Strict Hexagonal Layers with Security Ports** — Extract clean domain entities, define repository ports (`IUserRepository`, `IRememberTokenRepository`), and hash interfaces (`IPasswordHasher`, `ITokenHasher`). Keep Sequelize, bcrypt, and crypto in `infrastructure`. Use cases interact only through ports.
   - Pros: 100% testable without database/system coupling, strictly respects Billetera rules, zero external library leakage in domain/application.
   - Cons: Higher initial class and file overhead.
   - Effort: Medium
2. **Simplified Hexagonal Layers (Concrete Security Utilities)** — Extract domain entities and repository ports, but import external hashing/security libraries directly inside the use cases.
   - Pros: Fewer files to manage.
   - Cons: Couples use cases to specific encryption dependencies, violating clean architecture boundaries.
   - Effort: Low

### Recommendation
Approach 1 is recommended. It conforms perfectly to the `gentleman-rules` from Billetera by ensuring strict layer flow (Entry Point -> Use Case -> Repo), decoupling external hashing libraries from application logic, and preventing the use of `any` via typed interfaces and custom row mappings.

### Risks
- Session properties mapping: EJS templates access properties like `user.FirstName` directly. The `UserDTO` must retain case-sensitive attributes to avoid breaking front-end views.
- Transitioning controllers to TS: Refactoring controllers requires updating entry points to instantiate the repositories and inject them into use cases manually.

### Ready for Proposal
Yes
