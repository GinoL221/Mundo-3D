# Proposal: Standardize Naming Conventions to camelCase and snake_case

## 1. Intent
Standardize codebase properties to lower camelCase and database column names to snake_case, fixing the PascalCase mismatches.

## 2. Scope
This change initiates Slice 1: User & RememberToken (Auth).
- **In Scope**:
  - Migrate `User` and `RememberToken` entities, database models, DTOs, use cases, controllers, middlewares, session/cookie logic, views, and tests.
  - Update MySQL tables `User` and `RememberToken` to use snake_case columns.
  - Configure Sequelize mapping fields.
- **Out of Scope**: Category, Franchise, Product, and ShoppingCart slices.

## 3. Capabilities
- **New Capabilities**: None.
- **Modified Capabilities**:
  - `user-auth`: Internal data structures, endpoints, views, and database columns for User and RememberToken.

## 4. Approach
Incremental Slice-by-Slice (Option B).
- Define snake_case fields in Sequelize (using `underscored: true` or explicit column mappings).
- Update entities (`User`, `RememberToken`) and DTOs to use camelCase properties.
- Refactor use cases and controllers.
- Apply database migrations via SQL/Sequelize script.

## 5. Risks & Mitigation
- **Session/Cookie Serialization**: Changing field names can invalidate active sessions. *Mitigation*: Run migration during maintenance or gracefully handle serialization errors.
- **Association/Foreign Keys**: Breaking Sequelize relations. *Mitigation*: Explicitly define mapping keys (`id_user` / `IDUser`).
- **Diff Size**: Refactoring across layers can result in large diffs. *Mitigation*: Focus strictly on User and RememberToken files.

## 6. Rollback Plan
- **Code**: Revert git commits.
- **Database**: Revert column names back to PascalCase via rollback SQL script.

## 7. Success Criteria
- Register/Login functionality is fully operational.
- Database columns in MySQL physically use snake_case (`id_user`, `first_name`, `last_name`, `email`, `password_user`, `id_role`, `id_remember_token`, `token_hash`, `expiry_date`, `created_at`).
- All 324 tests pass successfully.
