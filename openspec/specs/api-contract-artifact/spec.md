# API Contract Artifact Specification

## Purpose

The OpenAPI contract for `GET /api/openapi.json` is generated once from JSDoc annotations,
committed as a static artifact, and served from that artifact instead of being rebuilt on
every request — removing `swagger-jsdoc` from the request path while keeping the URL live.

## Requirements

### Requirement: Deterministic Build-Time Generation

A dev-only script MUST run the existing JSDoc-scan/spec-build logic exactly once per
invocation and write its result to a committed `openapi.json` artifact. Given unchanged
JSDoc annotations and route/schema source, repeated runs MUST produce byte-identical output
(stable key ordering, no timestamps or non-deterministic fields).

#### Scenario: Regeneration with no source changes is byte-identical

- GIVEN the JSDoc annotations and OpenAPI schema source are unchanged since the last commit
- WHEN the generation script runs again
- THEN the newly written `openapi.json` MUST be byte-identical to the previously committed file

#### Scenario: Regeneration after a source change reflects the update

- GIVEN a JSDoc annotation or route schema has been added, removed, or edited
- WHEN the generation script runs
- THEN the written `openapi.json` MUST reflect the updated paths/schemas
- AND it MUST NOT retain stale entries from the previous source state

### Requirement: Request-Path Isolation from the Generator

No code reachable from a live Express request (including `GET /api/openapi.json` itself)
MUST import or invoke `swagger-jsdoc`. Only the dev-only generation script MAY depend on it.

#### Scenario: Live route never imports the generator library

- GIVEN the application is running to serve requests
- WHEN any request-path module is loaded, including the `/api/openapi.json` route handler
- THEN `swagger-jsdoc` MUST NOT be `require`d or imported by that module or its transitive
  request-path dependencies

#### Scenario: Only the generation script is a reachable entry point to the generator library

- GIVEN a static analysis of the backend source tree
- WHEN identifying request-path-reachable entry points into `swagger-jsdoc` (directly or
  transitively, e.g. via `openapiSpec.ts`)
- THEN the dev-only generation script MUST be the only reachable entry point
- AND no module reachable from a live Express request MUST reach `swagger-jsdoc` through any
  import chain

### Requirement: Static-File Serving of the Committed Contract

`GET /api/openapi.json` MUST serve the committed, pre-generated `openapi.json` content and
MUST NOT execute the spec-building pipeline per request. The response MUST remain
unauthenticated and MUST preserve the existing response shape (a JSON OpenAPI 3.0 document).

#### Scenario: Route returns the committed artifact unchanged

- GIVEN a committed `openapi.json` artifact is present at process boot
- WHEN a client sends `GET /api/openapi.json`
- THEN the response MUST be `200` with the exact content of the committed artifact
- AND no per-request JSDoc scan or spec rebuild MUST occur

#### Scenario: Route remains unauthenticated

- GIVEN no credentials are supplied
- WHEN a client sends `GET /api/openapi.json`
- THEN the response MUST NOT be blocked by authentication or authorization middleware

### Requirement: Predictable Behavior on Missing Artifact

The system MUST handle a missing or unreadable committed `openapi.json` at boot or at
request time in one well-defined, deliberate way. The exact response (e.g. a `404` for the
route, or a startup failure) is an implementation decision left to `sdd-design`, but
whichever is chosen MUST be consistent, MUST NOT throw an unhandled exception that crashes
the process on a live request, and MUST be covered by an automated test.

#### Scenario: Missing artifact produces a defined, tested outcome

- GIVEN the committed `openapi.json` artifact is absent or unreadable at the location the
  route/boot sequence expects
- WHEN the application starts or a client sends `GET /api/openapi.json`
- THEN the system MUST respond with the single, documented behavior chosen by design
  (either a `404` on the route or a fail-loud startup error) and MUST NOT silently serve
  stale/partial data or crash with an unhandled exception

### Requirement: CI Drift Detection

CI MUST regenerate the OpenAPI artifact from source and hard-block the build if the
regenerated content differs from the committed `openapi.json`, consistent with existing
hard-block gates (`architecture:check`, `frontend:quality-check`).

#### Scenario: Committed artifact matches source — CI passes

- GIVEN the committed `openapi.json` was generated from the current JSDoc/schema source
- WHEN CI regenerates the artifact and compares it to the committed file
- THEN the comparison MUST succeed and the build MUST proceed

#### Scenario: Committed artifact is stale — CI fails

- GIVEN the committed `openapi.json` no longer matches a fresh regeneration from source
  (e.g. a JSDoc annotation changed without regenerating)
- WHEN CI regenerates the artifact and compares it to the committed file
- THEN CI MUST fail the build (hard-block, not a warning)
- AND the failure output MUST include the exact local regeneration command to fix it

### Requirement: Devtime-Only Dependency Placement

`swagger-jsdoc` and `@types/swagger-jsdoc` MUST be declared in `devDependencies`, not
`dependencies`, so `pnpm audit --prod` no longer reports advisories introduced by their
transitive dependency tree.

#### Scenario: Production audit excludes the generator's advisories

- GIVEN `swagger-jsdoc` and `@types/swagger-jsdoc` are declared in `devDependencies`
- WHEN `pnpm audit --prod` runs against the backend package
- THEN it MUST NOT report advisories originating solely from `swagger-jsdoc`'s dependency tree
