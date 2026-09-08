# Delta for Dynamic Homepage

## MODIFIED Requirements

### Requirement: Responsive Layout

The Home page MUST use content-fit responsive behavior: one product column below 640px, two columns from 640px through 1023px, and three columns from 1024px only while every card remains at or above the product-card minimum width. Its body text MUST be at least 16px, prose measure SHOULD remain approximately 75ch or less, and headings MUST scale fluidly within explicit lower and upper bounds. Other pages MUST retain their existing responsive behavior.

(Previously: All pages shared Mobile, Tablet, and Desktop ranges ending at 1024px, a 1440px container, and only a generic multi-column desktop rule.)

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
