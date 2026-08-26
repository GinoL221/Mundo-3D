# Delta for User & Auth Domain Hexagonal Architecture

## MODIFIED Requirements

### Requirement: Business Error Propagation

Given an application Use Case running a business action, when a business rule is violated (e.g., duplicate email during registration, whether detected sequentially or as the losing side of a concurrent race), the Use Case MUST throw a custom Domain Exception (`UserAlreadyExistsException`), and it MUST NOT allow a generic database, network, or framework error — including a raw `SequelizeUniqueConstraintError` surfaced by a concurrent duplicate insert — to propagate to the controller.
(Previously: this guarantee held only for the sequential check-then-insert path in `RegisterUserUseCase`; a concurrent duplicate-email write could bypass the check-then-insert guard and let the driver's raw unique-constraint error reach the controller unmapped.)

#### Scenario: Sequential duplicate email throws domain exception

- GIVEN a registration request whose email already exists in the database
- WHEN `RegisterUserUseCase.execute` runs
- THEN it MUST throw `UserAlreadyExistsException`
- AND it MUST NOT throw a raw database or framework error

#### Scenario: Concurrent duplicate email throws the same domain exception

- GIVEN two registration requests submitted concurrently with the same, previously-unused email
- WHEN both requests race the check-then-insert path and the database's `UNIQUE KEY` on `email` rejects the losing insert
- THEN the losing request MUST result in `UserAlreadyExistsException`
- AND it MUST NOT result in an unmapped `SequelizeUniqueConstraintError` reaching the controller

### Requirement: Controller Dependency Injection and API JSON Authentication

Given an Express Controller handling user registration, when it catches `UserAlreadyExistsException` — whether from a sequential duplicate check or from the losing side of a concurrent registration race — it MUST return HTTP 400 with the same JSON error message shape as the sequential duplicate-email path, and it MUST clean up any uploaded avatar file associated with that request via `cleanupUploadedFile`. It MUST NOT allow the losing request of a concurrent race to reach the generic error handler and return 500, and it MUST NOT leave the losing request's uploaded file orphaned on disk.
(Previously: the 400 response and avatar cleanup were only guaranteed for the sequential duplicate-email path; a losing concurrent registration reached the generic `errorHandler`, returning 500 with the uploaded file left orphaned.)

#### Scenario: Sequential duplicate email registration returns 400 and cleans up the upload

- GIVEN a `POST /api/users/register` request with an email that already exists and an uploaded avatar file
- WHEN the request is processed
- THEN the response status MUST be 400
- AND the response body MUST match the existing duplicate-email error message
- AND the uploaded avatar file MUST be removed from disk

#### Scenario: Concurrent duplicate email registration resolves like the sequential path

- GIVEN two `POST /api/users/register` requests submitted concurrently with the same email, each with its own uploaded avatar file
- WHEN both requests are processed concurrently against the database
- THEN exactly one request MUST receive HTTP 201 Created
- AND the other request MUST receive the same HTTP 400 response shape and message as the sequential duplicate-email path
- AND neither request MUST receive an HTTP 500 response
- AND the losing request's uploaded avatar file MUST be cleaned up, not orphaned
