# Desktop Layout Specification

## Purpose

Defines the max-width constraints for the desktop layout to ensure content is readable and visually balanced on widescreen displays (1440px+).

## Requirements

### Requirement: Desktop layout uses wider max-width

The system SHALL preserve the existing centered 1440px maximum for non-Home main content, footer, and navigation on desktop viewports. Home SHALL instead constrain its header, main content, and footer to one centered 1104px maximum frame from 1024px upward, without redundant child constraints.

#### Scenario: User views Home on wide desktop

- GIVEN the Home viewport is 1440px or wider
- WHEN the page loads
- THEN header, main content, and footer MUST align within one centered frame no wider than 1104px
- AND child regions MUST NOT introduce conflicting maximum widths

#### Scenario: User views non-Home desktop content

- GIVEN a non-Home page is viewed at 1920px or wider
- WHEN the page loads
- THEN its existing main content, footer, and navbar MAY span up to 1440px centered

#### Scenario: User views Home at standard desktop width

- GIVEN the Home viewport is 1024px
- WHEN the page loads
- THEN the 1104px frame MUST contract to the available width with padding
- AND no content MUST overflow horizontally

### Requirement: Mobile and tablet layouts unchanged

The system SHALL preserve existing mobile and tablet behavior on non-Home pages. Home SHALL use its confirmed one-column layout below 640px and two-column layout from 640px through 1023px; these behaviors MUST remain independent of orientation.

#### Scenario: User views Home on mobile

- GIVEN the Home viewport is 375px
- WHEN the page loads
- THEN Home MUST use its confirmed one-column responsive layout

#### Scenario: User views Home on tablet

- GIVEN Home is viewed at 768x1024 or at 1023px wide in either orientation
- WHEN the page loads
- THEN Home MUST use its confirmed two-column layout and compact navigation

#### Scenario: User views another page below desktop

- GIVEN a non-Home page is viewed below 1024px
- WHEN the page loads
- THEN its pre-change responsive behavior MUST remain unchanged
