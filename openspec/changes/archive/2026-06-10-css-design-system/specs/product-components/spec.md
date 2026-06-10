# Product Components Specification

## Purpose

BEM product card and product grid styles replacing `.contenido_produc`, `.containerProducto`, `.products_container`, and product detail classes.

## Requirements

### Requirement: Product Grid Block

The `.product-grid` block MUST style the product listing container as a flex-wrap centered grid with `--space-lg` gap and `--space-md` vertical padding. On mobile (<640px) cards MUST be single-column ≤320px. On tablet (640-1023px) cards MUST be 2-column. On desktop (≥1024px) cards MUST be 4-column.

#### Scenario: Desktop product grid layout

- GIVEN a viewport ≥1024px
- WHEN the product grid renders
- THEN `.product-grid` MUST display cards at `calc(25% - var(--space-lg))` width with min 220px

#### Scenario: Mobile product grid layout

- GIVEN a viewport <640px
- WHEN the product grid renders
- THEN `.product-card` MUST be full width with max-width 320px

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

Product detail page MUST use `.product-detail` block with `.product-detail__title`, `.product-detail__main` (replacing `.containerMainProductDetail`), `.product-detail__image` (replacing `.containerCardProducto img`), and `.product-detail__info` (replacing `.containerSectionDetalle`).

#### Scenario: Product detail layout

- GIVEN a product detail page renders
- WHEN `.product-detail__main` is displayed
- THEN it MUST flex-wrap with `--space-md` gap, and `.product-detail__info` MUST have `--surface` background with centered text

### Requirement: Empty State Block

The `.empty-state` block MUST display a centered fallback with 3D printer illustration, `--pico-yellow` heading in `--font-heading`, and `--font-body` message text when no products exist.

#### Scenario: Empty state renders

- GIVEN zero products are available
- WHEN the homepage renders
- THEN `.empty-state` MUST center content vertically with min-height 50vh