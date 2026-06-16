## Exploration: Migrating Mundo-3D to Clean/Hexagonal Architecture

### Current State
Currently, Mundo-3D is structured as a traditional Node.js/Express MVC application in pure JavaScript using Sequelize as the ORM:
- **`src/controllers`**: Handlers parse HTTP requests and call services directly, rendering EJS views or returning JSON.
- **`src/services`**: Functions bundle database operations (calling Sequelize models directly) alongside application logic and password hashing/token operations. This leaks infrastructure concerns into the logic layer.
- **`src/database/models`**: Sequelize models define schemas and are imported directly by the services.

This design tightly couples business logic to Sequelize and the Express request-response lifecycle, violating clean architecture principles.

### Affected Areas
- `src/controllers/` — Needs refactoring to act as entry points (HTTP adapters). They must instantiate repository adapters, inject them into use cases, and call use case execution methods instead of calling services directly.
- `src/services/` — Must be split. The database queries must move to repository adapters in `src/infrastructure`, while business flows must become use cases under `src/application/use-cases`.
- `src/database/models/` — Must be encapsulated inside infrastructure database adapters and isolated from the core logic.
- `src/routes/` — Must be updated to instantiate and inject the repository adapters and use cases into the controllers.

### Approaches
1. **Gradual JavaScript Migration with JSDoc Interfaces**
   - Retain JavaScript files and structure the code into `domain`, `application`, and `infrastructure` layers, using JSDoc to define interfaces/contracts for ports.
   - **Pros**:
     - No compilation step or complex build tool configuration.
     - Lower setup overhead; existing test suite (Jest) can run without changes.
   - **Cons**:
     - Harder to enforce architecture boundaries and port contracts without compile-time check.
     - Does not strictly fulfill the Billetera `gentleman-rules` regarding strict type safety and interface adherence.
   - **Effort**: Medium

2. **TypeScript Migration with Strict Hexagonal Architecture**
   - Introduce TypeScript (`tsconfig.json`), compile steps, and migrate controllers, services, and models to TS, declaring explicit repository and service interface ports under `src/domain`.
   - **Pros**:
     - Strict alignment with Billetera's `gentleman-rules` (strict type-safety, zero `any` policy).
     - Compile-time checking prevents use cases from calling infrastructure adapters directly.
     - Standardized interfaces clearly document dependency flows.
   - **Cons**:
     - High initial setup (Webpack/esbuild/tsc config, `ts-jest` for testing, eslint config).
     - Higher initial refactoring effort to type all model schemas and Express middlewares.
   - **Effort**: High

### Recommendation
We recommend **Approach 2: TypeScript Migration with Strict Hexagonal Architecture**. 
Even though it requires higher effort to set up, migrating to TypeScript enables compile-time verification of hexagonal boundaries (e.g. use cases only calling repository ports/interfaces defined in `src/domain/types.ts`). It ensures strict type safety (no `any` policy) and clean boundary separation as outlined in Billetera's `gentleman-rules`.

We can map the layers as follows:
- **Domain Layer (`src/domain`)**: Core entities (`Product`, `User`, `Category`, `Franchise`, `RememberToken`) and port interfaces (`IProductRepository`, `IUserRepository`, `IPasswordHasher`).
- **Application Layer (`src/application`)**: Independent use cases (`GetProductByIdUseCase`, `LoginUserUseCase`) interacting only with ports.
- **Infrastructure Layer (`src/infrastructure`)**:
  - *Adapters*: `SequelizeProductRepository`, `BcryptPasswordHasher`.
  - *Entry points*: Express controllers and EJS views.

### Risks
- **EJS Integration**: Direct rendering of EJS views in Express controllers is coupled to directory structures. Rendering must remain in the HTTP controller entry points (infrastructure) after receiving the result from Use Cases.
- **Test Suite Breakage**: Refactoring services into Use Cases and repository ports will break existing tests in `src/__tests__`. Tests must be rewritten to verify Use Cases with mocked interfaces and test repository implementations separately.
- **Validation Middleware coupling**: `express-validator` is currently used in routing and checked in controllers (like `processLogin.js`). Validation rules must either be treated as an HTTP concern (infrastructure controller) or mapped clean-ly to application validations.

### Ready for Proposal
Yes
