# Tasks: openapi-buildtime-spec

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~260-320 total (script ~55, handler ~35, index.ts ~5, package.json x2 ~10, ci.yml ~10, tests ~150-210) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Build-time generation script + committed artifact + loader/handler + route swap + CI gate + dep move, fully tested | PR 1 (single) | `pnpm --filter backend test src/infrastructure/openapi` | `pnpm --filter backend generate:openapi && pnpm --filter backend check:openapi`; then `curl localhost:PORT/api/openapi.json` against a locally started backend | Revert the single commit — restores live `buildOpenApiSpec()` call and original `dependencies` placement; no schema/data migration |

## Phase 1: Generation script (build-time, dev-only)

- [x] 1.1 RED: `backend/scripts/generate-openapi-spec.test.js` (node:test, mirrors `scripts/deploy/*.test.js` convention) — default mode writes `backend/openapi.json` with `JSON.stringify(spec, null, 2) + '\n'`; two consecutive runs with unchanged source produce byte-identical files. [Deterministic Build-Time Generation: Regeneration with no source changes is byte-identical]
- [x] 1.2 RED: same suite — after mutating a JSDoc annotation/route schema, regeneration reflects the change and drops stale entries. [Deterministic Build-Time Generation: Regeneration after a source change reflects the update]
- [x] 1.3 RED: same suite — `--check` mode makes no write, exits 0 when in-memory spec matches the committed file, exits 1 and prints the exact fix command (`pnpm --filter backend generate:openapi`) when it differs. [CI Drift Detection: both scenarios]
- [x] 1.4 GREEN: create `backend/scripts/generate-openapi-spec.js` — `require('ts-node/register')`, call `buildOpenApiSpec()`, serialize via `JSON.stringify(spec, null, 2) + '\n'`, default mode writes `backend/openapi.json`, `--check` mode compares in-memory only (no write) and exits 1 with the fix-command message on mismatch.
- [x] 1.5 Run `node backend/scripts/generate-openapi-spec.js` once to produce the initial committed `backend/openapi.json`; verify it is valid JSON and matches the current live spec shape (spot-check against `openapiSpec.test.ts` `EXPECTED_ENDPOINTS`).

## Phase 2: Static serving (runtime)

- [x] 2.1 RED: `backend/src/infrastructure/openapi/__tests__/openapiArtifact.test.ts` — `loadOpenApiArtifact('/nonexistent/path')` returns `null` (no throw). [Predictable Behavior on Missing Artifact]
- [x] 2.2 RED: same suite — `loadOpenApiArtifact(OPENAPI_ARTIFACT_PATH)` (real committed file) returns the exact file string. [Deterministic Build-Time Generation — loader reads committed bytes]
- [x] 2.3 RED: same suite — `createOpenApiRouteHandler(null)` responds `404` with a JSON error body, using a stub `res` (no `fs` mocking). [Predictable Behavior on Missing Artifact: Missing artifact produces a defined, tested outcome]
- [x] 2.4 RED: same suite — `createOpenApiRouteHandler(someJsonString)` responds `200`, `Content-Type: application/json`, body byte-equal to `someJsonString` (no `JSON.parse`/`stringify` round trip). [Static-File Serving of the Committed Contract: Route returns the committed artifact unchanged]
- [x] 2.5 GREEN: create `backend/src/infrastructure/openapi/openapiArtifact.ts` exporting `OPENAPI_ARTIFACT_PATH`, `loadOpenApiArtifact(artifactPath?)`, `createOpenApiRouteHandler(artifact?)` per the design's interface contract; loader uses `fs.readFileSync` (never `require`), path is a module-level constant derived only from `__dirname`, never from request input.
- [x] 2.6 GREEN: `backend/src/infrastructure/openapi/openapiArtifact.ts` — module-load call reads `backend/openapi.json` once via `loadOpenApiArtifact(OPENAPI_ARTIFACT_PATH)`; on `null`, emit one `logger.warn` at boot (no throw).
- [x] 2.7 GREEN: modify `backend/src/infrastructure/routes/api/index.ts` — replace `import { buildOpenApiSpec } from '../../openapi/openapiSpec'` with `import { createOpenApiRouteHandler } from '../../openapi/openapiArtifact'`; replace the inline `router.get('/openapi.json', ...)` body with `router.get('/openapi.json', createOpenApiRouteHandler());`.
- [x] 2.8 RED: rewrite `backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts:132-141` — `GET /api/openapi.json` through real `app.js` returns `200` with body deep-equal to `JSON.parse(fs.readFileSync('backend/openapi.json'))`, unauthenticated (no cookie/header). [Static-File Serving of the Committed Contract: Route remains unauthenticated]
- [x] 2.9 RED: new dedicated test asserting the request path never loads `swagger-jsdoc` — require only `../../../app` and assert no `swagger-jsdoc` entry in Jest's module registry (or, if not introspectable, assert `routes/api/index.ts` source contains no `swagger-jsdoc`/`openapiSpec` import). [Request-Path Isolation from the Generator: both scenarios]
- [x] 2.10 GREEN: confirm 2.8-2.9 pass with the Phase 2 wiring; no further production change expected (this locks in isolation already achieved by 2.7).

## Phase 3: Dependency placement, scripts, CI gate

- [x] 3.1 Modify `backend/package.json` — move `"swagger-jsdoc": "6.3.0"` from `dependencies` to `devDependencies`; add `"generate:openapi": "node scripts/generate-openapi-spec.js"` and `"check:openapi": "node scripts/generate-openapi-spec.js --check"` scripts.
- [x] 3.2 Modify root `package.json` — add `"check:openapi": "pnpm --filter backend check:openapi"` script.
- [x] 3.3 Modify `.github/workflows/ci.yml` — add a `quality` job step named "Check OpenAPI spec is up to date" running `pnpm run check:openapi`, placed directly after "Check architecture boundaries".
- [x] 3.4 Run `pnpm audit --prod --filter backend` (or equivalent) to confirm the 5 HIGH `swagger-jsdoc`-originated advisories no longer appear. [Devtime-Only Dependency Placement: Production audit excludes the generator's advisories]

## Phase 4: Verification / cleanup

- [x] 4.1 Run `pnpm --filter backend test src/infrastructure/openapi` — confirm `openapiSpec.test.ts`, `openapiArtifact.test.ts` all green.
- [x] 4.2 Run `node --test backend/scripts/generate-openapi-spec.test.js` (or the project's equivalent runner) — confirm both default and `--check` mode tests green.
- [x] 4.3 Run `pnpm run check:openapi` locally — confirm it passes against the freshly committed `backend/openapi.json` (no drift).
- [x] 4.4 Run `pnpm --filter backend architecture:check` — confirm the `routes/api/index.ts` composition-root allowlist still passes with the new import (no allowlist edit expected per design).
- [x] 4.5 Confirm no leftover `console.log`/dead code in the new script and handler files; confirm both stay under the 250-line cap.

## Notes

- Order is strict within each phase (RED before GREEN); Phase 1 must land before Phase 2 (the committed artifact must exist before the loader/handler tests can read it); Phase 3's dependency move must land after Phase 2 confirms `swagger-jsdoc` is unreachable from the request path.
- Threat matrix: only "Documentation-like paths" is applicable, covered by tasks 2.1-2.5 (loader never `require`s, path never derived from request input). All other threat-matrix rows are N/A (no git/commit/push/PR operations in this change).
- Non-goals (no tasks): OpenAPI schema/content changes, Swagger UI, `render.yaml` changes, pruning devDependencies from the production install.
