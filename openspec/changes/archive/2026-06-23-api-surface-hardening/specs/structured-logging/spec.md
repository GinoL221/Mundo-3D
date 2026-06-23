# Delta for Structured Logging

## MODIFIED Requirements

### Requirement: Middleware Logging Migration

All raw `console.log` and `console.error` statements inside the application middleware files MUST be replaced by logger calls. After the orphaned middlewares (`cartCount.ts`, `userLogged.ts`) are removed, the remaining file requiring migration is `errorHandler.ts`. No console output statements MUST remain in active middleware modules.

(Previously: Listed `cartCount.ts`, `errorHandler.ts`, `userLogged.ts`; cartCount and userLogged are now removed as orphaned.)

#### Scenario: Error handler middleware logs uncaught exceptions structured
- GIVEN `errorHandler` processes an uncaught HTTP exception
- WHEN the error stack and message are logged
- THEN they MUST be logged via `logger.error` rather than `console.error`
- AND the log entry MUST include the error message and stack trace
