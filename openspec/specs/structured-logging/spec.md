# Structured Logging Specification

## Purpose
Defines requirements and test scenarios for a centralized structured JSON logging setup powered by Pino. This standardizes all application log messages, isolates test logs, and configures environment-specific formatting.

## Requirements

### Requirement: Centralized Logger Utility
The system MUST implement a type-safe logger utility in `src/infrastructure/logging/logger.ts` utilizing `pino`.
- The logger configuration MUST dynamically adapt based on `process.env.NODE_ENV`:
  - When `NODE_ENV` is `production`, the logger MUST serialize log statements to standard output in raw JSON format.
  - When `NODE_ENV` is `development` (or any other non-test environment), the logger SHOULD use `pino-pretty` to generate human-readable, colorized terminal output.
  - When `NODE_ENV` is `test`, the logger level MUST default to `silent` to prevent polluting the test outputs.
- The logger level MUST be overridable by setting the `LOG_LEVEL` environment variable. If `LOG_LEVEL` is not provided, the default log level MUST be `info` (for non-test environments).

#### Scenario: Production JSON logging is active
- GIVEN the application starts in production mode (`NODE_ENV=production`)
- WHEN a log statement is executed
- THEN it MUST be output as structured JSON to stdout/stderr
- AND it SHALL NOT be pretty-printed

#### Scenario: Development pretty-printing is active
- GIVEN the application starts in development mode
- WHEN a log statement is executed
- THEN it SHOULD be formatted using `pino-pretty` as colorized text

#### Scenario: Silent logging during tests
- GIVEN the application starts in a test environment (`NODE_ENV=test`)
- AND the `LOG_LEVEL` environment variable is not defined
- WHEN the logger is imported and used
- THEN its level MUST be set to `silent` and no logs shall be written to stdout/stderr

#### Scenario: Overriding log level in tests
- GIVEN the application runs in a test environment (`NODE_ENV=test`)
- AND the `LOG_LEVEL` environment variable is set to `debug`
- WHEN a debug log statement is executed
- THEN it MUST be output to stdout/stderr at level `debug`

---

### Requirement: Middleware Logging Migration

All raw `console.log` and `console.error` statements inside the application middleware files MUST be replaced by logger calls. After the orphaned middlewares (`cartCount.ts`, `userLogged.ts`) are removed, the remaining file requiring migration is `errorHandler.ts`. No console output statements MUST remain in active middleware modules.

(Previously: Listed `cartCount.ts`, `errorHandler.ts`, `userLogged.ts`; cartCount and userLogged are now removed as orphaned.)

#### Scenario: Error handler middleware logs uncaught exceptions structured
- GIVEN `errorHandler` processes an uncaught HTTP exception
- WHEN the error stack and message are logged
- THEN they MUST be logged via `logger.error` rather than `console.error`
- AND the log entry MUST include the error message and stack trace

---

### Requirement: Exclude Administrative CLI Scripts
Administrative CLI scripts (`src/database/seed.js` and `src/database/reset-db.js`) MUST continue to use native `console.log` and `console.error` statements for clean, raw terminal outputs. They MUST NOT import or configure the Pino-based application logger.

#### Scenario: Seeding database outputs raw text
- GIVEN the database seed script is run via terminal CLI
- WHEN logs are written
- THEN the script MUST output them using native `console.log`
- AND the output MUST NOT contain JSON-structured logging envelopes
