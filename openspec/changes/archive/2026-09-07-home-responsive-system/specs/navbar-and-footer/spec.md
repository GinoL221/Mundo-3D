# Delta for Navbar and Footer

## ADDED Requirements

### Requirement: Shared Home Frame

The Home header, main content, and footer MUST align to the same centered frame with a maximum width of 1104px and MUST remain fluid below that maximum.

#### Scenario: Wide Home alignment

- GIVEN Home is viewed at 1440px
- WHEN header, content, and footer render
- THEN their content edges MUST align within one centered 1104px maximum frame

#### Scenario: Narrow Home frame

- GIVEN the viewport is narrower than 1104px plus required gutters
- WHEN Home renders
- THEN the shared frame MUST contract within the viewport without horizontal overflow

### Requirement: Home Disclosure Navigation

Home MUST expose compact navigation through 1023px in every orientation and horizontal navigation from 1024px. Compact navigation MUST be a non-modal disclosure operated by a native keyboard-operable control. The control MUST expose synchronized `aria-expanded` and `aria-controls`; `aria-controls` MUST reference a stable controlled-region ID across rendering and hydration. Ordinary navigation links MUST NOT use ARIA `menu` or `menuitem` roles.

#### Scenario: Compact navigation operates from the keyboard

- GIVEN Home is at 1023px or narrower and the disclosure control is focused
- WHEN the user activates it with Enter or Space
- THEN the controlled navigation MUST open and `aria-expanded` MUST become `true`
- AND `aria-controls` MUST identify the visible navigation region

#### Scenario: Escape closes and restores focus

- GIVEN compact navigation is open
- WHEN the user presses Escape
- THEN navigation MUST close, `aria-expanded` MUST become `false`, and focus MUST return to its control

#### Scenario: Disclosure remains non-modal

- GIVEN compact navigation is open
- WHEN the user moves focus outside the navigation
- THEN outside page content MUST remain available and no modal semantics or focus trap MUST apply

#### Scenario: Navigation boundary is orientation-independent

- GIVEN Home is rendered at 1023px and then at 1024px in either orientation
- WHEN responsive state is evaluated
- THEN 1023px MUST use compact navigation and 1024px MUST expose horizontal navigation
- AND visible state and control state MUST agree at both widths
