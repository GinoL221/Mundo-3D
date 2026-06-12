# Delta for CSS Design System

## ADDED Requirements

### Requirement: Input Foreground Token

The system MUST define a `--input-fg` custom property in `colors.css` for both dark and light themes. In dark mode `--input-fg` MUST resolve to a light color legible on `--input-bg`. In light mode `--input-fg` MUST resolve to a dark color legible on the light-mode `--input-bg`. The system MUST also override `--input-bg` in the `[data-theme="light"]` selector so that light-mode inputs have a non-black background.

#### Scenario: Dark mode input foreground resolves

- GIVEN `<html>` has no `data-theme` attribute (dark mode default)
- WHEN `--input-fg` is evaluated
- THEN it MUST resolve to a color with sufficient contrast on the dark-mode `--input-bg`

#### Scenario: Light mode input foreground and background override

- GIVEN `data-theme="light"` is set on `<html>`
- WHEN `[data-theme="light"]` selectors in `colors.css` are evaluated
- THEN `--input-bg` MUST resolve to a non-black background color
- AND `--input-fg` MUST resolve to a dark color legible on that background

## MODIFIED Requirements

### Requirement: Design Token Files

The system MUST provide three token files under `public/css/tokens/`: `colors.css` (PICO-8 palette + semantic custom properties including `[data-theme="light"]` overrides AND the `--input-fg` token with light-mode override for `--input-bg`), `typography.css` (font scale: `--font-heading` Press Start 2P, `--font-body` VT323, heading sizes), and `spacing.css` (8px grid: `--space-xs` through `--space-2xl`). Token files MUST be loaded before base and component files in `head.ejs`.

(Previously: colors.css listed semantic custom properties without `--input-fg` or light-mode `--input-bg` override.)

#### Scenario: Tokens cascade correctly

- GIVEN `head.ejs` renders its `<link>` tags in order
- WHEN the browser processes the CSS cascade
- THEN `tokens/colors.css` MUST be linked before `base/reset.css`
- AND all semantic custom properties (`--bg`, `--fg`, `--accent`, `--danger`, `--warning`, `--surface`, `--input-fg`) MUST resolve to PICO-8 hex values in dark mode

#### Scenario: Light theme tokens override correctly

- GIVEN `data-theme="light"` is set on `<html>`
- WHEN `[data-theme="light"]` selectors in `colors.css` are evaluated
- THEN `--bg` MUST resolve to `#f5f0e8`, `--fg` to `#1a2a4a`, `--accent` to `#8b7355`, `--surface` to `#ffffff`
- AND `--input-bg` MUST resolve to a non-black value
- AND `--input-fg` MUST resolve to a dark color legible on the light-mode `--input-bg`
