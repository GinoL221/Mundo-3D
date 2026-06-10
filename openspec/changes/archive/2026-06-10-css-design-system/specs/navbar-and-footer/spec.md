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