# Technical Design: retro-crt-jrpg-effects

This document details the design for introducing retro visual theme effects, including a toggleable CRT filter overlay and JRPG-style cursor animations.

---

## 1. Technical Approach

### CRT Overlay Layer
- A dedicated `<div class="crt-overlay"></div>` will be added to the layout.
- Styled using:
  - `pointer-events: none` to ensure all user interactions pass through to the underlying content.
  - `position: fixed` covering the full viewport (`top: 0; left: 0; width: 100vw; height: 100vh;`).
  - High `z-index` (e.g., `9999`) to cover all components.
  - CSS `background` combining a repeating linear gradient (for scanlines) and a radial gradient (for vignette/phosphor glow).
  - Optional subtle screen flicker animation.
- Activated globally when the class `.crt-theme-active` is present on the `<html>` element.

### JRPG Cursor Hover Effect
- Interactive elements (like `.navbar__link` and `.product-card__action`) will display a retro blinking arrow (`▶`) on hover.
- Implemented using a CSS pseudo-element (`::before` or `::after`).
- Bounded to target hover state when `.crt-theme-active` is enabled:
  ```css
  .crt-theme-active .navbar__link:hover::before,
  .crt-theme-active .product-card__action:hover::before {
    content: "▶ ";
    animation: jrpg-blink 0.8s steps(2, start) infinite;
  }
  ```
- Reduced motion support (`prefers-reduced-motion: reduce`) will disable the blinking animation and any screen flickers.

---

## 2. Architecture Decisions

### Inline Script for Theme Initialization
- **Decision**: Put an inline script in `Layout.astro` `<head>` vs. using an external script module.
- **Choice**: Inline script.
- **Rationale**: Reads the theme preference from `localStorage` immediately upon rendering. Applying the `.crt-theme-active` class to the `document.documentElement` before the body renders prevents a visual flash of unstyled content (FOUC).

### Overlay Layout Insertion
- **Decision**: Position of the CRT overlay in the DOM.
- **Choice**: End of `<body>` in `Layout.astro`.
- **Rationale**: Ensures it covers the entire application visually while keeping it simple. `pointer-events: none` completely prevents interaction blocks.

---

## 3. Data Flow

1. **User Interaction**: User clicks the `crt-toggle` button in the navigation header.
2. **State Updates**:
   - Client JS event listener fires.
   - Toggles the `.crt-theme-active` class on the `<html>` element.
   - Persists preference in `localStorage` under `retro-theme-preference` (`"enabled"` or `"disabled"`).
   - Adjusts toggle button UI state (icon, accessibility labels).
3. **Reactive Styling**: CSS rules automatically activate or deactivate the overlay visibility and pseudo-element hovers depending on the `.crt-theme-active` class.

---

## 4. File Changes

### [Layout.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/layouts/Layout.astro)
- Add inline script to head to read `retro-theme-preference` (defaults to `"enabled"`) and set `.crt-theme-active` class.
- Append `<div class="crt-overlay"></div>` to the bottom of the body.

### [Header.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/components/Header.astro)
- Add the theme toggle button next to the standard theme toggle.
- Add JS listener to handle the click event, toggle the class on `<html>`, persist the state in `localStorage`, and update the button UI icon.

### [layout.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/base/layout.css)
- Implement `.crt-overlay` styling: `position: fixed`, pointer events, z-index, and gradients.
- Implement `@keyframes` for screen flicker and blink animations.
- Define visibility toggle: `.crt-overlay` is hidden unless `html.crt-theme-active` is set.
- Implement `prefers-reduced-motion` media queries to disable animations.

### [navbar.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/components/navbar.css)
- Style the CRT toggle button (`.crt-toggle-btn`).
- Add hover pseudo-element (`::before` / `::after`) for navigation links (`.navbar__link`) displaying the blinking `▶` cursor.

### [product-card.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/components/product-card.css)
- Add hover pseudo-element styling for call-to-action buttons (`.product-card__action`).

---

## 5. Interfaces & Contracts

### Local Storage Contract
- **Key**: `retro-theme-preference`
- **Values**: `"enabled"` (default) or `"disabled"`

### CSS Variables
- `--scanline-opacity`: Density/opacity of CRT scanlines (e.g., `0.08`).
- `--vignette-opacity`: Opacity of the radial glow vignette (e.g., `0.15`).

---

## 6. Testing Strategy

### E2E / Integration Testing (Playwright)
- **Overlay Verification**: Verify that the overlay is present, has `pointer-events: none`, and occupies full screen.
- **Persistence**: Verify that disabling the CRT theme sets `retro-theme-preference` to `"disabled"` in local storage and hides the overlay. Check that a page reload preserves this preference.
- **Accessibility**: Emulate `prefers-reduced-motion: reduce` and verify that the `animation` properties for blink and flicker are set to `none` or have speed `0s`.

---

## 7. Migration & Rollback
- **Migration**: None.
- **Rollback**: Run `git checkout` on changed files to restore original visual state.

---

## 8. Open Questions
- None.
