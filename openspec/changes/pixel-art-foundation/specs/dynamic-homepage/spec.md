# Dynamic Homepage Specification

## Purpose

Replaces the hardcoded index page with a dynamic one powered by ProductService, featuring a carousel and an empty-state fallback.

## Requirements

### Requirement: Dynamic Product Listing on Homepage

`index.ejs` MUST fetch products via `ProductService.findAll()` (or `findLatest()`) and render product cards with name, price, category illustration, and link to detail.

#### Scenario: Products displayed when available

- GIVEN the database contains one or more active products
- WHEN a user visits `/` (index route)
- THEN the page MUST render a product card for each product with its name, price, and category illustration
- AND each card MUST link to the product detail page

#### Scenario: Products not found shows empty state

- GIVEN the database contains zero products
- WHEN a user visits `/`
- THEN the page MUST render the empty state: a 3D printer pixel art illustration and the text "Próximamente"
- AND MUST NOT display an empty product grid or "no products" list

### Requirement: Carousel with Linked Slides

The homepage MUST include a `carousel.js` component cycling 3 slides, each with correct navigation links.

#### Scenario: Carousel cycles through 3 slides

- GIVEN the homepage has loaded
- WHEN the carousel initializes
- THEN it MUST display exactly 3 slides
- AND each slide MUST contain a clickable link navigating to a valid page

#### Scenario: Carousel auto-advances

- GIVEN the carousel is active on the homepage
- WHEN no user interaction occurs for its interval duration
- THEN the carousel MUST auto-advance to the next slide

#### Scenario: Carousel manual navigation

- GIVEN the carousel is visible
- WHEN the user clicks a navigation indicator or arrow
- THEN the carousel MUST advance to the selected slide immediately

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

All pages MUST be responsive across three breakpoints: Mobile (<640px), Tablet (640–1024px), Desktop (>1024px), with a container max-width of 1200px.

#### Scenario: Desktop layout

- GIVEN a viewport wider than 1024px
- WHEN any page renders
- THEN the main content container MUST have `max-width: 1200px` and `margin: 0 auto`
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