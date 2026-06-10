# Delta for Dynamic Homepage

## MODIFIED Requirements

### Requirement: Carousel with Linked Slides

The homepage MUST include a compact retro LCD text panel carousel (`carousel.js`) with a fixed height of 150px, custom retro styling (scanline overlays and double borders), auto-cycling 3 specific text slides, each with correct navigation links.
(Previously: Standard graphical homepage banner carousel.)

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
