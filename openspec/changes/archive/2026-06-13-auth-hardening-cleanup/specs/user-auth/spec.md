# Delta for User Auth

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Render Without path.join
All view rendering MUST use relative view paths instead of absolute paths or `path.join(__dirname, ...)`. Specifically, `processLogin.js` MUST use `res.render('users/login')` and `getAllProducts.js` MUST use `res.render('products/products')`.
(Previously: Specified `processLogin.js` using `res.render('users/login')`.)

#### Scenario: View rendering uses relative paths
- GIVEN a request that triggers `processLogin` or `getAllProducts`
- WHEN rendering is initiated
- THEN it SHALL render using `'users/login'` or `'products/products'`
- AND it MUST NOT use absolute paths or `path.join`
