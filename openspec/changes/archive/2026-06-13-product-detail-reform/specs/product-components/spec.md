# Delta for product-components

## MODIFIED Requirements

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
