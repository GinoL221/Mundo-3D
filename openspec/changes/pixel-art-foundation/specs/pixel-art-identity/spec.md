# Pixel Art Identity Specification

## Purpose

Establishes the PICO-8 pixel art design system as the single visual foundation for all pages — palette, typography, rendering rules, and static assets.

## Requirements

### Requirement: PICO-8 Design System Custom Properties

The system MUST define CSS custom properties for the PICO-8 palette mapped to semantic roles (`--bg`, `--fg`, `--accent`, `--danger`, `--warning`, `--surface`), typography scales, spacing units, and responsive breakpoints in a single `styles.css` file.

#### Scenario: Design properties available on root

- GIVEN any page loads `styles.css`
- WHEN the browser computes styles for the `<html>` element
- THEN `--bg`, `--fg`, `--accent`, `--danger`, `--warning`, and `--surface` MUST each resolve to a PICO-8 hex color
- AND `--font-heading` MUST resolve to `'Press Start 2P'` and `--font-body` to `'VT323'`

#### Scenario: Breakpoint custom properties defined

- GIVEN the design system custom properties are loaded
- THEN `--breakpoint-mobile`, `--breakpoint-tablet`, and `--breakpoint-desktop` MUST resolve to `640px`, `1024px`, and a value ≥1024px respectively

### Requirement: CSS Consolidation into Single Stylesheet

The system MUST consolidate all ~16 CSS files into ONE `public/css/styles.css` organized by layer (custom properties → reset → typography → layout → components → utilities) and remove all old CSS files.

#### Scenario: All pages reference single stylesheet

- GIVEN any EJS template in `src/views/`
- WHEN the template renders its `<head>` section
- THEN it MUST reference exactly `styles.css` and MUST NOT reference any deleted CSS file

#### Scenario: Old CSS files removed

- GIVEN the consolidation is complete
- WHEN listing files in `public/css/`
- THEN only `styles.css` (and `normalize.css` if retained) MUST exist
- AND all page-specific files (index.css, login.css, users.css, etc.) MUST NOT exist

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

`header.ejs` and `footer.ejs` MUST use the PICO-8 design system, Press Start 2P headings, VT323 body text, and pixel art icons for navigation and cart.

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