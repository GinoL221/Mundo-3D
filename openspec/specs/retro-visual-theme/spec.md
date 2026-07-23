# Retro Visual Theme Specification

## Purpose

Retro visual theme settings, CRT effect layer, JRPG hover cursors, accessibility reduction options, and toggle state persistence.

## Requirements

### Requirement: CRT Filter Overlay

The system MUST render a subtle CRT scanline and phosphor glow overlay by default on page load. To prevent interaction issues, the overlay MUST ignore all mouse and pointer interactions using `pointer-events: none`.

#### Scenario: CRT Overlay Active by Default

- GIVEN the application is loaded
- WHEN no user preference is stored in `localStorage`
- THEN the CRT scanline and phosphor glow overlay elements MUST be active and visible in the layout

#### Scenario: CRT Overlay Ignores Pointer Events

- GIVEN the CRT overlay is visible
- WHEN a user clicks or interacts with the area occupied by the overlay
- THEN the pointer events MUST pass through the overlay to the underlying elements

### Requirement: JRPG Cursor Hover

The system MUST display a blinking retro JRPG arrow cursor (`▶`) on interactive elements (specifically, header links and primary call-to-action buttons) when hovered by the user.

#### Scenario: Blinking JRPG Cursor on Header Hover

- GIVEN a user hovers over a header navigation link
- WHEN the retro visual theme is enabled
- THEN a blinking JRPG arrow (`▶`) MUST appear beside the link text

#### Scenario: Blinking JRPG Cursor on CTA Button Hover

- GIVEN a user hovers over a primary call-to-action button
- WHEN the retro visual theme is enabled
- THEN a blinking JRPG arrow (`▶`) MUST appear beside the button text

### Requirement: Theme Toggle Control

Navigation bar MUST provide a CRT/JRPG toggle using `retro-theme-preference`, default `enabled`, persisted in `localStorage`, and applied before paint.

#### Scenario: Theme Toggled Off

- GIVEN the CRT theme is currently active
- WHEN the user clicks the theme toggle control
- THEN the CRT overlay MUST be hidden
- AND the JRPG hover cursors MUST be disabled
- AND the disabled state preference MUST be saved to `localStorage`

#### Scenario: Theme Preference Persistent Initialization

- GIVEN a user previously disabled the retro theme
- WHEN they reload or navigate to another page
- THEN the page MUST initialize with the retro theme disabled
- AND there MUST NOT be any transient visual flash of the CRT overlay or effects during load

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

### Requirement: Reduced Motion Support

The system MUST detect the user's system preference for reduced motion. If active, all CRT animations (e.g. flickers) and JRPG cursor blinking animations MUST be disabled.

#### Scenario: System Reduced Motion Disables Animations

- GIVEN the user's system preference `prefers-reduced-motion: reduce` is active
- WHEN the retro visual theme is enabled
- THEN any CRT flicker or screen animations MUST be disabled
- AND the JRPG cursor arrows MUST not blink on hover
