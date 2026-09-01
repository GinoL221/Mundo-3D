# Design: openapi-buildtime-spec

## Technical Approach

Split the OpenAPI contract into **generation** (dev-only) and **serving** (runtime). `openapiSpec.ts` keeps `buildOpenApiSpec()` unchanged but loses its runtime caller; a new plain-Node script becomes its only caller and writes the committed `backend/openapi.json`. A new `openapiArtifact.ts` reads that file once at module load and supplies the route handler. `swagger-jsdoc` therefore never loads in the Express process.

## Architecture Decisions

### Decision: commit location = `backend/openapi.json`

**Choice**: backend package root, sibling of `backend/package.json`. Committed, not gitignored.
**Alternatives considered**: repo root, `docs/`, `backend/generated/`.
**Rationale**: the file is read at runtime by backend code, so it must stay inside the backend workspace package. `openapiSpec.ts:12` already resolves `backend/package.json` via `path.join(__dirname,'..','..','..')`, which lands identically from `src/infrastructure/openapi/` and `dist/infrastructure/openapi/`; `backend/openapi.json` reuses that exact resolution — no new mechanism, no `process.cwd()` dependency. `docs/` holds human prose (`RUNBOOKS.md` only) and would place a runtime-read file outside the package; repo root is the same boundary break plus workspace ambiguity; `backend/generated/` invents a directory whose name invites a future `.gitignore` entry for a file that must stay committed. This is the repo's **first** committed generated artifact — `backend/coverage/` is gitignored because it is CI-uploaded evidence, not something production serves.

### Decision: missing artifact ⇒ 404 + boot warn, not fail-loud

**Choice**: `loadOpenApiArtifact()` returns `null` on read failure; route answers `404 {"error": ...}`; `logger.warn` fires once at boot.
**Alternatives considered**: throw at module load (the `app.js:1-12` pattern); silent 404.
**Rationale**: `app.js`'s throws guard *security* invariants where a silent fallback is dangerous — missing `JWT_SECRET` means insecure auth, missing `CORS_ORIGIN` silently denies every real origin. A missing documentation artifact endangers nothing. Throwing would take products/cart/orders/auth down over a zero-consumer docs file: the guard's cost (total outage) far exceeds its benefit. `check:openapi` hard-blocks in CI, so "missing at boot" is already prevented at merge time. The `logger.warn` keeps it loud without making it fatal — "fail loud" is not the same as "fail fatal".

### Decision: read once at boot, serve raw bytes

**Choice**: `fs.readFileSync` at module load; `res.type('application/json').send(cachedString)`.
**Alternatives considered**: `express.static` (`app.js:109`), `res.sendFile`, per-request read.
**Rationale**: `express.static` serves a *directory* — pointing it at `backend/` would expose `package.json` and everything else. `res.sendFile` reintroduces per-request I/O, the exact cost this change removes. Boot-time `readFileSync` mirrors `openapiSpec.ts:13`. Serving the raw string (no `JSON.parse`→`stringify` round trip) makes the response byte-identical to what CI gates.

### Decision: drift gate as a `--check` flag, invoked by CI

**Choice**: `generate-openapi-spec.js` writes by default; `--check` regenerates in memory, compares to the committed file, and exits 1 naming the fix command. Exposed as `check:openapi`; ci.yml runs `pnpm run check:openapi`.
**Alternatives considered**: `git diff --exit-code` in ci.yml; a jest byte-equality test.
**Rationale**: every step in ci.yml's `quality` job invokes a pnpm script, never bespoke shell — matching `architecture:check` and `frontend:quality-check`. `--check` runs identically locally and in CI and emits an actionable message; `git diff` mutates the CI worktree and prints a raw diff with no remediation. Byte drift stays enforced in exactly one place, so jest asserts *wiring*, not drift.

## Data Flow

    route JSDoc + openapiSchemas ─→ buildOpenApiSpec() ─→ generate-openapi-spec.js
                                                                 │ (dev only)
                                                                 ▼
                                                      backend/openapi.json (committed)
                                       CI: check:openapi ────────┤
                                                                 ▼
                                            openapiArtifact.ts (read once at boot)
                                                                 ▼
                                    routes/api/index.ts ──→ GET /api/openapi.json

Serialization: `JSON.stringify(spec, null, 2) + '\n'` — identical to `generate-coverage-risk-map.js:144`. **No** `generatedAt`/`revision` fields (they would break reproducibility). The script loads the TS source via `require('ts-node/register')`, mirroring `app.js:26-28`.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/openapi.json` | Create | Committed, CI-gated OpenAPI 3.0 artifact served by the route |
| `backend/scripts/generate-openapi-spec.js` | Create | Writes (`default`) / verifies (`--check`) the artifact; sole `swagger-jsdoc` caller |
| `backend/src/infrastructure/openapi/openapiArtifact.ts` | Create | Boot-time loader + route handler factory |
| `backend/src/infrastructure/routes/api/index.ts` | Modify | Swap `buildOpenApiSpec` import for `createOpenApiRouteHandler()` |
| `backend/package.json` | Modify | `swagger-jsdoc` → `devDependencies`; add `generate:openapi`, `check:openapi` |
| `package.json` (root) | Modify | Add `check:openapi` delegating to the backend filter |
| `.github/workflows/ci.yml` | Modify | New `quality` step directly after "Check architecture boundaries" |
| `backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts` | Modify | Rewrite lines 132-141 for static serving |
| `backend/src/infrastructure/openapi/__tests__/openapiArtifact.test.ts` | Create | Loader/handler unit tests, including the 404 branch |

## Interfaces / Contracts

```ts
// backend/src/infrastructure/openapi/openapiArtifact.ts
export const OPENAPI_ARTIFACT_PATH: string;                    // __dirname + '../../../openapi.json'
export function loadOpenApiArtifact(artifactPath?: string): string | null;
export function createOpenApiRouteHandler(artifact?: string | null): RequestHandler;
```

`index.ts` reduces to `router.get('/openapi.json', createOpenApiRouteHandler());`. The factory keeps the composition root thin and makes the 404 branch unit-testable without mocking `fs`. `routes/api/index.ts` is already in `tools/architecture/config.js`'s composition-root allowlist, so the import swap needs **no** allowlist change; `infrastructure`→`express` imports are permitted (see `CartApiController.ts:1`).

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `loadOpenApiArtifact('/missing')` → `null`; `createOpenApiRouteHandler(null)` → 404 JSON; with a string → 200, `application/json`, exact bytes | jest + stub `res`, no `fs` mocking |
| Unit | `buildOpenApiSpec()` shape and `EXPECTED_ENDPOINTS` coverage | Unchanged (`openapiSpec.test.ts:64-130`) |
| Integration | `GET /api/openapi.json` through real `app.js` → 200, body deep-equals `JSON.parse(backend/openapi.json)` | supertest; replaces lines 132-141 |
| Integration | Request path never loads `swagger-jsdoc` (success criterion #2) | Dedicated test file requiring only `../../../app`, assert no `swagger-jsdoc` entry in jest's module registry. Fallback if the registry is not introspectable: assert `index.ts` source contains no `swagger-jsdoc`/`openapiSpec` import |
| CI gate | Committed artifact reproduces byte-identically | `pnpm run check:openapi` in the `quality` job (hard block) |

Coverage is unaffected: `collectCoverageFrom` is `src/**` only, so `backend/scripts/` stays out of scope — and `openapiSpec.ts` keeps its existing unit coverage.

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED test |
|---|---|---|---|
| Documentation-like paths | **Applicable** — a `.json` data file is read from disk and returned to clients | Classified as inert data: read with `fs.readFileSync`, **never** `require()`d (which would execute module resolution) and never `JSON.parse`d before sending. The path is a module-level constant derived only from `__dirname` — never from request input, query, or header | Handler ignores any request-supplied path/query and always serves `OPENAPI_ARTIFACT_PATH`; loader is not `require`-based |
| Git repository selection | N/A — no `git` invocation; `--check` compares in-process buffers, never shells out | — | — |
| Commit state | N/A — the script never stages, commits, or inspects the index | — | — |
| Push state | N/A — no remote operation | — | — |
| PR commands | N/A — no PR automation; the gate is a plain pnpm script step | — | — |

## Migration / Rollout

No migration. `render.yaml` is untouched: the artifact ships in the checkout, and devDependencies stay installed in the production container (`render.yaml:15-17` deliberately omits `--prod`), so `type-check` and `build` still resolve `swagger-jsdoc` types after the move. Rollback is a single revert.

## Open Questions

- [ ] `swagger-jsdoc` glob ordering is assumed deterministic across platforms (CI is `ubuntu-latest`, dev is Linux). If `check:openapi` ever disagrees between local and CI, the mitigation is a canonical key sort inside the writer — deliberately not applied pre-emptively, since it would scramble the natural `openapi`/`info`/`paths` order.
- [ ] A `backend/package.json` version bump changes `info.version` and makes the artifact stale; CI will block until regenerated. Accepted — the `--check` failure message must name `pnpm --filter backend generate:openapi` explicitly.
