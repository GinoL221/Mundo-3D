## Exploration: Theme and Carousel

### Current State
- **Theme**: Currently, colors are hardcoded as `:root` variables in `public/css/styles.css` using the PICO-8 color palette, defaulting to a dark color scheme. There is no support for a light theme or theme toggle mechanism.
- **Carousel**: Currently, the carousel spans up to `80vh` in height and renders full-size image files (`/img/carousel/Capturaa.jpg`, etc.) with text captions overlaying the bottom. It relies on `public/js/carousel.js` to animate translation of slides.

### Affected Areas
- `src/views/partials/head.ejs` — Needs a blocking, inline script to load the theme from `localStorage` and apply it to the `html` element before the page renders (preventing FOUC). Needs to include `theme.js` script tag.
- `src/views/partials/header.ejs` — Needs a theme selector switch in the header navigation list (e.g. within `.barra-derecha`).
- `src/views/index.ejs` — Needs the carousel markup redesigned, removing the `<img>` tags and structuring each slide as a text-only, retro arcade-style LCD billboard with customizable text tags, titles, and subtitles.
- `public/css/styles.css` — Needs theme variables updated to support `[data-theme="light"]`, styles for the new header switch button, and compact retro styles for the LCD-style carousel slides (height 120px-150px, scanline CRT animation, and custom PICO-8 borders).
- `public/js/theme.js` — A new script file containing the runtime logic to toggle between light and dark themes and sync the selection to `localStorage`.

### Approaches
1. **Responsive Text Toggle Button (Recommended)** — Place a theme switch inside `barra-derecha` that displays a retro mode indicator (e.g., `MODE: DARK` / `MODE: LIGHT`) with an arcade style icon. Uses CSS media queries to hide the text and only show the icon on mobile viewports to prevent layout wrapping.
   - Pros: Highly thematic, matches the game-menu setting aesthetics, legible on desktop, space-efficient on mobile.
   - Cons: Requires styling a custom toggle button from scratch.
   - Effort: Low

2. **Plain Checkbox Toggle** — A simple checkbox styled as a sliding switch.
   - Pros: Standard interaction model.
   - Cons: Clashes with the custom pixelated 8-bit retro arcade aesthetic.
   - Effort: Low

### Recommendation
Implement **Approach 1 (Responsive Text Toggle Button)**. It is highly cohesive with the PICO-8 and retro arcade branding of Mundo 3D. The button's style will match the form buttons in the app with custom pixelated borders. 

For the carousel, remove the image tags entirely and style each slide as a glowing LCD retro terminal with scanlines overlay (using a CSS `linear-gradient` with small spacing). The slides will auto-adapt to light/dark themes by mapping color variables (e.g., green/yellow glowing amber text on black in dark mode, and dark-blue Game Boy LCD style text on grey in light mode).

### Risks
- **Asset Removal Impact**: Removing the image-based slides reduces the page load weight significantly, but changes the visual showcase of specific printed products. We should ensure the new text copy is compelling and clearly leads to target routes.
- **FOUC**: If the head-blocking script contains errors or does not run fast enough, it will result in a visual flash. An inline IIFE script right inside `<head>` is the best mitigation.

### Ready for Proposal
Yes — The codebase is well-prepared, structured, and modular. The proposed changes can be made cleanly by updating CSS variables, EJS layout partials, and implementing a small JavaScript handler for theme states.
