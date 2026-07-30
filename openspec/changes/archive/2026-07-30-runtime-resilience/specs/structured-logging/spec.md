# Delta for Structured Logging

## ADDED Requirements

### Requirement: Boot Entrypoint Logging Migration

`backend/index.js` MUST replace its raw `console.log`/`console.error` statements with the existing Pino logger (`backend/src/infrastructure/logging/logger.ts`). This extends the console→logger migration to the boot entrypoint script only. It does not change the scope of the existing Middleware Logging Migration requirement, and the Exclude Administrative CLI Scripts requirement remains unchanged: `backend/src/database/seed.js` and `reset-db.js` MUST keep native `console` output.

#### Scenario: Boot success logs structured
- GIVEN `backend/index.js` completes boot (DB auth, migration check, seed) successfully
- WHEN it logs that the server is listening
- THEN the message MUST be logged via the Pino logger, not `console.log`

#### Scenario: Boot failure logs structured
- GIVEN `backend/index.js` fails to boot (DB auth, migration check, or seed failure)
- WHEN the error is logged before `process.exit(1)`
- THEN it MUST be logged via the Pino logger's error method, not `console.error`
- AND the log entry MUST include the error message

#### Scenario: CLI scripts remain unaffected
- GIVEN `backend/src/database/seed.js` or `reset-db.js` runs as a CLI script
- WHEN it logs output
- THEN it MUST continue to use native `console.log`/`console.error`
- AND MUST NOT import or configure the Pino-based application logger
