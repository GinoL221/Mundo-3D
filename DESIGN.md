# Visual Design System — Mundo 3D

This document translates the current Mundo 3D brand manual into technical rules and records implementation status. It does not define or override brand identity.

## Quick path

1. Read `docs/diseno/manual-identidad.md` for brand decisions.
2. Check the status and debt notes here before treating a rule as shipped.
3. Verify claims against the current frontend source.

## Authority and status

| Priority | Source                              | Role                                                              |
| -------: | ----------------------------------- | ----------------------------------------------------------------- |
|        1 | `docs/diseno/manual-identidad.md`   | Brand identity, logo system, color, type, photography, and voice. |
|        2 | `DESIGN.md`                         | Technical translation, conventions, and implementation debt.      |
|        3 | `docs/diseno/identidad-visual.html` | Visual summary of the approved identity.                          |
|        4 | Production repository               | What the product currently serves.                                |

The product direction is a workshop vitrine: catalogue first, paper and ink surfaces, IBM Plex Sans, and blue `#2F6BFF`. The five PNG identity assets in `docs/diseno/imagenes/` are approved and materialize the manual's logo variants. PICO-8 colors, pixel-art selectors, and CRT/JRPG effects that still ship are legacy implementation surfaces, not brand authority.

## Visual theme and atmosphere

Mundo 3D is a quiet workshop catalogue: editorial, tactile, warm, precise, and honest. The interface should frame the real printed pieces rather than compete with them. Use paper and ink surfaces, restrained borders, generous whitespace, and blue only for brand emphasis and actions.

The visual system is not retro, pixel-art, CRT, JRPG, SaaS-gradient, or toy-like. Existing retro surfaces are isolated legacy behavior and must not be copied into new work.

## Design tokens

Tokens live in `frontend/src/styles/tokens/` and are consumed by the frontend stylesheets.

### Colors (`tokens/colors.css`)

The default `:root` values and the explicit `data-theme="light"` values are the light paper theme. The dark values are a workshop-night theme, not an approved dark brand palette.

| Token               | Light/default | Dark      |
| ------------------- | ------------- | --------- |
| `--bg`              | `#f6f2ea`     | `#1e1b18` |
| `--fg`              | `#1e1b18`     | `#f6f2ea` |
| `--accent`          | `#2f6bff`     | `#2f6bff` |
| `--link-text`       | `#174ea6`     | `#8eb4ff` |
| `--accent-soft`     | `#dce7ff`     | `#dce7ff` |
| `--danger`          | `#8a0032`     | `#8a0032` |
| `--warning`         | `#2f6bff`     | `#2f6bff` |
| `--surface`         | `#fffdf9`     | `#292524` |
| `--border`          | `#ded7cd`     | `#44403c` |
| `--input-bg`        | `#fffdf9`     | `#292524` |
| `--input-fg`        | `#1e1b18`     | `#f6f2ea` |
| `--danger-text`     | `#b91c1c`     | `#fca5a5` |
| `--title-highlight` | `#1e1b18`     | `#f6f2ea` |
| `--lcd-bg`          | `#fffdf9`     | `#292524` |
| `--lcd-fg`          | `#2f6bff`     | `#2f6bff` |

`--danger` is for filled danger backgrounds with light text. `--danger-text` is for danger text and borders directly on surfaces; keep the roles separate. `--warning` currently maps to the blue accent because no separate warning color is prescribed.

`--link-text` is an implementation-derived accessible text-link role, measured at 7.03:1 against the light `--bg` and 7.72:1 against the light `--surface`, then 8.26:1 against the dark `--bg` and 7.31:1 against the dark `--surface`. It is not a replacement for the official brand blue `--accent` (`#2f6bff`), which remains available for filled brand buttons, graphical emphasis, borders, and focus indicators where appropriate. These implementation values do not loosen or replace the manual's contrast rule.

The `--pico-*` variables remain only as compatibility aliases for legacy selectors in product detail, alerts, profile, admin, and other older surfaces. They are explicitly implementation debt: do not use them for new brand work, and do not reintroduce PICO crimson or orange as brand tokens.

Theme state is set on `<html>` by `Layout.astro` and `themeToggle.ts`, using `localStorage.theme` with light as the initial value.

### Typography (`tokens/typography.css`)

- `--font-heading` and `--font-body`: `"IBM Plex Sans", system-ui, sans-serif`.
- Scale: H1 `32px`, H2 `24px`, H3/heading `18px`, body `16px`, small `14px`, extra-small `12px`.
- Line height: base `1.5`, headings `1.2`.

`Layout.astro` loads IBM Plex Sans weights 400, 500, and 600 from Google Fonts with `display=swap`. The manual's 40px display role is a brand role; there is no `--text-display` token yet. Press Start 2P and VT323 are not active product tokens and must not be introduced into brand work.

### Spacing and breakpoints (`tokens/spacing.css`)

The spacing scale follows the existing 8px rhythm: `--space-xs 4px`, `--space-sm 8px`, `--space-md 16px`, `--space-lg 24px`, `--space-xl 32px`, and `--space-2xl 48px`.

The accepted breakpoint names are `--bp-mobile 640px`, `--bp-tablet 1024px`, and `--bp-desktop 1024px`. Current CSS uses both `min-width` and `max-width` queries: mobile is below 640px, tablet is 640–1023px, and desktop starts at 1024px. The main container is capped at 1440px; default horizontal padding is 16px and tablet main content uses 24px padding.

## Component styling

- **Buttons:** Use semantic tokens, a clear verb, visible keyboard focus, and a minimum 44 × 44px interactive area. Blue is reserved for primary brand actions; disabled controls stay visibly disabled and lose hover emphasis.
- **Cards:** Use `--surface` with `--border` for separation. Product imagery carries the visual color; do not fill catalogue cards with the accent blue. The existing product-card radius is a legacy implementation detail and should not become a new global radius rule.
- **Forms:** Keep labels and validation states explicit. Use `--input-bg` and `--input-fg`; never communicate errors or status with color alone.
- **Navigation:** Use the supplied horizontal isologotype as one image, BEM naming, and 24px outline icons with accessible labels for icon-only controls.
- **Images:** Use real catalogue images and supplied logo files. Do not invent stock photography, customer imagery, or replacement logo artwork.

## Layout principles

- Follow the existing 8px rhythm and the semantic spacing tokens.
- Keep the catalogue hierarchy obvious: context, featured piece, catalogue, then commission/help action.
- Prefer content-driven sections and whitespace over decorative panels or dense chrome.
- Keep the main content readable inside the 1440px container and preserve the documented horizontal padding at each breakpoint.
- Do not add a component solely to reproduce a legacy CRT or pixel-art treatment.

## Depth and elevation

The brand is intentionally flat and tactile. Establish hierarchy with paper/surface contrast, ink typography, borders, spacing, and real photography. Do not introduce gradients, drop shadows, bevels, stickers, glow, or artificial elevation into new brand components. The existing LCD glow and dark workshop surfaces are documented legacy/debt, not defaults for new work.

## Logo assets

Use the supplied files; do not reconstruct, recolor, filter, stretch, or separate their parts.

| Variant     | Documentation asset                            | Frontend asset                                      |
| ----------- | ---------------------------------------------- | --------------------------------------------------- |
| Isologotype | `docs/diseno/imagenes/Mundo3D_Isologotipo.png` | `frontend/public/img/brand/Mundo3D_Isologotipo.png` |
| Logotype    | `docs/diseno/imagenes/Mundo3D_Logotipo.png`    | `frontend/public/img/brand/Mundo3D_Logotipo.png`    |
| Imagotype   | `docs/diseno/imagenes/Mundo3D_Imagotipo.png`   | `frontend/public/img/brand/Mundo3D_Imagotipo.png`   |
| Isotype     | `docs/diseno/imagenes/Mundo3D_Isotipo.png`     | `frontend/public/img/brand/Mundo3D_Isotipo.png`     |

The header uses the horizontal isologotype as one responsive image in the labelled home link. Its image has an empty `alt`, intrinsic dimensions, and the `.navbar__logo-image` class. The frontend favicon uses the standalone isotype in PNG and ICO form. The five documented PNG identity assets are approved brand assets.

## CSS and component conventions

- Styles are plain CSS files imported by `frontend/src/layouts/Layout.astro` in this order: normalize, tokens, base reset, base layout, base utilities, then components.
- Component styles generally use BEM names such as `.navbar__link`, `.navbar__list--left`, `.product-card__action`, and `.carousel--lcd`. Older standalone blocks such as `.cart-link` and `.empty-state` remain in use.
- `--bp-*` is the only breakpoint token naming convention. Use the existing 640px and 1024px boundaries rather than adding aliases.
- `reset.css` applies `image-rendering: pixelated` and `border-radius: 0` globally for the legacy visual surface. The product card overrides its radius to 4px, and the brand logo opts back into `image-rendering: auto`.
- Keep disabled controls visibly disabled (`opacity: 0.5; cursor: not-allowed`) and remove their hover accent state, as done for the unavailable search controls.
- Header controls use 24px outline SVG icons; CRT emoji/pixel-art icon code remains unused legacy, not new brand guidance.

## CRT/JRPG legacy surface

These effects remain shipped but are not brand guidance:

- `Layout.astro` reads `localStorage['retro-theme-preference']`, defaulting to `disabled`, and toggles `html.crt-theme-active` before paint. `.crt-overlay` is a fixed, pointer-transparent viewport overlay with scanlines and vignette; the flicker is disabled under `prefers-reduced-motion: reduce`.
- `nav-toggles.css` and `product-card.css` add the `▶` hover cursor and `jrpg-blink` animation only while the CRT class is active. Both cursor animations have reduced-motion overrides. Navbar links reserve cursor space before hover; product-card actions still transition padding and can reflow, which is known legacy debt.
- `carousel--lcd .glow` keeps its always-on `lcd-glow` animation independently of the CRT class. It currently has no reduced-motion override and should not be copied into new components without fixing that debt.
- `crtToggle.ts` remains as a tested legacy module, but the current `Header.astro` no longer renders or wires a CRT toggle control.

## Do's and don'ts

### Do

- Use `Mundo 3D` exactly as the brand name.
- Use IBM Plex Sans and the official semantic tokens.
- Use the supplied logo assets unchanged and choose the variant according to available space.
- Let real product photography carry the color and keep copy concrete in rioplatense `vos`.
- Preserve visible focus, honest states, reduced-motion behavior, and touch targets.

### Don't

- Do not write `Mundo-3D`, `MUNDO 3D`, or `Mundo 3D is a` in brand copy.
- Do not reconstruct, recolor, filter, stretch, crop, or separate logo assets.
- Do not reintroduce orange, PICO-8 crimson, pixel fonts, CRT chrome, or JRPG effects as brand guidance.
- Do not invent stock, payment, shipping, support, customer, or inventory claims.
- Do not use blue as a decorative fill for catalogue cards or as the only state signal.

## Responsive behavior

- Mobile is below 640px, tablet is 640–1023px, and desktop starts at 1024px.
- Header and footer content must remain content-driven; do not force desktop widths into narrow viewports.
- Catalogue cards and calls to action may stack or wrap, but must remain inside the viewport without horizontal scrolling.
- Preserve 44 × 44px targets for interactive controls and keep focus indicators visible at every width.
- Respect `prefers-reduced-motion: reduce` for every new animation. Do not copy the current LCD exception without first resolving its missing reduced-motion override.

## Accessibility conventions

- The home link exposes `aria-label="Mundo 3D — Inicio"`; its meaningful context comes from the link, so the contained logo image uses `alt=""`.
- Meaningful content images need descriptive alternatives; decorative images use empty alternatives. Icon-only controls keep an accessible label.
- The manual's accessibility touch-target guidance is separate from logo sizing: interactive areas should be at least 44 × 44px. The isotipo has no artificial 24 × 24px brand minimum.
- Page-level H1s exist; catalogue, authentication, and admin pages commonly use `.sr-only`, while informational pages render a visible H1. Do not add a second H1 merely to satisfy a visual layout.
- Async errors and confirmations use `role="alert"` or `aria-live="polite"` where the current component exposes them. Preserve visible keyboard focus and do not rely on color alone for state.
- Any new animation needs a matching reduced-motion behavior. The current LCD exception is tracked above as debt.

## Agent prompt guide

When generating or changing UI, use this document as the technical visual system and `docs/diseno/manual-identidad.md` as the authoritative brand source. Preserve the existing architecture, semantic tokens, supplied image assets, accessibility conventions, and responsive boundaries.

Before proposing a new visual rule, check whether it is already defined here or in the manual. If the production code disagrees with an approved rule, report the drift and do not silently redefine the brand. Treat dark-theme values and CRT/JRPG behavior as implementation status or legacy debt, not as approved brand guidance.

## Review checklist

- [ ] New visual decisions agree with the identity manual.
- [ ] New components use semantic tokens, IBM Plex Sans, and the existing spacing/breakpoint conventions.
- [ ] Approved logo assets are consumed as files rather than reconstructed in HTML/CSS.
- [ ] Legacy PICO/CRT behavior is isolated and labelled as debt.
- [ ] Keyboard focus, labels, alt text, touch targets, and reduced-motion behavior remain intact.
