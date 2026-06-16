# Product Components Specification

## Purpose

BEM product card and product grid styles replacing `.contenido_produc`, `.containerProducto`, `.products_container`, and product detail classes.

## Requirements

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

### Requirement: Product Card Block

The `.product-card` block MUST style each product card with `--surface` background, `2px solid --pico-muted` border, flex-direction column, and hover state changing border to `--accent`. Elements: `.product-card__image` replaces `.containerProductoImg img`, `.product-card__body` replaces `.containerCardFooter`/`.info_produc`, `.product-card__title` for product name, `.product-card__price` for pricing, `.product-card__action` for add-to-cart button.

#### Scenario: Card hover interaction

- GIVEN a `.product-card` element
- WHEN the user hovers over it
- THEN the border-color MUST change to `--accent`

#### Scenario: Card add-to-cart button

- GIVEN a `.product-card__action` button
- WHEN rendered
- THEN it MUST use `--font-body` at 16px, `--pico-black` background, full width, and hover state changing background to `--accent`

### Requirement: Product Detail Styles

The product detail page MUST use the `.product-detail` block containing `.product-detail__title` (styled with `--title-highlight`), `.product-detail__main`, `.product-detail__image` (styled using `image-rendering: pixelated`), and `.product-detail__info`.
The `.product-detail__card` wrapper MUST use `display: flex` with a gap at viewports ≥640px to create a 2-column layout (image + info side-by-side) with items vertically centered (`align-items: center`). Below 640px, it MUST stack vertically.
The "← Volver a productos" link MUST be located at the top of the `.product-detail__card` container.
Interactive triggers MUST use semantic links (`<a>`) only, with no nested `<button>` elements.
The actions MUST link to `/productCart` with query parameters: primary button MUST target `?action=buy` and secondary button MUST target `?action=add`.
The secondary button MUST be styled with a sky blue background (`--pico-sky`, `#29adff`).
Product prices MUST use the shared `.price` and `.price--lg` classes.

(Previously: The `.product-detail__card` wrapper lacked vertical centering, Volver link was not specified at the top, interactive triggers had invalid nested <a><button> elements, action buttons lacked query parameters, secondary button had outline-only style, title did not use highlighted style, image lacked pixelated rendering, and price styling did not use shared classes.)

#### Scenario: Desktop product detail 2-column layout

- GIVEN a viewport ≥640px
- WHEN the product detail page renders
- THEN `.product-detail__card` MUST display as flex with gap and align-items center
- AND image and info columns MUST appear side-by-side

#### Scenario: Mobile product detail stacks

- GIVEN a viewport <640px
- WHEN the product detail page renders
- THEN `.product-detail__card` MUST stack vertically

#### Scenario: Product detail back link location

- GIVEN a product detail page
- WHEN rendered
- THEN the "← Volver a productos" link MUST appear at the top of the detail card container

#### Scenario: Detail page button targets and nesting

- GIVEN a product detail page
- WHEN rendering the action links
- THEN they MUST be semantic anchor tags (`<a>`) without nested button tags
- AND the primary link href MUST be `/productCart?action=buy`
- AND the secondary link href MUST be `/productCart?action=add`

#### Scenario: Product detail visual styling

- GIVEN a product detail page
- WHEN elements are styled
- THEN the title MUST use the `--title-highlight` color
- AND the product image MUST use `image-rendering: pixelated`
- AND the price text MUST use `.price` and `.price--lg` classes
- AND the secondary action link MUST use background color `--pico-sky` (`#29adff`)

### Requirement: Empty State Block

The `.empty-state` block MUST display a centered fallback with 3D printer illustration, `--pico-yellow` heading in `--font-heading`, and `--font-body` message text when no products exist.

#### Scenario: Empty state renders

- GIVEN zero products are available
- WHEN the homepage renders
- THEN `.empty-state` MUST center content vertically with min-height 50vh