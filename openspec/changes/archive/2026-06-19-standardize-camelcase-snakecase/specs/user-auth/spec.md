# Delta Specification: user-auth Naming Convention Standardization

This delta specification modifies [openspec/specs/user-auth/spec.md](file:///home/ginopc/Desarrollo/Mundo-3D/openspec/specs/user-auth/spec.md) to support camelCase code properties and snake_case database columns for User and RememberToken models.

## MODIFIED: Structural Layering Rules

- **Domain Layer (`src/domain`)**: MUST define pure business entities (`User`, `RememberToken`), repository ports (`IUserRepository`, `IRememberTokenRepository`), security ports (`IPasswordHasher`, `ITokenHasher`), and custom exceptions. All entity attributes and constructor parameters MUST use camelCase naming (e.g., `idUser`, `firstName`, `lastName`, `email`, `password`, `image`, `idRole`, `category` for `User`; `idRememberToken`, `tokenHash`, `idUser`, `expiryDate`, `createdAt` for `RememberToken`). It MUST NOT import from the application or infrastructure layers, nor depend on Sequelize, Bcrypt, or Express.
- **Application Layer (`src/application`)**: MUST encapsulate use cases (Register, Authenticate, Create/Verify/Delete Remember Token). They MUST depend solely on Domain ports. They MUST throw custom domain exceptions on validation/business failure and return plain DTO objects (`UserDTO`, `RememberTokenDTO`) using camelCase attributes.
- **Infrastructure Layer (`src/infrastructure`)**:
  - **Database Adapters**: MUST implement domain repositories via Sequelize, mapping database records to Domain Entities. Sequelize models MUST use snake_case for database columns (e.g., `id_user`, `first_name`, `last_name`, `email`, `password_user`, `id_role`, `category` for `User`; `id_remember_token`, `token_hash`, `id_user`, `expiry_date`, `created_at` for `RememberToken`) and map them to camelCase properties in application code via Sequelize field option mapping (e.g. `field: 'first_name'` for property `firstName`).
  - **Security Adapters**: MUST implement hashing ports using BcryptJS and SHA-256.
  - **Controllers/Middlewares**: MUST handle HTTP mapping using camelCase keys (e.g., `req.body.email`). They MUST instantiate adapters, inject them into Use Cases, and handle domain exceptions to return appropriate HTTP responses or render relative views.

## MODIFIED: BDD Scenarios

### Scenario 2: Use Case Execution and Return Types
Given an application Use Case in `src/application/use-cases`
When the Use Case successfully completes its execution
Then it MUST return a plain JavaScript/TypeScript DTO object containing camelCase properties (`idUser`, `firstName`, `lastName`, `email`, `image`, `idRole`, `category` for `UserDTO`; `idRememberToken`, `tokenHash`, `idUser`, `expiryDate`, `createdAt` for `RememberTokenDTO`)
And it MUST NOT return Sequelize model instances or any active database transaction/connection references

### Scenario 5: Infrastructure Adapter Verification
Given a repository adapter in the infrastructure layer (`src/infrastructure/repositories`)
When executing database operations via Sequelize
Then it MUST translate query results into pure Domain Entities or return null/boolean as defined by the domain port
And Sequelize models MUST define snake_case database columns mapped to camelCase properties via field mappings (e.g. mapping `first_name` database column to `firstName` property)
And it MUST NOT expose Sequelize-specific classes or methods to the application layer
