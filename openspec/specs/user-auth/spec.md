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

### Scenario 3: Business Error Propagation (Sequential Path)
Given an application Use Case running a business action
When a business rule is violated (e.g., duplicate email during registration or invalid credentials during login)
Then the Use Case MUST throw a custom Domain Exception
And it MUST NOT throw generic database, network, or framework errors

### Scenario 3b: Business Error Propagation (Concurrent Duplicate Email)
Given two registration requests submitted concurrently with the same, previously-unused email
When both requests race the check-then-insert path and the database's `UNIQUE KEY` on `email` rejects the losing insert
Then the losing request MUST result in `UserAlreadyExistsException`
And it MUST NOT result in an unmapped `SequelizeUniqueConstraintError` reaching the controller

### Scenario 4: Controller Dependency Injection and API JSON Authentication (Sequential Path)
Given an Express Controller handling user registration or login
When an HTTP request is received
Then the controller MUST validate syntactic inputs
And it MUST call the appropriate Use Case by injecting the correct infrastructure adapters (Sequelize repositories, Bcrypt/SHA-256 security services)
And it MUST catch Domain Exceptions to return structured JSON responses with an appropriate HTTP status (e.g., 400 Bad Request, 401 Unauthorized)
And on successful authentication (login or register), the response MUST contain the generated JWT token in the JSON body, and the controller MUST NOT issue session cookies or render HTML views

### Scenario 4b: Controller Handling of Concurrent Duplicate Email Registration
Given two `POST /api/users/register` requests submitted concurrently with the same email, each with its own uploaded avatar file
When both requests are processed concurrently against the database
Then exactly one request MUST receive HTTP 201 Created
And the other request MUST receive the same HTTP 400 response shape and message as the sequential duplicate-email path
And neither request MUST receive an HTTP 500 response
And the losing request's uploaded avatar file MUST be cleaned up, not orphaned

### Scenario 5: Infrastructure Adapter Verification
Given a repository adapter in the infrastructure layer (`src/infrastructure/repositories`)
When executing database operations via Sequelize
Then it MUST translate query results into pure Domain Entities or return null/boolean as defined by the domain port
And Sequelize models MUST define snake_case database columns mapped to camelCase properties via field mappings (e.g. mapping `first_name` database column to `firstName` property)
And it MUST NOT expose Sequelize-specific classes or methods to the application layer

## 3. Accepted Risks

### Registration confirms whether an email is already registered

`POST /api/users/register` answers a duplicate email with HTTP 400 and the message `Este email ya está registrado`. Scenario 4b above requires that exact response shape for the concurrent path, so this is specified behaviour rather than an oversight — but it is also an account-enumeration channel: anyone can submit an address and learn from the response alone whether it holds an account. No rate limit hides this, because the answer is in the body, not in the timing.

This was identified as MEDIUM-3 of the 2026-09-01 authentication security review, alongside a login timing oracle. **The timing half is closed** (`AuthenticateUserUseCase` now spends a decoy bcrypt comparison when the email is unknown, so a miss costs what a hit costs). The registration half is deliberately left open.

**Why it stays open.** The standard mitigation is to stop answering in the response at all: accept every registration with the same success shape, then send an email that either completes signup or tells the existing account holder that someone tried to register their address. That requires a transactional email path this system does not have. Substituting a vaguer error without that path does not close the channel — it only makes the product worse at telling a returning customer why their signup failed, on a storefront where friction at signup is paid for in sales.

**What an attacker gains.** Confirmation that an address has an account here. Not a password, not a session, not a way in. It is a privacy and phishing-targeting exposure, not an authentication bypass, and it is bounded by `registerLimiter`'s per-IP rate limit.

**What closing it would require**, whenever it is taken up:
1. A transactional email sender, which is the actual blocker and is useful well beyond this.
2. Registration returning an identical response for a fresh and an already-registered address, which means Scenario 4b's "same HTTP 400 response shape and message" requirement must be rewritten, not merely worked around.
3. Signup completing out-of-band via that email, so a real new user is not left stuck at a success screen with no account.
4. A matching decoy delay on the duplicate path, or the timing oracle simply moves here from the login route.

Reviewed and accepted by the maintainer on 2026-09-04. Revisit when transactional email lands for any other reason.
