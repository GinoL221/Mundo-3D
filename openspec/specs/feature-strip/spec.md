# Feature Strip Specification

## Purpose

A 3-tile value proposition section on the homepage, positioned between the carousel and the product grid. Communicates the brand's core benefits at a glance.

## Requirements

### Requirement: Feature Strip Component

The `.feature-strip` block MUST display 3 tiles in a horizontal row on viewports ≥640px and stack vertically on mobile. Each tile (`.feature-strip__tile`) MUST contain a heading (`.feature-strip__heading`) and description (`.feature-strip__text`). Tiles MUST use `--surface` background, `--pico-muted` border, and `--space-md` padding. The strip MUST be placed in `index.ejs` between the carousel section and `<main>`.

#### Scenario: Desktop 3-tile row

- GIVEN a viewport ≥640px
- WHEN the homepage renders
- THEN `.feature-strip` MUST display 3 tiles in a horizontal flex row with gap
- AND each tile MUST be equal width

#### Scenario: Mobile stacked tiles

- GIVEN a viewport <640px
- WHEN the homepage renders
- THEN tiles MUST stack vertically in a single column

#### Scenario: Feature strip positioned between carousel and products

- GIVEN the homepage DOM structure
- WHEN the feature strip renders
- THEN it MUST appear after the carousel and before `<main>` (product grid)

### Requirement: Feature Strip CSS File

A new `public/css/components/feature-strip.css` file MUST define all `.feature-strip` styles. The file MUST be linked in `head.ejs` alongside other component CSS files. Mobile-first: base styles = stacked; `min-width: 640px` adds horizontal layout.

#### Scenario: CSS file loaded in head

- GIVEN `head.ejs` renders
- WHEN the `<link>` elements are listed
- THEN `components/feature-strip.css` MUST appear after `base/layout.css` and alongside other component files
