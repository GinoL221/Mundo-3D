# Cart and Forms Specification

## Purpose

BEM cart and form styles replacing Spanish selectors (`.contenedor-carrito`, `.tarjeta-de-productos`, `.containerRegistroLogin`, etc.).

## Requirements

### Requirement: Cart Block

The `.cart` block MUST style the cart page. Elements: `.cart__container` (replaces `.contenedor-carrito`), `.cart__items` (replaces `.tarjeta-de-productos`), `.cart__item` (replaces `article.producto`), `.cart__item-image` (replaces `.imagen-producto`), `.cart__item-details` (replaces `.tarjeta`), `.cart__summary` (replaces `section.total`), `.cart__btn-continue` (replaces `.seguir`), `.cart__btn-checkout` (replaces `.finalizar`).

#### Scenario: Desktop cart layout

- GIVEN a viewport ≥1024px
- WHEN the cart page renders
- THEN `.cart__container` MUST flex with `--space-lg` gap
- AND `.cart__items` takes 55% width, `.cart__summary` takes 40% width with no top border

#### Scenario: Mobile cart layout

- GIVEN a viewport <640px
- WHEN the cart page renders
- THEN `.cart__item` MUST flex-direction column and `.cart__item-image` MUST be full width

### Requirement: Form Block

The `.form-card` block MUST style login, register, new user, and product form containers with `--surface` background, `2px solid --pico-muted` border, centered text, and shadow. Variants: `.form-card--login` (300px width), `.form-card--register` (400px width), `.form-card--wide` (max-width 600px).

#### Scenario: Login form renders

- GIVEN the login page loads
- WHEN `.form-card--login` renders
- THEN it MUST be 300px wide with centered text and `--surface` background

#### Scenario: Form input styling

- GIVEN any form inside `.form-card`
- WHEN `.form-card__input` elements render
- THEN they MUST have `--pico-black` background, `2px solid --pico-muted` border, `--font-body` 16px, and focus state changing border to `--accent`

#### Scenario: Form button styling

- GIVEN any `.form-card__btn` button
- WHEN rendered
- THEN it MUST have `--pico-black` background, `2px solid --pico-muted` border, and hover state changing to `--accent` background