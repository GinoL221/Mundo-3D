# Design: Runtime Resilience

## Technical Approach

A dependency-free readiness latch bridges `index.js` (writer) and `app.js` (reader). Unit A adds the latch plus a path-prefixed `/health` router. Unit B captures the `http.Server`, adds idempotent signal-driven shutdown, and swaps `console` for the Pino logger. Nothing is registered as global middleware and no `/api/*` behavior changes.

## Architecture Decisions

### Decision: Forced-shutdown timeout is env-configurable

| Option | Tradeoff | Verdict |
|---|---|---|
| Hardcoded `10_000` | Magic number; retuning needs a code change + deploy; tests must wait 10s or use fake timers | Rejected |
| `SHUTDOWN_TIMEOUT_MS` env, default `10000` | ~6 lines + `.env.example` entry | **Chosen** |
| Config-object plumbing | New surface for one scalar | Rejected |

**Rationale**: the orchestrator's own kill deadline (`terminationGracePeriodSeconds`, `docker stop -t`) is external, so the app deadline must be tunable *below* it without a rebuild. Secondary win: tests set `SHUTDOWN_TIMEOUT_MS=50` instead of manipulating timers. Parsed once at module scope; non-finite or non-positive values fall back to the default rather than disabling the guard.

### Decision: Minimal, extensible JSON body

| Endpoint | Success | Failure |
|---|---|---|
| `GET /health/live` | `200 { "status": "ok" }` | — (200 whenever the process answers) |
| `GET /health/ready` | `200 { "status": "ok" }` | `503 { "status": "unavailable" }` |

Both send `Cache-Control: no-store`. **Rationale**: the status code is the contract; the body is for humans running `curl`. Rejected `204 No Content` (undebuggable) and a rich `{ checks[], uptime, version }` shape — readiness is a latch, so there are no per-dependency results to report and inventing them would misrepresent state.

### Decision: Readiness is a latch, never a module-level env default

`readinessState` always initialises to `false`. The `NODE_ENV=test` "ready immediately" behavior lives in `index.js`'s test branch (`markReady()` before `listen`), not in the module. **Rationale**: an env-based default would make the 503 path untestable and would hide real boot state. Route tests drive the latch with the real `markReady()`/`markUnready()` functions, so no `__resetForTests` back door is needed.

### Decision: Fake `http.Server` as a controllable EventEmitter

`backend/src/__tests__/helpers/fakeHttpServer.js` exports `createFakeHttpServer()` returning `{ app, server, flushClose }`:

```js
// server extends EventEmitter
app.listen(port, cb)          // jest.fn — calls cb() synchronously, RETURNS server
server.close(cb)              // jest.fn — stores cb; does NOT call it
server.closeIdleConnections() // jest.fn
server.closeAllConnections()  // jest.fn
server.address()              // () => ({ port })
flushClose(err)               // test-driven: invokes the stored close cb
```

**Rationale**: today's `{ listen }` mock returns `undefined`, which is precisely why nothing can be captured. `close` must be *deferred* rather than auto-resolving, because the forced-timeout branch is only reachable while a close is still pending. Rejected a real `http.createServer()` (binds a socket, adds port-collision flake) and `jest.mock('http')` (mocks a core module the Express app itself needs).

## Data Flow

```
boot ok ──→ markReady() ──→ readinessState(true)
                                  ↑ read
                        GET /health/ready ──→ 200

SIGTERM ─┬─ shuttingDown? ──yes──→ log warn, return        (idempotent)
         └─ no ──→ shuttingDown = true
                     │
                     ├─ httpServer === null ──→ bootAborted = true, exit(1)
                     │
                     └─ markUnready()            → /health/ready now 503
                        arm timer(drainDeadline) → forced path
                        httpServer.close(cb)
                        httpServer.closeIdleConnections()
                             │                      │
                        close cb fires          deadline hit
                             │                      │
                        sequelize.close()      closeAllConnections()
                        clearTimeout           log error
                             │                      │
                        exitAfterFlush(0) ←─────────┴──→ exitAfterFlush(1)
```

`closeIdleConnections()` is mandatory: without it, idle keep-alive sockets keep `close()` pending until the client disconnects, so the forced timeout fires on *every* shutdown. Node `>=22.12` supports it.

## Resolved Risks

| Risk | Resolution |
|---|---|
| Global-middleware readiness trap | Mount as `server.use('/health', healthRouter)` with `router.get('/live'\|'/ready')` — a **path-prefixed** mount Express never enters for `/api/*` or static. No bare `router.use` gate anywhere. Discharged by an explicit regression test: `GET /api/products` returns non-503 while `isReady()` is `false`. `appConfig.test.js` is provably untouched. |
| `ts-node/register` ordering | `index.js` gets its own copy of `app.js`'s guard (`if (!process.env.JEST_WORKER_ID) require('ts-node/register')`) at the top, before any TS require. It no longer depends on `require('./src/app')` running first, so reordering cannot break `pnpm start`. Rejected a shared `tsRuntime.js` module: 3 duplicated lines cost less than a new file that the architecture checker and coverage scope both have to account for, and the duplicate is self-sufficient so drift is harmless. Proven by `boot.integration.test.js`, which spawns real `node index.js` with `JEST_WORKER_ID` deleted — the only way to exercise a path `ts-jest` never takes. |
| Pino worker flush truncation | Every shutdown line is logged **before** any exit. Exit goes through `exitAfterFlush(code)` = `logger.flush(() => process.exit(code))` plus a `FLUSH_GRACE_MS` (250ms) fallback timer, because `flush(cb)` is not guaranteed to fire on a transport-less destination. The drain timer is armed at `max(0, SHUTDOWN_TIMEOUT_MS - FLUSH_GRACE_MS)`, so the flush window is carved **out of** the budget, never added to it; worst-case wall clock stays `SHUTDOWN_TIMEOUT_MS`. |
| Idempotency | Module-level `let shuttingDown = false` in `index.js`, checked and set at the top of `shutdown(signal)`. Deliberately **not** `!isReady()`: that conflates "shutting down" with "not yet booted". A second signal logs `warn` and returns — no second `close()`, no re-armed timer. |

## File Changes

| File | Action | Unit |
|---|---|---|
| `backend/src/infrastructure/health/readinessState.ts` | Create — `markReady`, `markUnready`, `isReady` | A |
| `backend/src/infrastructure/routes/health.ts` | Create — Express Router, `.get('/live')`, `.get('/ready')` | A |
| `backend/src/app.js` | Modify — `server.use('/health', healthRouter)` after `requestId`+`helmet`, **before** `requestLogger`/static/body-parsing (probes must not spam logs or parse bodies) | A |
| `backend/index.js` | Modify — explicit ts-node guard; `markReady()` in both success paths | A |
| `backend/src/infrastructure/health/__tests__/readinessState.test.ts` | Create | A |
| `backend/src/infrastructure/routes/__tests__/health.test.ts` | Create — includes the no-global-gate regression | A |
| `backend/index.js` | Modify — capture `httpServer`, signals, `shutdown()`, `exitAfterFlush()`, `console`→`logger`, log real `address().port` | B |
| `backend/src/__tests__/helpers/fakeHttpServer.js` | Create | B |
| `backend/src/__tests__/index.test.js` | Modify — logger mock replaces console spies; fake server; shutdown scenarios | B |
| `backend/src/__tests__/boot.integration.test.js` | Create — spawn smoke, `NODE_ENV=test`, `PORT=0` | B |
| `.env.example` | Modify — `SHUTDOWN_TIMEOUT_MS=10000` | B |

## Interfaces

```ts
// backend/src/infrastructure/health/readinessState.ts
export function markReady(): void;
export function markUnready(): void;
export function isReady(): boolean;
```

Consumed from CommonJS as `require('./src/infrastructure/health/readinessState')` — named exports land directly on the module object under ts-node, matching how `app.js` already consumes TS infra.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Latch transitions | Direct calls; default `false` asserted |
| Unit | `shutdown()` idempotency, forced timeout, boot-abort, sequelize close, logger calls | `fakeHttpServer` + `SHUTDOWN_TIMEOUT_MS=50` + `process.emit('SIGTERM')` |
| Integration | Both endpoints, status codes, body, `no-store`, no global gate | supertest against `app.js` |
| Integration | ts-node ordering + real SIGTERM exit code | `child_process.spawn` with `JEST_WORKER_ID` removed |

**Test gotchas to carry into tasks**: (1) `process` is global, so each `require('../../index')` adds signal listeners — snapshot `process.listeners('SIGTERM'\|'SIGINT')` in `beforeEach` and remove only the newly added ones in `afterEach`; never `removeAllListeners` (it would strip Jest's own handlers). (2) `process.exit` is spied to a no-op, so shutdown code must `return` immediately after every `exitAfterFlush` call or tests will run past the exit point. (3) `logger` is `silent` under `NODE_ENV=test`, so assert on a `jest.mock` of the logger module, not on stdout.

## Threat Matrix

The change adds HTTP routing and process-signal integration, but no row of the reference matrix applies.

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification or execution of repo content |
| Git repository selection | N/A — no VCS invocation |
| Commit state | N/A — no index/worktree interaction |
| Push state | N/A — no remote operation |
| PR commands | N/A — no PR automation |

The one subprocess introduced (`spawn('node', ['index.js'])` in `boot.integration.test.js`) takes a fixed argv array with no user or environment-derived interpolation and no shell, so no argument-composition boundary exists.

## Migration / Rollout

No migration. Both units are additive and independently revertible; no schema, data, or `/api/*` contract is touched. `SHUTDOWN_TIMEOUT_MS` is optional with a safe default, so existing `.env` files keep working unchanged.

## Open Questions

None — all three proposal open decisions are resolved above.
