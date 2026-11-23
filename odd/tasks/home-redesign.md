# Home redesign — hero A + Home corrections + Header accessibility

Two PRs on top of the frontend-design-pass chain tip (`feat/design-pass-10-styleguide-polish`, rebased on `origin/main`).
Design authority: Impeccable. Critique: `.impeccable/critique/2026-11-22T20-21-32Z__frontend-src-pages-index-astro.md`; hero directions in `design/home-hero/`.

## Specs

- **S1 — Hero A.** User: "esto del producto destacado esa card de producto tendriamos que cambiarla o actualizarlo al nuevo estilo, la siento vacia y sin sentido ahora" and "me parece mucho mejor la A claramente". Implement `design/home-hero/01-pieza-protagonista.html`: large borderless piece photo (no card frame), honest sentence "La última pieza que salió del taller.", name + tabular price, hairline spec row (Categoría, Material, Dimensiones) where cells with no data are hidden, explicit "Ver la pieza →" link.
- **S2 — Selection rule.** Replace the hardcoded `HOME_FEATURED_PRODUCT_NAME` with: newest product (highest id) with a real (non-placeholder) photo; fallback to the latest-product endpoint; honest empty/error states preserved.
- **S3 — Mobile fold.** At 390×844 the hero must be compact (4:3 photo, condensed sheet) so the catalogue starts to show; today the hero takes 90.6% of the first viewport.
- **S4 — Commission banner secondary.** Catalogue H2 ≥ commission H2; replace the full-bleed blue wall with a calm tinted section using kit tokens; CTA uses kit button; `text-wrap: balance` on its title.
- **S5 — Hero secondary CTA.** "Enviar solicitud de encargo" gets visible link affordance and links directly to `/help`; hero H1 `text-wrap: balance`; radii aligned to `--radius-control` / `--radius-surface`.
- **S6 — Catalogue cards.** No category eyebrow above the title (category moves next to the price/footer); remove the repeated "Ver detalle →" (whole card stays a link with a clear accessible name); "Ver todo el catálogo →" uses `--link-text`; 2-column grid on narrow mobile.
- **S7 — Async states.** Loading uses grid-matched skeleton (aria-busy, reduced-motion safe) instead of an empty 260px box; error state visually distinct from empty (kit danger tokens + icon); template headings are `<h3>`; a full API failure shows a single retry.
- **S8 — Footer.** Column labels are not `<h2>`; tighter desktop rhythm keeping 44px targets; "Proyecto" column balanced with honest repo links.
- **S9 — Header (second PR).** User approved: "dividirlo así en dos PRs" — "PR Header: los puntos 1, 2 y 4 (orden de foco, enlace para saltar al contenido, 'Registrarse' secundario, menú mobile y mini-carrito). Afecta a todas las páginas." Tab order follows visual order (no cross-group CSS `order`), logo `:focus-visible`, skip link to main content, header bottom hairline, "Registrarse" as secondary button, 1024px nav without absolute centering, mobile menu without "CUENTA" kicker nor 3px left accent border, mini-cart closes when focus leaves it.

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 | — | inline: rebase chain PRs 4–7 onto origin/main (local only) | 738248e (chain tip) |
| T2 | S1–S8 | worker in /tmp/mundo3d-home on `feat/home-hero-redesign` | 42d29a9, 2c39601 |
| T3 | S9 | worker on `feat/header-a11y-polish` stacked on T2 | b30ac82, 2f85877, 0c6e2dc |

## Log

- L1 (user, verbatim): "bien, antes de seguir, esto del producto destacado esa card de producto tendriamos que cambiarla o actualizarlo al nuevo estilo, la siento vacia y sin sentido ahora, cual es el sentido con que la habias colocado? loc cumple actualmente? te parece si repensamos ese diseño?"
- L2 (user): "si me parece" (Impeccable critique + 2–3 directions).
- L3 (user): "no la veo en open desing, pero me parece mucho mejor la A claramente, alguna otra recomendacion para correguir del home?"
- L4 (user): "si" — approves splitting into PR "Home" (hero A + mobile compaction + points 3, 5, 6, 7, 8) and PR "Header" (points 1, 2, 4).
- L6: T2 verified — lint, astro check, vitest 369/369, quality, build, detect (1 known template false positive), isolated E2E 44/44 incl. home-responsive 10/10; mobile hero 598px, catalogue heading visible above the 390×844 fold. `homeProducts.test.ts` updated inline to the S2 rule.
- L7: T3 verified independently (gentle-ai-verify, 52 page/role/theme runs PASS). Fixed the only new defect found: the skip link had no target without JavaScript; now a static `#main-content` span is the target and JS focuses `<main>` (verified with and without JS). Known pre-existing limitation: mobile drawer needs JS (same as base). Mobile logged-in icon order is now cart then avatar (follows visual order).
- L8: Published and merged with user approval: chain PRs #248–#251 (issue #244 closed), Home PR #253, Header PR #254 (issue #252 closed). All CI checks green, goldens matched CI on first run.
- L5: local DB returns null material/dimensions/finish/productionTime → spec cells must be null-safe. CI goldens differ from local by arrow-glyph rasterization; if CI fails only on goldens, verify the CI diff artifacts visually before adopting them.
