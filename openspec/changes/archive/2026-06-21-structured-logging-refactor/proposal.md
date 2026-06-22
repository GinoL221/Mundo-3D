# Proposal: Structured Logging Refactor

## Intent

Refactor application logging in the Express/TypeScript codebase to use structured JSON logging powered by Pino. This will standardize log formats, enable trace/request correlation ID tracking for HTTP requests, silence logs during test runs, and preserve native CLI logging for database administrative scripts.

## Scope

### In Scope
- Install production dependency `pino` and development dependency `pino-pretty`.
- Establish a centralized type-safe logger utility in `src/infrastructure/logging/logger.ts` utilizing Pino.
- Implement Express middleware in `src/infrastructure/middlewares/requestId.ts` to attach a unique correlation ID (`reqId`) to each HTTP request.
- Log incoming HTTP requests and response times with the corresponding `reqId`.
- Replace `console.error` and `console.log` invocations inside the application middleware:
  - `src/infrastructure/middlewares/cartCount.ts`
  - `src/infrastructure/middlewares/errorHandler.ts`
  - `src/infrastructure/middlewares/userLogged.ts`
- Update unit/integration tests to assert against logger outputs using Jest spies instead of `console.error` mocks.

### Out of Scope
- Migrating database utility scripts `src/database/seed.js` and `src/database/reset-db.js` to Pino (they must continue using native `console.log` and `console.error` for clean CLI feedback).
- Introducing third-party application monitoring service SDKs (APM).

## Capabilities

### New Capabilities
- `structured-logging`: A Pino-backed logger interface that serializes log contexts natively to JSON on stdout/stderr.
- `request-correlation`: Middleware that injects a unique ID (`reqId`) into the request scope and standardizes HTTP access logs.

### Modified Capabilities
- `error-handling`: Centralized Express error handler logs structured error stacks and messages with metadata.
- `authentication`: Traces session validation warnings and remember-token validation errors under the new logger interface.
- `cart-management`: Logs cart computation failures in a structured format.

## Approach

1. **Pino Logger Setup**:
   - Establish `src/infrastructure/logging/logger.ts`.
   - Log level defaults to `info` in development and production, and `silent` in test environments.
   - Configure Pino to use `pino-pretty` transport for human-readable colorized output exclusively in development.
2. **Request Trace Middleware**:
   - Build a middleware that reads an existing request ID (e.g. `X-Request-Id`) or generates a new one via `crypto.randomUUID()`.
   - Store it as `req.id` and add it to request/response logs.
3. **Application Integration**:
   - Swap all `console` logging in middlewares with imports of the singleton logger.
4. **Test Adjustments**:
   - Jest tests will run with logs silenced by default. Update `errorHandler.test.ts` to spy on `logger.error` to assert correct log behavior.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/infrastructure/logging/logger.ts` | New | Centralized Pino logger instance configuration. |
| `src/infrastructure/middlewares/requestId.ts` | New | Trace correlation middleware using UUIDs. |
| `src/infrastructure/middlewares/errorHandler.ts` | Modified | Migrate console errors to logger-based structured statements. |
| `src/infrastructure/middlewares/cartCount.ts` | Modified | Migrate console errors to logger-based structured statements. |
| `src/infrastructure/middlewares/userLogged.ts` | Modified | Migrate console errors to logger-based structured statements. |
| `src/app.js` | Modified | Integrate request tracing middleware and mount request logs. |
| `src/infrastructure/middlewares/__tests__/errorHandler.test.ts` | Modified | Re-route console mocks to test-safe logger spies. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Log silence hiding test errors | Low | Ensure log level is overridable via `LOG_LEVEL` environment variable during tests if debugging is needed. |
| Performance overhead of pretty-printing | Low | Ensure `pino-pretty` is strictly loaded only when `NODE_ENV !== 'production'` and is installed only as a `devDependency`. |

## Rollback Plan

Revert Git changes to restore the `console` invocations, remove the new files under `src/infrastructure/logging` and `src/infrastructure/middlewares/requestId.ts`, and uninstall the `pino` and `pino-pretty` packages.

## Dependencies

- `pino` (production dependency)
- `pino-pretty` (development dependency)

## Success Criteria

- [ ] All existing Jest test suites pass.
- [ ] Application logs are structured JSON when running in production mode.
- [ ] Local development logs are human-readable and colorized.
- [ ] Every request gets logged with a unique correlation `reqId`.
- [ ] Administrative CLI scripts continue using standard `console` functions.
