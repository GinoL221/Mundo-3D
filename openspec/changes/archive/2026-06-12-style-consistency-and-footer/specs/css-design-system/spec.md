# CSS Design System Delta Spec

## Purpose
Add tokens, header grid, and theme toggle specifications.

## ADDED Requirements

### Requirement: Header Grid and Theme Toggle
The header navbar MUST use a CSS Grid layout on viewports ≥640px to center the search bar. The theme toggle MUST NOT display text labels and MUST display only the theme icon.

#### Scenario: Header grid on desktop
- GIVEN a viewport ≥640px
- WHEN the header renders
- THEN `.navbar__inner` MUST display as grid centering the search bar
- AND logo MUST align left, menu right

#### Scenario: Theme toggle icon-only
- GIVEN the header renders
- WHEN inspecting the theme toggle button
- THEN it MUST NOT contain a text element
- AND the icon container MUST display the current theme icon

## MODIFIED Requirements

### Requirement: Design Token Files
The system MUST provide token files under `public/css/tokens/`: `colors.css` (including `--input-fg`, `--title-highlight`, `--lcd-bg`, and `--lcd-fg`), `typography.css`, and `spacing.css`.

(Previously: colors.css listed custom properties without `--title-highlight`, `--lcd-bg`, and `--lcd-fg`.)

#### Scenario: Tokens cascade correctly
- GIVEN `head.ejs` loads token files
- WHEN processing CSS cascade
- THEN `--title-highlight`, `--lcd-bg`, and `--lcd-fg` MUST resolve to dark-mode defaults

#### Scenario: Light theme overrides
- GIVEN `data-theme="light"` is set on `<html>`
- WHEN colors.css is evaluated
- THEN `--title-highlight` MUST resolve to `#1a2a4a`
- AND `--lcd-bg` and `--lcd-fg` MUST resolve to classic Game Boy colors (#8bac0f and #0f380f)
