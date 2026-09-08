# Apply Progress: Home Responsive System

> Reconciliation note (2026-09-07): Entries below are chronological evidence for the original `959/960` contract and are preserved as historical run records. The committed implementation and current E2E contract now use compact navigation/two columns through `1023px` and exposed navigation/viable three columns from `1024px`. The current matrix has 13 cases (`320`, `360`, `375`, `639`, `640`, `768x1024`, `820`, `960`, `1023`, `1024x768`, `1279`, `1280`, `1440`). This documentation-only reconciliation did not execute that matrix or create/update screenshots; historical pass statements below do not prove the revised `1023/1024` contract.

## Work Unit 1: Disclosure Contract

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)

### Completed Tasks

- [x] 1.1 Add RED cases in `frontend/src/scripts/homeMenu.test.ts` for 959/960 transitions, Enter/Space, Escape focus restore, outside focus/click, stable control relation, and cleanup.
- [x] 1.2 Harden `frontend/src/scripts/homeMenu.ts` and `frontend/src/components/HomeHeader.astro` so native disclosure state, stable ID, and non-modal ordinary links meet those cases.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm --filter frontend exec vitest run src/scripts/homeMenu.test.ts --pool=forks --maxWorkers=1` — exit 0; 1 test file and 9 tests passed.                                                                         |
| Runtime harness command/scenario and exact result | Same focused Vitest fake-DOM harness — exit 0; verified compact disclosure at 959px, exposed state at 960px, keyboard-originated native button clicks, Escape focus restoration, focus/click exit, and cleanup.     |
| Rollback boundary                                 | Revert `frontend/src/scripts/homeMenu.ts`, `frontend/src/scripts/homeMenu.test.ts`, and the `hidden` attribute in `frontend/src/components/HomeHeader.astro`; this removes only Home disclosure lifecycle behavior. |

### Notes

- The pre-production RED run failed for missing outside-focus closure and fixture setup for the stable control relation. The implementation adds `focusin` closure, cleans it up, and makes desktop controls inert so exposed navigation remains synchronized.
- The project script form `pnpm --filter frontend test -- homeMenu.test.ts` ran unrelated test files in this workspace. The direct Vitest invocation above isolated the assigned test file.

### Remaining Tasks

- [ ] 2.1 Add failing matrix assertions in `e2e/tests/home-responsive.spec.ts` for the required viewports, grid/frame/type/target/identity metrics, navigation, and no overflow.
- [ ] 2.2 Consolidate mobile-first tokens and invariant styling in Home CSS files.
- [ ] 2.3 Make `home-responsive.css` the sole viewport owner and remove obsolete responsive imports/files.
- [ ] 3.1 Create deterministic payloads and responsive browser evidence.
- [ ] 3.2 Add product-loading integration coverage.
- [ ] 3.3 Run the final responsive checks and confirm unrelated paths remain untouched.

## Work Unit 2: Responsive CSS System

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)
**Status:** Recovery candidate prepared; blocked by the required browser harness, so no Phase 2 checkbox is marked complete.
**Failed evidence revision remediated:** `sha256:9f546fd8135b8ad9201da4a60570258844765d2f3f36e8c33a1593866754f37d`

### Recovery Work Performed

- Retained the non-fixtured responsive assertion contract in `e2e/tests/home-responsive.spec.ts`; its 12 explicit matrix cases register successfully, but it cannot be completed without the Unit 3 deterministic product fixture because cards are required for its metrics.
- Split the 405-line responsive layer into `home-responsive-base.css` and `home-responsive-desktop.css`, both imported only through `home-responsive.css`. This keeps `home-responsive.css` as the single Layout import and all Home source files below the repository's 250-line limit.
- Kept the mobile-first `640px` and desktop `960px` boundaries unchanged, retained the `360px` safeguard and reduced-motion handling, and isolated Home theme/wordmark rules in `home-brand.css` so `home-shell.css` is within the source-file limit.
- Confirmed `Layout.astro` imports the Home responsive entry point once. Obsolete `home-tablet.css` and `home-mobile.css` are absent from the worktree and have no imports to remove.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm frontend:check` — exit 0; Astro checked 88 files with 0 errors, 0 warnings, and 0 hints. `pnpm --filter e2e exec playwright test --list tests/home-responsive.spec.ts` — exit 0; 12 explicit Chromium matrix tests registered.                                                                                                                                                                                                                        |
| Runtime harness command/scenario and exact result | `pnpm test:e2e -- home-responsive.spec.ts` — exit 1 before tests ran; Playwright reported `Process from config.webServer exited early`. A bounded direct configured-backend probe did not bind port 3032 within 20 seconds. The diagnostic control with only `TS_NODE_TRANSPILE_ONLY=true` added returned `GET /health/ready` as HTTP 200, but that environment is not part of the preserved Playwright configuration and was not used as passing evidence. |
| Rollback boundary                                 | Revert the Work Unit 2 Home CSS/import changes in `frontend/src/layouts/Layout.astro`, `frontend/src/styles/components/home-shell.css`, `home-brand.css`, `home-responsive.css`, `home-responsive-base.css`, and `home-responsive-desktop.css`; this restores the prior responsive-layer organization without affecting disclosure logic, product loading, or non-Home pages.                                                                               |

### Notes

- The configured Playwright process setup remains unchanged as required by the design. The backend startup/readiness failure is outside the Phase 2 source boundary; no backend or `e2e/playwright.config.ts` change was made to hide it.
- The fresh browser failure differs from the failed revision's 60-second timeout: Playwright now reports an early configured-webServer exit. Its child output does not expose a deeper error, so the readiness issue remains unresolved and the required runtime evidence is still unavailable.
- This honest CSS split exceeds the 400-line review budget when measured as a standalone diff because moving the former 405-line owner into cohesive files necessarily records both deletions and additions. It needs a maintainer-approved `size:exception` or a different delivery boundary before any PR work.

## Recovery Replan

- The maintainer-authorized reset separates CSS ownership from browser evidence. Work Unit 2 now contains CSS splitting, token consolidation, and responsive-layer ownership only.
- The existing non-fixtured `e2e/tests/home-responsive.spec.ts` draft is retained for Work Unit 3 task 3.1 and remains unverified until deterministic fixtures and a reachable browser harness are available.
- Backend webServer readiness remains a separate remediation concern; no backend or `e2e/playwright.config.ts` change is authorized by this replan.

## Browser Slice Replan

- The next native objective is limited to tasks 3.1–3.2: responsive assertions, deterministic fixtures, and list-only registration that does not require the failing backend webServer.
- Backend readiness, browser screenshots, loading scenarios, and final focused checks move to Phase 4 tasks 4.1–4.4 and require a separate bounded attempt.
- The preserved Playwright process contract must not be weakened or bypassed to manufacture browser evidence.

## Work Unit 2: CSS Ownership Primitives Completion

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)
**Remediation attempt:** `sha256:12591d0eff88c800b43a2f1d6fb34461d1f00f7b064eb8968a49417abe0eb91c`
**Failed evidence revision addressed:** `sha256:b432170ad7eada30e2df8ef2798c014941b05642d597e8db8fc2678efde5b727`

### Completed Tasks

- [x] 2.1 Split responsive ownership into cohesive Home CSS files, keeping every source file under 250 lines and preserving existing selectors/tokens.
- [x] 2.2 Consolidate mobile-first tokens and invariant styling in `frontend/src/styles/components/home-shell.css`, `frontend/src/styles/components/home.css`, `frontend/src/styles/components/home-products.css`, and `frontend/src/styles/components/home-footer.css`.
- [x] 2.3 Make `frontend/src/styles/components/home-responsive.css` the sole viewport owner; remove imports in `frontend/src/layouts/Layout.astro` and delete obsolete responsive layers.

### Implementation State

- `home-responsive.css` is the sole Layout-imported viewport entry point and imports the cohesive mobile-first base and `960px` desktop layers.
- Invariant Home tokens and visual rules remain in `home-shell.css`, `home-brand.css`, `home.css`, `home-products.css`, and `home-footer.css`.
- `Layout.astro` has one Home responsive entry import; `home-tablet.css` and `home-mobile.css` are absent, with no obsolete layer import retained.

### Source File Size and Change Evidence

| File                          | Lines | Evidence                                                       |
| ----------------------------- | ----: | -------------------------------------------------------------- |
| `home-shell.css`              |   219 | Under the 250-line source-file limit.                          |
| `home-brand.css`              |    35 | Under the 250-line source-file limit.                          |
| `home.css`                    |   239 | Under the 250-line source-file limit.                          |
| `home-products.css`           |   218 | Under the 250-line source-file limit.                          |
| `home-footer.css`             |   154 | Under the 250-line source-file limit.                          |
| `home-responsive.css`         |     2 | Single responsive entry import.                                |
| `home-responsive-base.css`    |   236 | Mobile defaults and the `640px` grid mode.                     |
| `home-responsive-desktop.css` |   168 | `960px` desktop mode, `360px` safeguard, and motion reduction. |

- The current remediation attempt made no additional production-source changes beyond the inherited CSS recovery candidate.
- Relative to the repository baseline, the inherited CSS candidate plus the Layout import is 1,296 lines (`1,271` untracked CSS additions plus `25` Layout additions/deletions). It cannot be presented as one <=400-line review diff without an explicit `size:exception` or an already-established narrower base; no commit or PR was created here.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm frontend:check` — exit 0; Astro checked 88 files with 0 errors, 0 warnings, and 0 hints.                                                                                                                                                                                                                                          |
| Runtime harness command/scenario and exact result | N/A for this CSS ownership-only work unit. Browser matrix evidence is explicitly reserved for Work Unit 3, and the configured Playwright command was not run because backend readiness remains an unresolved, out-of-scope boundary.                                                                                                    |
| Rollback boundary                                 | Revert `frontend/src/layouts/Layout.astro` Home imports and `frontend/src/styles/components/home-{shell,brand,footer,products,responsive,responsive-base,responsive-desktop}.css`; this removes only the Home CSS ownership system and does not affect disclosure logic, product loading, backend startup, or Playwright configuration. |

### Remaining Blockers

- Work Unit 3 owns the existing unverified `e2e/tests/home-responsive.spec.ts` draft, deterministic fixture work, and all browser evidence.
- The configured Playwright backend-readiness boundary remains unresolved and was intentionally not changed or exercised in this slice.
- The inherited baseline diff exceeds the 400-line review budget; a future delivery owner needs an explicit `size:exception` or a narrower stacked base before opening a PR.

## Work Unit 3: Responsive Browser Contract

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)
**Runtime attempt:** `sha256:46788bfc40f089300678fa2756e9ede277a5559752b7979389fb37aff3a5f645`

### Completed Tasks

- [x] 3.1 Add failing matrix assertions in `e2e/tests/home-responsive.spec.ts` for required viewports, grid/frame/type/target/identity metrics, navigation, and no overflow.
- [x] 3.2 Create deterministic payloads in `e2e/fixtures/homeProducts.ts` and register the responsive scenarios with fixed theme, motion, fonts, Chromium, and rendering assumptions; list-only registration is the complete evidence for this unit.

### Implementation State

- The responsive contract registers one explicit Chromium case for every approved viewport: `320`, `360`, `375`, `639`, `640`, `768x1024`, `959`, `960`, `1024x768`, `1279`, `1280`, and `1440`.
- Each case fixes light theme, reduced motion, a 1x non-mobile context, `es-AR` locale, UTC time zone, local deterministic products, and font/placeholder-image readiness before its assertions.
- The matrix asserts grid columns, 280px card minimum, 44px local product-target policy, 16px body minimum, 75ch prose cap, bounded headings, 1104px frame fit, uncropped logo behavior, compact/exposed navigation contract, ordinary-link semantics, and no horizontal overflow.
- No screenshot, backend readiness, live browser execution, loading outcome, hydration, CSS, or Playwright configuration change was made.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm --filter e2e exec playwright test --list tests/home-responsive.spec.ts` — exit 0; 12 Chromium tests in 1 file registered, one for each required viewport.                                                                                                  |
| Runtime harness command/scenario and exact result | N/A — this unit is explicitly list-only. The preserved configured backend/browser harness and screenshot capture are Phase 4 work and were not launched.                                                                                                         |
| Rollback boundary                                 | Revert `e2e/fixtures/homeProducts.ts` and `e2e/tests/home-responsive.spec.ts`; this removes only deterministic Home responsive registration and assertions, without changing Home runtime behavior, backend readiness, screenshots, or Playwright configuration. |

### Deviations

None — implementation matches the browser-contract replan. Reduced motion remains controlled through `page.emulateMedia()` because the installed Playwright type surface does not expose it as a `test.use()` option.

### Remaining Tasks

- [ ] 4.1 Establish a reachable configured backend webServer readiness boundary without weakening or bypassing the preserved `e2e/playwright.config.ts` process contract.
- [ ] 4.2 Complete responsive browser evidence in fixed Chromium across the approved viewport matrix with screenshots and no overflow assertions.
- [ ] 4.3 Add `e2e/tests/home-product-loading.spec.ts` routed success, empty, and error assertions that preserve `frontend/src/pages/index.astro` hydration and content regions.
- [ ] 4.4 Run `pnpm frontend:check`, focused Vitest, and focused Playwright tests; confirm unrelated paths are untouched.

## Work Unit 4: Responsive Runtime Evidence

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)
**Runtime attempt:** `sha256:0359219c2c7f3c22c99edc8b143398f64af0bb741305ce8ab8b98560de0f69d4`
**Status:** Partial — backend readiness is proven, but configured Chromium execution is blocked before test execution by an unrelated Astro dev-server registry entry.

### Completed Tasks

- [x] 4.1 Establish a reachable configured backend webServer readiness boundary without weakening or bypassing the preserved `e2e/playwright.config.ts` process contract.

### In-Progress Tasks

- [ ] 4.2 Complete responsive browser evidence in fixed Chromium across the approved viewport matrix with screenshots and no overflow assertions.
- [ ] 4.3 Add `e2e/tests/home-product-loading.spec.ts` routed success, empty, and error assertions that preserve `frontend/src/pages/index.astro` hydration and content regions.
- [ ] 4.4 Run `pnpm frontend:check`, focused Vitest, and focused Playwright tests; confirm unrelated paths are untouched.

### Implementation State

- The backend starts under the exact environment from the unchanged `e2e/playwright.config.ts` command and responds to `GET /health/ready` with `{"status":"ok"}` on port 3032. No Playwright configuration, alternate environment variable, test-only backend mock, or direct server was used as browser-passing evidence.
- `e2e/tests/home-responsive.spec.ts` now records one fixed-Chromium full-page screenshot assertion for each approved matrix case. The run did not reach a browser, so no screenshots or baselines were generated.
- `e2e/tests/home-product-loading.spec.ts` adds routed success, empty, and error checks against the existing Home content regions and hydration flow without changing `frontend/src/pages/index.astro`.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm frontend:check` — exit 0; Astro checked 88 files with 0 errors, 0 warnings, and 0 hints. `pnpm --filter frontend exec vitest run src/scripts/homeMenu.test.ts --pool=forks --maxWorkers=1` — exit 0; 1 test file and 9 tests passed. `pnpm --filter e2e exec playwright test --list tests/home-responsive.spec.ts tests/home-product-loading.spec.ts` — exit 0; 15 Chromium tests in 2 files registered.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Runtime harness command/scenario and exact result | Exact configured backend process: `NODE_ENV=test PORT=3032 CORS_ORIGIN=http://localhost:4322 JWT_SECRET=e2e-only-jwt-secret-not-for-production COOKIE_SECRET=e2e-only-cookie-secret-not-for-production LOGIN_LIMIT_MAX=1000 REGISTER_LIMIT_MAX=1000 ACCOUNT_LOGIN_LIMIT_MAX=1000 pnpm --filter backend start`, followed by `curl --fail --silent --show-error --max-time 5 http://localhost:3032/health/ready` — exit 0; `{"status":"ok"}`. Focused configured Playwright: `pnpm test:e2e -- tests/home-responsive.spec.ts tests/home-product-loading.spec.ts --update-snapshots` — exit 1 before any test ran; the frontend `webServer` command exited because Astro reported an existing server at `http://127.0.0.1:4321` (PID 1403053), preventing the configured command from binding port 4322. No browser evidence was manufactured. |
| Rollback boundary                                 | Revert the screenshot assertion in `e2e/tests/home-responsive.spec.ts` and remove `e2e/tests/home-product-loading.spec.ts`; this removes only the Phase 4 browser/loading coverage and leaves prior CSS, disclosure, Home hydration, backend implementation, and Playwright configuration untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Deviations

None — no approved CSS, disclosure, Home hydration, backend source, or Playwright process-contract changes were made.

### Unresolved Risks

- The machine-level Astro dev-server registry reports an unrelated background server at port 4321 (PID 1403053, uptime 114100 seconds). The preserved configured frontend command therefore exits instead of starting at port 4322. Stopping or replacing that external process was outside this bounded slice, so Chromium execution, screenshot capture, and loading-runtime evidence remain unavailable.
- `4.3` remains unchecked despite its authored test because the required configured runtime harness did not execute it.

## Work Unit 4: Responsive Runtime Evidence Retry

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)
**Runtime attempt:** `sha256:d6e1c69fdd3345912d462a8b6ff16ad8904b77bd14b495458d2344bd46efac7a`
**Failed evidence revision under remediation:** `sha256:ac6be1ec956938fb22bfdad5fdc162ae3f237e263ef5bf71309dc9d9d273a6b3`
**Status:** Blocked — the preserved configured Playwright `webServer` process exited before any Chromium test executed.

### Completed Tasks

- [x] 4.1 Establish a reachable configured backend webServer readiness boundary without weakening or bypassing the preserved `e2e/playwright.config.ts` process contract. (Previously completed; not re-executed or re-counted in this retry.)

### In-Progress Tasks

- [ ] 4.2 Complete responsive browser evidence in fixed Chromium across the approved viewport matrix with screenshots and no overflow assertions.
- [ ] 4.3 Add `e2e/tests/home-product-loading.spec.ts` routed success, empty, and error assertions that preserve `frontend/src/pages/index.astro` hydration and content regions.
- [ ] 4.4 Run `pnpm frontend:check`, focused Vitest, and focused Playwright tests; confirm unrelated paths are untouched.

### Retry Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm test:e2e -- tests/home-responsive.spec.ts tests/home-product-loading.spec.ts --update-snapshots` — exit 1; 0 Chromium tests executed and 0 screenshots were generated. Playwright invoked `node index.js` and `astro dev --port 4322`, then reported `Error: Process from config.webServer exited early.`                                                              |
| Runtime harness command/scenario and exact result | Same preserved configured Playwright command — exit 1 before readiness and test execution. The output identifies the configured backend and Astro commands but does not identify which child process exited or emit child stderr, so no narrower root cause is asserted. No direct server, alternate environment, configuration change, or manufactured screenshot was used. |
| Rollback boundary                                 | Revert only this retry record in `openspec/changes/home-responsive-system/apply-progress.md`; no implementation, test, configuration, or screenshot artifact was changed by this attempt.                                                                                                                                                                                    |

### Notes

- The maintainer-authorized stale Astro process reset did not make the configured harness pass. The current failure is recorded exactly as Playwright emitted it and is distinct from the prior port-4321 registry diagnosis.
- `4.2`, `4.3`, and `4.4` remain unchecked because the single authorized runtime attempt did not reach the browser. `4.1` remains complete but was neither rewritten nor counted as new work.
- The worktree inventory remains limited to the pre-existing modified and untracked paths; this retry added no source, test, baseline, or configuration changes.

## Work Unit 4: Responsive Runtime Evidence Foreground Retry

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)
**Runtime attempt:** `sha256:a92c932fe3b7df4c603f827b641b83a731d4e2aecdfb202d65fc3b7af15a58f9`
**Failed evidence revision under remediation:** `sha256:ac6be1ec956938fb22bfdad5fdc162ae3f237e263ef5bf71309dc9d9d273a6b3`
**Status:** Blocked — the unchanged configured Playwright harness started and ran Chromium, but the Astro server stopped while loading the first Home test. No task is complete.

### Completed Tasks

- [x] 4.1 Establish a reachable configured backend webServer readiness boundary without weakening or bypassing the preserved `e2e/playwright.config.ts` process contract. (Previously completed; not re-executed or re-counted in this retry.)

### In-Progress Tasks

- [ ] 4.2 Complete responsive browser evidence in fixed Chromium across the approved viewport matrix with screenshots and no overflow assertions.
- [ ] 4.3 Add `e2e/tests/home-product-loading.spec.ts` routed success, empty, and error assertions that preserve `frontend/src/pages/index.astro` hydration and content regions.
- [ ] 4.4 Run `pnpm frontend:check`, focused Vitest, and focused Playwright tests; confirm unrelated paths are untouched.

### Implementation State

- Corrected the responsive test's fixed-browser guard to inspect the configured project name (`testInfo.project.name === 'chromium'`). The prior `project.use.browserName` property is not populated by the installed Playwright project configuration and prevented every matrix case from reaching the browser.
- `e2e/playwright.config.ts`, backend source, and `frontend/src/pages/index.astro` remain unchanged by this retry.
- No screenshot baseline was created because the configured frontend stopped during the first loading test; failed runs do not constitute visual evidence.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm frontend:check` — exit 0; Astro checked 88 files with 0 errors, 0 warnings, and 0 hints. `pnpm --filter frontend exec vitest run src/scripts/homeMenu.test.ts --pool=forks --maxWorkers=1` — exit 0; 1 test file and 9 tests passed.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Runtime harness command/scenario and exact result | `ASTRO_DEV_BACKGROUND=0 pnpm --filter e2e exec playwright test tests/home-responsive.spec.ts tests/home-product-loading.spec.ts --project=chromium --update-snapshots` — exit 1; both preserved configured `webServer` commands started and the runner executed 15 Chromium tests. The first Home loading test timed out at `page.goto('http://localhost:4322/')` after 30 seconds; the remaining two loading tests received `net::ERR_CONNECTION_REFUSED`. The 12 responsive cases then failed before page navigation only because the pre-fix test guard read undefined `testInfo.project.use.browserName`. No screenshots or baselines were generated. |
| Rollback boundary                                 | Revert the `testInfo.project.name` guard in `e2e/tests/home-responsive.spec.ts` and this progress entry. This removes only the focused Phase 4 test-harness correction and its evidence record; it does not affect Home hydration, backend startup, Playwright configuration, or unrelated worktree changes.                                                                                                                                                                                                                                                                                                                                              |

### Notes

- An initial invocation through the root `test:e2e` script was interrupted after it selected the full suite instead of the assigned paths. It produced no evidence. The recorded result above is the single focused configured Playwright execution for this active attempt.
- The foreground Astro override avoided the earlier pre-browser `webServer exited early` failure and allowed Chromium to start, but the frontend listener was no longer available after the first navigation. The configured command did not report the child-process stderr needed to identify why it stopped; no ad-hoc server, readiness bypass, or configuration change was used.
- `git status --short` after checks matches the pre-existing modified/untracked inventory, except for the authorized edit to the already-untracked `e2e/tests/home-responsive.spec.ts`; no unrelated tracked path was changed by this retry. `git diff --check` passed.

## Work Unit 4: Responsive Navigation Determinism Recovery

**Mode:** Standard
**Delivery:** stacked PR slice (`stacked-to-main`)
**Runtime attempt:** `sha256:52e2d611230debc95d1a89c2f372136a6f94861ddd665e465ae9d7ec76c17ce2`
**Failed evidence revision remediated:** `sha256:a36fdab5577031f80ea7f4a533b5f34a209b854e1e248ba5d6714cb76655c5ac`
**Status:** Complete — configured backend and frontend web servers reached the actual focused Chromium assertions.

### Completed Tasks

- [x] 4.2 Complete responsive browser evidence in fixed Chromium across the approved viewport matrix with screenshots and no overflow assertions.
- [x] 4.3 Add `e2e/tests/home-product-loading.spec.ts` routed success, empty, and error assertions that preserve `frontend/src/pages/index.astro` hydration and content regions.
- [x] 4.4 Run `pnpm frontend:check`, focused Vitest, and focused Playwright tests; confirm unrelated paths are untouched.

### Implementation State

- Home Playwright navigation now waits for `domcontentloaded`, rather than the external-resource-dependent `load` event. Responsive screenshots additionally wait for fonts and local illustration decoding with a five-second upper bound.
- The existing backend and Astro `webServer` commands in `e2e/playwright.config.ts`, Home hydration in `frontend/src/pages/index.astro`, product API behavior, and Home CSS/disclosure behavior remain unchanged.
- Twelve fixed Chromium full-page baselines were generated for the approved responsive matrix: `320`, `360`, `375`, `639`, `640`, `768x1024`, `959`, `960`, `1024x768`, `1279`, `1280`, and `1440`.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm frontend:check` — exit 0; Astro checked 88 files with 0 errors, 0 warnings, and 0 hints. `pnpm --filter frontend exec vitest run src/scripts/homeMenu.test.ts --pool=forks --maxWorkers=1` — exit 0; 1 test file and 9 tests passed. `pnpm --filter e2e exec playwright test --list tests/home-responsive.spec.ts tests/home-product-loading.spec.ts --project=chromium` — exit 0; 15 Chromium tests in 2 files registered.                           |
| Runtime harness command/scenario and exact result | `ASTRO_DEV_BACKGROUND=0 pnpm --filter e2e exec playwright test tests/home-responsive.spec.ts tests/home-product-loading.spec.ts --project=chromium --update-snapshots` — exit 0; both configured `webServer` commands started, global setup seeded the test database, 3 routed Home loading scenarios and 12 responsive Chromium screenshot scenarios passed in 28.5 seconds. Twelve missing approved baselines were written; no tests failed or timed out. |
| Rollback boundary                                 | Revert the deterministic navigation/readiness changes in `e2e/tests/home-responsive.spec.ts` and `e2e/tests/home-product-loading.spec.ts`, plus `e2e/tests/home-responsive.spec.ts-snapshots/`. This removes only this runtime-evidence recovery and preserves Home hydration, backend behavior, Playwright configuration, CSS, and disclosure work.                                                                                                        |

### Deviations

None — the implementation preserves the configured process contract and makes test-side rendering readiness deterministic without changing the app contract.

### Cleanup Evidence

- `git diff --check` exited 0.
- `git status --short` retained the inherited modified/untracked inventory and added only the authorized Home screenshot-baseline directory; no unrelated tracked path was changed by this recovery.
- `home-responsive.spec.ts` is 128 lines and `home-product-loading.spec.ts` is 50 lines, both within the repository's 250-line source-file limit.

## Focused Remediation: Verification Evidence Completion

**Mode:** Standard
**Delivery:** maintainer-authorized bounded remediation (`ask-on-risk`, `stacked-to-main`)
**Runtime attempt:** `sha256:50bfead52d8604e5fe8cccb5192a13827cac366df8cf0330af2c5b3231a6dce2`
**Failed evidence revision remediated:** `sha256:f6cde9ff2fb5aed4a9efdba67153c9c896cd5a2f0848025f5ed9af85864c1250`
**Status:** Complete — adds focused runtime evidence only; all existing task checkboxes remain unchanged.

### Completed Remediation Evidence

- [x] Proved the `>=960px` constrained-grid fallback uses fewer than three columns while preserving the 280px card minimum.
- [x] Proved the default non-Home shell at 1920px and below 1024px retains its Header/Footer selection, no Home shell, and bounded layout behavior.
- [x] Proved the Home loading status is observable while the routed products request remains pending, before deterministic settlement.
- [x] Proved the 959/960 navigation boundary in portrait orientation.
- [x] Added an automated static-contract assertion for the documented local 44px product policy, distinct from the WCAG AA 24px minimum.
- [x] Removed the `@typescript-eslint/unbound-method` violation without disabling or weakening the rule.

### Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm --filter frontend exec vitest run src/scripts/homeMenu.test.ts --pool=forks --maxWorkers=1` — exit 0; 1 file and 9 tests passed. `pnpm --filter e2e exec playwright test --list tests/home-responsive-remediation.spec.ts --project=chromium` — exit 0; 6 Chromium remediation tests registered.                        |
| Runtime harness command/scenario and exact result | `ASTRO_DEV_BACKGROUND=0 pnpm --filter e2e exec playwright test tests/home-responsive-remediation.spec.ts --project=chromium` — exit 0; preserved configured backend and Astro web servers started, the configured database reset/seed completed, and all 6 focused Chromium remediation scenarios passed in 19.3 seconds.     |
| Relevant quality command and exact result         | `pnpm --filter frontend lint && pnpm frontend:check && git diff --check` — exit 0; ESLint passed, Astro checked 88 files with 0 errors, 0 warnings, and 0 hints, and the diff has no whitespace errors.                                                                                                                       |
| Rollback boundary                                 | Revert `e2e/tests/home-responsive-remediation.spec.ts` and the focused mock-reference update in `frontend/src/scripts/homeMenu.test.ts`; this removes only remediation evidence and the lint-safe test mock, preserving Home runtime behavior, hydration, CSS, backend behavior, screenshots, and `e2e/playwright.config.ts`. |

### Notes

- The constrained-grid test narrows only the rendered grid element after Home has loaded at 960px; it does not change production CSS or viewport rules.
- The pending-loading test holds the routed request with a promise that is explicitly released after observing `#home-loading-msg`; it uses no time delay.
- No production code, backend behavior, Home hydration, screenshot baseline, or Playwright configuration was changed.
