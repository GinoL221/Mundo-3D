# Cart and Forms Delta Spec

## Purpose
Fix button widths and alignment in forms.

## MODIFIED Requirements

### Requirement: Form Block
The `.form-card` block MUST style login, register, new user, and product form containers with `--surface` background and centered text. All `.form-card__input` and `.form-card__btn` elements MUST use `var(--input-fg)` for text. Buttons MUST span 100% of the inputs' width (either as a single 100% width button or flexed equally inside a 100% width container), with no offset margins.

(Previously: form buttons had right margin and no specified width, making them narrower than inputs.)

#### Scenario: Login form renders
- GIVEN the login page loads
- WHEN `.form-card--login` renders
- THEN it MUST be 300px wide with centered text and `--surface` background

#### Scenario: Form input styling
- GIVEN any form inside `.form-card`
- WHEN `.form-card__input` renders
- THEN it MUST have `var(--input-bg)` background, `2px solid --pico-muted` border, and `var(--input-fg)` text color

#### Scenario: Form button styling
- GIVEN any `.form-card__btn` in a single-button form
- WHEN rendered
- THEN it MUST have 100% width and no right margin

#### Scenario: Register form uses medium variant with actions container
- GIVEN the register page loads
- WHEN the form container renders
- THEN it MUST use `.form-card--medium` (400px width)
- AND buttons MUST be wrapped in a container spanning 100% width
- AND each button MUST flex equally with no right margin
