# Tasks: Theme and Carousel

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full implementation | PR 1 | Base branch: main. All features. |

## Phase 1: Foundation

- [x] 1.1 Add PICO-8 breakpoint variables (`--breakpoint-mobile`, `--breakpoint-tablet`, `--breakpoint-desktop`) to `:root` in `public/css/styles.css`.
- [x] 1.2 Define Light Theme color palette custom properties (`--bg`, `--fg`, `--accent`, `--surface`) under `[data-theme="light"]` selector in `public/css/styles.css`.
- [x] 1.3 Ensure default variables (`--bg`, `--fg`, `--accent`, `--surface`) are active under `:root` (dark theme mapping).

## Phase 2: Theme Switching

- [x] 2.1 Add synchronous inline script in `src/views/partials/head.ejs` to retrieve theme from `localStorage` and set `data-theme` on `<html>`.
- [x] 2.2 Create `public/js/theme.js` to handle theme toggle click, `localStorage` updates, and button state management.
- [x] 2.3 Modify `src/views/partials/header.ejs` to include the theme toggle button within `barra-derecha`.
- [x] 2.4 Add responsive styling for header toggle button in `public/css/styles.css` to collapse label to `◐` on viewport `< 640px`.
- [x] 2.5 Include `public/js/theme.js` script tag in `src/views/partials/header.ejs` or `src/views/index.ejs`.

## Phase 3: LCD Carousel

- [x] 3.1 Replace graphical slides in `src/views/index.ejs` carousel layout with text slides and specified anchor hrefs.
- [x] 3.2 Add retro visual styles (double borders, scanline overlays, glowing neon LCD colors) for theme states in `public/css/styles.css`.
- [x] 3.3 Set compact carousel height (150px) and hide overflow in `public/css/styles.css`.
- [x] 3.4 Refactor `public/js/carousel.js` to cycle text slides correctly and maintain indicators/navigation links.

## Phase 4: Verification

- [x] 4.1 Write Jest unit/integration tests to verify that `data-theme` updates dynamically on toggle button click.
- [x] 4.2 Verify saved theme in `localStorage` applies properly without Flash of Unstyled Content (FOUC).
- [x] 4.3 Smoke test the LCD carousel auto-advancing behavior and manual slide navigation controls.
- [x] 4.4 Verify responsive layout of the theme toggle button collapsing to `◐` on viewport sizes `< 640px`.
