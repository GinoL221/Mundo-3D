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
- S8 (L5): Register validation: "Frontend al contrato actual" — show and validate client-side exactly what the backend enforces (names 2–10, password 8–32 with uppercase/number/special, image .jpg/.png); no API rule changes.
- S9 (L5): Profile image: "Pasa a opcional" — backend and form accept registration without an image.
- S10 (L5): Errors: "Por campo + backend en vos" — parse every API error, aria-invalid + per-field message, and backend user validation messages in voseo (exact strings in L6).
- S11 (L5): Extras: "Mostrar contraseña", "Quitar Limpiar formulario", "aria-current en header", "Fusionar carrito al registrarse".
- S12 (L7): /confirm-email without `?token=`: "Aviso + reenvío" — hide "Confirmar correo"; a `.ui-state` explains the link comes from the email; resend is the main action.
- S13 (L7): After confirming: "Según sesión" — with an active session "Ir al catálogo"; without one "Iniciar sesión".
- S14 (L7): Resend 400: "Error en el campo" — client-side email validation and a 400 shown as an inline field error; 202 stays non-enumerating.
- S15 (L7): Fix the email template copy ("Confirma" → "Confirmá") in the same pass.
- S16 (L8): Oversized or rejected profile images: validate the 5 MB limit on the client and show the upload-filter rejection (`{error:'Invalid file format or size limit exceeded'}`) on the image field in Spanish; no backend error-shape change (errorHandler is shared with admin uploads).
- S7 (L1): "Issue #207: el logout deja válida la familia de refresh tokens cuando no hay cookie de acceso."

## Tasks

- T1 S2,S4 — replace the 5 PICO-8 illustration SVGs with neutral placeholders, drop pixelated rendering hints — inline — commit: bdfa2a3 (done)
- T2 S2,S3,S5,S6 — /cart pass (empty state, kickers, nested border, Eliminar, copy, guest CTA, error placement, sync-error notice) — inline — commit: 22d5c41 (done)
- T3 S1,S3,S8,S10,S11 — /login + /register frontend pass (.ui-* migration, field errors, show password, fieldsets, no reset, aria-current, cart merge on register, client validation, optional image UI) — worker — commit: 1f33459 + f501218 (done; S8 PASS by independent verify)
- T3b S9,S10 — backend: optional register image + voseo validation messages (L6) — worker — commit: 6ce8db4 (done)
- T3c S16 — register image size/upload-filter error on the field — inline — commit: 3bf81e5 (done)
- T4 S1,S3,S12-S15 — /confirm-email pass (.ui-* migration, loading/busy, .ui-callout outcomes with exits, no-token state, resend 400 handling, mail template accent, drop legacy auth.css/email-confirmation.css) — worker — commit: next (done)
- T5 S1,S3 — /orders + /order critique and pass — inline — commit: pending
- T6 S7 — issue #207 logout revokes refresh family without access cookie — inline — commit: pending

## Log

- L1 (user, 2026-11-23): "Pase de diseño Taller Maker en las pantallas que faltan: /cart, /login, /register, /confirm-email, /orders y /order. Autoridad de diseño: solo Impeccable (.pi/skills/impeccable/), empezando por critique de cada página; complementar solo con modern-web-guidance. Pendientes ya detectados: el carrito vacío rosa pixelado (empty-cart.svg en CartList.astro), las ilustraciones SVG de respaldo en frontend/public/images/illustrations/ (pixel art PICO-8), el kicker \"TU SELECCIÓN\" y la card que envuelve el estado vacío en /cart. Usar los primitivos .ui-* de frontend/src/styles/base/ui-kit.css y mantener design/taller-maker-styleguide.html en espejo 1:1. 2. Issue #207: el logout deja válida la familia de refresh tokens cuando no hay cookie de acceso."
- L2 (user, 2026-11-23, after /cart critique 19/40): Ilustraciones "Reemplazo global (Recomendado)"; Alcance /cart "Visual + copy + errores (Recomendado)"; Eliminar "Inmediato, estilo nuevo (Recomendado)".
- L3 (agent, approved by L2): /cart direction — refinement, not redesign. Empty state open on `--bg` with no card (`.ui-state--empty` + new `.ui-state--open` modifier: no border, no surface, transparent), a 24px monochrome outline icon via `currentColor` (`.ui-state__icon`), warm title, primary CTA "Ver catálogo". Missing-photo fallback: neutral placeholder, no `pixelated`. Summary: no kicker; count is the sum of quantities as "N piezas"; a fixed line "Pedido simulado: no se cobra nada."; guest CTA "Iniciá sesión para finalizar"; `#checkout-error` rendered inside the summary next to the CTA. Item: name links to `/product?id=<productId>`, no inner border on the media frame, "Eliminar" uses `.ui-btn--danger-soft`. Hygiene: weight 600 (IBM Plex ships 400/500/600), merge the four cart stylesheets. Critique: `.impeccable/critique/2026-11-23T04-36-30Z__frontend-src-pages-cart-astro.md`.
- L5 (user, 2026-11-23, after /login 23/40 and /register 18/40 critiques): Validaciones "Frontend al contrato actual (Recomendado)"; Foto perfil "Pasa a opcional"; Errores "Por campo + backend en vos (Recomendado)"; Extras "Mostrar contraseña, Quitar Limpiar formulario, aria-current en header, Fusionar carrito al registrarse".
- L6 (agent): exact voseo backend messages — "Tienes que ingresar un nombre"→"Ingresá tu nombre"; "Tienes que ingresar un apellido"→"Ingresá tu apellido"; "Tienes que ingresar un mail"→"Ingresá tu correo"; "Tienes que ingresar un mail valido"/"válido"→"Ingresá un correo válido"; "Tienes que ingresar una contraseña"→"Ingresá tu contraseña"; "Tienes que confirmar la contraseña"→"Confirmá tu contraseña"; "Tienes que subir una imagen" is removed (image optional); any other tú form in user validators becomes the equivalent voseo imperative. Rules and "Tiene que tener entre …" style messages keep their wording.
- L7 (user, 2026-11-23, after /confirm-email critique 15/40): Sin token "Aviso + reenvío (Recomendado)"; Tras confirmar "Según sesión (Recomendado)"; Reenvío 400 "Error en el campo (Recomendado)"; Mail "Sí, en el mismo pase". Critique: `.impeccable/critique/2026-11-23T05-18-41Z__frontend-src-pages-confirm-email-astro.md`.
- L8 (user, 2026-11-23): "1. si 2. si" — rewrite the local backend commit so the stray auth-file-picker.css deletion moves to the frontend commit (done: e9ec158/fa7328a/b5cf1e0 → 6ce8db4/1f33459/f501218, identical final tree 37842cb), and fold the oversized-image error into this pass.
- L4 (agent): fallback SVGs are loaded via `<img>` so they cannot follow `data-theme`; use one warm mid-gray stroke `#8c857d` (≈3.6:1 on #ffffff, ≈4.6:1 on #1b1917), transparent background, keep the five filenames so consumers and tests keep working.
