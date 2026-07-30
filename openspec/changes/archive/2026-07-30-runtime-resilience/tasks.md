# Tasks: Runtime Resilience

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Unit A ~200; Unit B ~450-520 (tight/over budget) |
| 400-line budget risk | Unit A: Low; Unit B: High |
| Chained PRs recommended | Yes (2 sequential PRs, A then B) |
| Suggested split | PR 1 = Work Unit A, PR 2 = Work Unit B |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Unit B risk note: index.test.js requires a full mock-shape rework (9 existing tests + new shutdown/idempotency/forced-timeout/boot-abort/sequelize-close scenarios) alongside index.js shutdown orchestration, fakeHttpServer.js, and boot.integration.test.js. Combined estimate is likely at or over the 400-line budget even though the unit is one coupled deliverable per design (shutdown logic can't be split without breaking atomicity). Flagging for orchestrator decision before sdd-apply; size:exception may be needed if the estimate holds after drafting the diff.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| A | Readiness latch + `/health/*` routes, path-prefixed | PR 1 | `pnpm --filter backend test src/infrastructure/health` | `pnpm --filter backend dev` then `curl -i localhost:3031/health/live`, `/health/ready`, `/api/products` | Revert `readinessState.ts`, `health.ts`, `app.js` mount line, `index.js` `markReady()` calls |
| B | Server capture, signal-driven graceful shutdown, logger migration | PR 2 (bases on PR 1 after merge) | `pnpm --filter backend test src/__tests__/index.test.js` | `pnpm --filter backend test:integration -- boot.integration.test.js`; manual: start server, `kill -TERM <pid>`, confirm drain + exit | Revert `index.js` shutdown/logger changes, `fakeHttpServer.js`, `index.test.js` rework, `boot.integration.test.js`, `.env.example` entry — Unit A stays functional |

## Work Unit A: Health Contract

### Phase 1: Readiness Latch

- [x] A1.1 RED: `backend/src/infrastructure/health/__tests__/readinessState.test.ts` — assert `isReady()` defaults `false`; `markReady()`/`markUnready()` flip it.
- [x] A1.2 GREEN: create `backend/src/infrastructure/health/readinessState.ts` exporting `markReady`/`markUnready`/`isReady`, dependency-free, module-scope boolean.

### Phase 2: Health Routes

- [x] A2.1 RED: `backend/src/infrastructure/routes/__tests__/health.test.ts` — `/health/live` always 200; `/health/ready` 503 pre-`markReady()`, 200 after, body `{"status":"unavailable"}`/`{"status":"ok"}`, `Cache-Control: no-store` on both.
- [x] A2.2 RED (regression): same file — `GET /api/products` (via `app.js`, supertest) stays non-503 while `isReady()` is `false`.
- [x] A2.3 GREEN: create `backend/src/infrastructure/routes/health.ts` — Express `Router()`, `.get('/live')`, `.get('/ready')`, `no-store` header, reads `isReady()` only inside these two handlers.
- [x] A2.4 GREEN: mount in `backend/src/app.js` as `server.use('/health', healthRouter)` after `requestId`+`helmet`, before `requestLogger`/static/body-parsing. Never global middleware.

### Phase 3: Boot Wiring

- [x] A3.1 Add explicit `if (!process.env.JEST_WORKER_ID) require('ts-node/register');` guard at the top of `backend/index.js`, before any TS require.
- [x] A3.2 Require `readinessState` in `backend/index.js`; call `markReady()` in the `NODE_ENV=test` immediate-listen branch.
- [x] A3.3 Call `markReady()` in the full boot success path, inside the `server.listen()` callback after DB auth/migrate/seed resolve.

### Phase 4: Verification

- [x] A4.1 Run `pnpm --filter backend test src/infrastructure/health` — all RED tests pass GREEN.
- [x] A4.2 Manual: boot dev server, curl `/health/live`, `/health/ready` (before/after boot), `/api/products` — confirm contract and non-503 regression.

## Work Unit B: Lifecycle and Shutdown

### Phase 1: Test Harness

- [x] B1.1 Create `backend/src/__tests__/helpers/fakeHttpServer.js` — `createFakeHttpServer()` returns `{ app, server, flushClose }`; `server` extends `EventEmitter`; `close(cb)` stores callback without invoking; `closeIdleConnections`/`closeAllConnections`/`address()` stubs.

### Phase 2: Shutdown Implementation

- [x] B2.1 RED: rework `backend/src/__tests__/index.test.js` — replace `{ listen }` mock with `fakeHttpServer`-shaped mock; replace `console` spies with a `logger` module mock.
- [x] B2.2 RED: add scenarios — `SIGTERM`/`SIGINT` flips readiness immediately, drains via `close(cb)`, calls `closeIdleConnections()`; second signal during drain is a no-op (idempotent, no crash).
- [x] B2.3 RED: add scenarios — forced exit when `flushClose` never fires within `SHUTDOWN_TIMEOUT_MS=50`; signal received before `.listen()` resolves aborts boot with `exit(1)`; `db.sequelize.close()` called after drain completes.
- [x] B2.4 GREEN: in `backend/index.js`, capture `httpServer` from `server.listen(...)`; add module-level `let shuttingDown = false`.
- [x] B2.5 GREEN: implement `shutdown(signal)` — idempotency guard, `markUnready()`, arm forced timer at `max(0, SHUTDOWN_TIMEOUT_MS - 250)` (parse env, invalid/non-numeric falls back to `10000`), `httpServer.closeIdleConnections()`, `httpServer.close(cb)` → `db.sequelize.close()` → `exitAfterFlush(0)`; forced-timeout path → `closeAllConnections()`, log error, `exitAfterFlush(1)`.
- [x] B2.6 GREEN: implement `exitAfterFlush(code)` — log shutdown line via logger, `logger.flush(() => process.exit(code))` plus 250ms fallback timer.
- [x] B2.7 GREEN: register `SIGTERM`/`SIGINT` listeners; on signal before `httpServer` exists, abort boot and `process.exit(1)`.
- [x] B2.8 GREEN: replace remaining `console.log`/`console.error` in `backend/index.js` with the Pino `logger` (boot success/failure lines), log real `address().port`.
- [x] B2.9 Snapshot/restore `process.listeners('SIGTERM'|'SIGINT')` in `beforeEach`/`afterEach` of `index.test.js`; remove only newly added listeners, never `removeAllListeners`.

### Phase 3: Integration Smoke Test

- [x] B3.1 Create `backend/src/__tests__/boot.integration.test.js` — `spawn('node', ['index.js'], { env: { ...process.env, NODE_ENV: 'test', PORT: '0' } })` with `JEST_WORKER_ID` deleted, fixed argv, no shell; assert real ts-node/register path boots, `GET /health/ready` returns `200` once the process is listening (closes the spec's "Readiness set after trivial test-env boot" scenario, which has no other automated proof), and responds to `SIGTERM` with clean exit.
- [x] B3.2 Confirm filename matches `\.integration\.test\.(js|ts)$` so `backend/jest.config.js`'s `testPathIgnorePatterns` excludes it from `pnpm --filter backend test`/`test:fast`, and it runs only via `pnpm --filter backend test:integration` (`jest.integration.config.js`).

### Phase 4: Env Docs

- [x] B4.1 Add `SHUTDOWN_TIMEOUT_MS=10000` to `.env.example`.

### Phase 5: Verification

- [x] B5.1 Run `pnpm --filter backend test src/__tests__/index.test.js` — all scenarios GREEN.
- [x] B5.2 Run `pnpm --filter backend test:integration -- boot.integration.test.js` — real spawn exits cleanly on `SIGTERM`.
- [x] B5.3 Run full `pnpm --filter backend test:fast` — confirm no `/api/*` regressions and existing suites pass.

Checkbox task count: 27 (Unit A: 11; Unit B: 16).

Dependency boundary: Unit A fully ordered before Unit B — B's shutdown logic depends on A's readiness module and A's ts-node guard landing first.
