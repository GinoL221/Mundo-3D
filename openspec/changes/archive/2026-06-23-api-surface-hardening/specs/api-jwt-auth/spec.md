# Delta for API JWT Authentication

## ADDED Requirements

### Requirement: Centralized JWT Secret Module

The system MUST provide a single module that resolves the JWT signing secret exclusively from `process.env.JWT_SECRET`. The module MUST throw an unrecoverable error at application startup when the environment variable is absent or empty. No hardcoded fallback values (including `"test_jwt_secret"`) SHALL be permitted anywhere in the codebase.

#### Scenario: Application starts with valid JWT_SECRET

- GIVEN `process.env.JWT_SECRET` is set to a non-empty string
- WHEN the application bootstraps and imports the secret module
- THEN the module MUST export the configured secret value
- AND no error SHALL be thrown

#### Scenario: Application fails fast when JWT_SECRET is missing

- GIVEN `process.env.JWT_SECRET` is undefined or empty
- WHEN the application bootstraps and imports the secret module
- THEN the module MUST throw an error with a descriptive message
- AND the application MUST NOT start

### Requirement: Request User Type Augmentation

The Express `Request` object MUST be augmented with an optional `user` property whose shape carries at least `id`, `email`, and `role`. The auth middleware MUST assign the decoded JWT payload to `req.user` after successful verification.

#### Scenario: Auth middleware populates req.user

- GIVEN a valid `Bearer <token>` is provided in the `Authorization` header
- WHEN the auth middleware verifies the token
- THEN `req.user` MUST be populated with `{ id, email, role }` from the JWT payload
- AND downstream handlers MUST be able to access `req.user` without type errors

#### Scenario: req.user is undefined on unauthenticated request

- GIVEN no `Authorization` header is provided
- WHEN a request reaches a handler on a non-protected route
- THEN `req.user` SHOULD be undefined or absent
