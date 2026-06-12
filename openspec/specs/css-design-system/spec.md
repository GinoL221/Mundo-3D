# CSS Design System Specification

## Purpose

Token-driven CSS architecture replacing the monolithic `styles.css` with modular files, BEM naming in English, consolidated design tokens, and mobile-first responsive queries per component.

## Requirements

### Requirement: Design Token Files

The system MUST provide three token files under `public/css/tokens/`: `colors.css` (PICO-8 palette + semantic custom properties including `[data-theme="light"]` overrides AND the `--input-fg` token with light-mode override for `--input-bg`), `typography.css` (font scale: `--font-heading` Press Start 2P, `--font-body` VT323, heading sizes), and `spacing.css` (8px grid: `--space-xs` through `--space-2xl`). Token files MUST be loaded before base and component files in `head.ejs`.

(Previously: colors.css listed semantic custom properties without `--input-fg` or light-mode `--input-bg` override.)

#### Scenario: Tokens cascade correctly

- GIVEN `head.ejs` renders its `<link>` tags in order
- WHEN the browser processes the CSS cascade
- THEN `tokens/colors.css` MUST be linked before `base/reset.css`
- AND all semantic custom properties (`--bg`, `--fg`, `--accent`, `--danger`, `--warning`, `--surface`, `--input-fg`) MUST resolve to PICO-8 hex values in dark mode

#### Scenario: Light theme tokens override correctly

- GIVEN `data-theme="light"` is set on `<html>`
- WHEN `[data-theme="light"]` selectors in `colors.css` are evaluated
- THEN `--bg` MUST resolve to `#f5f0e8`, `--fg` to `#1a2a4a`, `--accent` to `#8b7355`, `--surface` to `#ffffff`
- AND `--input-bg` MUST resolve to a non-black value
- AND `--input-fg` MUST resolve to a dark color legible on the light-mode `--input-bg`

### Requirement: Breakpoint Token Consolidation

The system MUST define exactly three breakpoint custom properties: `--bp-mobile: 640px`, `--bp-tablet: 1024px`, `--bp-desktop: 1024px`. The previous `--breakpoint-mobile`, `--breakpoint-tablet`, and `--breakpoint-desktop` aliases MUST NOT exist anywhere in the CSS codebase after migration.

#### Scenario: Old breakpoint tokens removed

- GIVEN the migration is complete
- WHEN searching all CSS files for `--breakpoint-mobile`, `--breakpoint-tablet`, or `--breakpoint-desktop`
- THEN zero matches MUST be found

#### Scenario: New breakpoint tokens functional

- GIVEN `tokens/spacing.css` is loaded
- WHEN a component file uses `var(--bp-mobile)` in a media query
- THEN the value MUST resolve to `640px`

### Requirement: Modular CSS File Loading

`head.ejs` MUST load all CSS via ordered `<link>` tags: `normalize.css`, then `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `base/reset.css`, `base/layout.css`, then component files, then theme/override files. The monolithic `styles.css` MUST NOT be referenced after migration.

#### Scenario: All 14 CSS files loaded in order

- GIVEN `head.ejs` renders
- WHEN the `<link>` elements are listed in DOM order
- THEN there MUST be exactly 14 CSS `<link>` tags
- AND `tokens/colors.css` MUST appear before `base/reset.css`
- AND all component files MUST appear after `base/layout.css`
- AND `styles.css` MUST NOT appear

#### Scenario: No references to styles.css

- GIVEN the migration is complete
- WHEN searching all EJS files for `styles.css`
- THEN zero matches MUST be found

### Requirement: BEM Naming in English

All CSS class names MUST follow Block__Element--Modifier convention in English. Spanish class names (`.barra-navegacion`, `.contenido_produc`, `.containerSectionIndex`, `.containerSections`, etc.) and mixed-language names MUST NOT exist after migration. Each component MUST have exactly one canonical Block name.

#### Scenario: No Spanish or mixed-language class names

- GIVEN the migration is complete
- WHEN running `rg "barra-navegacion|contenido_produc|containerSection"` in `src/views/` and `public/`
- THEN zero matches MUST be found

#### Scenario: Single canonical product grid name

- GIVEN product grid styles are defined
- WHEN searching for product grid class names
- THEN exactly one Block name MUST exist (`.product-grid`), not `.products_container`, `.containerSectionIndex`, or `.contenido_produc`

### Requirement: Mobile-First Responsive Queries

All media queries MUST use `min-width` breakpoints (mobile-first). Media queries MUST live in their owning component file, not in a separate responsive section.

#### Scenario: No max-width-only media queries for layout

- GIVEN all component CSS files after migration
- WHEN searching for media queries using `max-width`
- THEN only theme-specific overrides (e.g., `.theme-toggle-btn` icon/text swap at 639px) MAY use `max-width`
- AND layout breakpoints MUST use `min-width` exclusively

### Requirement: Progressive Deletion of Monolith

`styles.css` MUST be emptied section by section across 7 PR slices. At no point MUST `styles.css` contain styles that duplicate what exists in modular files, and at no point MUST any class be defined in both places simultaneously. After PR 7, `styles.css` MUST be deleted.

#### Scenario: Safe intermediate state

- GIVEN any PR slice is merged (PRs 1-6)
- WHEN the site loads
- THEN `styles.css` contains only the sections not yet migrated
- AND no class name exists in both `styles.css` and a component file

#### Scenario: Final state removes monolith

- GIVEN PR 7 is merged
- WHEN listing `public/css/styles.css`
- THEN the file MUST NOT exist

### Requirement: Grep Verification per PR

Each PR slice MUST include a grep verification step confirming zero references to old class names in both CSS and EJS files before merge.

#### Scenario: Grep check passes before merge

- GIVEN a PR slice updates class names
- WHEN running `rg` for all old class names replaced in that slice
- THEN the search MUST return zero matches in `src/views/` and `public/css/`

### Requirement: Input Foreground Token

The system MUST define a `--input-fg` custom property in `colors.css` for both dark and light themes. In dark mode `--input-fg` MUST resolve to a light color legible on `--input-bg`. In light mode `--input-fg` MUST resolve to a dark color legible on the light-mode `--input-bg`. The system MUST also override `--input-bg` in the `[data-theme="light"]` selector so that light-mode inputs have a non-black background.

#### Scenario: Dark mode input foreground resolves

- GIVEN `<html>` has no `data-theme` attribute (dark mode default)
- WHEN `--input-fg` is evaluated
- THEN it MUST resolve to a color with sufficient contrast on the dark-mode `--input-bg`

#### Scenario: Light mode input foreground and background override

- GIVEN `data-theme="light"` is set on `<html>`
- WHEN `[data-theme="light"]` selectors in `colors.css` are evaluated
- THEN `--input-bg` MUST resolve to a non-black background color
- AND `--input-fg` MUST resolve to a dark color legible on that background