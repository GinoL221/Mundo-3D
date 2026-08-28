# Tasks: Deploy Pipeline Foundations

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~470 total (env-preflight ~60, smoke-test ~140, migrate-and-start ~160, package.json edits ~10, RUNBOOKS ~50, plus ~50 misc) |
| 400-line budget risk | Medium (close to budget; design's "still small" undercounts test-file lines) |
| Chained PRs recommended | Yes (2 sequential PRs) |
| Suggested split | PR 1 = Work Unit A (env-preflight + smoke-test, standalone scripts+tests+docs stub), PR 2 = Work Unit B (migrate-and-start + integration test + package.json aliases + RUNBOOKS completion) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Per-file estimate: `env-preflight.js` ~35 + `env-preflight.test.js` ~50 = ~85. `smoke-test.js` ~90 + `smoke-test.test.js` ~110 (fixture HTTP server) = ~200. `migrate-and-start.js` ~80 + `migrate-and-start.test.js` ~130 (spawn/spawnSync mocking, signal-forwarding) = ~210. Integration test ~70. `backend/package.json` + root `package.json` ~10. `docs/RUNBOOKS.md` ~55. Total ≈ 630 lines — above design's own "still small" framing once test-file line counts are counted, and above the 400-line single-PR budget. Splitting at the natural dependency seam (env-preflight + smoke-test have zero interdependency and no subprocess-mocking complexity; migrate-and-start + its integration test are the heaviest, most interdependent unit) keeps each PR reviewable and each PR's own diff under budget.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| A | `env-preflight.js` + `smoke-test.js`, their `node --test` unit tests, root `test:deploy-scripts` alias | PR 1 | `node --test scripts/deploy/env-preflight.test.js scripts/deploy/smoke-test.test.js` | N/A — pure unit tests with fixture HTTP server; no real running instance needed for this PR | Revert `scripts/deploy/env-preflight.js`, `scripts/deploy/smoke-test.js`, their test files, and the root `test:deploy-scripts` script; nothing else references them yet |
| B | `migrate-and-start.js` + its unit test + real-DB integration test + `backend/package.json` deploy aliases + `docs/RUNBOOKS.md` Deploy Pipeline section | PR 2 (bases on PR 1 after merge) | `node --test scripts/deploy/migrate-and-start.test.js` then `cd backend && npm run test:integration -- deploy-migrate-and-start` | `pnpm --filter backend dev` locally, then `node scripts/deploy/smoke-test.js` against it (manual/CI step named in RUNBOOKS) | Revert `scripts/deploy/migrate-and-start.js`, its test, the integration test, the `backend/package.json` alias additions, and the RUNBOOKS section; Unit A's two scripts stay functional and undisturbed |

## Work Unit A: env-preflight + smoke-test

### Phase 1: `env-preflight.js`

- [x] 1.1 RED: create `scripts/deploy/env-preflight.test.js` (`node --test`) covering `checkEnv(env)`: (a) all 9 required vars present + `COOKIE_DOMAIN` present → `{ missing: [], warnings: [] }`; (b) all required present, `COOKIE_DOMAIN` absent → `{ missing: [], warnings: ['COOKIE_DOMAIN'] }`; (c) 3 required vars absent (e.g. `JWT_SECRET`, `DB_PASS`, `PUBLIC_API_URL`) → `missing` contains exactly those 3, in `REQUIRED` array order; (d) empty-string value counts as unset (falsy check, matches `!env[k]`). Import `checkEnv` from `./env-preflight` (will not resolve yet — expected RED).
- [x] 1.2 GREEN: create `scripts/deploy/env-preflight.js` per design's exact interface — `REQUIRED = ['JWT_SECRET', 'CORS_ORIGIN', 'COOKIE_SECRET', 'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_HOST', 'PUBLIC_API_URL']`, `WARN_ONLY = ['COOKIE_DOMAIN']`, `checkEnv(env = process.env)` returns `{ missing: REQUIRED.filter(k => !env[k]), warnings: WARN_ONLY.filter(k => !env[k]) }`; export `{ checkEnv, REQUIRED, WARN_ONLY }`. Run 1.1 to GREEN.
- [x] 1.3 GREEN: add the `if (require.main === module)` CLI guard to `env-preflight.js` — calls `checkEnv()` against `process.env`; if `missing.length > 0`, prints `[env-preflight] FAIL: N required production env var(s) missing: <comma-joined>` and sets `process.exitCode = 1`; for each warning prints `[env-preflight] WARN: <VAR> not set — required only for the cross-subdomain cookie topology; safe to ignore on a single-domain deploy.`; if `missing.length === 0` leaves `process.exitCode` unset (implicit 0). All messages print together in one pass — no interactive prompting.
- [x] 1.4 Add a `node --test` case exercising the CLI guard path indirectly is optional; the acceptance bar for this task is `checkEnv()` coverage from 1.1 — do not add subprocess-spawning tests here (that pattern belongs to Unit B's `migrate-and-start.test.js`).

### Phase 2: `smoke-test.js`

- [x] 2.1 RED: create `scripts/deploy/smoke-test.test.js` (`node --test`) with a fixture `http.createServer` helper controlling per-path response sequences. Cases: (a) both `/health/live` and `/health/ready` return 200 immediately → `run({ baseUrl, timeoutMs: 5000 })` resolves/exits 0 well before `timeoutMs` elapses (assert elapsed time bound, not just the outcome, per spec scenario "must not report failure due to unrelated polling delay"); (b) `/health/ready` returns 503 for the entire `timeoutMs` window → exit non-zero after timeout elapses, never before; (c) `/health/live` returns 503 for the first N poll ticks then 200, and `/health/ready` returns 200 immediately after that — assert `/health/ready` was never polled before `/health/live` first returned 200 (spec scenario "waits for liveness before checking readiness"); (d) base URL refuses connections (server not started / wrong port) → exit non-zero, no unhandled rejection. Import `run` from `./smoke-test` (RED — module does not exist yet).
- [x] 2.2 GREEN: create `scripts/deploy/smoke-test.js` exporting `run({ baseUrl, timeoutMs = 60000 } = {})` using Node's `http`/`https` builtins (choose module by `baseUrl` protocol): poll `GET {baseUrl}/health/live` at a fixed 1000ms interval (per design) until it returns 200 or `timeoutMs` elapses (treat connection-refused/errors as a failed attempt, not a thrown exception, so polling continues); once live succeeds, begin polling `GET {baseUrl}/health/ready` the same way against the *remaining* time budget. Resolve/return an object or throw distinguishing success vs timeout — pick one shape and use it consistently in the CLI guard (2.3). Run 2.1 to GREEN.
- [x] 2.3 GREEN: add the CLI guard — reads `SMOKE_TEST_BASE_URL` env var or `process.argv[2]` as a positional base-URL fallback (env var takes precedence per design), `SMOKE_TEST_TIMEOUT_MS` env var (parsed int, default 60000) or the `run()` default; calls `run({ baseUrl, timeoutMs })`; on success sets exit code 0 (implicit) and prints elapsed time + both endpoints' final status; on failure sets `process.exitCode = 1` and prints elapsed time plus the last observed status/error for whichever phase failed (live or ready), per design's "actionable CI log" requirement.
- [x] 2.4 Verify no `console.log` was left uncommented for debug-only output beyond the two intentional log lines described in 1.3/2.3 (AGENTS.md: no stray `console.log` in production code paths — CLI-output prints in a CLI-guard script are the intended exception, not a violation, but keep them to the documented lines only).

### Phase 3: Root Test Alias + Unit A Verification

- [x] 3.1 Modify root `package.json` — add `"test:deploy-scripts": "node --test \"scripts/deploy/**/*.test.js\""` to `scripts`. **Deviation from design**: `node --test scripts/deploy` (a bare directory path) does NOT do recursive test-file discovery in this Node version — it's resolved as a module path to `require`, producing `MODULE_NOT_FOUND`. Confirmed via direct reproduction. An explicit glob is required for directory-based discovery to actually work.
- [x] 3.2 Run `pnpm test:deploy-scripts` — both `env-preflight.test.js` and `smoke-test.test.js` pass GREEN (8/8 tests).
- [x] 3.3 Confirm `backend/jest.config.js`'s `testMatch: ['**/src/**/*.test.js', ...]` does not pick up `scripts/deploy/*.test.js` (path is outside `backend/src/`) — run `cd backend && npm test` and confirm no new files were collected.

## Work Unit B: migrate-and-start + Integration + Docs

### Phase 4: `migrate-and-start.js`

- [ ] 4.1 RED: create `scripts/deploy/migrate-and-start.test.js` (`node --test`, `node:test`'s `mock` module) mocking `child_process.spawnSync` (for `db:migrate`) and `child_process.spawn` (for `start`). Cases: (a) `db:migrate` spawnSync returns `{ status: 0 }` → `spawn` is called exactly once with `('pnpm', ['--filter', 'backend', 'start'], expect.objectContaining({ cwd: REPO_ROOT }))` (spec scenario "Successful deploy runs all three steps in order" — build is out of scope per design, only migrate→start here); (b) `db:migrate` spawnSync returns `{ status: 1 }` → `spawn` (`start`) is never called, and `run()` resolves/exits with the same non-zero code (spec scenario "A failed migration blocks the start step"); (c) both spawn calls use a fixed argv array and `shell: false` (or omitted, since that is the default) — assert no shell-string interpolation; (d) sending `SIGTERM` to the wrapper process while the `start` child is running results in `child.kill('SIGTERM')` being called on the spawned child (signal-forwarding); same for `SIGINT`. Import `run` from `./migrate-and-start` (RED — module does not exist yet).
- [ ] 4.2 GREEN: create `scripts/deploy/migrate-and-start.js` exporting `run()` — resolves `REPO_ROOT = path.resolve(__dirname, '..', '..')`; calls `spawnSync('pnpm', ['--filter', 'backend', 'db:migrate'], { cwd: REPO_ROOT, stdio: 'inherit', shell: false })`; if `status !== 0`, returns/sets exit code to that non-zero status without spawning `start`. Run case (a) and (b) from 4.1 to GREEN.
- [ ] 4.3 GREEN: on migrate success, `spawn('pnpm', ['--filter', 'backend', 'start'], { cwd: REPO_ROOT, stdio: 'inherit', shell: false })`; wire `run()`'s resolution to the child's `exit` event, propagating its exit code as `run()`'s own result/`process.exitCode`. Run case (c) to GREEN.
- [ ] 4.4 GREEN: register `process.on('SIGTERM', ...)` / `process.on('SIGINT', ...)` handlers (only while the `start` child is active) that call `child.kill(signal)` to forward the exact received signal to the spawned `start` child. Run case (d) to GREEN.
- [ ] 4.5 GREEN: add the `if (require.main === module)` CLI guard invoking `run()` and setting `process.exitCode` from its result; export `{ run }`.

### Phase 5: Real-DB Integration Test

- [ ] 5.1 RED: create `backend/src/__tests__/deploy-migrate-and-start.integration.test.js` (Jest, real MySQL, reuses `bootstrapTestDatabase()`/`closeTestDatabase()` from `backend/src/__tests__/helpers/testDb.ts`, same real-child-process pattern as `boot.integration.test.js`). Case 1: spawn `node ../../scripts/deploy/migrate-and-start.js` (or invoke `run()` directly if it does not require a fresh process — prefer spawning the real script per design's "real-child-process pattern", matching `boot.integration.test.js`'s style) against the test DB env (`NODE_ENV=test`, `PORT=0`, valid `DB_*` vars), assert it reaches a listening state and `GET /health/ready` eventually returns 200 within a bounded wait (mirrors `boot.integration.test.js`'s `waitFor`/`extractPort` helpers — consider extracting/reusing them if duplicating verbatim exceeds the 250-line file cap). Case 2: same spawn with a deliberately wrong `DB_PASS`, assert non-zero exit and that the server never bound to a port (no port ever extracted from stdout within the wait window). This test only compiles once `migrate-and-start.js` exists — expected to fail to run meaningfully before Phase 4 lands.
- [ ] 5.2 GREEN: confirm both cases in 5.1 pass against a real local/CI MySQL instance via `cd backend && npm run test:integration`. No production code changes should be needed here if Phase 4's `migrate-and-start.js` already behaves correctly — this phase is verification, not new implementation. If a gap surfaces (e.g., the script's stdio/exit-code contract doesn't match what a real spawn produces), return to Phase 4 to fix it, keeping 4.1's unit tests green.
- [ ] 5.3 Confirm this new file lands in the `*.integration.test.(ts|js)` naming convention so `backend/jest.config.js`'s `testPathIgnorePatterns` excludes it from `pnpm test`/`test:fast`, and `backend/jest.integration.config.js` picks it up for `test:integration` only.

### Phase 6: Package Script Aliases

- [ ] 6.1 Modify `backend/package.json` — add to `scripts`: `"deploy:migrate-and-start": "node ../scripts/deploy/migrate-and-start.js"`, `"deploy:smoke-test": "node ../scripts/deploy/smoke-test.js"`, `"deploy:env-preflight": "node ../scripts/deploy/env-preflight.js"`.
- [ ] 6.2 Run each new `backend` alias once manually against a locally running dev instance (`pnpm --filter backend dev` in one terminal, then `pnpm --filter backend deploy:smoke-test` in another) to confirm the relative `../scripts/deploy/*.js` path resolves correctly from `backend/`'s cwd (proves the `cwd`-independence design decision holds for the actual alias invocation, not just the script's internal `REPO_ROOT` logic).

### Phase 7: RUNBOOKS.md Documentation

- [ ] 7.1 Modify `docs/RUNBOOKS.md` — append a new `## Deploy Pipeline` section immediately after the existing "Compiled production start" section (current last section). Content: the 4-step sequence `pnpm --filter backend build` → `pnpm --filter backend deploy:env-preflight` → `pnpm --filter backend deploy:migrate-and-start` → `pnpm --filter backend deploy:smoke-test` (or root `test:deploy-scripts` reference for local script testing), with each step's exact command and what its exit code means (non-zero at any step stops the sequence; that step's failure category — build/compile vs preflight/config vs migrate/runtime vs smoke/health).
- [ ] 7.2 In the same section, add a `### Migration authoring: expand/contract` subsection stating, per spec's exact requirement wording, that schema migrations must remain compatible with both the previous and new app version during a deploy window (additive changes first; destructive changes — drops, renames, `NOT NULL` tightening — only once the old code path is confirmed gone), that this is a manual authoring discipline rather than anything enforced by a script or lint rule, and that `db:migrate:down` remains a manual last resort rather than the primary safety net.
- [ ] 7.3 Verify the new section names all three scripts (deploy sequencing / migrate-and-start, smoke test, env-preflight) together in one place per spec scenario "RUNBOOKS documents all three scripts".

### Phase 8: Unit B Full Verification

- [ ] 8.1 Run `node --test scripts/deploy` — all three scripts' unit test files pass GREEN together.
- [ ] 8.2 Run `cd backend && npm run test:integration` — the new integration test passes against a real DB.
- [ ] 8.3 Run `pnpm test` (root) — confirm no regression in the existing suite; confirm `scripts/deploy/*.test.js` is not picked up by any Jest config (only by `node --test`).
- [ ] 8.4 Confirm every file created stays under the 250-line cap (`AGENTS.md`); `migrate-and-start.test.js` and `smoke-test.test.js` are the largest risk given fixture/mock setup — split into a small local test-helper module within `scripts/deploy/` if either approaches the limit (test files are exempt from the cap per `AGENTS.md`, but keep an eye on it anyway for readability).
- [ ] 8.5 Cross-check spec.md's 4 requirements and their 9 scenarios against the tests written: Ordered Deploy Sequencing (3 scenarios → 4.1 cases a/b + design's build-step exclusion note), Post-Deploy Smoke Test (3 scenarios → 2.1 cases a/b/c), Required Production Environment Variable Preflight (2 scenarios → 1.1 cases a/c, 1.3's before-app-start CLI framing), Deploy Pipeline Documentation (2 scenarios → 7.1/7.2/7.3). Confirm none are unaddressed before calling this change ready for `sdd-verify`.

## Key Learnings

1. Design's own "still small" effort estimate only counted production files; adding realistic test-file line counts (spawn/spawnSync mocking, fixture HTTP servers) pushes the total near/above the 400-line single-PR budget, so the forecast recommends 2 chained PRs.
2. `backend/jest.config.js`'s `testMatch` is scoped to `**/src/**/*.test.js`, so `scripts/deploy/*.test.js` is naturally invisible to Jest without any extra exclusion config — confirmed by reading the config directly rather than assuming.
3. The natural PR split follows dependency complexity, not just the design's own groupings: env-preflight + smoke-test have no subprocess-mocking need and no interdependency, while migrate-and-start + its integration test are the heaviest and should ship together with the doc section that describes them.
4. `boot.integration.test.js` already establishes the exact spawn/waitFor/extractPort pattern the new integration test should reuse, avoiding pattern drift between the two integration tests.

## Result Contract

- status: done
- executive_summary: 8 phases / 27 checkbox tasks across 2 sequential work units (Unit A: env-preflight + smoke-test, ~285 lines, low risk; Unit B: migrate-and-start + integration test + package.json + docs, ~345 lines, medium risk due to spawn/signal mocking) — chained PRs recommended since combined ~630-line estimate exceeds the 400-line ask-on-risk budget as a single PR.
- artifacts: openspec/changes/deploy-topology/tasks.md
- next_recommended: sdd-apply
- risks: Unit B's integration test (Phase 5) depends on Unit A merging only loosely (no shared files) but strictly depends on Phase 4 (`migrate-and-start.js`) within the same PR; signal-forwarding (4.4) and the real-DB integration test's negative case (5.1 case 2, bad credentials never binding a port) are the two most failure-prone tasks and deserve extra reviewer attention; `docs/RUNBOOKS.md` edit is a single shared file — if Unit A and Unit B PRs both touched it there would be a merge conflict, so RUNBOOKS.md is deliberately assigned entirely to Unit B.
- skill_resolution: paths-injected
