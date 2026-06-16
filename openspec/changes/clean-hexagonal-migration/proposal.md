# Clean & Hexagonal Architecture Migration (Product Domain Slice)

## Intent
Migrate the core Product domain (including Categories and Franchises) from a coupled JS MVC architecture to a type-safe, decoupled TypeScript Hexagonal Architecture to establish a pattern for future codebase modernization.

## Scope
| In Scope | Out of Scope |
| :--- | :--- |
| - TypeScript compilation and build setup | - Migration of Users or Cart domains |
| - Domain core entities for Products, Categories, Franchises | - Replacing Sequelize with another database ORM |
| - Use cases & ports for the Product domain | - Rewriting EJS templates |
| - Express controllers & Sequelize adapters for Products | |

## Capabilities
- **New**: TypeScript and strict compilation rules.
- **Modified**: Decoupled Product services split into Use Cases (application) and Repository Adapters (infrastructure). Syntactic validation in controllers; semantic validation in use cases.

## Approach
Implement a single vertical slice:
1. **Infrastructure Setup**: Add `tsconfig.json`, `ts-jest`, compiler pipelines, and type-safety rules.
2. **Domain Layer (`src/domain`)**: Define strict interfaces (Ports) and domain entities for Product, Category, and Franchise.
3. **Application Layer (`src/application`)**: Implement Use Cases returning clean DTOs.
4. **Infrastructure Layer (`src/infrastructure`)**: Write Sequelize adapters implementing ports, and update Express controllers to map DTOs to EJS views.

## Affected Areas
- `src/controllers/` (Product controllers)
- `src/services/` (split into `application/use-cases` and `infrastructure/repositories`)
- `src/database/models/` (encapsulated under Sequelize adapters)
- `src/routes/` (dependency injection routing for Products)

## Risks & Mitigation
| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| **Coexistence bugs** | Medium | Strict Boy Scout rule inside the Product domain; other domains allow temporary legacy patches with tech debt tracking. |
| **EJS Coupling** | High | Use cases return clean, plain DTOs; EJS rendering is kept strictly inside Express infrastructure controllers. |
| **Broken Jest tests** | High | Mock Repository interfaces to test Use Cases in isolation; test adapters integration separately. |

## Rollback Plan
Maintain git branch isolation. In case of failure:
1. Revert to the master/main commit before migration.
2. Rollback build/compiler configurations (`package.json`, `tsconfig.json`).
3. Keep the Sequelize database schema unchanged as we are only refactoring the code structure.

## Dependencies
- Node.js environment supporting TypeScript compiler tools.
- Existing Sequelize schemas.

## Success Criteria
- Product domain is 100% migrated to TypeScript with no use of `any`.
- Compile-time check enforces domain layers cannot import infrastructure packages.
- Jest test coverage for the migrated slice remains at or above 80%.
