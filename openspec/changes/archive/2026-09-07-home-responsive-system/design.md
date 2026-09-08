# Design: Home Responsive System

## Technical Approach

Keep `index.astro` → `Layout variant="home"` → `HomeHeader`/`HomeFooter`, existing markup, and product hydration unchanged. Make `home-responsive.css` the sole viewport-dependent Home layer, scoped under `.home-shell`: one product column below `640px`, exactly two at `640–1023px`, and three from `1024px` only while each card satisfies the `280px` minimum; otherwise the grid falls back to fewer columns. The shared frame remains fluid up to `1104px`. Home body copy stays at least `16px`, prose is capped at approximately `75ch`, and every fluid heading uses explicit lower and upper implementation constants through `clamp()`.

## Architecture Decisions

| Decision             | Choice                                                                                    | Alternative                   | Rationale                                                               |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Responsive ownership | Consolidate media rules in `home-responsive.css`; keep invariant visuals in component CSS | Patch three conflicting files | One auditable owner prevents later imports reversing layout.            |
| Content-fit tokens   | `1104px` frame, `280px` card minimum, bounded heading tokens, fluid gutters/spacing       | Device exceptions             | Explicit metrics encode confirmed fit and readability.                  |
| Navigation model     | Native-button disclosure over ordinary `<nav>` links                                      | Modal drawer or ARIA menu     | Outside content stays available without inappropriate widget semantics. |
| Browser determinism  | Preserve current Playwright dev servers; control data/rendering in tests                  | Replace process configuration | Route fixtures and context settings avoid unrelated process risk.       |

## Data Flow

```text
existing Playwright webServer ─→ Astro Home ─→ existing hydration ─→ settled fixture DOM
route fixtures + viewport/theme/motion/font controls ──────────────┴─→ assertions/screenshots
```

## File Changes

| File                                                                                               | Action   | Description                                                                           |
| -------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `frontend/src/layouts/Layout.astro`                                                                | Modify   | Remove tablet/mobile imports; retain one responsive import and shell/hydration.       |
| `frontend/src/styles/components/home-responsive.css`                                               | Modify   | Own mobile defaults, `360px` safeguard, grid fit, and `640`/`1024` modes.             |
| `frontend/src/styles/components/home-shell.css`                                                    | Modify   | Define shared frame, card-minimum, body, bounded-heading, gutter, and spacing tokens. |
| `frontend/src/styles/components/home.css`                                                          | Modify   | Consume bounded fluid headings, `16px` body minimum, and `75ch` prose measure.        |
| `frontend/src/styles/components/home-products.css`                                                 | Modify   | Preserve visuals; enforce card minimum, fit fallback, and 44px product targets.       |
| `frontend/src/styles/components/home-footer.css`                                                   | Modify   | Preserve identity; consume shared frame and stacking rules.                           |
| `frontend/src/styles/components/home-tablet.css`, `frontend/src/styles/components/home-mobile.css` | Delete   | Merge responsive rules into the single owner.                                         |
| `frontend/src/scripts/homeMenu.ts`, `frontend/src/scripts/homeMenu.test.ts`                        | Modify   | Enforce and test disclosure lifecycle plus the `1023/1024` boundary.                  |
| `e2e/fixtures/homeProducts.ts`                                                                     | Create   | Stable Home API payloads using repository-local placeholder assets.                   |
| `e2e/tests/home-responsive.spec.ts`                                                                | Create   | Responsive metrics, accessibility, overflow, and screenshots.                         |
| `e2e/tests/home-product-loading.spec.ts`                                                           | Create   | Separate success/empty/error loading checks.                                          |
| `e2e/tests/home-responsive.spec.ts-snapshots/`                                                     | Create   | Controlled local Chromium baselines.                                                  |
| `e2e/playwright.config.ts`                                                                         | Preserve | Keep current backend `start` and frontend `dev` webServer processes unchanged.        |

`HomeHeader.astro`, `HomeFooter.astro`, `index.astro`, and `themeToggle.ts` retain their contracts.

## Interfaces / Contracts

- **Grid:** `<640px` = one column; `640–1023px` = exactly two; `>=1024px` = three only if three `280px` cards plus gaps fit, otherwise fewer columns. Cards never shrink below the minimum and the page never scrolls horizontally.
- **Typography:** Home body copy computes to `>=16px`; prose containers compute to approximately `<=75ch`. Hero and section heading scales expose named lower-bound and upper-bound constants, use `clamp(lower, fluid, upper)`, require `upper > lower`, and never compute outside those bounds.
- **Navigation:** CSS uses `min-width: 1024px`; `homeMenu.ts` uses `max-width: 1023px`. Stable IDs and synchronized `aria-expanded`/`hidden` survive hydration. Escape restores toggle focus; outside focus/click closes without a trap or modal/menu roles.
- **Visual:** preserve palette, IBM Plex typography, square geometry, uncropped wordmarks, pixelated placeholders, SVG controls, reduced-motion behavior, and the local 44px product-target policy.

## Testing Strategy

| Layer       | What to Test                                                    | Approach                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Disclosure state and `1023/1024` transitions                    | Extend Vitest fakes for media changes, focus/click exit, Escape, idempotence, and cleanup.                                                                                                                                                                                                                                                                                                                                 |
| Integration | Existing Home loading outcomes                                  | Intercept success/empty/error API outcomes on the existing server setup; no screenshots or hydration redesign.                                                                                                                                                                                                                                                                                                             |
| E2E         | Grid, typography, identity, accessibility, and visual stability | At `320`, `360`, `375`, `639/640`, `768x1024`, `820`, `960`, `1023/1024`, `1279/1280`, and `1440`: assert one/two/viable-three columns and fewer-column fallback, card width `>=280px`, body `>=16px`, prose `<=~75ch`, heading lower/upper caps, 44px targets, frame alignment, roles, and no overflow. Fix route data, light theme, reduced motion, device scale, Chromium, and font/image readiness before screenshots. |

## Threat Matrix

N/A — this change does not alter routing, shell commands, subprocesses, VCS/PR automation, executable classification, or process integration. `e2e/playwright.config.ts` and its existing Playwright `webServer` process setup are explicitly preserved; new tests only consume those servers.

## Migration / Rollout

No data migration required. Ship and revert the Home CSS/menu/tests as one source-only slice without touching product loading or unrelated dirty files.

## Open Questions

None.
