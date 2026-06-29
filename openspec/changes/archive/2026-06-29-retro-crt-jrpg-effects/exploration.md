# Exploration: CRT Retro Effects & JRPG Animations

This document analyzes the implementation of a CRT screen effect (scanlines, screen curvature, flicker, and phosphor glow) and JRPG-style blinking arrow menu cursor animations in the Mundo 3D codebase.

## Current State

Mundo 3D is built with **Astro**, using a PICO-8-inspired theme.
- Styling is implemented using raw CSS stylesheets located in [styles/](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/), including tokens for colors, typography, and spacing.
- The global layout is in [Layout.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/layouts/Layout.astro), which imports all required stylesheets.
- Fonts used are `'Press Start 2P'` for headings and `'VT323'` for body text.
- Currently, dark/light theme switching is supported, setting a `data-theme` attribute on the `<html>` element.
- There are no active CRT overlays or interactive JRPG animations like menu arrows.

## Affected Areas

- [Layout.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/layouts/Layout.astro) — Add global CRT overlay structure and load initial CRT preferences.
- [Header.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/components/Header.astro) — Add a CRT toggle button in the navbar, next to the theme toggle, along with the toggle JS logic.
- [layout.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/base/layout.css) — Define global CRT overlay container and overlay effects.
- [navbar.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/components/navbar.css) — Add styling for the CRT toggle button and apply the JRPG arrow animation to navbar items.
- [product-card.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/components/product-card.css) — Add JRPG hover cursor animation rules for product cards.
- A new CSS file or existing utility file to hold JRPG animations and generic hover arrows.

---

## Approaches

### 1. CRT Effect (Scanlines + Phosphor Glow)

#### Approach A: Static Overlay + Radial Gradient (Recommended)
Add a fixed overlay element covering the screen with a low-opacity scanline background using CSS gradients and mix-blend-mode. Glow is applied dynamically via text-shadow / box-shadow.
- **Pros**: Very lightweight, high performance, customizable, doesn't interfere with user interactions (using `pointer-events: none`).
- **Cons**: Scanlines can degrade readability if they are too dark.
- **Effort**: Low.

#### Approach B: SVG Displacement Filter + Screen Warp (Alternative)
Use a complex SVG `<filter>` in CSS (`feDisplacementMap`, `feTurbulence`) to simulate screen curvature and phosphor separation.
- **Pros**: High fidelity, looks incredibly realistic.
- **Cons**: Significant GPU rendering cost, may cause noticeable input lag or frame drops, poor text rendering on low-res fonts.
- **Effort**: High.

---

## 2. JRPG Animations (Blinking Arrow ▶ on Hover)

### Approach A: CSS Pseudo-Elements (Recommended)
Add pseudo-elements (`::before` or `::after`) containing `"▶"` to target elements. Using CSS transition and a blinking keyframe animation triggered by `:hover`.
- **Pros**: 100% declarative, zero JS overhead, does not shift layout (when using absolute positioning with relative container), easy to customize via color variables.
- **Cons**: Requires adding relative positioning and padding to hover targets to prevent overlap.
- **Effort**: Low.

### Approach B: Dynamic JS Cursor Overlay (Alternative)
A single absolute pointer element in the DOM is positioned dynamically using JS `mouseenter` / `mouseleave` handlers.
- **Pros**: Can animate the cursor gliding between different menu items.
- **Cons**: Requires client-side JS runtime, susceptible to layout shifts and page resizing bugs, higher maintenance overhead.
- **Effort**: Medium.

---

## Recommendation

1. **CRT Effect**: Use **Approach A**. Implement a fixed, pointer-events-disabled `.crt-overlay` element. Introduce a `.crt-enabled` class on the `<html>` element, controlled by a toggle button in the Header. Support saving user preference in `localStorage` (defaulting to enabled on dark theme, disabled on light theme). Apply dynamic glows using CSS custom variables scoped under `.crt-enabled`.
2. **JRPG Animations**: Use **Approach A**. Define a utility class `.jrpg-arrow` or apply it directly to interactive components (e.g. `.navbar__link`, `.product-card-link`, `.button`). Use a blinking keyframes animation using visibility steps to emulate retro rendering.

---

## Risks

- **Readability & Contrast**: The CRT scanlines might compromise readability for some users. The CRT toggle button provides a clear bypass mechanism. We will also disable the scanline roll flicker if the user prefers reduced motion (using `@media (prefers-reduced-motion)`).
- **Pointer Events**: If `.crt-overlay` forgets `pointer-events: none`, it will block clicks to the rest of the application.

## Ready for Proposal
Yes
