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

### Requirement: Render Without path.join

`processLogin.js` MUST use `res.render('users/login')` instead of `res.render(path.join(__dirname, '../../views/users/login.ejs'))`.

#### Scenario: Login error renders with view name

- GIVEN a login attempt fails validation or credentials
- WHEN `processLogin` renders the login page
- THEN it SHALL call `res.render('users/login', { errors, oldData })`
- AND it MUST NOT use `path.join(__dirname, ...)` for the view path
