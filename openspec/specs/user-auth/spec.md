# User Auth Specification

## Purpose

Defines the credential verification capability owned by `UserService`, ensuring no controller or route directly calls `bcrypt`.

## Requirements

### Requirement: Password Verification

`UserService` MUST expose `verifyPassword(plainPassword, hashedPassword)` returning a boolean. The method SHALL delegate to `bcryptjs.compareSync` internally.

#### Scenario: Correct password returns true

- GIVEN a user with hashed password stored in DB
- WHEN `UserService.verifyPassword('secret123', hash)` is called where 'secret123' matches the hash
- THEN the method SHALL return `true`

#### Scenario: Incorrect password returns false

- GIVEN a user with hashed password stored in DB
- WHEN `UserService.verifyPassword('wrongpass', hash)` is called
- THEN the method SHALL return `false`

### Requirement: No Direct bcrypt in Controllers

Controllers and routes MUST NOT import `bcryptjs` directly. All password verification MUST go through `UserService.verifyPassword`.

#### Scenario: processLogin uses UserService instead of bcrypt

- GIVEN `processLogin.js` needs to verify a login password
- WHEN the controller verifies the password
- THEN it SHALL call `UserService.verifyPassword(password, user.PasswordUser)`
- AND it MUST NOT import `bcryptjs` or call `bcrypt.compareSync`

### Requirement: Unified Login Error Rendering

`processLogin.js` MUST simplify and unify credentials validation error rendering, returning a generic credential error to prevent user existence leakage.

#### Scenario: Credential verification failure renders generic error

- GIVEN a login attempt with invalid email or incorrect password
- WHEN credential check fails
- THEN the system SHALL render `users/login` with a single unified error
- AND it MUST NOT leak whether the email exists in the database

#### Scenario: Input validation failure renders field errors

- GIVEN input fields fail basic validation checks (e.g., empty fields)
- WHEN validation check runs
- THEN the system SHALL render `users/login` with field-specific errors and `oldData`

### Requirement: Render Without path.join

All view rendering MUST use relative view paths instead of absolute paths or `path.join(__dirname, ...)`. Specifically, `processLogin.js` MUST use `res.render('users/login')` and `getAllProducts.js` MUST use `res.render('products/products')`.

#### Scenario: View rendering uses relative paths

- GIVEN a request that triggers `processLogin` or `getAllProducts`
- WHEN rendering is initiated
- THEN it SHALL render using `'users/login'` or `'products/products'`
- AND it MUST NOT use absolute paths or `path.join`

