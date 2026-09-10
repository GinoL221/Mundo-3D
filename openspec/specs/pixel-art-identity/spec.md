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

### Requirement: Scoped Image Rendering Rules

Real product imagery and approved brand imagery MUST use normal browser image rendering and MUST NOT be globally pixelated, reconstructed, recolored, filtered, or otherwise altered by the shared contract. Intentional pixel-art placeholders MAY retain pixelated rendering only through an explicit, isolated semantic marker. Existing square geometry and legacy typography rules MAY remain for known legacy consumers through the compatibility mapping, but Wave 0 MUST NOT promote PICO-8, CRT/JRPG, pixel-font, orange/crimson, shadow, gradient, or glow treatments into shared authority.

(Previously: Pixelated rendering, square geometry, and the Press Start 2P / VT323 font stack applied globally to all pages and images.)

#### Scenario: Real product or brand imagery renders normally

- GIVEN an image is approved product photography, a product image, or an approved brand asset
- WHEN the shared and legacy styles are computed
- THEN its image rendering MUST be normal
- AND the shared contract MUST NOT recolor, filter, reconstruct, or pixelate it

#### Scenario: Intentional pixel art remains isolated

- GIVEN an image is an intentional pixel-art placeholder
- WHEN it carries the explicit pixel-art semantic marker
- THEN it MAY use pixelated rendering
- AND removing that marker MUST restore normal rendering

#### Scenario: Legacy geometry and typography remain compatible

- GIVEN a known legacy consumer depends on square geometry or legacy font treatment
- WHEN Wave 0 is applied
- THEN its compatibility mapping MUST preserve the consumer's existing behavior
- AND those treatments MUST NOT be classified as shared semantic foundations
