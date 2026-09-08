## Exploration: home-responsive-system

### Current State

The Home page is a dedicated Astro variant (`index.astro` → `Layout variant="home"` → `HomeHeader`/`HomeFooter`) with client-side product hydration. It currently retains the requested behavior: compact menu at `<=959px`, horizontal desktop navigation at `>=960px`, a full wordmark with a `<=360px` fallback, account links first in the compact menu, a two-column product grid through `641–1024px`, and SVG UI icons.

The tablet issue comes from two overlapping responsive systems. `home-responsive.css` first promotes header children with `display: contents` from `641px`, hides the menu toggle, and lays primary/auth links across the header; its `641–959px` block then wraps the primary links onto a second row. `home-tablet.css`, imported later, reverses that result by restoring a top row with a compact menu. The outcome depends on cascade order and duplicated selectors rather than one explicit navigation mode. The `max-width: 1024px` section also mixes header, footer, hero, grid, and commission behavior, while fixed desktop dimensions and repeated 32px gutters are spread across several files.

### Affected Areas

- `frontend/src/pages/index.astro` — Home content hierarchy and dynamic featured/catalogue product regions.
- `frontend/src/layouts/Layout.astro` — imports three overlapping Home responsive stylesheets and selects the Home shell.
- `frontend/src/components/HomeHeader.astro` — wordmark, account/menu order, cart/theme/menu controls, and accessibility attributes.
- `frontend/src/scripts/homeMenu.ts` — JavaScript compact-navigation boundary is `max-width: 959px`; it manages hidden state, focus, Escape, outside-click, and viewport changes.
- `frontend/src/styles/components/home-shell.css` — shared Home tokens, desktop header geometry, navigation, and wordmark dimensions.
- `frontend/src/styles/components/home.css` / `home-products.css` — fixed section/card dimensions, page container widths, product grid, and CTA layout.
- `frontend/src/styles/components/home-responsive.css` / `home-tablet.css` / `home-mobile.css` — competing breakpoint rules that should become one mobile-first responsive layer.
- `frontend/src/styles/components/home-footer.css` — responsive footer/wordmark/social-control constraints.
- `frontend/src/scripts/homeMenu.test.ts` / `frontend/src/scripts/themeToggle.ts` — unit coverage for the compact-menu boundary and theme action semantics.
- `e2e/playwright.config.ts` / `e2e/tests/*.spec.ts` — Playwright is Chromium desktop-only today; it has Home-adjacent header/theme/cart coverage but no Home viewport or visual-regression matrix.

### Approaches

1. **Consolidate Home responsiveness into a mobile-first stylesheet** — Preserve current approved behavior, move shared component rules to base styles, and use a small set of behavior boundaries for grid, header mode, and spacious desktop layout.
   - Pros: Removes cascade conflicts; makes the `959/960px` JavaScript/CSS contract explicit; reduces future breakpoint drift; preserves current visual identity and components.
   - Cons: Requires careful selector-by-selector regression validation because the worktree already contains uncommitted Home changes.
   - Effort: Medium.

2. **Patch the iPad Mini range only** — Add or adjust a `768px` rule to force compact navigation and maintain two cards.
   - Pros: Small immediate diff.
   - Cons: Creates another device-oriented exception, leaves contradictory rules in place, and does not establish fluid typography/spacing or a maintainable validation matrix.
   - Effort: Low initially; high maintenance risk.

### Recommendation

Use Approach 1. Define responsive behavior rather than device labels: one-column phone content and grid below the tablet threshold; compact, disclosure-based navigation through `959px`; two-column product cards from the tablet threshold until the desktop grid threshold; horizontal navigation at `960px+`; and a capped, fluid content frame for wide displays. Keep the currently approved `<=360px` wordmark fallback as a content-fit safeguard, not a general layout breakpoint.

Recommended implementation target, pending product confirmation:

- **Phone (`0–639px`)**: compact menu, one-column hero/featured card/grid, fluid type and 16px gutters.
- **Tablet (`640–959px`, portrait and landscape)**: compact menu, two-column product grid, no forced second-row desktop navigation, fluid gutters and section spacing.
- **Desktop (`960–1279px`)**: exposed horizontal navigation and three-column product grid where card minimum widths remain viable.
- **Wide (`1280px+`)**: retain the same structure with an explicit content maximum (current 1104px is a viable starting point), scaling whitespace/type with `clamp()` rather than adding device-specific layouts.

Product decisions that remain unresolved and must be recorded by the proposal phase:

1. Confirm the exact grid transition: retain two columns at `640–959px` and move to three at `960px`, or defer three columns until a wider content-fit threshold.
2. Confirm whether `1104px` remains the Home content maximum or should become a new design token shared by header, sections, and footer.
3. Confirm the allowed fluid typography range for the hero and section headings, including the minimum readable body size and maximum line length.
4. Confirm tablet landscape acceptance criteria: compact navigation through `959px` regardless of orientation, versus desktop navigation when the available inline space is demonstrably sufficient.
5. Confirm validation ownership: automated browser assertions only, screenshot/visual baselines, or both.

### Risks

- The worktree is already substantially dirty, including Home components, Home styles, and `index.astro`; implementation must be a narrowly scoped delta and must not reset, reformat, or absorb unrelated changes.
- The same selectors occur in three files and source import order currently determines the tablet result; consolidation can regress phone/desktop behavior if the menu script and CSS boundary diverge.
- Existing browser coverage is desktop Chromium only. A responsive change requires explicit viewport checks at minimum for 320/360, 375, 768×1024, tablet landscape, 960, 1024, and wide desktop; each must verify no horizontal overflow, uncropped wordmark/media, menu keyboard behavior, card count, light/dark contrast, and SVG controls.
- The 400 changed-line budget is at medium-to-high risk if CSS reorganization, components, tests, and e2e viewport coverage ship together. With `ask-on-risk`, split implementation into independently reversible work units if the forecast exceeds the budget.
- Rollback should be a single revertable responsive-system slice that changes only the Home styles and directly coupled Home menu tests; preserve the existing component markup and product-loading behavior unless a separately reviewed requirement demands it.

### Ready for Proposal

Yes — provided the proposal explicitly preserves approved current behavior and records the five unresolved product decisions above. A research lane is not required for this phase: the core issue is local CSS architecture, and current Astro behavior is already configured and testable. A targeted standards/accessibility research lane is optional only if the team wants external evidence to select a viewport or visual-regression baseline policy; do not block the proposal on it.
