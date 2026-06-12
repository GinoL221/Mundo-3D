# Delta Spec: Layout Redesign

## Delta for CSS Design System

### ADDED Requirements

#### Requirement: Input Foreground Token

The system MUST define a `--input-fg` custom property in `colors.css` for both dark and light themes. In dark mode `--input-fg` MUST resolve to a light color legible on `--input-bg`. In light mode `--input-fg` MUST resolve to a dark color legible on the light-mode `--input-bg`. The system MUST also override `--input-bg` in the `[data-theme="light"]` selector so that light-mode inputs have a non-black background.

**Scenario: Dark mode input foreground resolves**
- GIVEN `<html>` has no `data-theme` attribute
- WHEN `--input-fg` is evaluated
- THEN it MUST resolve to a color with sufficient contrast on the dark-mode `--input-bg`

**Scenario: Light mode input foreground and background override**
- GIVEN `data-theme="light"` is set on `<html>`
- WHEN `[data-theme="light"]` selectors in `colors.css` are evaluated
- THEN `--input-bg` MUST resolve to a non-black background
- AND `--input-fg` MUST resolve to a dark color legible on that background

### MODIFIED Requirements

#### Requirement: Design Token Files

The system MUST provide three token files under `public/css/tokens/`: `colors.css` (PICO-8 palette + semantic custom properties including `[data-theme="light"]` overrides AND the `--input-fg` token with light-mode override for `--input-bg`), `typography.css`, and `spacing.css`. Token files MUST be loaded before base and component files in `head.ejs`.

(Previously: colors.css listed semantic custom properties without `--input-fg` or light-mode `--input-bg` override.)

**Scenario: Tokens cascade correctly**
- GIVEN `head.ejs` renders its `<link>` tags in order
- WHEN the browser processes the CSS cascade
- THEN `tokens/colors.css` MUST be linked before `base/reset.css`
- AND all semantic custom properties including `--input-fg` MUST resolve to PICO-8 hex values in dark mode

**Scenario: Light theme tokens override correctly**
- GIVEN `data-theme="light"` is set on `<html>`
- WHEN `[data-theme="light"]` selectors are evaluated
- THEN `--input-bg` MUST resolve to a non-black value and `--input-fg` MUST resolve to a dark color legible on it

---

## Delta for Product Components

### MODIFIED Requirements

#### Requirement: Product Grid Block

The `.product-grid` block MUST use `display: grid` with `grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))` and `--space-lg` gap. The grid MUST NOT use flexbox, `calc()` breakpoint widths, or manual column-count media queries. `.product-card` MUST NOT set a hardcoded `width`.

(Previously: flex-wrap grid with calc-based widths at three breakpoints; `.product-card` had `width: 250px`.)

**Scenario: Desktop product grid layout**
- GIVEN a viewport ≥1024px
- WHEN the product grid renders
- THEN `.product-grid` MUST use CSS Grid auto-fit with minmax(250px, 1fr)

**Scenario: Mobile product grid layout**
- GIVEN a viewport <640px
- WHEN the product grid renders
- THEN cards MUST stack in a single column intrinsically

**Scenario: No calc breakpoint widths remain**
- GIVEN the migration is complete
- WHEN searching `product-grid.css` for `calc(` or `width:` on `.product-card`
- THEN zero matches MUST be found

#### Requirement: Product Detail Styles

Product detail MUST use `.product-detail__card` as a flex container at ≥640px (2-column: image + info side-by-side). Below 640px it MUST stack vertically.

(Previously: `.product-detail__card` existed in HTML without CSS rules.)

**Scenario: Desktop 2-column layout**
- GIVEN a viewport ≥640px
- WHEN a product detail page renders
- THEN `.product-detail__card` MUST display as flex with gap, image and info side-by-side

**Scenario: Mobile stacks**
- GIVEN a viewport <640px
- WHEN a product detail page renders
- THEN `.product-detail__card` MUST stack vertically

---

## Delta for Cart and Forms

### MODIFIED Requirements

#### Requirement: Form Block

The `.form-card` block MUST style form containers with `--surface` background, `2px solid --pico-muted` border, centered text, and shadow. Variants: `.form-card--login` (300px), `.form-card--medium` (400px), `.form-card--wide` (max-width 600px). All `.form-card__input` and `.form-card__btn` elements MUST use `var(--input-fg)` for text color. Register page MUST use `.form-card--medium`.

(Previously: register variant was `.form-card--register`; inputs used `var(--fg)` directly; no `--input-fg` token.)

**Scenario: Form input styling**
- GIVEN any form inside `.form-card`
- WHEN `.form-card__input` elements render
- THEN they MUST have `var(--input-bg)` background, `var(--input-fg)` text color, and focus border `--accent`

**Scenario: Form button styling**
- GIVEN any `.form-card__btn` button
- WHEN rendered
- THEN it MUST have `var(--input-bg)` background, `var(--input-fg)` text color, and hover `--accent` background

**Scenario: Register form uses medium variant**
- GIVEN the register page loads
- WHEN the form container renders
- THEN it MUST use `.form-card--medium` class at 400px width

---

## New: Feature Strip Specification

### Requirements

#### Requirement: Feature Strip Component

The `.feature-strip` block MUST display 3 tiles horizontally at ≥640px and stack vertically on mobile. Each tile MUST contain a heading and description. Tiles use `--surface` background, `--pico-muted` border, `--space-md` padding. The strip MUST sit in `index.ejs` between carousel and `<main>`.

**Scenario: Desktop 3-tile row**
- GIVEN viewport ≥640px
- WHEN homepage renders
- THEN `.feature-strip` MUST display 3 tiles in a horizontal flex row with gap, equal width

**Scenario: Mobile stacked tiles**
- GIVEN viewport <640px
- WHEN homepage renders
- THEN tiles MUST stack vertically

**Scenario: Position between carousel and products**
- GIVEN homepage DOM
- WHEN feature strip renders
- THEN it MUST appear after carousel and before `<main>`

#### Requirement: Feature Strip CSS File

A new `public/css/components/feature-strip.css` MUST define all `.feature-strip` styles and be linked in `head.ejs`. Mobile-first: base = stacked; `min-width: 640px` adds horizontal layout.

**Scenario: CSS file loaded in head**
- GIVEN `head.ejs` renders
- WHEN `<link>` elements are listed
- THEN `components/feature-strip.css` MUST appear alongside other component files
