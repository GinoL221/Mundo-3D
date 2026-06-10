# Proposal: Theme and Carousel

## Intent
Improve homepage engagement and accessibility by introducing a persistent Light/Dark retro theme toggle and replacing the graphical home banner with an active, compact text-based LCD carousel.

## Scope

### In Scope
- **Theme switch**: Add toggle in header displaying `MODE: DARK` / `MODE: LIGHT`, collapsing to `◐` on mobile. Save selection in `localStorage`.
- **Light mode palette**: Apply `#f5f0e8` (bg), `#1a2a4a` (fg), `#8b7355` (accent/border), and `#ffffff` (surface).
- **LCD Carousel**: Implement a ~150px tall retro LCD panel cycling text:
  1. "Modelado y fabricación 3D"
  2. "Calidad premium garantizada"
  3. "Pedí tu cotización"

### Out of Scope
- Automatic system theme detection (e.g., `prefers-color-scheme`).
- Storing theme choice on the server or session database.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `pixel-art-identity`: Light theme styles, header toggle button, CSS variables override, and responsive collapse rules.
- `dynamic-homepage`: Compact LCD panel text carousel (~150px tall) with auto-cycling.

## Approach
1. **Theme Switcher**:
   - Define a selector class (e.g. `[data-theme="light"]`) on `<html>` to override `--bg`, `--fg`, `--accent`, and `--surface` values.
   - Insert a retro toggle button in `src/views/partials/header.ejs`. Use JS in a small inline or dedicated script to set/retrieve the theme from `localStorage` and prevent screen flash.
   - Mobile: CSS media query hides text labels and shows `◐` icon button.
2. **LCD Carousel**:
   - Update `src/views/index.ejs` banner to use a pixelated LCD styling (~150px height, glowing retro display layout).
   - Use CSS animations or JS in `public/js/carousel.js` to cycle slide elements with the 3 specified texts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `public/css/styles.css` | Modified | Add light theme palette custom variables, header toggle rules, and LCD panel styles. |
| `src/views/partials/header.ejs` | Modified | Inject retro toggle button with responsive behavior and load inline theme initializer. |
| `src/views/index.ejs` | Modified | Replace current banner with LCD panel text carousel. |
| `public/js/carousel.js` | Modified | Refactor carousel logic to support the text panel and slide transitions. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Theme Flash | Medium | Load light-mode detection script synchronously in the head element before body renders. |
| Text Overflow in LCD | Low | Enforce max-height/overflow hidden, and test on viewport widths down to 320px. |

## Rollback Plan
Revert to the latest commit before this change:
```bash
git checkout HEAD -- public/css/styles.css public/js/carousel.js src/views/index.ejs src/views/partials/header.ejs
```

## Dependencies
- None.

## Success Criteria
- [ ] Theme toggle updates the document theme attribute and saves to `localStorage`.
- [ ] Light mode uses the exact `#f5f0e8`, `#1a2a4a`, and `#8b7355` hex values.
- [ ] Theme switch collapses to `◐` on screens `< 640px`.
- [ ] LCD panel is ~150px tall and cycles the three specified text slides.
