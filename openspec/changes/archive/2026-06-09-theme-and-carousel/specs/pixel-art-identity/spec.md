# Delta for Pixel Art Identity

## ADDED Requirements

### Requirement: Flash of Unstyled Content (FOUC) Prevention

The system MUST execute a synchronous inline script in the `<head>` of all pages to apply the saved theme preference from `localStorage` to the `<html>` element before the page body renders.

#### Scenario: Saved theme applied before render

- GIVEN a user has set the theme preference to "light" in `localStorage`
- WHEN any page is requested and loaded
- THEN the inline script in `<head>` MUST read "light" from `localStorage`
- AND set `data-theme="light"` on the `<html>` element before the first paint

## MODIFIED Requirements

### Requirement: PICO-8 Design System Custom Properties

The system MUST define CSS custom properties for the PICO-8 palette mapped to semantic roles (`--bg`, `--fg`, `--accent`, `--danger`, `--warning`, `--surface`), typography scales, spacing units, and responsive breakpoints in a single `styles.css` file. The system MUST support a light theme override where custom properties map to a light palette: `#f5f0e8` (`--bg`), `#1a2a4a` (`--fg`), `#8b7355` (`--accent`), and `#ffffff` (`--surface`). The default theme SHALL be dark.
(Previously: Defined static CSS custom properties for semantic color roles on root.)

#### Scenario: Design properties available on root

- GIVEN any page loads `styles.css`
- WHEN the browser computes styles for the `<html>` element with default/dark theme
- THEN `--bg`, `--fg`, `--accent`, `--danger`, `--warning`, and `--surface` MUST each resolve to a PICO-8 hex color
- AND `--font-heading` MUST resolve to `'Press Start 2P'` and `--font-body` to `'VT323'`

#### Scenario: Breakpoint custom properties defined

- GIVEN the design system custom properties are loaded
- THEN `--breakpoint-mobile`, `--breakpoint-tablet`, and `--breakpoint-desktop` MUST resolve to `640px`, `1024px`, and a value ≥1024px respectively

#### Scenario: Light theme active

- GIVEN a page has theme attribute `data-theme="light"`
- WHEN the CSS custom properties are computed
- THEN `--bg` MUST resolve to `#f5f0e8`
- AND `--fg` MUST resolve to `#1a2a4a`
- AND `--accent` MUST resolve to `#8b7355`
- AND `--surface` MUST resolve to `#ffffff`

### Requirement: Header and Footer Pixel Art Styling

`header.ejs` and `footer.ejs` MUST use the PICO-8 design system, Press Start 2P headings, VT323 body text, and pixel art icons for navigation and cart. A theme toggle button MUST be present in the header. The button text MUST toggle between "MODE: DARK" and "MODE: LIGHT" on desktop viewports. On mobile viewports (<640px), the button text MUST collapse to the "◐" icon. The current theme preference MUST be saved to `localStorage` on click.
(Previously: Styled header and footer in dark theme only without theme controls.)

#### Scenario: Header renders with pixel art style

- GIVEN the homepage loads
- WHEN the header partial renders
- THEN the logo/branding MUST use `--font-heading`
- AND navigation links MUST use `--font-body`
- AND the cart counter MUST display the distinct product count
- AND the cart counter MUST be hidden when empty (no "0" badge)

#### Scenario: Footer renders with pixel art style

- GIVEN any page loads
- WHEN the footer partial renders
- THEN footer text MUST use `--font-body`
- AND footer links MUST follow PICO-8 color roles

#### Scenario: Theme toggle click updates theme and storage

- GIVEN the theme toggle button is rendered in the header
- WHEN a user clicks the theme toggle button
- THEN the document's theme attribute `data-theme` MUST toggle between "dark" and "light"
- AND the new theme preference MUST be saved in `localStorage`
- AND the button text/icon MUST update to match the active theme

#### Scenario: Theme toggle collapsed on mobile

- GIVEN a viewport width narrower than 640px
- WHEN the header renders the theme toggle button
- THEN the toggle button text MUST render as "◐"
