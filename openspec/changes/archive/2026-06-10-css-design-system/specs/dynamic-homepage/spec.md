# Delta for dynamic-homepage

## MODIFIED Requirements

### Requirement: Dynamic Product Listing on Homepage

`index.ejs` MUST fetch products via `ProductService.findAll()` (or `findLatest()`) and render product cards with name, price, category illustration, and link to detail. All product grid elements MUST use the canonical BEM class `.product-grid` for the grid container and `.product-card` for individual cards.

(Previously: Referenced legacy mixed class names in EJS markup.)

#### Scenario: Products displayed when available

- GIVEN the database contains one or more active products
- WHEN a user visits `/` (index route)
- THEN the page MUST render a product card for each product with its name, price, and category illustration
- AND each card MUST link to the product detail page
- AND the grid container MUST use `.product-grid` class

#### Scenario: Products not found shows empty state

- GIVEN the database contains zero products
- WHEN a user visits `/`
- THEN the page MUST render the empty state: a 3D printer pixel art illustration and the text "Próximamente"
- AND MUST NOT display an empty product grid or "no products" list

### Requirement: Responsive Layout

All pages MUST be responsive across three breakpoints: Mobile (<640px), Tablet (640–1024px), Desktop (>1024px), with a container max-width of 1440px. Breakpoint media queries MUST use `min-width` (mobile-first) and reference `--bp-mobile` (640px) and `--bp-tablet` (1024px) custom properties for widths only.

(Previously: Referenced `--breakpoint-*` tokens and inconsistent max-width values.)

#### Scenario: Desktop layout

- GIVEN a viewport wider than 1024px
- WHEN any page renders
- THEN the main content container MUST have `max-width: 1440px` and `margin: 0 auto`
- AND product grids MUST display in multi-column layout

#### Scenario: Mobile layout

- GIVEN a viewport narrower than 640px
- WHEN the homepage renders
- THEN product cards MUST stack vertically in a single column
- AND the carousel MUST occupy full width

#### Scenario: Tablet layout

- GIVEN a viewport between 640px and 1024px inclusive
- WHEN the homepage renders
- THEN product cards MUST display in a 2-column grid