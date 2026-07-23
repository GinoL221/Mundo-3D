# Delta for retro-visual-theme

## ADDED Requirements

### Requirement: Color Theme

Color control MUST use `theme`, default to `dark`, normalize invalid values to dark, persist toggles, and update the document attribute and icon.

#### Scenario: Color theme hydrates and toggles

- GIVEN `theme` is absent, valid, or invalid
- WHEN Header hydrates or the user toggles color theme
- THEN the document MUST reflect dark/light, persist it, and update its icon

### Requirement: Layout First-Paint Boundary

The Layout inline script MUST apply stored theme and CRT before first paint; Header controls MUST not replace it.

#### Scenario: Stored visual preferences apply before paint

- GIVEN stored `theme` or `retro-theme-preference` values exist
- WHEN loading begins
- THEN Layout MUST apply them before paint without flash; Header hydration MUST avoid SSR browser globals

## MODIFIED Requirements

### Requirement: Theme Toggle Control

Navigation bar MUST provide a CRT/JRPG toggle using `retro-theme-preference`, default `enabled`, persisted in `localStorage`, and applied before paint.
(Previously: Key/default unspecified.)

#### Scenario: Theme Toggled Off

- GIVEN the CRT theme is active
- WHEN the user clicks the theme toggle
- THEN CRT/JRPG effects MUST be disabled and `retro-theme-preference` saved as disabled

#### Scenario: Theme Preference Persistent Initialization

- GIVEN the retro theme was disabled
- WHEN the user reloads or navigates
- THEN it MUST initialize disabled without a CRT/effects flash
