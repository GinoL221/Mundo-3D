# Dynamic Homepage Specification

## Purpose

Replaces the hardcoded index page with a dynamic one powered by ProductService, featuring a carousel and an empty-state fallback.

## Requirements

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

### Requirement: Carousel with Linked Slides

The homepage MUST include a compact retro LCD text panel carousel (`carousel.js`) with a fixed height of 150px, custom retro styling (scanline overlays and double borders), auto-cycling 3 specific text slides, each with correct navigation links.

The 3 slides MUST cycle through the following precise text:

1. "Modelado y fabricación 3D" (links to catalog/products)
2. "Calidad premium garantizada" (links to about/guarantee info)
3. "Pedí tu cotización" (links to contact/quote request)

#### Scenario: Carousel cycles through 3 slides

- GIVEN the homepage has loaded
- WHEN the carousel initializes
- THEN it MUST display exactly 3 text slides in a 150px tall double-bordered panel
- AND each slide MUST display the specified text and contain a clickable link to the target page

#### Scenario: Carousel auto-advances

- GIVEN the carousel is active on the homepage
- WHEN no user interaction occurs for its interval duration
- THEN the carousel MUST auto-advance to the next text slide

#### Scenario: Carousel manual navigation

- GIVEN the carousel is visible
- WHEN the user clicks a navigation indicator or arrow
- THEN the carousel MUST advance to the selected text slide immediately

#### Scenario: Carousel displays retro visual effects

- GIVEN the carousel is rendered on the screen
- THEN the container MUST render with a double border, scanline effect overlay, and glowing retro LCD font colors

### Requirement: Cart Counter Behavior

The header cart counter MUST show the distinct product count and hide when the cart is empty.

#### Scenario: Cart with products shows distinct count

- GIVEN the user's session cart contains 3 units of product A and 2 units of product B
- WHEN the header renders
- THEN the cart counter MUST display "2" (distinct products, not total units)

#### Scenario: Empty cart hides counter

- GIVEN the user's session cart is empty or undefined
- WHEN the header renders
- THEN the cart counter element MUST be hidden (display none or equivalent)
- AND MUST NOT display "0"

### Requirement: Responsive Layout

The Home page MUST use content-fit responsive behavior: one product column below 640px, two columns from 640px through 1023px, and three columns from 1024px only while every card remains at or above the product-card minimum width. Its body text MUST be at least 16px, prose measure SHOULD remain approximately 75ch or less, and headings MUST scale fluidly within explicit lower and upper bounds. Other pages MUST retain their existing responsive behavior.

(Previously: Referenced `--breakpoint-*` tokens and inconsistent max-width values.)

#### Scenario: Phone Home layout

- GIVEN the Home viewport is narrower than 640px
- WHEN Home renders with products
- THEN product cards MUST form one column without horizontal overflow
- AND body text MUST remain at least 16px

#### Scenario: Tablet Home grid boundaries

- GIVEN the Home viewport is from 640px through 1023px
- WHEN products render in portrait or landscape orientation
- THEN product cards MUST form exactly two columns
- AND each card MUST remain at or above its declared minimum width

#### Scenario: Viable desktop Home grid

- GIVEN the Home viewport is at least 1024px and three cards fit within the Home frame at their minimum width
- WHEN products render
- THEN product cards MUST form exactly three columns
- AND the grid MUST NOT overflow horizontally

#### Scenario: Unviable three-column fit

- GIVEN the Home viewport is at least 1024px but three minimum-width cards do not fit in the available Home frame
- WHEN products render
- THEN the grid MUST use fewer columns rather than shrink a card below its minimum width

#### Scenario: Readable Home typography

- GIVEN Home contains body copy and headings at any supported viewport
- WHEN their computed layout is measured
- THEN body copy MUST be at least 16px and SHOULD not exceed approximately 75ch per line
- AND headings MUST remain within their defined minimum and maximum sizes
