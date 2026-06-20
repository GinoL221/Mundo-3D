# User & Auth Domain Hexagonal Architecture Specification

This specification defines the architectural rules and non-functional requirements for migrating the User and Authentication domain slice to Hexagonal Architecture.

## 1. Structural Layering Rules

- **Domain Layer (`src/domain`)**: MUST define pure business entities (`User`, `RememberToken`), repository ports (`IUserRepository`, `IRememberTokenRepository`), security ports (`IPasswordHasher`, `ITokenHasher`), and custom exceptions. All entity attributes and constructor parameters MUST use camelCase naming (e.g., `idUser`, `firstName`, `lastName`, `email`, `password`, `image`, `idRole`, `category` for `User`; `idRememberToken`, `tokenHash`, `idUser`, `expiryDate`, `createdAt` for `RememberToken`). It MUST NOT import from the application or infrastructure layers, nor depend on Sequelize, Bcrypt, or Express.
- **Application Layer (`src/application`)**: MUST encapsulate use cases (Register, Authenticate, Create/Verify/Delete Remember Token). They MUST depend solely on Domain ports. They MUST throw custom domain exceptions on validation/business failure and return plain DTO objects (`UserDTO`, `RememberTokenDTO`) using camelCase attributes.
- **Infrastructure Layer (`src/infrastructure`)**:
  - **Database Adapters**: MUST implement domain repositories via Sequelize, mapping database records to Domain Entities. Sequelize models MUST use snake_case for database columns (e.g., `id_user`, `first_name`, `last_name`, `email`, `password_user`, `id_role`, `category` for `User`; `id_remember_token`, `token_hash`, `id_user`, `expiry_date`, `created_at` for `RememberToken`) and map them to camelCase properties in application code via Sequelize field option mapping (e.g. `field: 'first_name'` for property `firstName`).
  - **Security Adapters**: MUST implement hashing ports using BcryptJS and SHA-256.
  - **Controllers/Middlewares**: MUST handle HTTP mapping using camelCase keys (e.g., `req.body.email`). They MUST instantiate adapters, inject them into Use Cases, and handle domain exceptions to return appropriate HTTP responses in JSON format, containing JWT access tokens on success. They MUST NOT render views or issue session cookies.

## 2. BDD Scenarios

### Scenario 1: Domain Layer Dependency Isolation
Given a module being written in the domain layer (`src/domain`)
When importing dependencies
Then the import paths MUST NOT point to the application (`src/application`) or infrastructure (`src/infrastructure`) layers
And the code MUST NOT import external frameworks or library adapters such as Sequelize, Express, or BcryptJS

### Scenario 2: Use Case Execution and Return Types
Given an application Use Case in `src/application/use-cases`
When the Use Case successfully completes its execution
Then it MUST return a plain JavaScript/TypeScript DTO object containing camelCase properties (`idUser`, `firstName`, `lastName`, `email`, `image`, `idRole`, `category` for `UserDTO`; `idRememberToken`, `tokenHash`, `idUser`, `expiryDate`, `createdAt` for `RememberTokenDTO`)
And it MUST NOT return Sequelize model instances or any active database transaction/connection references

### Scenario 3: Business Error Propagation
Given an application Use Case running a business action
When a business rule is violated (e.g., duplicate email during registration or invalid credentials during login)
Then the Use Case MUST throw a custom Domain Exception
And it MUST NOT throw generic database, network, or framework errors

### Scenario 4: Controller Dependency Injection and API JSON Authentication
Given an Express Controller handling user registration or login
When an HTTP request is received
Then the controller MUST validate syntactic inputs
And it MUST call the appropriate Use Case by injecting the correct infrastructure adapters (Sequelize repositories, Bcrypt/SHA-256 security services)
And it MUST catch Domain Exceptions to return structured JSON responses with an appropriate HTTP status (e.g., 400 Bad Request, 401 Unauthorized)
And on successful authentication (login or register), the response MUST contain the generated JWT token in the JSON body, and the controller MUST NOT issue session cookies or render HTML views

### Scenario 5: Infrastructure Adapter Verification
Given a repository adapter in the infrastructure layer (`src/infrastructure/repositories`)
When executing database operations via Sequelize
Then it MUST translate query results into pure Domain Entities or return null/boolean as defined by the domain port
And Sequelize models MUST define snake_case database columns mapped to camelCase properties via field mappings (e.g. mapping `first_name` database column to `firstName` property)
And it MUST NOT expose Sequelize-specific classes or methods to the application layer
