# Tasks: Frontend Design System Migration — Wave 0

## Review Workload Forecast

| Field                   | Value                               |
| ----------------------- | ----------------------------------- |
| Estimated changed lines | 465–560 additions + deletions total |
| 400-line budget risk    | High                                |
| Chained PRs recommended | Yes                                 |
| Suggested split         | PR 0A → PR 0B                       |
| Delivery strategy       | auto-chain                          |
| Chain strategy          | stacked-to-main                     |

| Slice                                     | Dependency | Estimated changed lines | Review boundary |
| ----------------------------------------- | ---------- | ----------------------: | --------------- |
| 0A: contract and foundations              | None       |                 235–275 | ≤400            |
| 0B: compatibility and regression evidence | 0A merged  |                 230–285 | ≤400            |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Resolved delivery decision and scope guard

The pre-edit inventory established a truthful full-Wave-0 estimate of 465–560 changed lines. The maintainer selected `auto-chain` with `stacked-to-main`; Wave 0 therefore proceeds as sequential PR 0A then PR 0B, with each PR independently reviewable and reversible. This replaces the prior single-slice 330–400 forecast and its apply-block: do not request another delivery decision or infer a `size:exception` unless either individual slice cannot remain at or below 400 changed lines.

- [x] Record the completed pre-edit inventory of imports, Home aliases, reset image declarations, placeholder selectors, and existing Home Playwright baselines in `frontend/src/layouts/Layout.astro`, `frontend/src/styles/{tokens,base,components}/`, and `e2e/tests/`; its 465–560-line finding is resolved by the approved stacked-to-main chain. <!-- sdd-owner: implementation -->
- [ ] Preserve Wave 0-only scope in both slices: modify only `docs/diseno/frontend-system-contract.md`, shared CSS/import/reset/Home compatibility boundaries, and Wave 0 evidence; keep the products route (read-only), product-detail route (read-only), cart route (read-only), `frontend/src/components/Header.astro`, `frontend/src/components/Footer.astro`, APIs, routing, data, route markup, and route state behavior preserve-only. <!-- sdd-owner: implementation -->

## Slice 0A — repository contract and semantic foundation (PR 0A → main)

**Start:** current legacy stylesheet and Home behavior. **Finish:** repository-owned contract, semantic tokens, opt-in primitives, and necessary global imports exist without image-reset or Home-alias changes. **Rollback:** revert PR 0A only; legacy CSS/import behavior remains. **Dependency:** none.

### 0A. RED

- [x] Create failing foundation-only assertions in `e2e/tests/wave0-system-contract.spec.ts` against the existing Home route, using inert injected test DOM only where necessary to prove absent `--sys-*` roles, opt-in frame/prose/action/state primitives, keyboard-visible focus, disabled semantics, and state hooks without changing route markup. <!-- sdd-owner: implementation -->
- [x] Run the focused failing `e2e/tests/wave0-system-contract.spec.ts` coverage and preserve `e2e/tests/home-product-loading.spec.ts` as Home state-regression evidence; record RED results without asserting image-policy or dark screenshot behavior reserved for 0B. <!-- sdd-owner: implementation -->

### 0A. GREEN

- [x] Create `docs/diseno/frontend-system-contract.md` as the repository-renderable Open Design deliverable with authority boundaries, classification of every admitted Home-derived value, `--sys-*` contract, state semantics, separate WCAG 2.2 AA and local 44×44 evidence ledgers, legacy-debt register, rollback boundary, and the deterministic 108-entry Wave 1 preparation rule marked `planned-not-created`. <!-- sdd-owner: implementation -->
- [x] Create `frontend/src/styles/tokens/semantic.css` with theme-resolving aliases only for approved shared colors, typography, spacing, frame, prose, focus, and target-size roles; retain primitive-token ownership and keep Home-only and legacy values outside shared authority. <!-- sdd-owner: implementation -->
- [x] Create `frontend/src/styles/base/system-primitives.css` below the 250-line source-file cap with low-specificity opt-in frame, section, prose, action, state, focus, disabled, and pixel-art-marker rules; introduce no route selectors, `!important`, global radius, shadow, gradient, glow, or CSS-only semantics. <!-- sdd-owner: implementation -->
- [x] Update only `frontend/src/layouts/Layout.astro` to load `tokens/semantic.css` after primitive tokens and `base/system-primitives.css` after existing base styles, preserving shell selection, scripts, and existing component-style relative ordering. <!-- sdd-owner: implementation -->

### 0A. TRIANGULATE and REFACTOR

- [x] Expand and run the focused 0A contract coverage for primary and text actions, native and custom disabled contracts, loading/empty/error/status semantics, keyboard operation, visible focus, computed token resolution, applicable contrast checks, and separately reported 44×44 CSS-pixel checks in existing light and dark theme support. <!-- sdd-owner: implementation -->
- [x] Remove only foundation duplicate declarations proven unnecessary by the 0A computed-style evidence; keep legacy `--pico-*`, CRT/JRPG, default-shell, square-geometry, and placeholder consumers intact, recount PR 0A, and stop for an explicit delivery decision only if this individual slice exceeds 400 changed lines. <!-- sdd-owner: implementation -->
- [x] Run `pnpm --filter frontend test`, `pnpm --filter frontend check`, the applicable frontend build command, and focused 0A Playwright coverage; record commands and outcomes before handing off PR 0A. <!-- sdd-owner: implementation -->

## Slice 0B — image compatibility, Home aliases, and final evidence (PR 0B → main; depends on 0A)

**Start:** merged PR 0A semantic foundation. **Finish:** scoped normal-image policy, explicit placeholder compatibility, bounded Home aliases, dark Home regression evidence, and final Wave 0 verification. **Rollback:** revert PR 0B only; PR 0A foundations and legacy consumers remain available. **Dependency:** PR 0A must be merged before PR 0B targets `main`.

### 0B. RED

- [ ] Extend `e2e/tests/wave0-system-contract.spec.ts` with failing image-policy assertions proving real product and approved brand imagery render normally while each known explicit placeholder compatibility selector retains pixelated rendering only through the canonical marker. <!-- sdd-owner: implementation -->
- [ ] Narrowly extend `e2e/tests/home-responsive.spec.ts` with deterministic dark-theme coverage for the established Home viewport matrix, preserving existing light fixtures, viewport names, locale, timezone, DPR, motion, font, image-readiness, and screenshot controls; run it to capture RED evidence before compatibility edits. <!-- sdd-owner: implementation -->

### 0B. GREEN

- [ ] Update `frontend/src/styles/base/reset.css` so ordinary `img` elements render normally, and update only `frontend/src/styles/components/home.css` and `frontend/src/styles/components/home-products.css` to retain known placeholders as explicit compatibility aliases without changing card/grid layout or approved assets. <!-- sdd-owner: implementation -->
- [ ] Update `frontend/src/styles/components/home-shell.css` only to alias admitted shared values using literal `var(--sys-*, fallback)` fallbacks, preserving Home-specific constants, selectors, markup, content, behavior, and responsive modes. <!-- sdd-owner: implementation -->

### 0B. TRIANGULATE and REFACTOR

- [ ] Run focused Wave 0 Playwright suites plus established Home functional, loading, responsive, and deterministic visual evidence; verify all 13 light screenshots and their dark equivalents show no unapproved Home change, and retain WCAG-oriented results separately from local 44×44-policy measurements. <!-- sdd-owner: implementation -->
- [ ] Remove only duplicate compatibility declarations proven unnecessary by computed-style and screenshot parity; preserve all legacy `--pico-*`, CRT/JRPG, default-shell, square-geometry, and placeholder consumers, and do not migrate any Wave 1 route or default-shell component. <!-- sdd-owner: implementation -->
- [ ] Recount PR 0B additions plus deletions, keep it at or below 400 lines, and run `pnpm --filter frontend test`, `pnpm --filter frontend check`, the applicable frontend build command, focused Wave 0 Playwright suites, and `pnpm test:all`; record failures without expanding into Wave 1 or shell scope. <!-- sdd-owner: implementation -->
- [ ] Verify the chained rollback boundary: reverting 0B restores its reset/Home alias/test changes while preserving 0A; reverting 0A afterward restores legacy imports/styles, with no data, API, routing, or content rollback. <!-- sdd-owner: implementation -->

## Parent lifecycle actions

- [ ] Start or reuse bounded review for PR 0A against `main`, confirming its ≤400-line count, strict-TDD evidence, contract/foundation-only boundary, and independent rollback. <!-- sdd-owner: parent -->
- [ ] After PR 0A merges, start or reuse bounded review for PR 0B against `main`, confirming its ≤400-line count, dependency on 0A, image/Home-only boundary, light/dark Home parity, separate accessibility ledgers, and independent rollback. <!-- sdd-owner: parent -->
