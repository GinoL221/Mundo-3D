# Design: Standardize Naming Conventions to camelCase and snake_case

## Technical Approach
The overall strategy is to migrate the codebase properties of the `User` and `RememberToken` models to camelCase, while standardizing database column names in MySQL to snake_case. This is implemented via explicit Sequelize attribute mapping using the `field` option. The migration will be conducted incrementally (Slice 1: User & RememberToken) to ensure all tests pass and to minimize diff sizes.

## Architecture Decisions

### Decision: Database Column Renaming Strategy
**Choice**: Explicitly map snake_case database columns using Sequelize `field` attribute mappings in model configuration files (`User.js` and `RememberToken.js`).
**Alternatives considered**: Using Sequelize's `underscored: true` model configuration option.
**Rationale**: `underscored: true` automatically maps all columns and association foreign keys to snake_case, which can result in implicit, unpredictable naming for complex associations and foreign keys. Declaring the mapping explicitly per field in the model configuration guarantees control, clarity, and safety when standardizing columns such as `id_user`, `first_name`, `last_name`, `email`, `image`, `password_user`, `id_role`, `category`, `id_remember_token`, `token_hash`, `expiry_date`, and `created_at`.

### Decision: Mapping Properties in Sequelize
**Choice**: Map database snake_case fields (e.g., `first_name`) to camelCase properties (e.g., `firstName`) at the Sequelize model definition layer using the `field` parameter.
**Alternatives considered**: Performing mappings in the database repository layer (`toEntity` mapping).
**Rationale**: Mapping at the Sequelize model layer ensures that Sequelize's native querying functions (e.g., `findOne`, `create`, `update`, `findByPk`) natively accept and return camelCase properties. This minimizes translation boilerplate code in repositories and allows the Sequelize repository implementation to remain clean and simple.

## Data Flow
1. **HTTP/Controller Layer**: Receives request payload containing camelCase properties (e.g., `firstName`, `password`).
2. **Application/Use Case Layer**: Processes incoming payloads, validates data structures, instantiates pure camelCase Domain Entities, and returns plain camelCase DTOs (e.g., `UserDTO`).
3. **Repository Layer**: Converts domain entities to camelCase objects matching the model interface and interacts with Sequelize.
4. **Sequelize Model Layer**: Translates camelCase model properties to MySQL snake_case database columns dynamically.

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `openspec/changes/standardize-camelcase-snakecase/design.md` | Create | Technical design documentation detailing architecture choices and migration plan. |
| `src/database/models/User.js` | Modify | Update Sequelize schema attributes to camelCase with explicit `field` options mapping to snake_case columns. |
| `src/database/models/RememberToken.js` | Modify | Update Sequelize schema attributes to camelCase with explicit `field` options mapping to snake_case columns. |
| `src/database/models/db.d.ts` | Modify | Update types (`UserAttributes`, `RememberTokenAttributes`) and instance interfaces to match camelCase properties. |
| `src/database/models/index.js` | Modify | Align Sequelize foreign key definitions with renamed camelCase models and snake_case database column mappings. |
| `src/domain/entities/User.ts` | Modify | Refactor entity properties to camelCase (`idUser`, `firstName`, `lastName`, `email`, `password`, `image`, `idRole`, `category`). |
| `src/domain/entities/RememberToken.ts` | Modify | Refactor entity properties to camelCase (`idRememberToken`, `tokenHash`, `idUser`, `expiryDate`, `createdAt`). |
| `src/application/dtos/UserDTO.ts` | Modify | Refactor DTO attributes to camelCase. |
| `src/application/dtos/RememberTokenDTO.ts` | Modify | Refactor DTO attributes to camelCase. |
| `src/infrastructure/repositories/SequelizeUserRepository.ts` | Modify | Align database calls and mapper logic (`toEntity`) to use camelCase attributes. |
| `src/infrastructure/repositories/SequelizeRememberTokenRepository.ts` | Modify | Align database calls and mapper logic (`toEntity`) to use camelCase attributes. |
| `src/application/use-cases/RegisterUserUseCase.ts` | Modify | Adjust registration payload fields to camelCase. |
| `src/application/use-cases/AuthenticateUserUseCase.ts` | Modify | Adjust credentials payload fields to camelCase. |
| `src/application/use-cases/CreateRememberTokenUseCase.ts` | Modify | Adjust properties passed to repositories to camelCase. |
| `src/application/use-cases/VerifyRememberTokenUseCase.ts` | Modify | Align validation attributes to camelCase. |
| `src/infrastructure/controllers/UserController.ts` | Modify | Align login, registration and session storage fields with camelCase conventions. |
| `src/infrastructure/controllers/UserApiController.ts` | Modify | Align API response fields to return camelCase payloads. |
| `src/infrastructure/middlewares/userLogged.ts` | Modify | Access session properties in camelCase (e.g., `req.session.userLogged.idUser`). |
| `src/__tests__/*` | Modify | Refactor all affected test cases to assert camelCase outputs and mock repositories/models accordingly. |

## Interfaces / Contracts

### `UserDTO` Interface
```typescript
export interface UserDTO {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  idRole?: number | null;
  category?: string | null;
}
```

### `RememberTokenDTO` Interface
```typescript
export interface RememberTokenDTO {
  idRememberToken: number;
  tokenHash: string;
  idUser: number;
  expiryDate: Date;
  createdAt?: Date | null;
}
```

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Entity Instantiation & Validation | Test that `User` and `RememberToken` entities throw validation errors or serialize properties properly using camelCase. |
| Integration | Repository Data Translation | Write tests to ensure `SequelizeUserRepository` and `SequelizeRememberTokenRepository` correctly read/write to memory SQLite and translate attributes via `toEntity`. |
| Integration | Use Cases | Verify that application use cases return camelCase DTOs and do not expose Sequelize instances. |
| Integration | Controllers / Routes | Test request-response mappings for registration, login, and remember-me endpoints using camelCase attributes. |

## Migration / Rollout
- **Local/Test Environment**: In development and test runs, Sequelize `{ alter: true }` will automatically alter the database schema to reflect the new snake_case column names and map them accordingly.
- **Production Environment**: Define a SQL script to alter tables `User` and `RememberToken` by renaming PascalCase columns to snake_case. Run this script during a deployment window, then rollout the codebase update.
- **Rollback plan**: If critical errors arise, rollback code deployment to the previous version and execute an inverse SQL script to restore database columns back to PascalCase.

## Open Questions
- None
