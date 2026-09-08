# Tasks: Home Responsive System

## Review Workload Forecast

| Field                   | Value                     |
| ----------------------- | ------------------------- |
| Estimated changed lines | 900–1,250 authored lines  |
| 400-line budget risk    | High                      |
| Chained PRs recommended | Yes                       |
| Suggested split         | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy       | ask-on-risk               |
| Chain strategy          | stacked-to-main           |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                          | Likely PR | Focused test command                                                          | Runtime harness                                  | Rollback boundary                 |
| ---- | ----------------------------- | --------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------- |
| 1    | Disclosure contract           | PR 1      | `pnpm --filter frontend test -- homeMenu.test.ts`                             | Vitest fake DOM at 1023/1024                     | `homeMenu.ts`, `homeMenu.test.ts` |
| 2    | CSS ownership primitives      | PR 2      | `pnpm frontend:check`                                                         | Home styles at 320/640/1024 locally              | CSS split and Home entry import   |
| 3    | Browser contract and fixtures | PR 3      | `pnpm --filter e2e exec playwright test --list tests/home-responsive.spec.ts` | List-only; no server required                    | fixture and responsive spec       |
| 4    | Browser evidence and loading  | PR 4      | Focused responsive and loading Playwright tests                               | Configured backend readiness plus fixed Chromium | E2E specs, fixtures, baselines    |

## Phase 1: Disclosure Contract

- [x] 1.1 Add RED cases in `frontend/src/scripts/homeMenu.test.ts` for 1023/1024 transitions, Enter/Space, Escape focus restore, outside focus/click, stable control relation, and cleanup.
- [x] 1.2 Harden `frontend/src/scripts/homeMenu.ts` and `frontend/src/components/HomeHeader.astro` so native disclosure state, stable ID, and non-modal ordinary links meet those cases.

## Phase 2: Responsive CSS Ownership

- [x] 2.1 Split responsive ownership into cohesive Home CSS files, keeping every source file under 250 lines and preserving existing selectors/tokens.
- [x] 2.2 Consolidate mobile-first tokens and invariant styling in `frontend/src/styles/components/home-shell.css`, `frontend/src/styles/components/home.css`, `frontend/src/styles/components/home-products.css`, and `frontend/src/styles/components/home-footer.css`.
- [x] 2.3 Make `frontend/src/styles/components/home-responsive.css` the sole viewport owner; remove imports in `frontend/src/layouts/Layout.astro` and delete obsolete responsive layers.

## Phase 3: Browser Evidence

- [x] 3.1 Add failing matrix assertions in `e2e/tests/home-responsive.spec.ts` for required viewports, grid/frame/type/target/identity metrics, navigation, and no overflow.
- [x] 3.2 Create deterministic payloads in `e2e/fixtures/homeProducts.ts` and register the responsive scenarios with fixed theme, motion, fonts, Chromium, and rendering assumptions; list-only registration is the complete evidence for this unit.

## Phase 4: Browser Evidence and Loading Integration

- [x] 4.1 Establish a reachable configured backend webServer readiness boundary without weakening or bypassing the preserved `e2e/playwright.config.ts` process contract.
- [x] 4.2 Complete responsive browser evidence in fixed Chromium across the approved viewport matrix with screenshots and no overflow assertions.
- [x] 4.3 Add `e2e/tests/home-product-loading.spec.ts` routed success, empty, and error assertions that preserve `frontend/src/pages/index.astro` hydration and content regions.
- [x] 4.4 Run `pnpm frontend:check`, focused Vitest, and focused Playwright tests; confirm unrelated paths are untouched.
