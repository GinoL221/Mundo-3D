# Delta for dynamic-homepage

## MODIFIED Requirements

### Requirement: Dynamic Product Listing on Homepage

`index.ejs` MUST fetch products via `ProductService.findAll()` (or `findLatest()`) and render product cards with name, price, category illustration, and link to detail. The detail link path MUST be `/product/:id` (where `:id` is the product ID). All product grid elements MUST use the canonical BEM class `.product-grid` for the grid container and `.product-card` for individual cards.

(Previously: The detail link path incorrectly linked to `/products/:id`.)

#### Scenario: Products displayed when available

- GIVEN the database contains one or more active products
- WHEN a user visits `/` (index route)
- THEN the page MUST render a product card for each product with its name, price, and category illustration
- AND each card MUST link to `/product/:id` where `:id` is the product ID

#### Scenario: Products not found shows empty state

- GIVEN the database contains zero products
- WHEN a user visits `/`
- THEN the page MUST render the empty state: a 3D printer pixel art illustration and the text "Próximamente"
- AND MUST NOT display an empty product grid or "no products" list
