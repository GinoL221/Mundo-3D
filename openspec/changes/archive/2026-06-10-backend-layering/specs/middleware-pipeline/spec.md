# Delta for Middleware Pipeline

## MODIFIED Requirements

### Requirement: Controller Error Propagation

All controller catch blocks MUST propagate errors to the global error handler via `next(err)` instead of returning inline `res.status(500).send(...)` or `res.status(500).json(...)`.
(Previously: Only covered controllers; now extends to middleware that fetches data from ORM directly)

#### Scenario: Controller catch block calls next(err)

- GIVEN a controller catch block previously used `res.status(500).send(error.message)`
- WHEN an unhandled error occurs in that controller
- THEN the controller SHALL call `next(err)`
- AND the global `errorHandler` middleware SHALL receive the error

#### Scenario: Error message not leaked to client

- GIVEN the `deleteUser` controller previously sent `${error.message}` in the 500 response
- WHEN an error occurs during user deletion
- THEN `next(err)` SHALL be called instead
- AND the client MUST NOT receive the raw `error.message` in the response body

## ADDED Requirements

### Requirement: Auth Middleware Uses UserService

`userLogged.js` MUST NOT call `User.findOne` directly or import `initializeModels`. It SHALL use `UserService.findByEmail(email)` to look up users from the remember-me cookie.

#### Scenario: userLogged finds user via UserService

- GIVEN a request with `req.cookies.userEmail` set to a valid email
- WHEN `userLoggedMiddleware` executes
- THEN it SHALL call `UserService.findByEmail(emailInCookie)`
- AND the result SHALL be assigned to `res.locals.userLogged`

#### Scenario: userLogged does not import User model

- GIVEN `userLogged.js` after refactoring
- WHEN the file is inspected
- THEN it MUST NOT import `initializeModels` or destructure `User` from `db`
- AND it MUST NOT call `User.findOne` directly

#### Scenario: Cookie lookup failure does not block request

- GIVEN `UserService.findByEmail` returns null (no user for cookie email)
- WHEN `userLoggedMiddleware` executes
- THEN `res.locals.userLogged` SHALL remain unset
- AND `next()` SHALL be called without error
