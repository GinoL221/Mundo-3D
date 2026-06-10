# Dynamic Homepage Specification

## Purpose

Replaces the hardcoded index page with a dynamic one powered by ProductService, featuring a carousel and an empty-state fallback.

## Requirements

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