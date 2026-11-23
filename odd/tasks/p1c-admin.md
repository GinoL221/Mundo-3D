# P1c — Admin pages on the Taller Maker UI kit

Migrate `/admin/products` (list, create, edit) and `/admin/commission-requests` off the legacy PICO-8 cards/forms onto the `.ui-*` primitives already in `main` (`ui-kit.css`: `.ui-page-head`, `.ui-table`, `.ui-stepper`, `.ui-form`/`.ui-fieldset`/`.ui-file`/`.ui-media-preview`, `.ui-state`/`.ui-skeleton`, `.ui-callout`, `.ui-inbox`, role stamps).
Design authority: Impeccable. Critique: `.impeccable/critique/2026-11-22T17-00-52Z__frontend-src-pages-admin-products-index-astro.md` (15/40). Specimens: `design/taller-maker-styleguide.html` sections `#tabla-admin`, `#admin-encabezado`, `#admin-stock`, `#admin-formulario`, `#admin-estados`, `#admin-encargos`.

## Specs

- **S1 — Products list.** `/admin/products` uses `.ui-page-head` with visible sentence-case h1, active role stamp (ADMIN/STAFF), one scope line, primary "+ Nueva pieza"; a responsive `.ui-table` (stacked rows below 640px) with thumbnail, name + category/material, borderless semantic stock status, formatted price (`$ 18.500`, tabular-nums), a 44px `[−] [n] [+]` stepper with `−` disabled at stock 0, "Editar" and ADMIN-only "Eliminar" (neutral at rest, solid crimson on hover; removed from the DOM for STAFF).
- **S2 — Feedback and states.** User choice (verbatim): "Sacar alert() y mantener confirm() en borrar (Recomendado)" — "Reemplaza window.alert() por callouts inline, pero conserva window.confirm() al borrar para mantener intactos los tests de diálogo en admin-products.spec.ts:276-310." Add a `role="status"` confirmation for stock updates and deletions, a "Reintentar" on load failure, an explicit empty state with "+ Nueva pieza", and skeleton loading.
- **S3 — Product forms.** User choice (verbatim): "Selectores reales + sincronizar E2E (Recomendado)" — "Carga categorías y franquicias reales desde la API en <select> y selector guiado de material (PLA/Resina/PETG/Flex/Otros), actualizando esos 3 fill->selectOption en admin-products.spec.ts." `create.astro` and `edit.astro` use `.ui-form` with `<fieldset>` groups (Datos básicos; Clasificación; Especificaciones 3D (opcionales); Imagen y stock), empty optional fields are omitted from `FormData`, inline field errors with `aria-invalid` + `aria-describedby`, `edit.astro` shows the current image preview and a note that stock is adjusted from the list.
- **S4 — Commission requests inbox.** `/admin/commission-requests` uses `.ui-page-head` with h1 "Solicitudes de encargo" (singular, matching the header), role stamp, a review-only note (manual review, no automatic email/quote/order, purged automatically after 30 days), and a flat `.ui-inbox` list: requester name, `mailto:` email, received date and expiration date (tabular-nums), idea text up to 65ch, link to `/product?id=…` or "Sin pieza asociada"; loading, empty, error with "Reintentar", and access-denied states.
- **S5 — Contracts.** Keep every role-gating and selector contract the E2E suites rely on (`.users-list__card` rows or the spec updated in the same change, `#admin-products-content`, `#admin-gate-denied`, `.admin-product-delete` absent for STAFF, `.admin-product-stock` holding the raw number, `.admin-product-stock-plus/minus`, `#admin-requests-content`, `#admin-requests-list`, `#nameProduct`, `#price`, `#create-btn`, `#edit-btn`, etc.). Retire `--pico-muted` inline styles and the legacy `.users-list`/`.form-card` usage on these pages.
- **S6 — Scope.** User choice (verbatim): "Las 4 páginas de P1c completas de corrido (Recomendado)". Delivered as two PRs: products (S1–S3) and commission inbox (S4).

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2, S3, S5 | worker in /tmp/mundo3d-admin-products on `feat/admin-products-ui` | fbfa397, 736ff90, 4139ad3 (PR #256 merged 84bebd8) |
| T2 | S4, S5 | worker in /tmp/mundo3d-admin-inbox on `feat/admin-commission-inbox-ui` | c2943f8, 54c7594 (PR #257 merged) |

## Log

- L1 (user, verbatim): "Las 4 páginas de P1c completas de corrido (Recomendado)", "Selectores reales + sincronizar E2E (Recomendado)", "Sacar alert() y mantener confirm() en borrar (Recomendado)".
- L2 (user): "primero quiero que veamos algo antes de avanzar" — paused P1c for the Home redesign (now merged in #253/#254).
- L3 (user): chose "P1c: páginas de admin" to resume.
- L6: Published and merged with user approval: issue #255 created and approved (`status:approved`), PR #256 (admin products, 84bebd8) and PR #257 (commission inbox, Closes #255) both passed full CI + real-DB E2E on first attempt and merged into `main`. Main checkout updated via `git pull --ff-only`.
- L5: First workers were interrupted by a process restart; relaunched to continue their partial work. Independent verification (risk item 2, role gating) PASS on both branches. Fixed findings: edit could not clear optional fields (backend accepts empty strings; material blank is coerced to null), prices with cents showed one decimal, requester email could inject mailto headers (unsafe addresses now render as plain text), inbox had a 16px inset vs the header frame. Pre-existing flaky /login redirect on 401 (race between authFetch and the page redirect) also reproduces on main; not changed here.
- L4: Product rule from PRODUCT.md: STAFF can create/edit products and adjust stock but must never see or execute deletion (backend-enforced; UI complements it). Local API returns null material/dimensions/finish for products.
