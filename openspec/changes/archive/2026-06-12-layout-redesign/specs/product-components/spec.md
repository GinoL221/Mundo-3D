# Delta for Product Components

## MODIFIED Requirements

### Requirement: Product Grid Block

The `.product-grid` block MUST use `display: grid` with `grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))` and `--space-lg` gap. The grid MUST NOT use flexbox, `calc()` breakpoint widths, or manual column-count media queries. Card sizing MUST be intrinsic via the grid; `.product-card` MUST NOT set a hardcoded `width`.

(Previously: flex-wrap grid with `calc(25% - var(--space-lg))` at desktop, 2-col at tablet, single-col at mobile via three breakpoint rules; `.product-card` had `width: 250px`.)

#### Scenario: Desktop product grid layout

- GIVEN a viewport ≥1024px
- WHEN the product grid renders
- THEN `.product-grid` MUST use CSS Grid auto-fit with minmax(250px, 1fr)
- AND cards MUST fill available columns intrinsically without hardcoded widths

#### Scenario: Mobile product grid layout

- GIVEN a viewport <640px
- WHEN the product grid renders
- THEN cards MUST stack in a single column at full width
- AND no manual breakpoint override MUST be needed for single-column

#### Scenario: No calc breakpoint widths remain

- GIVEN the migration is complete
- WHEN searching `product-grid.css` for `calc(` or `width:` on `.product-card`
- THEN zero matches MUST be found for calc-based widths or hardcoded card widths

### Requirement: Product Detail Styles

Product detail page MUST use `.product-detail` block with `.product-detail__title`, `.product-detail__main`, `.product-detail__image`, and `.product-detail__info`. The `.product-detail__card` wrapper MUST use `display: flex` with `gap` at viewport ≥640px to create a 2-column layout (image + info side-by-side). Below 640px the layout MUST stack vertically.

(Previously: `.product-detail__card` existed in HTML without CSS rules; `.product-detail__main` flex-wrapped with no column split.)

#### Scenario: Desktop product detail 2-column layout

- GIVEN a viewport ≥640px
- WHEN a product detail page renders
- THEN `.product-detail__card` MUST display as flex with gap
- AND image and info MUST appear side-by-side

#### Scenario: Mobile product detail stacks

- GIVEN a viewport <640px
- WHEN a product detail page renders
- THEN `.product-detail__card` MUST stack vertically (image above info)
