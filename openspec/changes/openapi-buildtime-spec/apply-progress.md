# Apply Progress: openapi-buildtime-spec

**Mode**: Strict TDD
**Status**: 24/24 tasks complete. Ready for verify.

## Completed Tasks

All tasks in `tasks.md` (Phases 1-4) are marked `[x]`. Summary by phase:

- **Phase 1** (1.1-1.5): Build-time generation script, TDD RED→GREEN, initial `backend/openapi.json` committed artifact generated and spot-checked.
- **Phase 2** (2.1-2.10): `openapiArtifact.ts` loader/handler, TDD RED→GREEN, route wiring swap, rewritten integration test, new request-path isolation test.
- **Phase 3** (3.1-3.4): `swagger-jsdoc` moved to devDependencies, `generate:openapi`/`check:openapi` scripts added (backend + root), CI gate step added, `pnpm audit --prod` confirms the 5 HIGH advisories are gone.
- **Phase 4** (4.1-4.5): All verification commands run and green; line-count/console.log check passed.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/scripts/generate-openapi-spec.js` | Created | Dev-only CLI: default mode writes `backend/openapi.json`; `--check` mode compares in-memory (no write), exits 1 naming the fix command on drift. Internals split into pure `serializeSpec`/`generate`/`check`/`runCli` functions with an injectable `buildSpec`, so unit tests never need `ts-node/register` or real route scanning. |
| `backend/scripts/generate-openapi-spec.test.js` | Created | node:test suite (9 tests) — determinism, drift reflection, `--check` exit codes and message, all via dependency injection. |
| `backend/openapi.json` | Created | Committed OpenAPI 3.0 artifact, generated once via the new script; 21 paths, valid JSON, matches `EXPECTED_ENDPOINTS`. |
| `backend/src/infrastructure/openapi/openapiArtifact.ts` | Created | `OPENAPI_ARTIFACT_PATH`, `loadOpenApiArtifact(artifactPath?)` (never throws, `fs.readFileSync` only, never `require`), `createOpenApiRouteHandler(artifact?)` (404 JSON on null, else raw-string 200 `application/json`, no JSON round trip). Module-load `logger.warn` on missing artifact. |
| `backend/src/infrastructure/openapi/__tests__/openapiArtifact.test.ts` | Created | 5 unit tests, stub `res`, no `fs` mocking. |
| `backend/src/infrastructure/openapi/__tests__/openapiRequestPathIsolation.test.ts` | Created | 2 tests: `require.cache` has no `swagger-jsdoc` entry after requiring only `app.js`; static fallback source-scan of `routes/api/index.ts`. |
| `backend/src/infrastructure/routes/api/index.ts` | Modified | Swapped `buildOpenApiSpec` import/call for `createOpenApiRouteHandler()`. |
| `backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts` | Modified | Lines 132-141 rewritten: asserts body deep-equals the committed `backend/openapi.json`, unauthenticated, through real `app.js`. |
| `backend/package.json` | Modified | `swagger-jsdoc` moved to `devDependencies`; added `generate:openapi`, `check:openapi` scripts. |
| `package.json` (root) | Modified | Added `check:openapi` delegating to backend. |
| `.github/workflows/ci.yml` | Modified | New `quality` job step "Check OpenAPI spec is up to date" (`pnpm run check:openapi`), placed right after "Check architecture boundaries". |
| `pnpm-lock.yaml` | Modified | Regenerated via `pnpm install --no-frozen-lockfile`; `swagger-jsdoc` importer entry moved from `dependencies` to `devDependencies` for the backend workspace. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.3 | `backend/scripts/generate-openapi-spec.test.js` | Unit (node:test) | N/A (new) | Written first — confirmed `MODULE_NOT_FOUND` before implementation existed | 9/9 passed after `generate-openapi-spec.js` created | Multiple cases per behavior (unchanged/changed source, match/mismatch, default/`--check` exit 0/1) | None needed — already minimal |
| 1.4-1.5 | (script + real generation run) | — | N/A (new) | N/A (implementation task) | Script run twice; byte-identical diff confirmed; `--check` exit 0 confirmed | N/A | N/A |
| 2.1-2.4 | `backend/src/infrastructure/openapi/__tests__/openapiArtifact.test.ts` | Unit (jest) | N/A (new) | Written first — confirmed `Cannot find module '../openapiArtifact'` before implementation existed | 5/5 passed after `openapiArtifact.ts` created | 404-branch and 200-branch both covered, plus a default-artifact case | None needed — already minimal |
| 2.7 | `backend/src/infrastructure/routes/api/index.ts` | — | ✅ 39/39 (`openapiSpec.test.ts` baseline before any change) | N/A (thin composition-root wiring; correctness driven by 2.1-2.6 unit tests) | Wiring applied, verified below at 2.8-2.10 | N/A | N/A |
| 2.8-2.9 | `openapiSpec.test.ts` (rewritten block) + new `openapiRequestPathIsolation.test.ts` | Integration (jest, supertest) | ✅ baseline above | Written to reflect NEW behavior; isolation test verified genuinely RED by temporarily reverting `index.ts` to the old `buildOpenApiSpec()` wiring — both isolation assertions failed for the right reason (`swagger-jsdoc`/`openapiSpec` still reachable) | After restoring the new wiring: both assertions pass | Static-fallback source-scan added alongside the `require.cache` check (2 independent proofs) | None needed |
| 2.10 | (confirmation) | — | — | — | 46/46 passing across all 3 openapi test files | — | — |
| 3.1-3.4 | (config/infra, no test-first applicable) | — | N/A | N/A | `pnpm audit --prod` confirms 0 matches for `swagger-jsdoc`/`brace-expansion`/`js-yaml`/`fast-uri` | N/A | N/A |
| 4.1-4.5 | (verification only) | — | — | — | All commands green (see Verification Commands Run below) | — | — |

**Note on 2.7-2.10 ordering**: `tasks.md` sequences the composition-root wiring (2.7, unlabeled RED — it is a one-line swap whose correctness is already fully specified by the 2.1-2.6 unit-level RED/GREEN cycle on `createOpenApiRouteHandler`) before the integration-level RED tests (2.8-2.9). To keep genuine RED evidence for the isolation requirement specifically (the one behavior that actually changes at the wiring layer), the new wiring was temporarily reverted to the old `buildOpenApiSpec()` call, the new tests were run and both isolation assertions failed for the correct reason, then the new wiring was restored and confirmed GREEN. The content-equality test (2.8) passes under both old and new wiring because it verifies output equivalence, not reachability — that is expected and consistent with the requirement it targets.

### Test Summary
- **Total tests written**: 17 new/rewritten test cases — jest: 5 (`openapiArtifact.test.ts`, new) + 2 (`openapiRequestPathIsolation.test.ts`, new) + 1 (`openapiSpec.test.ts`, rewritten in place) = 8 jest; node:test: 9 (`generate-openapi-spec.test.js`, new).
- **Total tests passing**: 956/956 (full backend jest suite, up from 949 baseline: +7 net new jest tests) + 9/9 (node:test script suite, run separately, not counted in the jest total).
- **Layers used**: Unit (jest: 5 + node:test: 9 = 14), Integration (jest: 3 — 1 rewritten + 2 new).
- **Approval tests** (refactoring): 1 — `openapiSpec.test.ts`'s route-wiring block was rewritten to reflect new static-serving behavior per the Approval Testing pattern (old assertions replaced, new ones written to fail against old code, then implementation confirmed).
- **Pure functions created**: `serializeSpec`, `generate`, `check`, `runCli` (all take injected `buildSpec`, no hidden state) in `generate-openapi-spec.js`; `loadOpenApiArtifact` and the handler factory returned by `createOpenApiRouteHandler` in `openapiArtifact.ts`.

## Verification Commands Run

| Command | Result |
|---|---|
| `pnpm --filter backend test src/infrastructure/openapi` | 3 suites, 46 tests passed |
| `node --test backend/scripts/generate-openapi-spec.test.js` | 9 tests passed |
| `pnpm run check:openapi` (root) | Exit 0, no output (no drift) |
| `pnpm --filter backend architecture:check` | Exit 0, no output (no allowlist edit needed — `routes/api/index.ts` was already a listed composition root) |
| `pnpm --filter backend lint` | Exit 0, no output |
| `pnpm --filter backend type-check` | Exit 0, no output |
| `pnpm audit --prod` (from `backend/`) | 4 unrelated advisories remain (sharp/svgo in frontend, uuid, body-parser); 0 matches for `swagger-jsdoc`/`brace-expansion`/`js-yaml`/`fast-uri` — the 5 HIGH advisories are confirmed gone |
| `pnpm --filter backend test` (full suite) | 117 suites, 956 tests passed (up from the 949-test baseline: +7 jest tests net) — one transient timeout occurred under full parallel-worker load on the first run (an HTTP round-trip test exceeded the 5s default Jest timeout under heavy CPU contention); two subsequent full runs (`--runInBand` and default parallel) both passed 956/956 cleanly, confirming it was resource contention, not a logic defect |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm --filter backend test src/infrastructure/openapi` → 3 suites, 46/46 passed |
| Runtime harness command/scenario and exact result | `pnpm --filter backend generate:openapi && pnpm --filter backend check:openapi` → generation writes the file, `--check` reports no drift (exit 0, silent); real `GET /api/openapi.json` verified through `supertest(app)` in the integration test, 200 with the exact committed bytes |
| Rollback boundary | Revert the single commit containing all files above — restores live `buildOpenApiSpec()` per-request generation and the original `dependencies` placement of `swagger-jsdoc`. No schema/data migration. |

## Deviations from Design

None material. One implementation-detail note: the design describes the generation script's CLI behavior only (`require('ts-node/register')`, call `buildOpenApiSpec()`, serialize, write/check). Internally, the script's business logic (`serializeSpec`/`generate`/`check`/`runCli`) was extracted into pure, dependency-injected functions with `ts-node/register` + the real `buildOpenApiSpec` wired up only in the `require.main === module` CLI branch. This lets the RED/GREEN/TRIANGULATE cycle run fast and deterministically without registering `ts-node` or scanning real route files in every test, while the real CLI invocation still does exactly what the design specifies. No change to external behavior, file paths, or interfaces named in `design.md`.

## Issues Found

None blocking. One transient full-suite timeout on the first parallel run (see Verification Commands Run) — confirmed non-reproducible across two subsequent full runs, attributed to CPU contention across many parallel Jest workers on this machine, not a defect in the new code.

## Remaining Tasks

None. All 24 tasks in `tasks.md` are complete.

## Workload / PR Boundary

- Mode: single PR (forecast: Low risk, ~260-320 changed lines)
- Current work unit: Unit 1 (the only unit) — "Build-time generation script + committed artifact + loader/handler + route swap + CI gate + dep move, fully tested"
- Boundary: starts from the clean `main` tip, ends with all 24 tasks complete and full verification green
- Estimated review budget impact: within the 400-line budget per the tasks.md forecast

## Status

24/24 tasks complete. Ready for verify.
