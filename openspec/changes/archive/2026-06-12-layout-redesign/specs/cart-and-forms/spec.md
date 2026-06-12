# Delta for Cart and Forms

## MODIFIED Requirements

### Requirement: Form Block

The `.form-card` block MUST style login, register, new user, and product form containers with `--surface` background, `2px solid --pico-muted` border, centered text, and shadow. Variants: `.form-card--login` (300px width), `.form-card--medium` (400px width), `.form-card--wide` (max-width 600px). All `.form-card__input` elements and `.form-card__btn` buttons MUST use `var(--input-fg)` for text color to ensure legibility in both themes. The register page MUST use `.form-card--medium` (400px).

(Previously: register variant was `.form-card--register` (400px); inputs used `var(--fg)` directly; no `--input-fg` token existed.)

#### Scenario: Login form renders

- GIVEN the login page loads
- WHEN `.form-card--login` renders
- THEN it MUST be 300px wide with centered text and `--surface` background

#### Scenario: Form input styling

- GIVEN any form inside `.form-card`
- WHEN `.form-card__input` elements render
- THEN they MUST have `var(--input-bg)` background, `2px solid --pico-muted` border, `var(--input-fg)` text color, `--font-body` 16px, and focus state changing border to `--accent`

#### Scenario: Form button styling

- GIVEN any `.form-card__btn` button
- WHEN rendered
- THEN it MUST have `var(--input-bg)` background, `var(--input-fg)` text color, `2px solid --pico-muted` border, and hover state changing to `--accent` background

#### Scenario: Register form uses medium variant

- GIVEN the register page loads
- WHEN the form container renders
- THEN it MUST use `.form-card--medium` class and render at 400px width
