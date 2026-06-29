# SDD Proposal: retro-crt-jrpg-effects

## Intent
Retro theme polish with subtle CRT emulation and interactive JRPG arrow animations.

## Scope
### In Scope
- Subtle CRT effect overlay (scanlines and phosphor glow) enabled by default.
- Header navigation bar CRT ON/OFF toggle, persisted in `localStorage`.
- Pure CSS blinking arrow (`▶`) animation on hover for:
  1. Header/Navbar navigation links
  2. Primary call-to-action buttons
- Accessibility support: Disable blinking animations and CRT flickers when `prefers-reduced-motion: reduce` is active.

### Out of Scope
- Global retro styling overrides (fonts, colors, borders) beyond the requested CRT overlay and JRPG hover arrow animations.
- Non-CSS blinking arrow implementations.

## Capabilities
### New/Modified Capabilities
- `retro-visual-theme`: A toggleable retro visual theme containing CRT filter overlay and JRPG cursor effects, supporting user preference persistence via `localStorage` and accessibility reduced motion media queries.

### Disabled/Removed Capabilities
- None.

## Approach
- **CRT Emulation Layer**: Static overlay element in the main layout using a repeating linear gradient for scanlines, combined with a radial gradient for viewport vignette/phosphor glow. A subtle CSS animation may simulate CRT flicker if appropriate, but will be disabled via `prefers-reduced-motion`. Pointer events will be disabled on the overlay to prevent interaction issues.
- **JRPG Blink Animation**: Implemented purely in CSS using `::before` or `::after` pseudo-elements. The blinking arrow character (`▶`) is rendered and animated using a steps-based CSS keyframe animation (`steps(2, start)`) controlling visibility.
- **Header Toggle**: Simple button or switch in the Navbar that toggles a class on the `<html>` or `<body>` element (e.g. `retro-theme-disabled` or `crt-active`). A small inline JS script in the Layout header will read from `localStorage` on load to prevent flash of unstyled content.

## Affected Areas
- `frontend/src/layouts/Layout.astro` - Layout wrapper to inject CRT overlay and init script.
- `frontend/src/components/Header.astro` - Navigation bar to place the ON/OFF theme toggle.
- `frontend/src/styles/base/layout.css` - Global CRT utility and overlay styling.
- `frontend/src/styles/components/navbar.css` - Styles for Navbar links and the toggle switch.
- `frontend/src/styles/components/product-card.css` - Styles for main buttons/CTAs to trigger JRPG hover arrows.

## Risks & Mitigations
- **Contrast & Readability**: CRT scanlines/glow can degrade text readability. *Mitigation:* Apply subtle scanline opacity (< 10%) and allow users to disable the effect.
- **Pointer Event Block**: The overlay could block page clicks. *Mitigation:* Use `pointer-events: none` on the CRT overlay.

## Rollback Plan
Run `git checkout` on the affected files to restore clean state.

## Success Criteria
- CRT overlay is active on page load by default.
- Toggle in Header successfully turns CRT effect ON/OFF, and state persists across reloads.
- Blinking JRPG arrow appears beside Navbar links and buttons on hover.
- Reduced motion setting disables CRT animations and JRPG blinking arrow.
