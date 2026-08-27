# Visual Design System — Mundo-3D

Source of truth for AI agents and contributors on the **current, already-approved** visual identity of Mundo-3D. This document describes what exists and is intentional — it is not a proposal, and it does not invent or redesign anything. When code and this document disagree, treat it as drift to flag, not as license to change the visual system unprompted.

Retro terminal / PICO-8-inspired pixel-art aesthetic, CRT/JRPG effects, BEM components, no build step for CSS.

## Design tokens

Defined in `frontend/src/styles/tokens/` (colors, typography, spacing), consumed by every component stylesheet. `backend/public/css/tokens/` mirrors these files exactly today — see "Known drift" below for what does *not* stay in sync.

### Colors (`tokens/colors.css`)

PICO-8 base palette:

| Token | Value |
|---|---|
| `--pico-black` | `#000000` |
| `--pico-dark-blue` | `#1d2b53` |
| `--pico-purple` | `#7e2553` |
| `--pico-dark-green` | `#008351` |
| `--pico-red` | `#ff004d` |
| `--pico-yellow` | `#ffec27` |
| `--pico-orange` | `#ffa300` |
| `--pico-white` | `#ffffff` |
| `--pico-light` | `#c2c3c7` |
| `--pico-muted` | `#5f574f` |
| `--pico-sky` | `#29adff` |

Semantic tokens, default (dark) theme:

| Token | Value |
|---|---|
| `--bg` | `#000000` |
| `--fg` | `#ffffff` |
| `--accent` | `#ed407f` |
| `--danger` | `#8a0032` |
| `--danger-text` | `var(--pico-red)` (`#ff004d`) |
| `--warning` | `var(--pico-orange)` |
| `--surface` | `#121214` |
| `--border` | `#2b2c2f` |
| `--input-bg` | `#18191b` |
| `--input-fg` | `#ffffff` |
| `--title-highlight` | `#ed407f` |
| `--lcd-bg` | `#121214` |
| `--lcd-fg` | `#ed407f` |

`--danger` vs `--danger-text` is a deliberate split, not duplication: `--danger` is only for a filled background with white text on top (cart badge, danger buttons) — that pairing already passes AA in both themes with one value. `--danger-text` is for danger-colored *text or borders directly on a page surface* (form errors, invalid-field borders, the 404/500 page heading) — `#8a0032` there is unreadable on the dark theme's near-black surfaces (~1.9:1), so `--danger-text` needs its own per-theme value. Never use `--danger` for text/border color, or `--danger-text` for a filled background.

`[data-theme="light"]` overrides: `--bg #c2c3c7`, `--fg #000000`, `--accent #bf1251`, `--surface #ffffff`, `--border #a0a1a5`, `--input-bg`/`--input-fg` flip to white/black, `--danger-text` equals `--danger` (`#8a0032` already passes AA on light surfaces), `--title-highlight #8a0d39`, `--lcd-bg #ffffff`, `--lcd-fg #bf1251`.

`--title-highlight` is darker than `--accent`/`--lcd-fg` on light theme (`#8a0d39` vs `#bf1251`) even though all three share the same crimson hue family — `#bf1251` only clears AA against `--surface` (white), not against `--bg` (`--pico-light`, a mid-gray), and `--title-highlight` is the one used as text color directly on `--bg` (page headings, feature-strip titles).

Toggled via `data-theme` on `<html>`, controlled by `frontend/src/scripts/themeToggle.ts` (`localStorage.theme`, `'dark'`/`'light'`, button `#theme-toggle`, icon ☀️/🌙).

### Typography (`tokens/typography.css`)

- `--font-heading: 'Press Start 2P', monospace`
- `--font-body: 'VT323', monospace`
- Headings: `--text-h1 18px`, `--text-h2 16px`, `--text-h3 14px`, `--text-heading 14px`
- Body: `--text-body 18px`, `--text-small 16px`, `--text-xs 10px`
- Line height: `--line-height-base 1.5`, `--line-height-heading 1.6`

### Spacing & breakpoints (`tokens/spacing.css`)

8px grid: `--space-xs 4px`, `--space-sm 8px`, `--space-md 16px`, `--space-lg 24px`, `--space-xl 32px`, `--space-2xl 48px`.

Breakpoints: `--bp-mobile 640px`, `--bp-tablet 1024px`, `--bp-desktop 1024px`. Mobile-first (`min-width`) only — desktop-first (`max-width`) is reserved for theme-specific overrides, not layout.

## Retro CRT/JRPG effects

Two independent, user-toggleable layers on top of the base theme:

**CRT scanline overlay** — `frontend/src/styles/base/layout.css` defines `--scanline-opacity: 0.08`, `--vignette-opacity: 0.15` and a fixed, full-viewport, `pointer-events: none`, `z-index: 9999` `.crt-overlay` div (appended at the end of `<body>` by `Layout.astro`): a radial-gradient vignette plus a repeating-linear-gradient scanline pattern (4px pitch). It renders only when `html.crt-theme-active`, with a `crt-flicker` keyframe animation (opacity 0.985↔1, 0.15s infinite).

**JRPG blinking hover cursor** — a `▶` character (`::before` content) on interactive elements, e.g. `.navbar__link::before` (`navbar.css`) and `.product-card__action::before` (`product-card.css`), both scoped under `html.crt-theme-active ...:hover`, animated with the shared `jrpg-blink` keyframe (opacity 1↔0, `steps(2,start)`).

**Phosphor/LCD glow** — a separate, always-on effect (not gated by the CRT toggle): `.carousel--lcd .glow` in `carousel.css`, using a layered `text-shadow` (`lcd-glow` keyframe) to simulate an LCD panel glow.

**Toggle mechanics** — `frontend/src/scripts/crtToggle.ts` (`initializeCrtToggle`, wired from `Header.astro`) reads/writes `localStorage['retro-theme-preference']` (`'enabled'` default / `'disabled'`), toggles `.crt-theme-active` on `<html>`, and swaps the `#crt-toggle` button icon (📺/🔌). `Layout.astro` applies both the theme and the CRT class in an inline `<script is:inline>` in `<head>`, before paint, to avoid a flash of the wrong theme/effect state.

**Accessibility** — every animated retro effect (`crt-flicker`, both `jrpg-blink` usages) has its own `@media (prefers-reduced-motion: reduce)` override that disables the animation. Do not add a new animated effect without a matching reduced-motion override.

## Component conventions

- Strict BEM (`block__element--modifier`), one file per component under `frontend/src/styles/components/`. Examples: `.navbar__link`, `.navbar__list--left`, `.product-card__action`, `.carousel--lcd`, `.form-card--wide`.
- A visual variant is a BEM modifier on the existing block (e.g. `.carousel--lcd`), never a new parallel component.
- `utilities.css` holds flat, non-BEM helper classes only (`.text-center`, `.mt-md`, `.mb-lg`, `.hidden`, `.sr-only`).
- No CSS bundler/build step — plain `<link>` tags, fixed load order: tokens → reset → typography → layout → components → utilities. Don't reorder these imports in `Layout.astro`.
- Pixel-art constraints: `image-rendering: pixelated` on raster art; `border-radius: 0` globally (no rounded corners).
- `--bp-*` is the only accepted breakpoint token naming; a `--breakpoint-*` alias was deliberately removed — don't reintroduce it.

## Accessibility conventions

- Every page has exactly one `<h1 class="sr-only">Page name — Mundo 3D</h1>` right after `<Layout>` opens, naming the page for screen readers/SEO without a visible top-level heading (the CRT/pixel-art hero already carries that role visually). Visible headings on a page start at `<h2>` and never skip a level.
- A control disabled during an async action (form submit) or not-yet-implemented (search) gets `opacity: 0.5; cursor: not-allowed;` and drops its `:hover` accent state — established on `.navbar__search-input/-btn:disabled` and `.form-card__btn:disabled`. Don't rely on the browser default alone.
- A small decorative control (carousel indicator) keeps its tiny visible size via a `::before`/inner element while the actual interactive box is grown to at least 24×24px (WCAG 2.2 SC 2.5.8) — see `.carousel__indicator`.
- Async state changes users need to notice (form errors, add-to-cart confirmation) use `role="alert"` or `aria-live="polite"`, not a silent DOM update.

## Known drift (tracked, not fixed by this document)

`backend/public/css/` and `frontend/src/styles/` are **not** identical. Tokens (`colors`, `typography`, `spacing`), `about.css`, and `utilities.css` are byte-identical; `forms.css` is identical except one frontend-only mobile-width rule for `.form-card` (login's fixed-width card, a class backend's EJS views don't use). `navbar.css` and `product-card.css` have diverged further: the backend copy lacks the CRT toggle button and all JRPG hover-cursor rules (the `retro-crt-jrpg-effects` change was never backported), and still uses plain `<img>` icons instead of the frontend's pixel-art panel treatment. This is the pre-existing "unify duplicated CSS" item on the improvement roadmap — resolving it (single source + build/copy step) is a separate, deliberate change, not something to patch incidentally while touching styles for other reasons.
