# Design: Theme and Carousel

## Technical Approach
- **Theme switch**: Add toggle in `src/views/partials/header.ejs` displaying `MODE: DARK` / `MODE: LIGHT` on desktop, collapsing to `◐` on mobile. Save selection in `localStorage`.
- **Light mode palette**: Apply `#f5f0e8` (`--bg`), `#1a2a4a` (`--fg`), `#8b7355` (`--accent`), and `#ffffff` (`--surface`) under selector `[data-theme="light"]` in `public/css/styles.css`.
- **FOUC Prevention**: Synchronous inline script in `src/views/partials/head.ejs` reading `theme` from `localStorage` and applying `data-theme="light"` to `<html>` before first paint.
- **LCD Carousel**: Refactor homepage banner in `src/views/index.ejs` and `public/js/carousel.js` into a text-based, auto-cycling LCD display (~150px height, double-bordered, scanlines overlay, glowing text).

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|---|---|---|---|
| **Theme Toggle UI** | CSS media query based text toggle / JS window width detection | Media queries are declarative and prevent flicker / JS requires resize events | **CSS Media Query** + `.theme-toggle-text`/`.theme-toggle-icon` spans |
| **FOUC Prevention** | Synchronous inline script in `<head>` / Block render with CSS import | Inline script is extremely fast and target-specific / CSS import is cleaner but less flexible | **Synchronous inline script in `<head>`** |
| **LCD Panel Theming** | Fully responsive colors / Theme-agnostic retro LCD look | Responsive colors fit the active theme / Theme-agnostic is more skeuomorphic but might clash | **Responsive LCD UI** (Dark mode: glowing green `#39ff14` on `#0f2010`; Light mode: passive slate `#1b301c` on `#cbd5c5`) |

## Data Flow
```
[User Click] ──→ theme.js (toggle event)
                   │
                   ├──→ localStorage.setItem('theme', 'light/dark')
                   ├──→ document.documentElement.setAttribute('data-theme', 'light/dark')
                   └──→ Update Header button text (MODE: LIGHT / MODE: DARK)
```
On page load, the inline script in `head.ejs` reads `localStorage` and updates `document.documentElement` immediately.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `public/js/theme.js` | Create | Contains the event listener to toggle themes, update button labels, and save choices. |
| `public/css/styles.css` | Modify | Define `[data-theme="light"]` color variable overrides, add theme toggle styles, define `--breakpoint-*` custom properties, and add LCD carousel styling (double border, scanlines, neon glowing text). |
| `src/views/partials/head.ejs` | Modify | Inject inline theme initialization script before CSS imports to prevent FOUC. |
| `src/views/partials/header.ejs` | Modify | Add the theme toggle button element inside `barra-derecha`. |
| `src/views/index.ejs` | Modify | Replace standard banner carousel HTML with a text-based layout structured for LCD carousel slides. |

## Interfaces / Contracts
`public/js/theme.js`:
```javascript
// Handles active theme setting: 'light' or 'dark' saved under key 'theme' in localStorage.
// Toggles element attribute: document.documentElement.setAttribute('data-theme', 'light' | 'dark')
```

`head.ejs` inline snippet:
```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  })();
</script>
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Visual | Light Mode styling | Verify all pages load with `#f5f0e8` background and `#1a2a4a` text when theme is active. |
| Integration | FOUC Prevention | Verify `data-theme` is applied to `<html>` prior to stylesheet load/first paint. |
| Responsive | Toggle button | Verify button displays "MODE: DARK/LIGHT" on desktop and collapses to "◐" under 640px. |
| Functional | LCD Carousel | Verify it auto-cycles through the 3 specific slides, links to correct targets, and supports manual arrow/dot clicks. |

## Migration / Rollout
No migration required. No database schema changes.

## Open Questions
- None.
