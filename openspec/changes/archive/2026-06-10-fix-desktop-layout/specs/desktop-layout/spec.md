# Desktop Layout Specification

## Purpose

Defines the max-width constraints for the desktop layout to ensure content is readable and visually balanced on widescreen displays (1440px+).

## ADDED Requirements

### Requirement: Desktop layout uses wider max-width

The system SHALL constrain the main content area, footer, and navigation bar to a maximum width of 1440px centered on desktop viewports (>= 1024px). No redundant max-width constraints SHALL exist on child elements that inherit container width.

#### Scenario: User views site on desktop (>= 1024px)

- GIVEN the viewport is 1920px or wider
- WHEN the page loads
- THEN the main content area spans up to 1440px centered
- AND the footer spans up to 1440px centered
- AND the navbar content spans up to 1440px centered
- AND no redundant max-width constraints exist on child elements

#### Scenario: User views site on standard desktop (1366px)

- GIVEN the viewport is 1366px
- WHEN the page loads
- THEN the content fills the viewport width with padding
- AND no content overflows horizontally

### Requirement: Mobile and tablet layouts unchanged

The system SHALL preserve the existing responsive behavior for mobile (< 640px) and tablet (640-1023px) viewports. No max-width changes SHALL affect these breakpoints.

#### Scenario: User views site on mobile (< 640px)

- GIVEN the viewport is 375px
- WHEN the page loads
- THEN the layout behaves exactly as before the change

#### Scenario: User views site on tablet (640-1023px)

- GIVEN the viewport is 768px
- WHEN the page loads
- THEN the layout behaves exactly as before the change
