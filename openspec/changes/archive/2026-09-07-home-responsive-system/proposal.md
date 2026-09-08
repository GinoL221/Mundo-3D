# Proposal: Home Responsive System

## Intent

Replace conflicting Home CSS layers with one mobile-first system preserving identity, markup, hydration, and compact-menu behavior.

## Scope

### In Scope

- Consolidate responsiveness: one-column phone, two-column grid at 640–1023px, three-column grid from 1024px when card minimum width remains viable, and a shared 1104px frame.
- Keep compact non-modal disclosure navigation through 1023px in every orientation; expose horizontal navigation from 1024px with CSS and JavaScript aligned.
- Set 16px minimum body text, approximately 75ch reading width, fluid headings, stable `aria-controls`, and 44px local product targets.
- Add behavioral and screenshot validation with controlled Chromium, fonts, fixtures, theme, motion, and the confirmed matrix.

### Out of Scope

- Backend/API changes or product-loading redesign.
- Broad identity redesign, unrelated pages, or wholesale component replacement.
- Replacing Home markup or absorbing unrelated dirty changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dynamic-homepage`: revise Home grid, content-fit, typography, and validation requirements.
- `navbar-and-footer`: revise Home frame and compact disclosure navigation.
- `css-design-system`: consolidate Home mobile-first responsive ownership.
- `pixel-art-identity`: preserve identity across responsive controls.
- `astro-frontend`: preserve Home shell and hydration.
- `desktop-layout`: scope the Home 1104px frame.
- `e2e`: add Home viewport, overflow, accessibility, and screenshot coverage.

## Approach

Follow exploration Approach 1: consolidate Home responsiveness into one mobile-first layer, remove cascade conflicts, keep the 1023/1024 CSS–JavaScript contract explicit, validate card minimum widths, and use deterministic browser evidence.

## Affected Areas

| Area                                                                              | Impact   | Description                                                                                      |
| --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `frontend/src/layouts/Layout.astro`, `frontend/src/styles/components/home-*.css`  | Modified | Consolidate Home imports, breakpoints, frame, grid, type, header, and footer rules.              |
| `frontend/src/components/HomeHeader.astro`, `frontend/src/scripts/homeMenu.ts`    | Modified | Align disclosure state, stable ID, focus/Escape behavior, and boundary without replacing markup. |
| `frontend/src/pages/index.astro`, `frontend/src/scripts/homeMenu.test.ts`, `e2e/` | Modified | Preserve hydration; add behavior, viewport, overflow, fixture, and screenshot coverage.          |

## Risks

| Risk                                                       | Likelihood | Mitigation                                                                    |
| ---------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| CSS consolidation regresses existing phone/desktop visuals | Med        | Boundary matrix, screenshot baselines, and focused behavioral assertions.     |
| Dirty worktree changes are accidentally absorbed           | High       | Limit edits to the listed Home/test paths; inspect diffs before review.       |
| Screenshot drift from host rendering                       | Med        | Fixed local Chromium, fonts, rendering settings, theme, motion, and fixtures. |

## Rollback Plan

Revert the responsive-system slice, including coupled Home menu/e2e tests, while preserving unrelated worktree changes and product hydration.

## Dependencies

- Existing Astro, Playwright/Chromium, and product fixtures.

## Success Criteria

- [ ] Confirmed boundaries show intended navigation, grid, frame, typography, and zero horizontal overflow.
- [ ] Compact disclosure synchronizes `aria-expanded`/stable `aria-controls`, supports keyboard/Escape/focus restoration, and remains non-modal.
- [ ] Behavioral tests and controlled screenshots pass without changing hydration or pixel-art identity.
