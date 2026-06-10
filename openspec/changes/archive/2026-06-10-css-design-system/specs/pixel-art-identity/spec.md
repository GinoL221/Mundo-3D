# Delta for pixel-art-identity

## MODIFIED Requirements

### Requirement: PICO-8 Design System Custom Properties

The system MUST define CSS custom properties for the PICO-8 palette mapped to semantic roles (`--bg`, `--fg`, `--accent`, `--danger`, `--warning`, `--surface`), typography scales, spacing units, and responsive breakpoints across modular token files (`tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`) loaded via ordered `<link>` tags in `head.ejs`. Breakpoint tokens MUST use the `--bp-*` naming scheme exclusively (`--bp-mobile`, `--bp-tablet`, `--bp-desktop`); the `--breakpoint-*` aliases MUST NOT exist. The system MUST support a light theme override where custom properties map to a light palette: `#f5f0e8` (`--bg`), `#1a2a4a` (`--fg`), `#8b7355` (`--accent`), and `#ffffff` (`--surface`). The default theme SHALL be dark.
(Previously: Defined all custom properties in a single `styles.css` with duplicate `--breakpoint-*` aliases.)

#### Scenario: Design properties available on root

- GIVEN any page loads the token CSS files
- WHEN the browser computes styles for the `<html>` element with default/dark theme
- THEN `--bg`, `--fg`, `--accent`, `--danger`, `--warning`, and `--surface` MUST each resolve to a PICO-8 hex color
- AND `--font-heading` MUST resolve to `'Press Start 2P'` and `--font-body` to `'VT323'`

#### Scenario: Breakpoint custom properties defined

- GIVEN the design system token files are loaded
- THEN `--bp-mobile` MUST resolve to `640px` and `--bp-tablet` MUST resolve to `1024px`
- AND `--breakpoint-mobile`, `--breakpoint-tablet`, and `--breakpoint-desktop` MUST NOT be defined

#### Scenario: Light theme active

- GIVEN a page has theme attribute `data-theme="light"`
- WHEN the CSS custom properties are computed
- THEN `--bg` MUST resolve to `#f5f0e8`
- AND `--fg` MUST resolve to `#1a2a4a`
- AND `--accent` MUST resolve to `#8b7355`
- AND `--surface` MUST resolve to `#ffffff`

### Requirement: Multi-File CSS Loading via Ordered Link Tags

The system MUST load CSS through ordered `<link>` tags in `head.ejs`: normalize, token files (colors, typography, spacing), base files (reset, layout), component files, in that order. The single `styles.css` stylesheet MUST NOT be referenced. Each CSS file MUST exist at its declared path.

(Previously: Consolidated into one `styles.css` file; this is a new requirement replacing single-stylesheet mandate.)

#### Scenario: All pages load CSS via multiple link tags

- GIVEN any EJS template in `src/views/`
- WHEN the template renders its `<head>` section
- THEN it MUST load CSS via multiple `<link>` tags in the documented order
- AND MUST NOT reference `styles.css`

#### Scenario: Theme tokens override correctly across files

- GIVEN the token files are loaded in order
- WHEN `[data-theme="light"]` selectors apply
- THEN component files MUST correctly inherit the light theme custom properties from `colors.css`

## REMOVED Requirements

### Requirement: CSS Consolidation into Single Stylesheet

(Reason: Replaced by multi-file CSS loading via ordered `<link>` tags per the css-design-system spec.)
(Migration: The single `styles.css` is progressively emptied across 7 PRs and deleted in PR 7. All rules migrate to `tokens/`, `base/`, and `components/` files.)