# Archive Report: openapi-buildtime-spec

**Date Archived**: 2026-08-31  
**Change Name**: openapi-buildtime-spec  
**Capability**: api-contract-artifact (new)  
**Status**: COMPLETE AND ARCHIVED  

---

## Executive Summary

The `openapi-buildtime-spec` change has been successfully completed, verified clean after fixes, and archived. The OpenAPI contract is now generated once at build/dev time via a committed artifact (`backend/openapi.json`), removing `swagger-jsdoc` from the live request path while preserving the `/api/openapi.json` URL. All three verification warnings were fixed post-verify and re-verified passing. The change is merged at commit `99f01db` ("feat(security): serve OpenAPI contract as a build-time artifact"), GPG-signed and verified.

---

## Final-State Facts (post-verify, before archive)

### Verification Verdict

**Original**: `pass_with_warnings` (3 non-critical warnings identified)  
**Post-verify fixes**: All 3 warnings fixed and re-verified clean in later commits  
**Final state**: PASS (all requirements met, all scenarios passing, all warnings resolved)

**Evidence**: Per `verify-report.md` "Post-Verify Fixes" section (lines 324-352):

1. **WARNING-1 (Orphaned test suite)**: Extended root `package.json`'s `test:deploy-scripts` script glob to include `"backend/scripts/**/*.test.js"`. The 9 `generate-openapi-spec.test.js` tests now run inside `test:deploy-scripts` (49 pre-existing + 9 new = 58 total), which is wired into `.github/workflows/ci.yml`'s `quality` job.

2. **WARNING-2 (Non-falsifiable assertion)**: Rewrote `openapiArtifact.test.ts:59` to assert that `res.send` was called with the actual committed file bytes (`fs.readFileSync(OPENAPI_ARTIFACT_PATH, 'utf-8')`), replacing the tautological `res.status.mock.calls.length + res.type.mock.calls.length > 0` check.

3. **WARNING-3 (Spec wording)**: Reconciled `api-contract-artifact/spec.md` scenario wording from "Only the generation script depends on the generator library" to "Only the generation script is a reachable entry point to the generator library", matching design.md's decision (only reachable caller, not literal sole importer; `openapiSpec.ts` still imports `swagger-jsdoc` but is unreachable from any live request).

**Re-verification after fixes**: `pnpm --filter backend test` → 117 suites, 956/956 passing (unchanged). `pnpm run test:deploy-scripts` → 58/58 passing (49 + 9, confirmed new script tests execute). All gates pass clean.

### Commit Information

**Hash**: `99f01db`  
**Message**: "feat(security): serve OpenAPI contract as a build-time artifact"  
**GPG Status**: Signed and verified  
**Parent**: `671c4eb` (fix(storage): dev-env upload stores a bare filename)  
**Files Changed**: 19 (10 modified, 9 new)  
**Insertions**: 3384  
**Deletions**: 15  

**Modified Files**:
- `.github/workflows/ci.yml` (drift gate step added, test suite runner widened)
- `backend/package.json` (swagger-jsdoc moved to devDependencies, scripts added)
- `backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts` (route wiring test rewritten)
- `backend/src/infrastructure/routes/api/index.ts` (handler swap)
- `package.json` (root-level check:openapi script added)
- `pnpm-lock.yaml` (dependency placement sync)

**New Files**:
- `backend/openapi.json` (committed, CI-gated build artifact)
- `backend/scripts/generate-openapi-spec.js` (generation script, dev-only entry to swagger-jsdoc)
- `backend/scripts/generate-openapi-spec.test.js` (9 unit tests for generation logic)
- `backend/src/infrastructure/openapi/openapiArtifact.ts` (boot-time loader, route handler factory)
- `backend/src/infrastructure/openapi/__tests__/openapiArtifact.test.ts` (loader/handler unit tests)
- `backend/src/infrastructure/openapi/__tests__/openapiRequestPathIsolation.test.ts` (isolation verification)

### Test Execution — Final State

**Build**: PASSED  
- `pnpm --filter backend build` → tsc exit 0, no output

**Tests — Primary Suite**: 117 suites / 956 tests PASSED  
- `pnpm --filter backend test` → exit 0, 117 suites total, 956 tests total
- `pnpm --filter backend test src/infrastructure/openapi` → 3 suites, 46 tests, all passing

**Tests — Generation Script (Post-Fix)**: 58/58 PASSED  
- `pnpm run test:deploy-scripts` → 58 tests total (49 pre-existing + 9 new from openapi generator)
- `node --test backend/scripts/generate-openapi-spec.test.js` → 9 tests, 0 failed

**Coverage**: 94.63% stmts / 85.08% branch / 89.75% funcs / 95.29% lines  
- Thresholds: 90/80/85/90 → ABOVE THRESHOLD in all metrics

### Verification Gates — All Passing

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| OpenAPI Drift | `pnpm run check:openapi` | PASS | exit 0, silent; committed artifact matches source |
| Architecture Boundaries | `pnpm --filter backend architecture:check` | PASS | exit 0; no allowlist changes needed |
| Linting | `pnpm --filter backend lint` | PASS | exit 0, no output |
| Type Checking | `pnpm --filter backend type-check` | PASS | exit 0, no output |
| Audit (Prod) | `pnpm audit --prod` | PASS | 4 unrelated advisories remain; 0 matches for swagger-jsdoc/brace-expansion/js-yaml/fast-uri |

### Security Impact

**Vulnerability Removal**: 5 HIGH transitive advisories from `swagger-jsdoc@6.3.0` are no longer reported by `pnpm audit --prod`:
- `brace-expansion` (2 instances via swagger-parser)
- `js-yaml` (2 instances via swagger-parser)
- `fast-uri` (1 instance via swagger-parser)

**Status**: These advisories are no longer in the production dependency audit surface (`--prod` flag), though the packages remain on disk in `node_modules` (devDependencies are installed in production per `render.yaml:15-17` which deliberately omits `--prod`). Reachability from any live request path is zero — tested and verified.

### Requirement Compliance Matrix

All 6 specification requirements are implemented; all 10 scenarios have covering tests and are passing:

| Requirement | Scenario | Status | Evidence |
|---|---|---|---|
| Deterministic Build-Time Generation | Regeneration with no source changes is byte-identical | COMPLIANT | `generate-openapi-spec.test.js` + verifier's real-pipeline double-run SHA-256 match |
| Deterministic Build-Time Generation | Regeneration after a source change reflects the update | COMPLIANT | `generate-openapi-spec.test.js` + source mutation test |
| Request-Path Isolation | Live route never imports the generator library | COMPLIANT | `openapiRequestPathIsolation.test.ts` + jest module registry verification |
| Request-Path Isolation | Only the generation script is a reachable entry point | COMPLIANT | Static analysis + test suite, spec wording reconciled post-verify |
| Static-File Serving | Route returns the committed artifact unchanged | COMPLIANT | `openapiArtifact.test.ts` + `openapiSpec.test.ts` integration test |
| Static-File Serving | Route remains unauthenticated | COMPLIANT | Supertest integration, no auth middleware |
| Predictable Behavior on Missing Artifact | Missing artifact produces a defined, tested outcome | COMPLIANT | 404 + boot `logger.warn`, all tested |
| CI Drift Detection | Committed artifact matches source — CI passes | COMPLIANT | `generate-openapi-spec.test.js --check` mode + live gate |
| CI Drift Detection | Committed artifact is stale — CI fails | COMPLIANT | Test verifies exit 1 + fix-command output |
| Devtime-Only Dependency Placement | Production audit excludes the generator's advisories | COMPLIANT | `pnpm audit --prod` verified, 0 swagger-jsdoc matches |

---

## Archive Contents

### SDD Artifacts Preserved

- ✓ `proposal.md` — Proposal: scope, approach, risks, success criteria
- ✓ `design.md` — Technical design, architecture decisions, interface contracts
- ✓ `tasks.md` — All 24 implementation tasks (Phases 1–4), all marked [x] complete
- ✓ `apply-progress.md` — Apply phase execution record, TDD evidence, all tasks implemented
- ✓ `verify-report.md` — Verification report with post-verify fixes section documenting all 3 warning resolutions
- ✓ `specs/api-contract-artifact/spec.md` — New capability specification (6 requirements, 10 scenarios, spec wording reconciled per WARNING-3 fix)

### Main Specs Updated

**New Main Spec Created**: `openspec/specs/api-contract-artifact/spec.md`  
The delta spec from the change folder has been synced into the main specification library. This spec is now the source of truth for the `api-contract-artifact` capability.

---

## SDD Cycle Completion Status

| Phase | Status | Evidence |
|-------|--------|----------|
| Proposal | ✓ Complete | Change scoped, approach decided, dependencies resolved |
| Exploration | ✓ Complete | Three approaches evaluated; chosen approach rationalized |
| Specification | ✓ Complete | 6 requirements, 10 scenarios defined; spec wording reconciled post-verify |
| Design | ✓ Complete | Technical approach, architecture decisions, interface contracts, threat matrix |
| Tasks | ✓ Complete | 24 tasks defined (4 phases), all implemented |
| Apply | ✓ Complete | All 24 tasks marked [x]; TDD cycle closed; changes committed to main |
| Verify | ✓ Complete + Fixed | Original PASS_WITH_WARNINGS; all 3 warnings fixed and re-verified clean |
| Archive | ✓ Complete | All artifacts preserved; main spec synced; change folder moved to archive |

**Total cycle time**: 2026-08-26 (proposal) → 2026-08-31 (archive) — 5 days  
**No blockers or unresolved issues**

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Requirements satisfied | 6/6 (100%) |
| Scenarios passing | 10/10 (100%) |
| Implementation tasks complete | 24/24 (100%) |
| Test suites | 117 (backend main suite) + 3 (new openapi suite) + standalone node:test (9 tests) |
| Total tests passing | 956 (jest) + 9 (node:test) = 965 total |
| Code coverage (changed files) | 94.11% line / 83.33% branch for instrumented files; project-wide 94.63% stmts |
| Lines of code added | 3384 |
| Files modified | 10 |
| Files created | 9 |
| High-severity vulnerabilities removed from audit | 5 (brace-expansion x2, js-yaml x2, fast-uri x1) |
| Verification warnings (original) | 3 (all fixed post-verify) |
| Verification warnings (final) | 0 |

---

## Deferred Items (Out of Scope)

Per the proposal "Out of Scope" section, the following remain intentionally unaddressed and are appropriate for separate, future changes:

1. **Pruning devDependencies from production installs**: Would require changes to `render.yaml` with `--prod` flag or similar — explicitly out of scope here. Current state is unreachable-but-physically-present, which the user accepted.
2. **Swagger UI or hosted documentation**: No API documentation UI was added. The route serves JSON only.
3. **OpenAPI schema/JSDoc content changes**: No endpoint coverage, schema, or `EXPECTED_ENDPOINTS` changes in this cycle.
4. **Quality gate unification (Fix C from audit plan)**: 250-line cap and no-console.log rules remain inconsistent between frontend and backend — acknowledged in audit backlog, not part of this change.

---

## Rollback Information

**Single Revert Required**: 
```bash
git revert 99f01db
```

**Effect**: Restores live per-request generation via `swagger-jsdoc`, restores original `dependencies` placement, removes all new files and testing infrastructure, reverts modified files to pre-change state.

**No Data Migration**: No schema, data, or deploy-time state changes; rollback is stateless and immediate.

---

## Lessons Learned (For Future Changes)

1. **Post-verify fixes must be re-verified before archive**: Three warnings from the original verification pass were residual (test wiring, assertion clarity, spec wording) and were fixed in follow-up commits. Re-verification confirmed all gates pass; this approach (fix-then-re-verify) is sound and documented in this archive report.

2. **Test runner glob expansion needed early**: The `generate-openapi-spec.test.js` suite (9 tests) was initially orphaned because `backend/scripts/` was not included in the test runner glob. This was fixed post-verify by expanding `package.json`'s `test:deploy-scripts` script. Future generation scripts should wire test runners upfront.

3. **Build-time artifact determinism is production-critical**: Three identical SHA-256 digests from independent runs of the real generation pipeline proved byte-identity. This discipline (no timestamps, stable key ordering) is essential for CI drift gates and reproducible builds.

4. **Request-path isolation testing doubles value with static analysis**: Combining Jest module registry checking (runtime proof) with source-code scanning (static proof) provided two independent verification angles for the same security goal, catching both the code path and the import chain.

---

## Archival Verification Checklist

- [x] All 24 implementation tasks marked complete in `tasks.md`
- [x] Main spec (`openspec/specs/api-contract-artifact/spec.md`) created from delta spec
- [x] Delta spec synced without differences (verified via `diff -r`)
- [x] Change folder moved to `openspec/changes/archive/2026-08-31-openapi-buildtime-spec/`
- [x] Source folder removed after move
- [x] Archived contents verified byte-identical to pre-move snapshot (via `diff -r`)
- [x] Archive includes: proposal, design, specs/, tasks, apply-progress, verify-report, archive-report
- [x] No CRITICAL issues in verify-report
- [x] All post-verify fixes documented and re-verified clean
- [x] Commit hash recorded and GPG signature confirmed
- [x] All verification gates passing (drift, architecture, lint, type-check, audit)
- [x] No stale checkboxes or incomplete implementation tasks

---

**Archive Complete** — Change closed and ready for reference.

**Next Recommended**: None — this change is complete. The 3 remaining items from the 2026-08-31 full-repo audit (dead deps cleanup, .env.example sync, Astro 7 bump) were already merged before this SDD cycle started.
