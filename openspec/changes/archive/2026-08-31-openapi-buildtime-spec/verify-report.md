```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:41f2b69ea13bd228d14aa53d51521b1f0c4acd7f5ed1cd31f774d2036410be01
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 10/10
test_command: pnpm --filter backend test
test_exit_code: 0
test_output_hash: sha256:bd792e1a3e4c9343904693549380f1ef989b680c7674b711379f81ede3ccc2a5
build_command: pnpm --filter backend build
build_exit_code: 0
build_output_hash: sha256:24c42b76aecef2c39c8a5639a3536efb936b03bdac9a8f8be50c0e71ffbc7af8
```

## Verification Report

**Change**: openapi-buildtime-spec
**Version**: N/A (capability `api-contract-artifact`, new)
**Mode**: Strict TDD
**Verified against**: uncommitted working tree (all changes staged/unstaged), not the apply narrative

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 24 |
| Tasks complete | 24 |
| Tasks incomplete | 0 |

All 24 tasks in `tasks.md` (Phases 1-4) are marked `[x]`. Each was cross-checked
against real file state, not the apply report: every file the tasks claim to
create or modify exists with the claimed content (see Correctness below).

### Build & Tests Execution

**Build**: PASSED

```text
$ pnpm --filter backend build        # tsc -p tsconfig.build.json
exit 0, no output
```

**Tests**: 956 passed / 0 failed / 0 skipped (jest), plus 9 passed (node:test)

```text
$ pnpm --filter backend test
Test Suites: 117 passed, 117 total
Tests:       956 passed, 956 total
exit 0

$ pnpm --filter backend test src/infrastructure/openapi
Test Suites: 3 passed, 3 total
Tests:       46 passed, 46 total
exit 0

$ node --test backend/scripts/generate-openapi-spec.test.js
tests 9, pass 9, fail 0
exit 0
```

**Coverage**: 94.63% stmts / 85.08% branch / 89.75% funcs / 95.29% lines
vs thresholds 90/80/85/90 → above threshold.

### Independent Command Evidence vs apply-progress claims

| Command | apply-progress claim | Verifier's own result | Match |
|---|---|---|---|
| `pnpm --filter backend test` | 117 suites, 956 tests passed | 117 suites, 956 tests passed, exit 0 | YES |
| `pnpm run check:openapi` | exit 0, no drift | exit 0, silent | YES |
| `pnpm --filter backend architecture:check` | exit 0, no output | exit 0, no output | YES |
| `pnpm --filter backend lint` | exit 0, no output | exit 0, no output | YES |
| `pnpm --filter backend type-check` | exit 0, no output | exit 0, no output | YES |
| `pnpm audit --prod` | 4 unrelated advisories; 0 swagger-jsdoc/brace-expansion/js-yaml/fast-uri matches | 4 advisories (sharp, svgo, uuid, body-parser); grep count for the 4 terms = 0 | YES |
| `pnpm --filter backend test src/infrastructure/openapi` | 3 suites, 46 tests | 3 suites, 46 tests, exit 0 | YES |
| `node --test .../generate-openapi-spec.test.js` | 9 tests passed | 9 passed, 0 failed | YES |

No discrepancy found between apply-progress and independently reproduced results.
The transient first-run timeout apply-progress reported did not reproduce in any
of the three full-suite runs executed during this verification.

Additional independent checks the apply report did not run:

- **Determinism, real pipeline**: ran `node scripts/generate-openapi-spec.js`
  twice against the real `buildOpenApiSpec()` (not the injected fake) and
  compared SHA-256 of `backend/openapi.json` before and after each run —
  `0a300e54...5071` all three times. Byte-identical, no drift, committed file
  reproduces exactly.
- **Compiled-output path resolution**: required
  `backend/dist/infrastructure/openapi/openapiArtifact.js` after a real `tsc`
  build. `OPENAPI_ARTIFACT_PATH` resolves to
  `<repo>/backend/openapi.json`, the file exists, and `loadOpenApiArtifact()`
  returns bytes identical to the committed file. The `__dirname`-based
  resolution therefore holds in the production `dist/` layout, not just in
  ts-node/test.
- **Artifact shape**: `openapi: 3.0.0`, 21 paths, 19 component schemas,
  `info.version: 1.0.0`. Valid JSON.
- **`backend/openapi.json` is not gitignored** (`git check-ignore` reports no
  match), so it will actually be committed.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Deterministic Build-Time Generation | Regeneration with no source changes is byte-identical | `generate-openapi-spec.test.js > generate: two consecutive runs with unchanged source produce byte-identical files` + verifier's own real-pipeline double-run SHA-256 | COMPLIANT |
| Deterministic Build-Time Generation | Regeneration after a source change reflects the update | `generate-openapi-spec.test.js > generate: regeneration after a source change reflects the update and drops stale entries` | COMPLIANT |
| Request-Path Isolation from the Generator | Live route never imports the generator library | `openapiRequestPathIsolation.test.ts > never loads swagger-jsdoc when only the running app is required` | COMPLIANT |
| Request-Path Isolation from the Generator | Only the generation script depends on the generator library | `openapiRequestPathIsolation.test.ts > routes/api/index.ts source contains no swagger-jsdoc or openapiSpec import` | PARTIAL (see WARNING-3) |
| Static-File Serving of the Committed Contract | Route returns the committed artifact unchanged | `openapiSpec.test.ts > serves the committed backend/openapi.json artifact unchanged...` + `openapiArtifact.test.ts > responds 200 ... exact artifact bytes (no JSON round trip)` | COMPLIANT |
| Static-File Serving of the Committed Contract | Route remains unauthenticated | `openapiSpec.test.ts > serves the committed backend/openapi.json artifact unchanged, unauthenticated, through the actual app.js mount point` (supertest, no cookie/header) | COMPLIANT |
| Predictable Behavior on Missing Artifact | Missing artifact produces a defined, tested outcome | `openapiArtifact.test.ts > returns null for a missing/unreadable path without throwing` + `> responds 404 with a JSON error body when the artifact is null` | COMPLIANT |
| CI Drift Detection | Committed artifact matches source — CI passes | `generate-openapi-spec.test.js > runCli --check mode: exits 0 and makes no write when the spec matches` + verifier's own `pnpm run check:openapi` exit 0 | COMPLIANT |
| CI Drift Detection | Committed artifact is stale — CI fails | `generate-openapi-spec.test.js > runCli --check mode: exits 1 and prints the exact fix command when the spec is stale` | COMPLIANT |
| Devtime-Only Dependency Placement | Production audit excludes the generator's advisories | No automated test; verified by executing `pnpm audit --prod` (0 matches for swagger-jsdoc/brace-expansion/js-yaml/fast-uri) | COMPLIANT (command-verified, see SUGGESTION-1) |

**Compliance summary**: 10/10 scenarios compliant (1 partial), 0 untested, 0 failing.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Deterministic Build-Time Generation | Implemented | `generate-openapi-spec.js:28` `serializeSpec` = `JSON.stringify(spec, null, 2) + '\n'`. No timestamp/revision field anywhere in `backend/openapi.json` (verified: no `generatedAt`). |
| Request-Path Isolation from the Generator | Implemented | `routes/api/index.ts:8` imports only `createOpenApiRouteHandler` from `../../openapi/openapiArtifact`; `openapiArtifact.ts` imports only `fs`, `path`, `express` types, and `logger`. Transitive chain to `swagger-jsdoc` is severed. |
| Static-File Serving of the Committed Contract | Implemented | `openapiArtifact.ts:47` `res.type('application/json').send(artifact)` — raw string, no `JSON.parse`/`stringify`. Read happens once at module load (`:26`), not per request. Route has no auth middleware. |
| Predictable Behavior on Missing Artifact | Implemented | `loadOpenApiArtifact` wraps `fs.readFileSync` in try/catch returning `null` (`:19-23`); handler returns `404` + `{error: string}` (`:41`); one boot-time `logger.warn` (`:29-32`). No throw path. |
| CI Drift Detection | Implemented | `.github/workflows/ci.yml:34-35` step "Check OpenAPI spec is up to date" → `pnpm run check:openapi`, placed immediately after "Check architecture boundaries" (`:31-32`) and before "Run linter" (`:37`). Exactly as tasks.md 3.3 specified. Failure message at `generate-openapi-spec.js:49` names `pnpm --filter backend generate:openapi` verbatim. |
| Devtime-Only Dependency Placement | Implemented | `backend/package.json:66` `swagger-jsdoc: 6.3.0` in `devDependencies` (removed from `dependencies`); `backend/package.json:58` `@types/swagger-jsdoc: 6.0.4` also in `devDependencies` (was already there — no move needed). `pnpm-lock.yaml` importer entry moved accordingly. |

### CI Workflow Verification

- YAML parses and the step is structurally valid (2-space list item under
  `jobs.quality.steps`, `name` + `run` keys, matching the sibling steps' shape).
- Placement confirmed at `.github/workflows/ci.yml:34-35`, directly after
  "Check architecture boundaries" (lines 31-32) — exactly where tasks.md 3.3
  and design.md required it.
- `pnpm run check:openapi` resolves: root `package.json:17` →
  `pnpm --filter backend check:openapi` → `backend/package.json:17` →
  `node scripts/generate-openapi-spec.js --check`. Executed end-to-end, exit 0.
- The step runs after `pnpm install --frozen-lockfile`, which installs
  devDependencies (no `--prod`), so `ts-node` and `swagger-jsdoc` are present
  for the check. Correct ordering.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Commit location = `backend/openapi.json` (backend package root, committed, not gitignored) | Yes | File exists at `backend/openapi.json`. `git check-ignore` finds no match. Not at repo root, not in `docs/`, not in `backend/generated/`. |
| Missing artifact ⇒ 404 + boot `logger.warn`, NOT a boot-time throw | Yes | `openapiArtifact.ts:18-33` — `loadOpenApiArtifact` returns `null` on any read failure, module-level `if (defaultArtifact === null) logger.warn(...)`, no `throw` anywhere in the file. Handler returns 404. Verified by reading the source, not the report. |
| Read once at boot, serve raw bytes | Yes | `const defaultArtifact = loadOpenApiArtifact();` at module scope (`:26`); `res.type(...).send(artifact)` (`:47`). No `express.static`, no `res.sendFile`, no per-request read. |
| Drift gate as a `--check` flag invoked by CI via a pnpm script | Yes | `--check` implemented at `generate-openapi-spec.js:44-53`; exposed as `check:openapi` in both package.json files; ci.yml step calls `pnpm run check:openapi`, not bespoke shell / `git diff`. |
| `OPENAPI_ARTIFACT_PATH` derived only from `__dirname`, never from request input | Yes | `openapiArtifact.ts:11` — module-level constant, `path.join(__dirname, '..','..','..','openapi.json')`. Handler signature ignores `_req` entirely. Threat-matrix "Documentation-like paths" response satisfied. |
| Artifact read with `fs.readFileSync`, never `require()`d, never `JSON.parse`d before sending | Yes | `openapiArtifact.ts:20`. No `require` of the JSON anywhere in the request path. |
| `routes/api/index.ts` needs no `tools/architecture/config.js` allowlist change | Yes | `architecture:check` exits 0 with no allowlist edit in the diff. |
| `render.yaml` untouched | Yes | Not present in `git status`/`git diff HEAD --name-only`. |
| Design deviation: script internals extracted into injectable pure functions | Acceptable | `serializeSpec`/`generate`/`check`/`runCli` are exported and DI-based; the real `ts-node/register` + `buildOpenApiSpec` wiring lives only in the `require.main === module` branch (`:64-72`). External CLI behavior, file paths, and the documented interface are unchanged. This is the deviation apply-progress declared, and it is benign. |

### Scope Boundary Check (Proposal Out-of-Scope list)

| Out-of-scope item | Touched? | Evidence |
|---|---|---|
| OpenAPI schema/JSDoc content, endpoint coverage, `EXPECTED_ENDPOINTS` | No | `git diff HEAD --stat` for `openapiSpec.ts`, `openapiSchemas.ts`, `routes/api/*` (except `index.ts`) is empty. `EXPECTED_ENDPOINTS` block in `openapiSpec.test.ts` unchanged — the only diff hunk there is lines 130-145 (the route-wiring block), exactly as design.md scoped it. |
| Swagger UI / hosted documentation surface | No | The only `swagger-ui` occurrence repo-wide is the pre-existing comment in `routes/api/index.ts` stating no UI is added. No `swagger-ui-express` dependency, no `/docs` route. |
| `render.yaml` changes | No | Untouched. |
| Pruning devDependencies from the production install | No | No `--prod` flag added anywhere; `render.yaml` and CI install steps unchanged (`pnpm install --frozen-lockfile`, no `--prod`). |

**Full changed-file set** (excluding the `openspec/` SDD artifacts and the
pre-existing untracked `.impeccable/`):

modified — `.github/workflows/ci.yml`, `backend/package.json`,
`backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts`,
`backend/src/infrastructure/routes/api/index.ts`, `package.json`,
`pnpm-lock.yaml`; new — `backend/openapi.json`,
`backend/scripts/generate-openapi-spec.js`,
`backend/scripts/generate-openapi-spec.test.js`,
`backend/src/infrastructure/openapi/openapiArtifact.ts`,
`backend/src/infrastructure/openapi/__tests__/openapiArtifact.test.ts`,
`backend/src/infrastructure/openapi/__tests__/openapiRequestPathIsolation.test.ts`.

This is exactly the design.md "File Changes" table plus the two extra test
files the tasks required. No scope creep detected.

### Repo Convention Check (AGENTS.md)

| Convention | Result |
|---|---|
| 250-line cap on source files | `openapiArtifact.ts` 49 lines, `generate-openapi-spec.js` 81 lines, `routes/api/index.ts` 25 lines — all well under. Test files exempt. |
| No `console.log` in production code paths | None in `backend/src/infrastructure/openapi/`. `generate-openapi-spec.js:43` uses `log = console.log` as an injectable default in a dev-only CLI script (same class as the existing `scripts/generate-coverage-risk-map.js`), not a production request path. |
| No dead code / commented-out blocks | None found in the new files. |
| No hardcoded secrets | None; the change touches no credentials. |
| No inline scripts in served HTML | N/A — no HTML touched. |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | "TDD Cycle Evidence" table present in `apply-progress.md` with 7 rows. |
| All tasks have tests | Yes | 3 test files cover the behavioral tasks (1.1-1.3, 2.1-2.4, 2.8-2.9). Tasks 3.1-3.4 are config/infra with no test-first surface; 1.4-1.5, 2.5-2.7, 2.10, 4.x are implementation/verification tasks. |
| RED confirmed (tests exist) | Yes | 3/3 claimed test files exist on disk and were read. |
| GREEN confirmed (tests pass) | Yes | 3/3 pass on independent execution: 5 + 2 jest (+39 pre-existing in `openapiSpec.test.ts`) = 46, and 9 node:test. |
| Triangulation adequate | Yes | Script suite: 9 cases across determinism, drift, and both `--check` exit paths. Handler suite: 404 branch, 200 branch, default-artifact case. Isolation suite: two independent proofs (`require.cache` + source scan), matching design.md's stated primary + fallback strategy. |
| Safety Net for modified files | Yes | `openapiSpec.test.ts` was modified, and apply-progress records a 39/39 baseline before the change. Arithmetic corroborates: the file still holds 39 tests today (46 total − 5 artifact − 2 isolation). |
| RED genuineness for the isolation test | Structurally corroborated | apply-progress claims the wiring was temporarily reverted to prove RED. Independently corroborated statically: `openapiSpec.ts:3` is `import swaggerJsdoc from 'swagger-jsdoc'`, so the old `index.ts → openapiSpec` import necessarily populated `require.cache` with `swagger-jsdoc` and necessarily matched `/openapiSpec/` in the source scan. Both assertions had to fail under the old wiring. |

**TDD Compliance**: 7/7 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 14 | 2 | node:test (9), jest (5) |
| Integration | 3 | 2 | jest + supertest, jest module registry |
| E2E | 0 | 0 | Playwright available, none added (correct — no UI surface) |
| **Total (new/rewritten)** | **17** | **4** | |

Matches the apply-progress count exactly (8 jest + 9 node:test).

### Changed File Coverage

| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `backend/src/infrastructure/openapi/openapiArtifact.ts` | 94.11 | 83.33 | L29 (boot `logger.warn` branch) | Excellent |
| `backend/src/infrastructure/routes/api/index.ts` | covered via `src/infrastructure/routes` aggregate | — | — | Excellent |
| `backend/scripts/generate-openapi-spec.js` | not instrumented | — | — | Out of `collectCoverageFrom` by design (`src/**` only) — expected per design.md |

**Average changed-file coverage (instrumented files)**: 94.11% line / 83.33% branch.
Whole-project coverage 94.63/85.08/89.75/95.29 is above the 90/80/85/90 thresholds.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `backend/src/infrastructure/openapi/__tests__/openapiArtifact.test.ts` | 59 | `expect(res.status.mock.calls.length + res.type.mock.calls.length).toBeGreaterThan(0)` | Cannot fail — the handler unconditionally calls `res.status` or `res.type` on every path, so this passes whether or not the default artifact loaded correctly. Does not verify what the test name claims. | WARNING |

**Assertion quality**: 0 CRITICAL, 1 WARNING. All other assertions verify real
behavior with concrete expected values (byte equality, exact status codes,
exact fix-command string, deep-equality against the committed artifact).
No tautologies, no ghost loops, no smoke-test-only cases, no mock-heavy files.

### Quality Metrics

**Linter**: No errors (`eslint src/`, exit 0).
**Type Checker**: No errors (`tsc --noEmit`, exit 0; and `tsc -p tsconfig.build.json`, exit 0).
**Architecture boundaries**: Pass (`architecture:check`, exit 0).

### Issues Found

**CRITICAL**: None.

**WARNING**:

1. **The 9-test `generate-openapi-spec.test.js` suite runs in no automated
   pipeline.** Jest's `testMatch` is
   `['**/src/**/*.test.js', '**/src/**/*.test.ts']` (`backend/jest.config.js:3`),
   which excludes `backend/scripts/`. The root `test:deploy-scripts` script is
   `node --test "scripts/deploy/**/*.test.js"` (`package.json:25`), whose glob
   does not match `backend/scripts/**`. No CI step invokes the new suite.
   Consequence: the only automated tests for the "Deterministic Build-Time
   Generation" and "CI Drift Detection" requirements execute only when a human
   runs them by hand. `tasks.md` 1.1 stated the file "mirrors
   `scripts/deploy/*.test.js` convention" — it mirrors the *style* but was never
   wired into the runner that executes those files. Suggested fix: change the
   root script to
   `node --test "scripts/deploy/**/*.test.js" "backend/scripts/**/*.test.js"`,
   or add a dedicated CI step. Note the live `check:openapi` CI gate still
   enforces drift itself, so the production guarantee holds; what is missing is
   regression protection for the generator's own logic.

2. **Non-falsifiable assertion** at `openapiArtifact.test.ts:59` (see Assertion
   Quality). The test titled "uses the module-level default artifact when none
   is passed" never asserts that the default artifact was actually loaded. It
   should assert `res.send` was called with the real committed file bytes.

3. **Spec wording vs. implementation, "Only the generation script depends on
   the generator library".** Static analysis across the backend source tree
   shows `backend/src/infrastructure/openapi/openapiSpec.ts:3` still contains
   `import swaggerJsdoc from 'swagger-jsdoc'`. The generation script is the only
   *entry point* into that module (which is what design.md decided: "a new
   plain-Node script becomes its only caller"), and the security goal —
   unreachability from any live Express request — is fully met and tested. But
   the scenario as literally written ("the dev-only generation script MUST be
   the only importer") is not literally true, and the covering test only scans
   `routes/api/index.ts`, not the whole tree. Recommend reconciling the spec
   sentence to "only caller / only reachable entry point" during archive rather
   than changing code.

**SUGGESTION**:

1. Nothing prevents a future regression from moving `swagger-jsdoc` back into
   `dependencies`; the "Devtime-Only Dependency Placement" requirement is
   verified only by a manual `pnpm audit --prod`. A three-line jest test
   asserting `backend/package.json`'s `dependencies` has no `swagger-jsdoc` key,
   or a `pnpm audit --prod` CI step, would make it self-guarding.
2. `openapiArtifact.ts:29` (the boot-time `logger.warn` branch) is the file's
   only uncovered line. Extracting the warn into a small exported function, or
   testing it via `jest.isolateModules` with a temporarily-renamed artifact,
   would close the last branch of the design's chosen missing-artifact
   behavior — currently only the 404 half is tested, not the warn half.
3. design.md's first Open Question (`swagger-jsdoc` glob ordering determinism
   across platforms) is still unchecked. Local Linux determinism is now proven
   (three identical SHA-256 digests from the real pipeline), and CI is
   `ubuntu-latest`, so risk is low — but the first CI run of the new
   `check:openapi` step is the real proof. Worth watching that one run.
4. `apply-progress.md` labels `openapiRequestPathIsolation.test.ts` as
   Integration in one place and the design labels the same idea Integration too;
   it is closer to an architectural/static-analysis guard than an integration
   test. Cosmetic only.

### Verdict

**PASS WITH WARNINGS** — all 3 warnings subsequently fixed and re-verified.

All 6 spec requirements are implemented and all 10 scenarios have covering tests
that passed at runtime under independent execution; both design-deferred
decisions (`backend/openapi.json` as the commit location, 404 + `logger.warn`
rather than a boot-time throw) were implemented exactly as decided; dependency
placement, CI wiring, scope boundaries, and repo conventions all check out; and
every apply-progress claim reproduced without discrepancy. The three warnings —
an orphaned test suite that no runner executes, one non-falsifiable assertion,
and a spec sentence that overstates what the code guarantees — were regression-
protection and wording gaps, not defects in shipped behavior, so none blocked
archive as originally verified.

### Post-Verify Fixes (applied after this report, before archive)

1. **Orphaned test suite (WARNING-1)**: extended root `package.json`'s
   `test:deploy-scripts` script glob from `"scripts/deploy/**/*.test.js"` to
   also include `"backend/scripts/**/*.test.js"`. Re-verified: the 9
   `generate-openapi-spec.test.js` tests now run inside `test:deploy-scripts`
   (49 pre-existing + 9 new = 58 total), which is already wired into
   `.github/workflows/ci.yml`'s `quality` job. Renamed that CI step from
   "Run deploy scripts unit tests (DB-independent)" to "Run standalone Node
   script unit tests (DB-independent)" to reflect the widened scope.
2. **Non-falsifiable assertion (WARNING-2)**: `openapiArtifact.test.ts`'s
   "uses the module-level default artifact when none is passed" test now
   asserts `res.send` was called with the actual committed file bytes
   (`fs.readFileSync(OPENAPI_ARTIFACT_PATH, 'utf-8')`), replacing the
   tautological `res.status.mock.calls.length + res.type.mock.calls.length
   > 0` check.
3. **Spec wording (WARNING-3)**: reconciled
   `api-contract-artifact/spec.md`'s "Only the generation script depends on
   the generator library" scenario to "Only the generation script is a
   reachable entry point to the generator library" — matching design.md's
   actual claim (only reachable caller, not literal sole importer;
   `openapiSpec.ts` still imports `swagger-jsdoc` but is unreachable from any
   live request).

**Re-verification after fixes**: `pnpm --filter backend test` → 117 suites,
956/956 passing (unchanged). `pnpm run test:deploy-scripts` → 58/58 passing
(49 + 9, confirmed the new script's tests execute). `pnpm run check:openapi`,
`pnpm --filter backend architecture:check`, `lint`, `type-check` → all exit 0,
no output. No regressions introduced by the fixes.
