# Design: Clean Hexagonal Users & Auth Migration

This document outlines the technical design for migrating the legacy user authentication and session management to Hexagonal Architecture.

## 1. Directory Structure

```text
src/
├── domain/
│   ├── entities/
│   │   ├── User.ts
│   │   └── RememberToken.ts
│   └── ports/
│       ├── IUserRepository.ts
│       ├── IRememberTokenRepository.ts
│       ├── IPasswordHasher.ts
│       └── ITokenHasher.ts
├── application/
│   ├── dtos/
│   │   ├── UserDTO.ts
│   │   └── RememberTokenDTO.ts
│   └── use-cases/
│       ├── RegisterUserUseCase.ts
│       ├── AuthenticateUserUseCase.ts
│       ├── CreateRememberTokenUseCase.ts
│       ├── VerifyRememberTokenUseCase.ts
│       └── DeleteRememberTokenUseCase.ts
└── infrastructure/
    ├── security/
    │   ├── BcryptPasswordHasher.ts
    │   └── Sha256TokenHasher.ts
    └── repositories/
        ├── SequelizeUserRepository.ts
        └── SequelizeRememberTokenRepository.ts
```

## 2. Domain Entities & Custom Exceptions

### Core Entities
*   **User**: Pure domain object containing standard user attributes (including the hashed password for verification).
*   **RememberToken**: Pure domain object representing a token record with its user association, hashed value, and expiration date.

### Custom Domain Exceptions
*   **UserAlreadyExistsException**: Thrown by registration when the email is already registered.
*   **InvalidCredentialsException**: Thrown when authentication fails due to incorrect email or password.

## 3. Ports (Interfaces)

### Repository Ports
```typescript
export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'IDUser'>): Promise<User>;
}

export interface IRememberTokenRepository {
  create(token: Omit<RememberToken, 'id'>): Promise<RememberToken>;
  findByHash(hash: string): Promise<RememberToken | null>;
  deleteByHash(hash: string): Promise<boolean>;
}
```

### Security Ports
```typescript
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}

export interface ITokenHasher {
  hash(token: string): string;
}
```

## 4. Application Use Cases

Use Cases depend purely on domain interfaces and return PascalCase DTOs:

*   **RegisterUserUseCase**: Receives registration inputs, validates uniqueness via `IUserRepository`, hashes the password with `IPasswordHasher`, creates the user, and returns a `UserDTO`.
*   **AuthenticateUserUseCase**: Validates credentials using `IUserRepository` and `IPasswordHasher`, returning a `UserDTO` or throwing `InvalidCredentialsException`.
*   **CreateRememberTokenUseCase**: Generates a hashed token via `ITokenHasher` and expiration date, saves it via `IRememberTokenRepository`.
*   **VerifyRememberTokenUseCase**: Checks `IRememberTokenRepository` for the token hash. If expired, deletes it and returns null; otherwise, fetches and returns a `UserDTO`.
*   **DeleteRememberTokenUseCase**: Hashes the plain token and deletes the record via `IRememberTokenRepository`.

## 5. Wiring in Express Controllers & Middlewares

Infrastructure adapters will be instantiated and injected manually at the controller level:

```javascript
// Example in processLogin.js:
const userRepository = new SequelizeUserRepository();
const rememberTokenRepository = new SequelizeRememberTokenRepository();
const passwordHasher = new BcryptPasswordHasher();
const tokenHasher = new Sha256TokenHasher();

const authenticateUseCase = new AuthenticateUserUseCase(userRepository, passwordHasher);
const createTokenUseCase = new CreateRememberTokenUseCase(rememberTokenRepository, tokenHasher);

// Within controller execution:
try {
  const userDto = await authenticateUseCase.execute({ email, password });
  req.session.userLogged = userDto;
  if (remember) {
    const plainToken = crypto.randomBytes(32).toString('hex');
    await createTokenUseCase.execute({ userId: userDto.IDUser, plainToken, durationSeconds });
    // Set signed cookie 'remember_token'
  }
  return res.redirect('profile');
} catch (error) {
  if (error instanceof InvalidCredentialsException) {
    return res.render('users/login', { errors: { email: { msg: error.message }, password: { msg: error.message } } });
  }
  next(error);
}
```

## 6. Architecture Decisions & Testing Strategy

### Rationale & Architecture Decisions

| Decision | Alternatives | Rationale |
| :--- | :--- | :--- |
| **Strict Dependency Injection** | Service locator, Container libraries | Simple, compile-time type-checked constructor injection without extra library dependencies. |
| **Separate Hasher Ports** | Standard utility modules | Decouples Domain/Application logic from libraries like `bcryptjs` and `crypto`, allowing easy swapping. |
| **Sequelize Mapping** | Leaking Sequelize models | Completely isolates Sequelize models inside the repository adapters, mapping to pure Entities. |

### Testing Strategy
*   **Use Cases**: 100% unit tested by passing mock repositories and mock hashers. No database connection or Express server setup required.
*   **Repository Adapters**: Integration tested against a SQLite in-memory database to verify that Sequelize schemas map correctly to and from Domain Entities.
*   **Controllers & Middlewares**: End-to-end integration tests using Supertest, mocking the Use Cases or database queries where appropriate, to verify session handling, cookies, and HTTP responses.
