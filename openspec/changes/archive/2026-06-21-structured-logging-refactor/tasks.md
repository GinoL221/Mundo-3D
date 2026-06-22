# Tasks: Structured Logging Refactor

Forecast:
```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Phase 1: Foundation
- [x] Install production dependency `pino` and devDependency `pino-pretty`.
- [x] Remove `morgan` from `package.json` devDependencies.
- [x] Run `npm install` to update `package-lock.json` and install new packages.

## Phase 2: Core implementation
- [x] Create `src/infrastructure/logging/logger.ts` for the Pino logger singleton.
- [x] Create `src/infrastructure/middlewares/requestId.ts` for correlation ID tracking.
- [x] Create `src/infrastructure/middlewares/requestLogger.ts` for structured HTTP request/response access logging.

## Phase 3: Express integration & refactoring
- [x] Update `src/app.js` to register `requestIdMiddleware` and `requestLogger` and remove `morgan` integration.
- [x] Update `src/infrastructure/middlewares/errorHandler.ts` to log errors via `logger.error` including correlation `reqId` and returning it in JSON.
- [x] Update `src/infrastructure/middlewares/cartCount.ts` to replace `console.error` with `logger.error` including correlation `reqId`.
- [x] Update `src/infrastructure/middlewares/userLogged.ts` to replace `console.error` with `logger.error` including correlation `reqId`.

## Phase 4: Testing & Verification
- [x] Update `src/infrastructure/middlewares/__tests__/errorHandler.test.ts` to use `logger.error` spies instead of `console.error` mocks.
- [x] Create unit tests for request correlation (`requestId.ts` and `requestLogger.ts`) verifying ID logic and log attributes.
- [x] Verify that all tests pass by running `npm test`.
- [x] Verify that no TypeScript or code style violations exist by running `npm run lint`.
