# Utility Pages Specification

## Purpose

BEM styles for profile, users list, alerts, error pages, and about page — replacing `.profile-*`, `.users_container`, `.message`, `.error-page`, and `.about-content` classes.

## Requirements

### Requirement: Profile Block

The `.profile` block MUST style the user profile page with max-width 800px, `--surface` background, `2px solid --pico-muted` border, and `--space-lg` padding. Elements: `.profile__image` (max-width 70%, border `--pico-muted`), `.profile__email` (color `--fg`, 20px `--font-body`).

#### Scenario: Profile renders with surface background

- GIVEN a user profile page
- WHEN it renders
- THEN `.profile` MUST have `--surface` background, centered layout, and bordered container

### Requirement: Users List Block

The `.users-list` block MUST replace `.users_container` as a flex-wrap centered grid with `--space-lg` gap. Each `.users-list__card` (replacing `.user_container`) MUST have `--surface` background, `2px solid --pico-muted` border, centered text, and `--space-md` padding/margin. Delete buttons MUST use `.users-list__btn--danger` with `--danger` background.

#### Scenario: Users list flex layout

- GIVEN a users management page
- WHEN `.users-list` renders
- THEN it MUST be a flex-wrap container with centered items and `--space-lg` gap

### Requirement: Alert Block

The `.alert` block MUST replace `.message` as a full-width notification with `--pico-purple` background, `--pico-yellow` text, centered alignment, and `--space-sm/md` padding. Element `.alert__text`uses `--font-body` at 18px.

#### Scenario: Alert message renders

- GIVEN a flash message needs to display
- WHEN `.alert` renders
- THEN it MUST have `--pico-purple` background with `--pico-yellow` centered text

### Requirement: Error Page Block

The `.error-page` block MUST style 403/404 error pages with centered column layout, min-height 60vh, `--font-heading` 24px heading in `--danger` color, `--font-body` 20px body, and action link styled as `--accent` background button with hover inverting to `--pico-black` background.

#### Scenario: Error page renders centered content

- GIVEN a 403 or 404 error
- WHEN `.error-page` renders
- THEN it MUST center content vertically with `--danger` colored heading

### Requirement: About Page

The about page MUST reuse `.form-card` with modifier for max-width 800px centered layout, replacing `.containerMainLogin .about-content`.

#### Scenario: About page uses form-card layout

- GIVEN the about page renders
- WHEN its container displays
- THEN it MUST use `.form-card--wide` or equivalent centered layout with `--surface` background