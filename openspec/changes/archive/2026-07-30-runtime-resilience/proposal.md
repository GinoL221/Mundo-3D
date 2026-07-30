# Proposal: Runtime Resilience

## Intent

The backend has no liveness, readiness, or shutdown semantics: no health route exists, no `SIGTERM`/`SIGINT` handler exists, and `backend/index.js` discards the `http.Server` returned by `server.listen()`, so nothing can close it. A restart or deploy therefore drops in-flight requests and leaves the Sequelize pool open, and no orchestrator can tell "process alive" from "process able to serve". Operators currently have no signal to gate traffic on.

## Scope

### In Scope — Work Unit A (health contract)

- Dependency-free readiness state module (boot writes, routes read).
- `GET /health/live` — 200 whenever the process is up, no dependency check.
- `GET /health/ready` — 200 when boot completed, 503 otherwise.
- Routes read state; readiness is route-scoped, never global middleware.
- `NODE_ENV=test`: ready immediately, no DB gating.

### In Scope — Work Unit B (lifecycle and shutdown)

- Capture the `http.Server` from `.listen()` (required prerequisite fix).
- `SIGTERM`/`SIGINT` handling, idempotent under repeated signals.
- Flip readiness to 503 at signal receipt, stop new connections, drain in-flight, close Sequelize, forced-close timeout (10s initial value).
- Signal during boot: abort boot, exit 1 (no server to close yet).
- `console.log`/`console.error` → existing Pino logger in `backend/index.js`, with the required rework of `backend/src/__tests__/index.test.js` console-spy assertions.

### Out of Scope

- Cart, catalog, and auth code or behavior.
- Product/API contract changes; `/api/*` responses unchanged.
- Kubernetes-style paths (`/livez`, `/readyz`): no consumer requires them; REST-style matches existing route conventions.
- `backend/src/database/seed.js` console calls — `structured-logging` requires CLI scripts to keep native `console`.
- Running migrations, seeds, or any live-DB operation while building this change.
- A backend `docker-compose.yml` healthcheck.

## Capabilities

### New Capabilities

- `runtime-resilience`: liveness, readiness, and graceful-shutdown contracts.

### Modified Capabilities

- `structured-logging`: extend the console→logger migration to the boot entrypoint `backend/index.js`; the CLI-script exclusion stays intact.

## Approach

Two sequential work units, one PR each. A is near-zero risk (pure addition, one state flip in the success path) and can merge alone. B holds every hard part — timers, signal races, idempotency, test rework — and gets undivided review attention. Split also keeps each PR inside the 400-line budget; `ask-on-risk` applies if either unit forecasts over.

## Affected Areas

| Area | Impact | Unit |
|---|---|---|
| readiness state module (new) | New | A |
| `backend/src/app.js` | Modified — health routes | A |
| `backend/index.js` | Modified — capture server, signals, logger | B |
| `backend/src/__tests__/index.test.js` | Modified — logger spies, server-shaped mock | B |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Global readiness gate 503s every `appConfig.test.js` route | Med | Route-scoped only; explicit "do not do this" in design |
| `ts-node/register` ordering — logger require before `./src/app` breaks `pnpm start` while tests pass | Med | Design pins require order or registers explicitly |
| Forced exit truncates pino-pretty worker flush | Low | Keep timeout generous; design notes flush window |
| Readiness is unobservable until Unit B ships | Low | Accepted; A still merges independently |

## Rollback Plan

Revert per unit. Reverting B restores the pre-change boot script and its tests, leaving A's endpoints functional. Reverting A removes two additive routes and the state module. No data, schema, or product contract is touched by either revert.

## Dependencies

- Unit B depends on Unit A's readiness state module.
- Existing `logger`, `db.sequelize`, and Jest suites are the baseline; no new runtime dependency.

## Success Criteria

- [ ] `GET /health/live` returns 200 once the process is listening.
- [ ] `GET /health/ready` returns 503 before boot completes and during shutdown, 200 otherwise.
- [ ] `SIGTERM`/`SIGINT` drains in-flight requests, closes Sequelize, and exits without dropped connections.
- [ ] Repeated signals do not re-run shutdown or crash.
- [ ] Existing suites still pass; no `/api/*` behavior changed.
- [ ] Each unit stays under 400 authored changed lines, or is flagged before apply.

## Open Decisions for Design

- Forced-timeout configurability: hardcoded 10s vs. env var.
- Exact JSON response body shape for both endpoints.
- Mock shape for `http.Server` in the reworked `index.test.js`.

## Relationship to the Umbrella

Sequence 2 of `gentleman-alignment-program`, following `verification-baseline-and-ci-gates`.
