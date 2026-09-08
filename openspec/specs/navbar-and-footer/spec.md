# Navbar and Footer Specification

## Purpose

BEM-based styles for header navigation, dropdown, cart badge, and footer sections replacing Spanish/mixed class names.

## Requirements

### Requirement: Navbar Block

The `.navbar` block MUST style the site navigation with flex layout, `--surface` background, PICO-8 color variables, and responsive mobile-first breakpoints. The element `.navbar__list` MUST replace `nav.barra-navegacion ul` and `.navbar__link` MUST replace `nav.barra-navegacion a`.

#### Scenario: Desktop navbar layout

- GIVEN a viewport ≥640px
- WHEN the navbar renders
- THEN `.navbar` MUST display as horizontal flex row
- AND `.navbar__link` items MUST use `--font-body` at 18px with `--space-xs` padding

#### Scenario: Mobile navbar stacks vertically

- GIVEN a viewport <640px
- WHEN the navbar renders
- THEN `.navbar` MUST flex-direction column and align items flex-start

### Requirement: Footer Block

The `.footer` block MUST style the site footer with `--surface` background, centered sections, and copyright row. The element `.footer__section` MUST replace `.containerSections` and `.footer__copyright` MUST replace `.containerCopyright`.

#### Scenario: Footer sections display

- GIVEN any page loads
- WHEN the footer partial renders
- THEN `.footer__section` groups MUST display with centered text and `--font-heading` headings
- AND `.footer__copyright` MUST align left with `--pico-muted` color

### Requirement: Dropdown and Cart BEM

The `.nav-item` MUST contain `.nav-item__dropdown` (replacing `.dropdown-menu`) and the cart link MUST use `.cart-link` with `.cart-badge` element.

#### Scenario: Dropdown opens on hover

- GIVEN a nav item with a dropdown
- WHEN the user hovers or focuses the parent `.nav-item`
- THEN `.nav-item__dropdown` MUST display block with `--surface` background and z-index 100

### Requirement: Header Session and Navigation

The Header MUST preserve session visibility, identity, links, dropdowns, and visual-only search through selectors, cookies, and events.

A cross-tab `BroadcastChannel('m3d-session')` message carries the state it announces, and the receiving tab MAY apply it directly instead of re-reading the cookie. This is not a loophole in the scenario below: the sending tab has already expired the cookie and is authoritative about the session ending, so the state applied is the state the cookie represents. It exists because cookie writes are not instantly visible across renderer processes — a receiver that re-derived the state from its own `document.cookie` could read a value the sender has already deleted, show a logged-out user as signed in, and never correct itself, since a one-shot message does not retry.

#### Scenario: Session state updates Header visibility

- GIVEN the non-httpOnly `m3d_user` cookie represents a guest, user, or administrator
- WHEN Header loads or receives a same-tab `session-changed` event, a `BroadcastChannel('m3d-session')` message from another tab, or a `focus`/`visibilitychange` fallback trigger
- THEN existing visibility, greeting, and avatar MUST reflect that state

#### Scenario: Header navigation remains unchanged

- GIVEN a page displays the Header
- WHEN a user follows a link, focuses/hover a dropdown, or activates search
- THEN navigation and dropdown behavior MUST remain unchanged; search MUST perform no action

### Requirement: Header Logout Transition

The keyboard-activatable Header logout MUST end the server-side session (clearing the httpOnly auth cookie plus the CSRF/display cookies), clear the cart, then navigate to `/login`.

#### Scenario: Authenticated user logs out

- GIVEN an authenticated user activates logout
- WHEN the transition runs
- THEN ending the session MUST precede cart clearing, which MUST precede `/login` navigation as guest

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
