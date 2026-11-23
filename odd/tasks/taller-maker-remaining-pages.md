# Taller Maker pass on remaining pages + issue #207

Impeccable-led design pass on /cart, /login, /register, /confirm-email, /orders and /order, then the logout refresh-family fix (#207).
Branch per PR; Impeccable critique precedes each page; `design/taller-maker-styleguide.html` mirrors `ui-kit.css` 1:1.

## Specs

- S1 (L1): "Pase de diseño Taller Maker en las pantallas que faltan: /cart, /login, /register, /confirm-email, /orders y /order."
- S2 (L1): "Pendientes ya detectados: el carrito vacío rosa pixelado (empty-cart.svg en CartList.astro), las ilustraciones SVG de respaldo en frontend/public/images/illustrations/ (pixel art PICO-8), el kicker \"TU SELECCIÓN\" y la card que envuelve el estado vacío en /cart."
- S3 (L1): "Usar los primitivos .ui-* de frontend/src/styles/base/ui-kit.css y mantener design/taller-maker-styleguide.html en espejo 1:1."
- S4 (L2): Fallback illustrations: "Reemplazo global" — neutral placeholder in every use; regenerate goldens that show fallbacks.
- S5 (L2): /cart scope "Visual + copy + errores": P1 pixel art, distill (kickers, card, nested border, Eliminar), copy for piezas/simulated/guest, and a visible notice on sync errors.
- S6 (L2): "Eliminar" stays immediate, restyled neutral→crimson (no undo).
- S7 (L1): "Issue #207: el logout deja válida la familia de refresh tokens cuando no hay cookie de acceso."

## Tasks

- T1 S2,S4 — replace the 5 PICO-8 illustration SVGs with neutral placeholders, drop pixelated rendering hints — inline — commit: pending
- T2 S2,S3,S5,S6 — /cart pass (empty state, kickers, nested border, Eliminar, copy, guest CTA, error placement, sync-error notice) — inline — commit: pending
- T3 S1,S3 — /login + /register critique and pass — inline — commit: pending
- T4 S1,S3 — /confirm-email critique and pass — inline — commit: pending
- T5 S1,S3 — /orders + /order critique and pass — inline — commit: pending
- T6 S7 — issue #207 logout revokes refresh family without access cookie — inline — commit: pending

## Log

- L1 (user, 2026-11-23): "Pase de diseño Taller Maker en las pantallas que faltan: /cart, /login, /register, /confirm-email, /orders y /order. Autoridad de diseño: solo Impeccable (.pi/skills/impeccable/), empezando por critique de cada página; complementar solo con modern-web-guidance. Pendientes ya detectados: el carrito vacío rosa pixelado (empty-cart.svg en CartList.astro), las ilustraciones SVG de respaldo en frontend/public/images/illustrations/ (pixel art PICO-8), el kicker \"TU SELECCIÓN\" y la card que envuelve el estado vacío en /cart. Usar los primitivos .ui-* de frontend/src/styles/base/ui-kit.css y mantener design/taller-maker-styleguide.html en espejo 1:1. 2. Issue #207: el logout deja válida la familia de refresh tokens cuando no hay cookie de acceso."
- L2 (user, 2026-11-23, after /cart critique 19/40): Ilustraciones "Reemplazo global (Recomendado)"; Alcance /cart "Visual + copy + errores (Recomendado)"; Eliminar "Inmediato, estilo nuevo (Recomendado)".
- L3 (agent, approved by L2): /cart direction — refinement, not redesign. Empty state open on `--bg` with no card (`.ui-state--empty` + new `.ui-state--open` modifier: no border, no surface, transparent), a 24px monochrome outline icon via `currentColor` (`.ui-state__icon`), warm title, primary CTA "Ver catálogo". Missing-photo fallback: neutral placeholder, no `pixelated`. Summary: no kicker; count is the sum of quantities as "N piezas"; a fixed line "Pedido simulado: no se cobra nada."; guest CTA "Iniciá sesión para finalizar"; `#checkout-error` rendered inside the summary next to the CTA. Item: name links to `/product?id=<productId>`, no inner border on the media frame, "Eliminar" uses `.ui-btn--danger-soft`. Hygiene: weight 600 (IBM Plex ships 400/500/600), merge the four cart stylesheets. Critique: `.impeccable/critique/2026-11-23T04-36-30Z__frontend-src-pages-cart-astro.md`.
- L4 (agent): fallback SVGs are loaded via `<img>` so they cannot follow `data-theme`; use one warm mid-gray stroke `#8c857d` (≈3.6:1 on #ffffff, ≈4.6:1 on #1b1917), transparent background, keep the five filenames so consumers and tests keep working.
