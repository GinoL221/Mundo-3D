# Task Breakdown: retro-crt-jrpg-effects

## Review Workload Forecast
```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

## Phase 1: Foundation
- [x] Add CSS variables `--scanline-opacity` and `--vignette-opacity` to [layout.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/base/layout.css).
- [x] Define `@keyframes jrpg-blink` for steps-based blinking (using visibility or opacity).
- [x] Define `@keyframes crt-flicker` for subtle screen flickering.
- [x] Implement `.crt-overlay` class rules in [layout.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/base/layout.css) (fixed, full screen, z-index 9999, gradients, and pointer-events).
- [x] Define active theme selectors (e.g., `html.crt-theme-active .crt-overlay`) to handle visibility.
- [x] Set up `@media (prefers-reduced-motion: reduce)` rules to disable animations (flicker and cursor blink).

## Phase 2: Core Implementation
- [x] Inject inline script in `<head>` of [Layout.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/layouts/Layout.astro) to check `localStorage.getItem('retro-theme-preference')` (defaults to `"enabled"`) and append class `crt-theme-active` if enabled.
- [x] Add `<div class="crt-overlay"></div>` before `</body>` in [Layout.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/layouts/Layout.astro).
- [x] Insert theme toggle button in navigation links of [Header.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/components/Header.astro).
- [x] Implement toggle event listener in `<script>` of [Header.astro](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/components/Header.astro) to toggle the `.crt-theme-active` class, update local storage state, and adjust button icon.

## Phase 3: Component Styling
- [x] Add styling for the CRT toggle button in [navbar.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/components/navbar.css).
- [x] Implement `::before` pseudo-element with blinking `▶` on hover for `.navbar__link` in [navbar.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/components/navbar.css) when CRT is active.
- [x] Implement `::before` pseudo-element with blinking `▶` on hover for `.product-card__action` (primary CTA buttons) in [product-card.css](file:///home/ginopc/Desarrollo/Mundo-3D/frontend/src/styles/components/product-card.css) when CRT is active.

## Phase 4: Testing & Verification
- [x] Verify that CRT overlay is visible on initial load.
- [x] Test the toggle button in Navbar: verify clicking hides overlay, changes button icon, and updates local storage `retro-theme-preference` to `"disabled"`.
- [x] Test page persistence: reload page after disabling, verify it remains disabled without visual flash.
- [x] Hover over navbar links and primary buttons to verify the blinking arrow appears.
- [x] Test reduced motion media queries: emulate `prefers-reduced-motion: reduce` and verify blinking and flickering are disabled.

## Phase 5: Documentation & Cleanup
- [x] Clean up any unused styling rules.
- [x] Verify there are no explicit `any` types or unused variables in modified scripts.
