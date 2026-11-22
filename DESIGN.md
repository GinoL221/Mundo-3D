# Visual Design System — Mundo 3D

This document translates the product experience defined in [PRODUCT.md](PRODUCT.md) and the current Mundo 3D brand manual into UX and technical visual rules. It records implementation status separately from target behavior and does not override product scope or brand identity.

## Quick path

1. Read [PRODUCT.md](PRODUCT.md) for audience, scope, and target demo acceptance criteria.
2. Read `docs/diseno/manual-identidad.md` for brand decisions.
3. Check the status and debt notes here before treating a rule as shipped.
4. Verify implementation claims against the current source; public availability and runtime safety need separate operational evidence.

## Authority and status

| Priority | Source                                | Role                                                                 |
| -------: | ------------------------------------- | -------------------------------------------------------------------- |
|        1 | `docs/diseno/manual-identidad.md`     | Brand identity, logo system, color, type, photography, and voice.    |
|        2 | `DESIGN.md`                           | Technical translation, conventions, and implementation debt.         |
|        3 | `design/taller-maker-styleguide.html` | Live UI kit specimen: tokens and `.ui-*` components, light and dark. |
|        4 | Production repository                 | What the product currently serves.                                   |

The table above orders visual authority only. `PRODUCT.md` governs audience, product scope, and target experience; the brand manual governs identity. Neither a product goal nor a visual rule proves that a capability is implemented or publicly deployed.

The product direction is a workshop vitrine: catalogue first, paper and ink surfaces, IBM Plex Sans, and blue `#2F6BFF`. The five PNG identity assets in `docs/diseno/imagenes/` are approved and materialize the manual's logo variants. PICO-8 colors, pixel-art selectors, and CRT/JRPG effects that still ship are legacy implementation surfaces, not brand authority.

## Recruiter demo experience — target

These guidelines translate the target in `PRODUCT.md`; they do not describe shipped demo controls or verified public availability. Keep the storefront useful to a shopper while making engineering depth discoverable to a technical evaluator.

| Surface              | Target UX rule                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public entry         | Lead with the catalogue, not a login wall, portfolio pitch, or mandatory tutorial. Browsing catalogue, product details, and cart must not require registration.                                                           |
| Optional orientation | Offer a short, skippable explanation of what to try and what each flow demonstrates. Keep repository and engineering-evidence links discoverable without interrupting shopping.                                           |
| Buyer demo           | Provide a clearly labelled demo entry without registration friction. Identify simulated purchases before confirmation and in the resulting order state; never imply a real charge or fulfilment.                          |
| STAFF demo           | Identify the active role and permitted actions. Public demo access must not offer ADMIN. Hiding controls is presentation, not backend authorization or visitor isolation.                                                 |
| Commission intake    | Ask visitors to use fictitious data. Explain that submitting a request does not create a quote, order, payment, or automated email. Demo STAFF review must not expose another visitor's requests.                         |
| Session and recovery | Make session expiry, unavailable demo access, and any implemented reset understandable, including what data was lost or retained and the next available action. Do not promise recovery behavior that has not been built. |

### States and safety boundaries

- Distinguish loading, empty, validation, rate-limit, permission, expired-session, and service-unavailable states; an API failure must not masquerade as an empty dataset or a successful operation.
- Preserve keyboard access, visible focus, labelled controls, readable feedback, responsive layouts, and reduced-motion behavior for every demo entry and role change.
- Do not publish shared credentials or suggest that existing role checks alone make public STAFF access safe. Backend-enforced isolation, usage limits, fictitious data, and recoverability need implementation and verification.
- Buyer interaction is the first demo delivery priority. Public STAFF interaction follows only after its safety boundaries are verified.
- Existing application sessions, orders, and role-based screens are not evidence that a demo-session mechanism, visitor-isolated stock, or automatic reset exists. The specific mechanics and placement of new controls require a separate design; no new visual identity is introduced here.

## Visual theme and atmosphere

Mundo 3D is a quiet workshop catalogue: editorial, tactile, warm, precise, and honest. The interface should frame the real printed pieces rather than compete with them. Use paper and ink surfaces, restrained borders, generous whitespace, and blue only for brand emphasis and actions.

The visual system is not retro, pixel-art, CRT, JRPG, SaaS-gradient, or toy-like. Existing retro surfaces are isolated legacy behavior and must not be copied into new work.

## Design tokens

Tokens live in `frontend/src/styles/tokens/` and are consumed by the frontend stylesheets.

### Colors (`tokens/colors.css`)

The default `:root` values and the explicit `data-theme="light"` values are the light paper theme. The dark values are a workshop-night theme, not an approved dark brand palette.

| Token               | Light/default | Dark      |
| ------------------- | ------------- | --------- |
| `--bg`              | `#f8fafc`     | `#11100f` |
| `--fg`              | `#0f172a`     | `#f5f1ea` |
| `--accent`          | `#2f6bff`     | `#2f6bff` |
| `--link-text`       | `#174ea6`     | `#8eb4ff` |
| `--accent-soft`     | `#dce7ff`     | `#dce7ff` |
| `--danger`          | `#8a0032`     | `#8a0032` |
| `--warning`         | `#2f6bff`     | `#2f6bff` |
| `--surface`         | `#ffffff`     | `#1b1917` |
| `--border`          | `#e2e8f0`     | `#2e2a26` |
| `--input-bg`        | `#ffffff`     | `#1b1917` |
| `--input-fg`        | `#0f172a`     | `#f5f1ea` |
| `--danger-text`     | `#b91c1c`     | `#fca5a5` |
| `--title-highlight` | `#0f172a`     | `#f5f1ea` |
| `--lcd-bg`          | `#ffffff`     | `#1b1917` |
| `--lcd-fg`          | `#2f6bff`     | `#2f6bff` |

`--danger` is for filled danger backgrounds with light text. `--danger-text` is for danger text and borders directly on surfaces; keep the roles separate. `--warning` currently maps to the blue accent because no separate warning color is prescribed.

`--link-text` is an implementation-derived accessible text-link role, measured at 7.75:1 against the light `--bg` (`#f8fafc`) and 8.10:1 against the light `--surface` (`#ffffff`), then 8.26:1 against the dark `--bg` and 7.31:1 against the dark `--surface`. It is not a replacement for the official brand blue `--accent` (`#2f6bff`), which remains available for filled brand buttons, graphical emphasis, borders, and focus indicators where appropriate. These implementation values do not loosen or replace the manual's contrast rule.

The `--pico-*` variables remain only as compatibility aliases for legacy selectors in product detail, alerts, profile, admin, and other older surfaces. They are explicitly implementation debt: do not use them for new brand work, and do not reintroduce PICO crimson or orange as brand tokens.

Theme state is set on `<html>` by `Layout.astro` and `themeToggle.ts`, using `localStorage.theme` with `system` as the initial value (following `prefers-color-scheme` and cycling `system -> light -> dark`).

### Typography (`tokens/typography.css`)

- `--font-heading` and `--font-body`: `"IBM Plex Sans", system-ui, sans-serif`.
- Scale: H1 `32px`, H2 `24px`, H3/heading `18px`, body `16px`, small `14px`, extra-small `12px`.
- Line height: base `1.5`, headings `1.2`.

`Layout.astro` imports the locally hosted IBM Plex Sans v23 WOFF2 Latin and Latin-ext subsets; their shared variable binaries provide weights 400, 500, and 600 with `font-display: swap`. Source URLs, checksums, sizes, and license are recorded in `frontend/public/fonts/ibm-plex-sans/README.md`. The manual's 40px display role is a brand role; there is no `--text-display` token yet. Press Start 2P and VT323 are not active product tokens and must not be introduced into brand work.

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

The brand is intentionally flat and tactile at rest. Establish hierarchy with paper/surface contrast, ink typography, borders, spacing, and real photography. Do not introduce gradients, resting drop shadows, bevels, stickers, glow, or artificial elevation into new brand components; interactive product cards may use a restrained soft-blur hover shadow (`--home-card-shadow-hover`) to signal clickability. The existing LCD glow and dark workshop surfaces are documented legacy/debt, not defaults for new work.

## Logo assets

Use the supplied files; do not reconstruct, recolor, filter, stretch, or separate their parts.

| Variant     | Documentation asset                            | Frontend asset                                      |
| ----------- | ---------------------------------------------- | --------------------------------------------------- |
| Isologotype | `docs/diseno/imagenes/Mundo3D_Isologotipo.png` | `frontend/public/img/brand/Mundo3D_Isologotipo.png` |
| Logotype    | `docs/diseno/imagenes/Mundo3D_Logotipo.png`    | `frontend/public/img/brand/Mundo3D_Logotipo.png`    |
| Imagotype   | `docs/diseno/imagenes/Mundo3D_Imagotipo.png`   | `frontend/public/img/brand/Mundo3D_Imagotipo.png`   |
| Isotype     | `docs/diseno/imagenes/Mundo3D_Isotipo.png`     | `frontend/public/img/brand/Mundo3D_Isotipo.png`     |

The header (`HomeHeader.astro`) uses the horizontal isologotype as one responsive image in the labelled home link (`.home-header__logo`, with light and dark variants). Its image has an empty `alt` and intrinsic dimensions. The frontend favicon uses the standalone isotype in PNG and ICO form. The five documented PNG identity assets are approved brand assets.

## CSS and component conventions

- Styles are plain CSS files imported by `frontend/src/layouts/Layout.astro` in this order: normalize, tokens, base reset, base layout, base utilities, base system primitives, then components.
- The shared layout shell uses `HomeHeader.astro` and `HomeFooter.astro` with BEM classes such as `.home-header__link`, `.home-header__utility`, `.home-footer__links`, `.product-card__action`, and `.orders-page`. Account dropdown selectors (`.nav-item__trigger`, `.nav-item__dropdown`, `.navbar__greeting`) and older standalone blocks (`.cart-link`, `.empty-state`) remain in use.
- `--bp-*` is the only breakpoint token naming convention. Use the existing 640px and 1024px boundaries rather than adding aliases.
- `reset.css` keeps `image-rendering: auto` by default (`img:where(:not([data-image-rendering='pixel-art']))`) while `border-radius: 0` remains on legacy rules; explicit `[data-image-rendering='pixel-art']` and `--pixelart`/`--placeholder` classes still opt into `pixelated` as legacy implementation debt.
- Keep disabled controls visibly disabled (`opacity: 0.5; cursor: not-allowed`) and remove their hover accent state.
- Header controls use 24px outline SVG icons; CRT emoji/pixel-art icon code remains unused legacy, not new brand guidance.

## CRT/JRPG legacy surface

These legacy artifacts remain in the repository as cleanup debt and are not brand guidance:

- `Layout.astro` and `HomeHeader.astro` no longer read `localStorage['retro-theme-preference']`, toggle `html.crt-theme-active`, or render `.crt-overlay` or a CRT toggle button.
- `crtToggle.ts` remains in `frontend/src/scripts/` only as an orphaned, unit-tested legacy module.
- `carousel.css` (including `.carousel--lcd` and `@keyframes lcd-glow`, which lacks a `prefers-reduced-motion` override), `feature-strip.css`, `profile.css`, and `error-pages.css` are still imported globally by `Layout.astro` despite being unused on active pages; do not copy them into new work.
- Legacy `--pico-*` token references remain in `semantic.css`, `alerts.css`, `users-list.css`, `nav-toggles.css`, and inline admin styles; migrate them to official semantic tokens as each sector is refined.

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

When generating or changing UI, use `PRODUCT.md` for audience, scope, and demo acceptance criteria, this document for UX and the technical visual system, and `docs/diseno/manual-identidad.md` as the authoritative brand source. Keep target demo behavior separate from implemented and operationally verified capabilities. Preserve the existing architecture, semantic tokens, supplied image assets, accessibility conventions, and responsive boundaries.

Before proposing a new visual rule, check whether it is already defined here or in the manual. If the production code disagrees with an approved rule, report the drift and do not silently redefine the brand. Treat dark-theme values and CRT/JRPG behavior as implementation status or legacy debt, not as approved brand guidance.

## Review checklist

- [ ] Changes respect `PRODUCT.md` audience, scope, and target/current distinction.
- [ ] Demo copy identifies simulated actions and does not claim unverified access, isolation, recovery, or deployment.
- [ ] Role controls and disclosures complement backend enforcement rather than replacing it.
- [ ] New visual decisions agree with the identity manual.
- [ ] New components use semantic tokens, IBM Plex Sans, and the existing spacing/breakpoint conventions.
- [ ] Approved logo assets are consumed as files rather than reconstructed in HTML/CSS.
- [ ] Legacy PICO/CRT behavior is isolated and labelled as debt.
- [ ] Keyboard focus, labels, alt text, touch targets, and reduced-motion behavior remain intact.
