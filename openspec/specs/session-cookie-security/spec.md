# Delta for Session Cookie Security

## ADDED Requirements

### Requirement: SameSite Cookie Flag

The session cookie configuration MUST include `sameSite: 'lax'` in the `cookie` options of `express-session` configuration.

#### Scenario: Session cookie includes SameSite attribute

- GIVEN the session middleware is configured in `app.js`
- WHEN a session cookie is set in the response
- THEN the `Set-Cookie` header MUST include `SameSite=Lax`

#### Scenario: SameSite lax allows safe cross-origin navigation

- GIVEN `sameSite` is set to `'lax'`
- WHEN a user navigates to the site via a top-level GET request from another origin (e.g., following a link)
- THEN the session cookie SHALL be sent with the request
- AND the user SHALL remain logged in

### Requirement: Conditional Secure Cookie Flag

The session cookie configuration MUST include a `secure` flag that is `true` in production (`NODE_ENV=production`) and `false` in other environments.

#### Scenario: Secure flag in production environment

- GIVEN `NODE_ENV` is set to `'production'`
- WHEN the session middleware initialization runs
- THEN the session cookie `secure` option SHALL be `true`
- AND browsers MUST only send the cookie over HTTPS

#### Scenario: Secure flag in development environment

- GIVEN `NODE_ENV` is not set or set to a value other than `'production'`
- WHEN the session middleware initialization runs
- THEN the session cookie `secure` option SHALL be `false`
- AND the session cookie SHALL be sent over HTTP in local development

### Requirement: Dead Code Removal from Route Imports

The system MUST remove unused `authMiddleware` imports from `src/routes/userRoutes.js` and `src/routes/productsRoutes.js`. These imports are present but never referenced in either file's route definitions.

#### Scenario: userRoutes no longer imports authMiddleware

- GIVEN `src/routes/userRoutes.js` currently imports `authMiddleware` destructured from the auth middleware module
- WHEN the dead import is removed
- THEN the import line SHALL NOT include `authMiddleware`
- AND all existing route definitions MUST continue to function identically

#### Scenario: productsRoutes no longer imports authMiddleware

- GIVEN `src/routes/productsRoutes.js` currently imports `authMiddleware` destructured from the auth middleware module
- WHEN the dead import is removed
- THEN the import line SHALL NOT include `authMiddleware`
- AND all existing route definitions MUST continue to function identically