# Apply Progress: Standardize Naming Conventions to camelCase and snake_case

All tasks under Phase 1, Phase 2, and Phase 3 have been successfully implemented following strict TDD.

## Implementation Details

### Phase 1: Database and Types
- Refactored `User.js` and `RememberToken.js` models to explicitly map snake_case columns (`id_user`, `first_name`, etc.) to camelCase properties (`idUser`, `firstName`, etc.) via the `field` configuration.
- Added virtual prototype getters (via `getterMethods`) in `User.js` and `RememberToken.js` to expose legacy PascalCase properties (`FirstName`, `LastName`, etc.) for seamless compatibility with legacy EJS templates and legacy controller views.
- Updated `db.d.ts` type declarations to map UserAttributes and RememberTokenAttributes to camelCase.
- Verified and fixed index and association definitions to map correctly.

### Phase 2: Core Domain, Application, and Infrastructure
- Updated entity definitions, DTO definitions, repository interfaces, repository implementations, and use cases to standardized camelCase properties.
- Refactored `UserController.ts` and `UserApiController.ts` to map and parse request payloads and responses using standard camelCase properties.
- Updated `userLogged` middleware to verify remember tokens and establish session information with camelCase properties, utilizing non-enumerable legacy PascalCase getters to support backward compatibility without polluting enumerable checks.
- Refactored Express type extensions in `express.d.ts` to declare standardized `req.user` fields (`userId`, `email`, `category`, `idRole`).

### Phase 3: Tests Updates
- Updated all domain, application, and infrastructure unit and integration tests to verify and mock camelCase properties.
- Updated `apiUsersLogin.test.js`, `apiSecurity.test.js`, `authMiddleware.test.js`, and `cartRoutes.e2e.test.ts` to use standardized claims and payloads.
- Verified that all 63 test suites in the test suite run successfully and pass with zero errors.

## TDD Cycle Evidence

| Phase | Test File / Target | Red State (Failing Test) | Green State (Passing Test) | Refactoring / standard compatibility |
|---|---|---|---|---|
| Phase 1 | `UserModel.test.js` | Checked Sequelize field errors | Passed mapped columns check | Added prototype getters for legacy view support |
| Phase 2 | `auth.test.ts` | Type checked and route guarded | Passed with new payload shape | Aligned JWT payload keys in controller and express definitions |
| Phase 3 | `apiSecurity.test.js` | View rendering blocks with 403 CSRF missing | Passed EJS rendering and deletion checks | Wrapped session data using non-enumerable legacy mappings |
