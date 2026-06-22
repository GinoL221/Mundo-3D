# Request Correlation Specification

## Purpose
Defines requirements and test scenarios for a request-scoped correlation middleware. This middleware assigns a unique ID (`reqId`) to each HTTP request and propagates it to log statements and HTTP response headers.

## Requirements

### Requirement: Correlation ID Propagation Middleware
The system MUST implement an Express middleware in `src/infrastructure/middlewares/requestId.ts`.
- The middleware MUST intercept every incoming HTTP request.
- The middleware MUST check for the presence of a request correlation ID header (specifically, `X-Request-Id`).
  - If the header is present, its value MUST be extracted and reused.
  - If the header is absent, the middleware MUST generate a unique ID using `crypto.randomUUID()`.
- The correlation ID MUST be stored on the request object (as `req.id`).
- The middleware MUST append the correlation ID to the response headers as `X-Request-Id`.

#### Scenario: Request contains correlation ID header
- GIVEN an incoming HTTP request containing the `X-Request-Id` header with value `test-correlation-id-123`
- WHEN the request is processed by the correlation middleware
- THEN `req.id` MUST be set to `test-correlation-id-123`
- AND the response MUST return the header `X-Request-Id` containing `test-correlation-id-123`

#### Scenario: Request lacks correlation ID header
- GIVEN an incoming HTTP request with no correlation ID header
- WHEN the request is processed by the correlation middleware
- THEN a new UUID MUST be generated via `crypto.randomUUID()`
- AND `req.id` MUST be set to the newly generated UUID
- AND the response MUST return the header `X-Request-Id` containing the generated UUID

---

### Requirement: Request Access Logging
The application MUST log all incoming HTTP requests and their responses.
- The middleware (or a dedicated request logger) MUST log the method, URL, HTTP status code, response time, and the request ID (`reqId`).
- Access logs MUST be emitted through the centralized Pino logger.

#### Scenario: Incoming request access log is recorded
- GIVEN a completed HTTP request with ID `req-abc-789`
- WHEN the access log is written
- THEN the log record MUST contain fields: `reqId: "req-abc-789"`, method, url, status, and response time in milliseconds

---

### Requirement: Correlation ID in Error Logs
The centralized error handling middleware (`src/infrastructure/middlewares/errorHandler.ts`) MUST include the active request correlation ID in its log output and JSON responses.
- Logged errors MUST output the `reqId` alongside error messages and stack traces to facilitate cross-referencing logs.
- The returned error JSON response payload MUST include the request ID to allow clients to report correlation IDs.

#### Scenario: Uncaught error logs contain request ID
- GIVEN a request with ID `error-req-999`
- WHEN the request causes an uncaught error and hits the error handler middleware
- THEN the error log entry MUST contain `reqId: "error-req-999"`
- AND the JSON payload returned to the user MUST contain the request ID
