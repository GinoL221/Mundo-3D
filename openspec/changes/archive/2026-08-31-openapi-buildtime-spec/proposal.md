# Proposal: openapi-buildtime-spec

## Intent

`swagger-jsdoc@6.3.0` sits in backend runtime `dependencies` and re-executes its full glob-scan + JSDoc-parse pipeline on **every** `GET /api/openapi.json` request. It carries 5 HIGH transitive advisories (brace-expansion x2, js-yaml x2, fast-uri) through `@apidevtools/swagger-parser`. A repo-wide search found zero code consumers of that route (unverified against live production traffic — see Risks), but the user wants to keep serving it as a live URL. We can still remove `swagger-jsdoc` from the request path entirely: generate the spec once at build/dev time and have the route serve the static result. (Audit finding #2, 2026-08-31.)

## Scope

### In Scope
- Add a dev-only `generate:openapi` script (mirrors `scripts/generate-coverage-risk-map.js`) that runs `buildOpenApiSpec()`/`swaggerJsdoc(...)` once and writes a committed `openapi.json`.
- Move `swagger-jsdoc` and `@types/swagger-jsdoc` to `devDependencies` — only the generation script imports them; the running Express process never does.
- Change `GET /api/openapi.json` (`routes/api/index.ts:19-24`) to serve the committed, pre-generated file (read once at process boot, served from memory or via `express.static`) instead of calling `buildOpenApiSpec()` live.
- Add a CI drift gate: regenerate in CI, fail the build if the committed `openapi.json` differs (hard-block, consistent with `architecture:check`/`frontend:quality-check`).
- Rewrite the route-wiring assertions in `openapiSpec.test.ts:132-141` to match static-file serving instead of live generation.
- Decide (in `sdd-design`) the missing-file-at-boot behavior: since the file is now a committed, CI-enforced artifact, it should always be present — but the code path needs an explicit decision (404 vs fail-loud) for the case where it somehow isn't.

### Out of Scope
- Any change to OpenAPI schema/JSDoc content, endpoint coverage, or `EXPECTED_ENDPOINTS`.
- Swagger UI or any hosted documentation surface.
- `render.yaml` changes — the committed file ships as part of the repo/build, no new deploy-time generation step needed.
- Pruning devDependencies from the production install (see Risks — would be a separate, higher-risk change).

## Capabilities

### New Capabilities
- `api-contract-artifact`: how the OpenAPI contract is generated, committed, served statically, and gated against drift.

### Modified Capabilities
- None.

## Approach

Hybrid of exploration Approach B (build-time generation) and keeping the live route, per user decision to preserve the `/api/openapi.json` URL rather than delete it. `swagger-jsdoc` is fully removed from the request path either way — the difference from Approach C is that the route stays and serves the generated artifact instead of disappearing.

| Rejected | Why |
|---|---|
| C — delete the route | User wants to keep the URL for possible future Swagger UI / partner consumption. |
| A — devDep + still-live generation | Route would still `require` swagger-jsdoc in-process; vulnerable code stays reachable. |
| D — memoize only | Fixes per-request cost, not the advisories — swagger-jsdoc still ships as a runtime dependency. |

**Verified correction to exploration (risk 2 resolved):** `render.yaml:15-17` documents that `--prod` is deliberately never passed, so devDependencies **are** installed in the production container and are not pruned. Moving `swagger-jsdoc` to `devDependencies` does **not** delete it from disk. What changes is reachability — no running request-path code ever `require`s it — plus reclassification out of `pnpm audit --prod`. Per the user's explicit decision, unreachable-but-present is an accepted outcome; success criteria are phrased as "unreachable"/"not in `pnpm audit --prod`", never "removed from production."

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/infrastructure/routes/api/index.ts` | Modified | Route handler serves the static generated file instead of calling `buildOpenApiSpec()` |
| `backend/package.json` | Modified | Dep moved to devDeps; `generate:openapi` script added |
| `backend/scripts/generate-openapi-spec.js` | New | Writes the committed `openapi.json` |
| `openapi.json` (location TBD in design) | New | Committed, CI-gated contract artifact served by the route |
| `backend/.../__tests__/openapiSpec.test.ts` | Modified | Route-wiring block rewritten for static-file serving |
| `.github/workflows/ci.yml` | Modified | Drift gate (hard-block) |
| `backend/src/infrastructure/openapi/openapiSpec.ts` | Modified | Caller becomes the generation script, not the Express route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Undiscovered off-repo consumer of the route's current behavior.** Moot for existence (the URL stays) but the response is no longer always-fresh — it's whatever was last committed. | Low | Documented behavior change; CI drift gate keeps it from silently going stale. |
| **Advisories remain on disk in production.** devDeps are not pruned (verified above), so filesystem-based scanners still see them; only `pnpm audit --prod` (dependency-tree-based) stops reporting them. | High (certain, accepted by user) | State the claim as reachability, not removal. A separate `--prod` prune change would be needed for physical absence — explicitly out of scope here. |
| Committed JSON drifts from source JSDoc. | Med | CI drift gate is in scope, not optional, and hard-blocks the merge. |
| Contributors must remember to regenerate before committing. | Med | Gate fails loudly in CI with the exact regeneration command; local `pnpm --filter backend generate:openapi` before pushing. |
| "Zero consumers" claim (motivating the security work at all) is static-search-only, not verified against live production traffic — Render dashboard access is currently unavailable (user 2FA lockout, recovery in progress separately). | Low | Not a blocker since the URL is being kept, not deleted — this risk mattered for Approach C, less so now. Still worth a spot-check of `/api/openapi.json` traffic once Render access is restored, to confirm nothing depends on live (non-cached) generation. |

## Rollback Plan

Single revert of the change commit restores live per-request generation and the original `dependencies` placement. No data, schema, or deploy-config migration is involved, so rollback is stateless and immediate.

## Dependencies

None. No `render.yaml`, database, or infrastructure prerequisite.

## Success Criteria

- [ ] `pnpm audit --prod` no longer reports the 5 HIGH advisories for the backend.
- [ ] No request-path code imports `swagger-jsdoc` (only the dev-only generation script does).
- [ ] `GET /api/openapi.json` still returns 200 with the current spec; suite green.
- [ ] `generate:openapi` reproduces the committed file byte-identically.
- [ ] CI fails (hard-block) when the committed `openapi.json` is stale.

## Proposal question round — resolved

1. **Keep the live URL?** → Yes. Route stays, now serves the build-time-generated static artifact instead of generating live.
2. **CI gate strictness** → Hard-block, consistent with `architecture:check`/`frontend:quality-check`.
3. **Compliance posture on devDependencies not being pruned** → Unreachable-but-physically-present is accepted. A `--prod` install-pruning change is explicitly out of scope (separate, higher-risk change touching `render.yaml`).

Remaining open item, deferred to `sdd-design`: exact commit location for `openapi.json` (repo root vs `docs/` vs `backend/`) and the missing-file-at-boot behavior (404 vs fail-loud) — implementation-level decisions, not product ones.
