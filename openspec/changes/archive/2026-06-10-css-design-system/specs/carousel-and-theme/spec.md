# Carousel and Theme Specification

## Purpose

BEM-based carousel and theme toggle styles, including LCD panel variant, replacing ad-hoc naming.

## Requirements

### Requirement: Carousel Block

The `.carousel` block MUST style the homepage carousel and generic carousel variant with overflow-hidden container, slide flexbox, navigation arrows (`.carousel__prev`, `.carousel__next`), and indicators (`.carousel__indicators`). The LCD panel variant MUST use modifier `.carousel--lcd` with double border, scanline overlay, and glow animation.

#### Scenario: Carousel slides transition

- GIVEN the carousel contains multiple slides
- WHEN the auto-cycle or user navigation advances
- THEN `.carousel__container` MUST translate via `transform` with 0.5s ease-in-out transition

#### Scenario: LCD panel displays retro effects

- GIVEN a carousel element with modifier `.carousel--lcd`
- WHEN rendered
- THEN it MUST display a 150px panel with double border (`6px double`), scanline overlay via `::after`, and glow keyframe animation on `.carousel--lcd .glow` elements

#### Scenario: Carousel navigation arrows

- GIVEN the carousel is visible
- WHEN `.carousel__prev` or `.carousel__next` buttons are shown
- THEN they MUST be positioned absolute at top 50% with `--surface` background and z-index 10

### Requirement: Theme Toggle Button

The `.theme-toggle-btn` block MUST style the theme toggle with `--surface` background, `--fg` text, `2px solid` border, and hover state changing to `--accent` background. On mobile (<640px), `.theme-toggle-btn__icon` MUST display while `.theme-toggle-btn__text` is hidden.

#### Scenario: Theme toggle responsive behavior

- GIVEN a viewport width <640px
- WHEN the theme toggle renders
- THEN `.theme-toggle-btn__text` MUST be hidden and `.theme-toggle-btn__icon` MUST display inline