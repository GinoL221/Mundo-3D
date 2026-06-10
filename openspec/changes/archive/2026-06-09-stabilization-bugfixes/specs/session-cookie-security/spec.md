# Delta for Session Cookie Security

## ADDED Requirements

### Requirement: Remember-Me Cookie Readability

The `cookie-parser` middleware MUST execute before `userLoggedMiddleware` in the Express middleware stack so that `req.cookies.userEmail` is populated when the auth middleware inspects it for the "remember me" feature.

- GIVEN `cookie-parser` is registered in `src/app.js`
- WHEN the middleware stack processes an incoming request
- THEN `cookie-parser` SHALL run before `userLoggedMiddleware`
- AND `req.cookies.userEmail` SHALL be available to the auth middleware

#### Scenario: Remember-me cookie is accessible to auth middleware

- GIVEN a user has a previously set `userEmail` cookie
- WHEN the request passes through the middleware pipeline
- THEN `userLoggedMiddleware` SHALL read `req.cookies.userEmail`
- AND the "remember me" login flow SHALL function correctly

#### Scenario: Middleware reorder does not break other middleware

- GIVEN `cookie-parser` and `userLoggedMiddleware` are swapped in registration order
- WHEN the application starts
- THEN all existing session and auth behavior MUST remain unchanged
- AND no middleware SHALL receive `undefined` for previously available cookie values

## MODIFIED Requirements

### Requirement: Dead Code Removal from Route Imports

The system MUST remove unused route imports: `authMiddleware` from `src/routes/userRoutes.js` and `src/routes/productsRoutes.js`, `guestMiddleware` from `src/routes/productsRoutes.js`, and the unused `User` model import from `src/controllers/users/viewShoppingCart.js`. A debug `console.log` statement at `viewShoppingCart.js:18` MUST also be removed.

(Previously: Only covered removing unused `authMiddleware` imports from two route files.)

#### Scenario: userRoutes no longer imports authMiddleware

- GIVEN `src/routes/userRoutes.js` currently imports `authMiddleware`
- WHEN the dead import is removed
- THEN the import line SHALL NOT include `authMiddleware`
- AND all existing route definitions MUST continue to function identically

#### Scenario: productsRoutes no longer imports authMiddleware or guestMiddleware

- GIVEN `src/routes/productsRoutes.js` currently imports both `authMiddleware` and `guestMiddleware`
- WHEN the dead imports are removed
- THEN the import line SHALL NOT include either `authMiddleware` or `guestMiddleware`
- AND `guestMiddleware` MUST still be exported from `src/middlewares/auth.js` and used in `userRoutes`

#### Scenario: viewShoppingCart no longer imports User model

- GIVEN `src/controllers/users/viewShoppingCart.js` imports `User` from the models but never uses it
- WHEN the unused import is removed
- THEN the file SHALL NOT import `User`
- AND the cart view controller MUST function identically

#### Scenario: Debug console.log removed from viewShoppingCart

- GIVEN `src/controllers/users/viewShoppingCart.js` contains a debug `console.log` at line 18
- WHEN the statement is removed
- THEN no `console.log` debug statements SHALL remain in the file