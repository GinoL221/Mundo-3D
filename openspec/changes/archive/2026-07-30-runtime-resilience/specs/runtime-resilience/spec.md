# Runtime Resilience Specification

## Purpose

Defines liveness, readiness, and graceful-shutdown contracts for the backend process, so an operator or orchestrator can distinguish "process alive" from "process able to serve", and so restarts/deploys drain in-flight requests instead of dropping them.

## Requirements

### Requirement: Liveness Endpoint

`GET /health/live` MUST return HTTP 200 whenever the process is up and listening, with zero dependency checks (no DB, no downstream calls).

#### Scenario: Live once listening
- GIVEN the process has completed `.listen()`
- WHEN `GET /health/live` is called
- THEN the response MUST be HTTP 200

#### Scenario: Live regardless of dependency health
- GIVEN the database is unreachable
- WHEN `GET /health/live` is called
- THEN the response MUST still be HTTP 200

### Requirement: Readiness Endpoint (Latch-Only)

`GET /health/ready` MUST return HTTP 503 until a boot-completion latch is set (DB auth, migration validation, and seed all succeeded), then HTTP 200. The latch MUST be set once at boot completion and MUST NOT be re-evaluated against the database on each request.

#### Scenario: Not ready before boot completes
- GIVEN the boot-completion latch has not yet been set
- WHEN `GET /health/ready` is called
- THEN the response MUST be HTTP 503

#### Scenario: Ready in steady state
- GIVEN the boot-completion latch was set
- WHEN `GET /health/ready` is called
- THEN the response MUST be HTTP 200
- AND no live database check MUST occur as part of answering the request

### Requirement: Test Environment Readiness

When `NODE_ENV=test`, `index.js`'s boot sequence completes without database gating (no DB auth, migration check, or seed step blocks it), so the latch is set immediately once that trivial boot path runs — consistent with the latch-only semantics above, not an exception to them. A test that exercises `app.js` directly, without executing `index.js`'s boot sequence, correctly observes an unset latch; that is expected, not a defect, because readiness state is read only inside the dedicated health routes (see Route-Scoped Readiness State) and does not affect any other route's behavior.

#### Scenario: Readiness set after trivial test-env boot
- GIVEN `NODE_ENV=test`
- WHEN `index.js`'s boot sequence runs and `.listen()` resolves successfully
- THEN the readiness latch MUST be set immediately, with no database check required first

#### Scenario: Unset latch when boot never ran
- GIVEN `NODE_ENV=test`
- AND `index.js`'s boot sequence has not executed (e.g. a test requires `app.js` directly)
- WHEN `GET /health/ready` is called
- THEN the response MUST be HTTP 503, consistent with the latch-only semantics defined above

### Requirement: Route-Scoped Readiness State

Readiness state MUST be read only inside the dedicated health routes. It MUST NOT be implemented as global gating middleware applied to other routes.

#### Scenario: Existing API routes unaffected
- GIVEN the readiness latch is unset (not ready)
- WHEN a request is made to an existing `/api/*` route
- THEN that route's response MUST be unaffected by readiness state

### Requirement: Graceful Shutdown on Termination Signals

On receiving `SIGTERM` or `SIGINT`, the process MUST immediately flip the readiness latch to not-ready, stop accepting new connections, drain in-flight requests, close the Sequelize connection, then exit.

#### Scenario: Readiness flips immediately on signal
- GIVEN the process is ready and serving
- WHEN `SIGTERM` or `SIGINT` is received
- THEN `GET /health/ready` MUST return HTTP 503 immediately, before drain completes

#### Scenario: In-flight requests drained before exit
- GIVEN a request is in flight when the shutdown signal is received
- WHEN shutdown proceeds
- THEN the in-flight request MUST complete before the process exits
- AND no new connections MUST be accepted during drain

#### Scenario: Sequelize closed on shutdown
- GIVEN the shutdown sequence completes the drain
- WHEN the process is about to exit
- THEN the Sequelize connection MUST be closed cleanly

### Requirement: Forced Shutdown Timeout

If graceful drain has not completed within 10 seconds of signal receipt, the process MUST force-exit rather than hang.

#### Scenario: Forced exit after timeout
- GIVEN drain has not completed 10 seconds after signal receipt
- WHEN the timeout elapses
- THEN the process MUST force-exit

### Requirement: Idempotent Shutdown Handling

A second or later `SIGTERM`/`SIGINT` received while shutdown is already in progress MUST NOT re-run the shutdown sequence or crash the process.

#### Scenario: Repeated signal during drain is a no-op
- GIVEN a shutdown sequence is already in progress
- WHEN another `SIGTERM` or `SIGINT` is received
- THEN the shutdown sequence MUST NOT restart
- AND the process MUST NOT crash

### Requirement: Signal Received Mid-Boot

If `SIGTERM`/`SIGINT` is received before `.listen()` has resolved (no `http.Server` exists yet), boot MUST abort and the process MUST exit with code 1, without attempting to drain a server that doesn't exist.

#### Scenario: Signal during boot aborts cleanly
- GIVEN the process has received a shutdown signal before `.listen()` resolved
- WHEN boot logic would otherwise proceed to `.listen()`
- THEN boot MUST abort
- AND the process MUST exit with code 1
