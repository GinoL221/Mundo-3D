# Exploration: openapi-buildtime-spec

## Current State

`buildOpenApiSpec()` (`backend/src/infrastructure/openapi/openapiSpec.ts:56-61`) calls `swaggerJsdoc({ definition, apis: [ROUTES_GLOB_TS, ROUTES_GLOB_JS] })` synchronously and returns a plain object — no caching, no memoization. It is invoked from exactly one call site: `backend/src/infrastructure/routes/api/index.ts:22-24`, inside the `GET /api/openapi.json` Express handler, so the full swagger-jsdoc glob-scan + JSDoc-parse + schema-assembly pipeline re-runs on **every single request** to that route.

`swagger-jsdoc@6.3.0` lives in `backend/package.json` `dependencies` (confirmed, package.json:44), not `devDependencies`. Its own lockfile entry (`pnpm-lock.yaml:8796-8801`) pulls in `@apidevtools/swagger-parser@12.1.0`, `commander@6.2.0`, `doctrine@3.0.0`, `glob@11.1.0`, matching the audit's claim that the HIGH-severity transitive advisories (brace-expansion x2, js-yaml x2, fast-uri) come in through this dependency chain, not through a direct backend dependency.

Zero-consumer claim re-verified independently: `rg -i "openapi\.json"` across the whole repo returns exactly 4 hits, all internal to the backend itself — the route definition and comment in `routes/api/index.ts`, a comment in `openapiSchemas.ts`, and the route's own integration test in `openapiSpec.test.ts:132-141`. Nothing in `frontend/src/`, `e2e/`, `scripts/`, `docs/`, or `.github/` references it. **Confirmed: zero external consumers.**

The 6 route-group files (`products.ts`, `users.ts`, `cart.ts`, `categories.ts`, `franchises.ts`, `orders.ts`) each carry `@openapi` JSDoc blocks that `swagger-jsdoc` extracts via the glob patterns; `openapiSchemas.ts` (component schemas) and `orderOpenapiSchemas.ts` (split out to respect the 250-line cap) feed `components.schemas`. `openapiSpec.test.ts` (142 lines) hand-maintains an `EXPECTED_ENDPOINTS` list and asserts the generated spec matches it exactly (no missing, no stale) — an existing manual drift-detection mechanism, scoped to route coverage only, not schema/JSDoc content.

Existing "fail loud, not silent" precedent already exists in `backend/src/app.js:1-12`: `JWT_SECRET` throws unconditionally outside `NODE_ENV=test`, `CORS_ORIGIN` throws in production if unset. `scripts/deploy/env-preflight.js` is a second, milder precedent — distinguishes hard-required vars (non-zero exit) from warn-only vars, runs as a build/deploy step (`deploy:start` = `env-preflight.js && migrate-and-start.js`), not inside the request path.

`render.yaml`'s `buildCommand` is `pnpm install --frozen-lockfile && pnpm --filter backend build`, where `build` = `tsc -p tsconfig.build.json` (compiles `src/**/*` to `dist/`, excluding tests). No existing post-build generation step. `dist/` is repo-root-gitignored (`.gitignore:92`).

Directly applicable existing precedent for "generate at build/test time, gitignore the output, upload as CI artifact instead of committing": `backend/package.json`'s `test:coverage` script runs `jest --coverage && node scripts/generate-coverage-risk-map.js`, writing to `backend/coverage/` (gitignored), and `.github/workflows/ci.yml:64-73` uploads `backend/coverage/{lcov.info,coverage-summary.json,risk-map.json}` as a CI artifact rather than committing it.

## Affected Areas

- `backend/src/infrastructure/openapi/openapiSpec.ts` (61 lines) — the generation function itself; whichever approach is picked, this either gets a new caller (a build script) or stays as-is with a caching wrapper.
- `backend/src/infrastructure/routes/api/index.ts:19-24` — the `GET /api/openapi.json` route mount; changes depending on whether the route serves a static file, a cached in-memory object, or is removed.
- `backend/src/infrastructure/openapi/openapiSchemas.ts` (216 lines), `orderOpenapiSchemas.ts` (52 lines), `productsSearchOpenapi.ts` — untouched by the design fork itself but are the actual JSDoc/schema sources any drift-detection gate would compare against.
- `backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts` (142 lines) — the `GET /api/openapi.json (real app wiring)` describe block (lines 132-142) needs rewriting if the route's serving mechanism changes.
- `backend/package.json` — `swagger-jsdoc` dependency placement (`dependencies` → `devDependencies` is the actual security fix); potentially a new `generate:openapi` script.
- `render.yaml:17` (`buildCommand`) — needs the generation step added if the spec becomes a build artifact.
- `.github/workflows/ci.yml` — candidate location for a drift-detection gate if question 4 resolves to "yes, add a gate."
- `backend/tsconfig.build.json` — if a generation script needs to run post-`tsc`, it must run against `dist/` (compiled output) or be a separate plain Node script outside the TS build.

## Approaches

The five audit questions aren't independent — they compose into two coherent overall strategies, plus hybrid variants:

### A. Move `swagger-jsdoc` to `devDependencies`, keep it a live runtime route (cached, not per-request)
Only viable if the build step generates the JSON once at build time and the runtime route just serves the static file — swagger-jsdoc itself never runs in the production process. A devDependency still `require`d at runtime will MODULE_NOT_FOUND in production if devDependencies are pruned before deploy (unconfirmed, see Risks).
- **Pros**: keeps `GET /api/openapi.json` as a live URL; zero client-facing change.
- **Cons**: doesn't actually remove swagger-jsdoc from what boots in production unless combined with build-time generation (Approach B).
- **Effort**: Medium (requires the caching/build-time split from Approach B anyway).

### B. Generate at build time, drop the runtime dependency entirely (spec becomes a build/repo artifact)
Add a build script (e.g., `backend/scripts/generate-openapi-spec.js`) that calls `buildOpenApiSpec()`-equivalent logic once during `pnpm --filter backend build` and writes `dist/openapi.json` (or `backend/generated/openapi.json`). `swagger-jsdoc` moves to `devDependencies`. The route either serves the static file or is removed since there are zero consumers.
- **Pros**: actually removes the 5 HIGH transitive advisories from what ships to production; matches the `test:coverage`/`generate-coverage-risk-map.js` precedent; smaller production `node_modules`.
- **Cons**: needs a new build step wired into `render.yaml`'s `buildCommand`; needs a decision on missing-file behavior at boot (404 vs fail-loud); `openapiSpec.test.ts` integration test needs rework.
- **Effort**: Medium — mostly plumbing, no new domain logic.

### C. Remove the route and swagger-jsdoc entirely (spec becomes a local dev-only artifact, never shipped)
Since the audit confirmed zero consumers, delete `GET /api/openapi.json`, move `swagger-jsdoc` + the openapi infra to `devDependencies`/a dev-only script (e.g., `pnpm --filter backend generate:openapi`, writing a committed `openapi.json` for human/PR reference), and drop runtime exposure altogether.
- **Pros**: simplest, smallest surface area; fully eliminates the runtime dependency and the request-time regeneration cost; still gives reviewers a committed, diffable JSON contract in git.
- **Cons**: loses the "always-live, always-current" property — if someone forgets to regenerate before merging, the committed file drifts unless a CI gate enforces regeneration; no `/openapi.json` URL exists anymore for any future integration.
- **Effort**: Low-Medium — deletion + one new committed-artifact + CI drift check.

### D. Keep the runtime route but cache the result in memory (no build-time change)
Wrap `buildOpenApiSpec()` in a memoized singleton so it only runs once per process, without touching the dependency placement.
- **Pros**: trivial, addresses the "per-request regeneration" performance concern in isolation.
- **Cons**: does **not** address the actual audit finding — swagger-jsdoc still ships in production `dependencies`. Not a real option on its own, only listed as what NOT to do in isolation.
- **Effort**: Low, but insufficient on its own.

## Answers to the 5 design questions (options, not decisions)

1. **Live URL vs. build/repo artifact only** — given confirmed zero consumers, no functional requirement forces a live URL. Options: (a) keep it live but only as a cached read of a build-time-generated file (Approach B), (b) drop the live route entirely (Approach C).
2. **Commit the generated JSON vs. gitignore + regenerate at build** — repo precedent (`backend/coverage/`) favors gitignore + regenerate + CI-artifact-upload. Committing trades a slightly noisier diff for human-reviewable contract changes in PRs; genuine tradeoff, no repo precedent either way.
3. **Missing file at boot: 404 vs. fail loud** — if the route is kept (Approach B), the `app.js` fail-loud precedent argues for that only if the spec is load-bearing; since it's zero-consumer documentation, a 404 (or removing the route, Approach C) is more proportionate.
4. **CI drift-detection gate** — only necessary if the generated JSON is committed (question 2 = commit) or if the route continues to serve build-time output that could silently go stale. If gitignored + regenerated every build, no drift is possible by construction. Direct consequence of question 2, not independent.
5. **`render.yaml` buildCommand change** — needed under Approach B or C-with-committed-artifact-refreshed-in-CI; not needed if generation is CI-only and never touches the production deploy pipeline.

## Recommendation

Approach C (remove the runtime route, move `swagger-jsdoc` out of production `dependencies`) combined with committing the generated JSON and gating it in CI is most consistent with what the audit found: a zero-consumer endpoint whose only real value is a human/reviewer-facing contract artifact, not a live integration surface. Concretely: move `swagger-jsdoc` to `devDependencies`; delete `GET /api/openapi.json`; add a `generate:openapi` script (dev-only, following the `generate-coverage-risk-map.js` pattern) that writes a committed `openapi.json` (location TBD in `sdd-propose` — repo root, `docs/`, or `backend/`); add a CI check that re-runs generation and fails the build if the committed file differs, mirroring how `architecture:check` and `frontend:quality-check` already gate CI. This avoids inventing a new fail-loud pattern for something with zero consumers (question 3 moot), avoids `render.yaml` changes (question 5 moot), and directly eliminates the 5 HIGH transitive advisories from production. `sdd-propose` should treat questions 1-3 as effectively resolved by "zero consumers" and focus scope/tasks on the commit-location decision (question 2) and the CI drift gate (question 4).

## Risks

- If an undiscovered internal consumer exists (e.g. a manual curl step in a runbook, or an external partner integration outside this repo), removing the live route would be a breaking change with no compile-time signal — worth one explicit confirmation question in `sdd-propose` rather than treating the `rg` sweep as absolutely exhaustive.
- Moving `swagger-jsdoc` to `devDependencies` only fully removes it from production if the production install step doesn't need it at runtime — no explicit evidence found on whether `pnpm install --frozen-lockfile` in `buildCommand` prunes devDependencies before the container ships; confirm during `sdd-design`.
- Committing a generated JSON artifact reintroduces a manual-sync risk unless the CI drift gate is actually built.

## Ready for Proposal

Yes. Zero-consumer claim independently re-verified, current per-request generation behavior confirmed, dependency chain causing the HIGH advisories confirmed in the lockfile, and existing repo precedents (`env-preflight.js` fail-loud pattern, `generate-coverage-risk-map.js` + gitignored+CI-uploaded coverage pattern) give `sdd-propose` concrete prior art.
