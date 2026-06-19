## Exploration: Naming Conventions Standardization (camelCase/snake_case)

### Current State
The codebase uses a mixture of naming conventions. The MySQL database schema uses PascalCase for tables (e.g. `User`, `Product`) and columns (e.g. `IDUser`, `FirstName`). Domain entities, DTOs, use cases, and repositories also pass and reference these properties in PascalCase. A few exceptions (like the `ShoppingCart` domain entity) have already been partially migrated to camelCase, causing structural inconsistency between the domain and database mapping layer.

### Affected Areas
- `src/database/models/` (User, Product, Category, Franchise, RememberToken, ShoppingCart) — Sequelize models use PascalCase properties and map to PascalCase tables/columns.
- `src/domain/entities/` (User, Product, Category, Franchise, RememberToken) — Entities use PascalCase properties in constructors and methods.
- `src/application/dtos/` (UserDTO, ProductDTO, CategoryDTO, FranchiseDTO, RememberTokenDTO, ShoppingCartDTO) — DTO interfaces define PascalCase properties.
- `src/infrastructure/repositories/` (Sequelize repositories) — Naming mapper methods (`toEntity`) and queries use PascalCase fields.
- `src/application/use-cases/` — Use case business logic maps inputs to entities using PascalCase.
- `src/infrastructure/controllers/` — Controllers process req.body or write sessions using PascalCase keys (e.g., `IDUser`, `FirstName`).
- `src/views/` (header.ejs, users.ejs, etc.) — EJS templates access properties using PascalCase keys (e.g., `locals.userLogged.IDRole`).
- `src/database/data/` (users.json, products.json) — Seed JSON data files use PascalCase keys.
- `src/__tests__/` and other `__tests__` subdirectories — Integration and unit tests mock data and assert properties using PascalCase.

### Approaches
1. **Option A: All-in-one Refactor** — Migrate all database tables, columns, models, entities, DTOs, use cases, controllers, and tests at once.
   - Pros: Simple conceptual transition; no intermediate state or temporary adapters needed.
   - Cons: Massive diff (40+ files, >1500 lines changed) violating the 400-line budget risk; high chance of introducing regression bugs that are hard to isolate.
   - Effort: High initial effort, high risk of regression.

2. **Option B: Incremental Slices (Recommended)** — Standardize the codebase in domain slices (e.g., Slice 1: User & Auth/RememberToken; Slice 2: Category & Franchise; Slice 3: Product; Slice 4: ShoppingCart).
   - Pros: Small, isolated commits (well within the 400-line budget per slice); keeps test suite green at each step; easier to verify and review.
   - Cons: Requires running under a mixed schema temporarily during the migration process.
   - Effort: Medium effort, extremely low risk.

### Recommendation
Option B (Incremental Slices) is the recommended approach. Starting with a vertical slice of User & RememberToken (which handles Auth) allows validating the Sequelize snake-to-camel mapping pattern under tests before modifying products, categories, or the cart.

### Risks
- Code size of an all-in-one refactor might exceed review capacity and safe-apply bounds.
- Session and cookie serialization (like `req.session.userLogged`) will break if views are not updated in sync with controllers/entities.
- Association definitions in Sequelize must be carefully updated to reference standard snake_case foreign keys (`id_user`, `id_product`, etc.).

### Ready for Proposal
Yes
