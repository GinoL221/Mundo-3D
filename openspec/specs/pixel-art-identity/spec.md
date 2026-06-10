# Pixel Art Identity Specification

## Purpose

Establishes the PICO-8 pixel art design system as the single visual foundation for all pages — palette, typography, rendering rules, and static assets.

## Requirements

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

### Requirement: Pixel Art Global Rendering Rules

All pages MUST apply `image-rendering: pixelated` to images, `border-radius: 0` globally, and the Press Start 2P / VT323 font stack.

#### Scenario: Pixelated rendering on images

- GIVEN any `<img>` element on any page
- WHEN the browser computes its style
- THEN `image-rendering` MUST be `pixelated`

#### Scenario: No border radius anywhere

- GIVEN any element on any page
- WHEN `border-radius` is computed
- THEN it MUST be `0` unless explicitly overridden by a utility class

#### Scenario: Press Start 2P minimum size enforcement

- GIVEN an element uses `--font-heading` (Press Start 2P)
- WHEN the element's computed `font-size` is below 14px
- THEN the font MUST NOT render Press Start 2P — a fallback MUST apply instead

### Requirement: Pixel Art Icon and Illustration Assets

The system MUST include Kenney.nl pixel art icons (CC0) in `public/images/icons/` and 5 category illustrations (64×64 px) plus an empty-state 3D printer illustration in `public/images/illustrations/`.

#### Scenario: Icon assets accessible

- GIVEN the `/images/icons/` directory in public
- WHEN an EJS template references an icon by path (e.g. `/images/icons/cart.png`)
- THEN the file MUST exist and be served as a static asset

#### Scenario: Category illustrations for each product type

- GIVEN the 5 product categories (Llavero, Busto, Figura, Máscara, Otras)
- WHEN the homepage renders a product card for any category
- THEN an illustration asset at `/images/illustrations/{category}.png` (64×64) MUST be available

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

### Requirement: Flash of Unstyled Content (FOUC) Prevention

The system MUST execute a synchronous inline script in the `<head>` of all pages to apply the saved theme preference from `localStorage` to the `<html>` element before the page body renders.

#### Scenario: Saved theme applied before render

- GIVEN a user has set the theme preference to "light" in `localStorage`
- WHEN any page is requested and loaded
- THEN the inline script in `<head>` MUST read "light" from `localStorage`
- AND set `data-theme="light"` on the `<html>` element before the first paint