# Tasks: CSS Design System — Modular Token-Driven CSS

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated total changed lines | ~1,400–1,800 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Delivery strategy | ask-always |
| Suggested split | 7 PRs (feature-branch-chain) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: **Yes**
Chained PRs recommended: **Yes**
Chain strategy: **feature-branch-chain**
400-line budget risk: **High**

> ⚠️ Total CSS rewrite (~1,400–1,800 changed lines) far exceeds the 400-line review budget.
> Split into 7 focused PRs. **Ask user to confirm chain strategy** before `sdd-apply`.
> Each PR targets the feature/tracker branch; child PRs target the immediate previous PR branch.

---

## Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Tokens + Base — foundation for all CSS | PR 1 → feature/css-design-system | 6 new files, head.ejs update, styles.css strip |
| 2 | Navbar + Footer — header/footer isolation | PR 2 → PR 1 branch | 2 new files, 2 EJS renames, grep verify |
| 3 | Carousel + Theme — interactive components | PR 3 → PR 2 branch | 1 new file, JS updates, .banner delete |
| 4 | Product Components — card/grid/detail | PR 4 → PR 3 branch | 3 new files, 3 EJS renames |
| 5 | Cart + Forms — commerce flows | PR 5 → PR 4 branch | 2 new files, 4 EJS renames, .text-danger rename |
| 6 | Profile + Users + Alerts + Error + About | PR 6 → PR 5 branch | 5 new files, 5 EJS renames |
| 7 | Delete Monolith — final cleanup | PR 7 → PR 6 branch | Delete styles.css, grep verification |

---

## Phase 1: PR 1 — Tokens + Base Foundation

**Goal**: Extract PICO-8 palette, typography, spacing, reset, and layout into 6 new files.
**Base branch**: `feature/css-design-system`
**Expected changed lines**: ~350

- [x] 1.1 Create `public/css/tokens/colors.css` — PICO-8 palette vars, semantic aliases, `[data-theme="light"]` overrides
- [x] 1.2 Create `public/css/tokens/typography.css` — `--font-heading`, `--font-body`, heading scale (`--text-h1` through `--text-body`)
- [x] 1.3 Create `public/css/tokens/spacing.css` — 8px grid (`--space-xs` through `--space-2xl`), `--bp-*` breakpoints; **remove** `--breakpoint-*` aliases
- [x] 1.4 Create `public/css/base/reset.css` — `box-sizing: border-box`, `border-radius: 0`, `image-rendering: pixelated` for img
- [x] 1.5 Create `public/css/base/layout.css` — `.container`, `main`, `body` flex, `html` font-size, `body` font/color, `h1-h6` typography, `p`, `a` base styles, responsive `main` padding via `@media`
- [x] 1.6 Create `public/css/base/utilities.css` — `.text-center/left/right`, `.mt-xs` through `.mt-xl`, `.mb-xs` through `.mb-xl`, `.hidden`
- [x] 1.7 Update `src/views/partials/head.ejs` — add 6 new `<link>` tags **BEFORE** existing `styles.css` link (order: normalize, colors, typography, spacing, reset, layout, utilities, then styles.css)
- [ ] 1.8 Update `pixel-art-identity` spec delta — change "single stylesheet" to "multi-file token+component system"
- [x] 1.9 **Remove from styles.css**: CSS variables section (lines 8–48), reset (lines 58–69), typography+layout (lines 72–129), utilities (lines 1206–1223)
- [x] 1.10 Run `npm test` — must stay green
- [ ] 1.11 Visual smoke: load homepage in dark + light theme, verify layout unchanged

**Grep guard for PR 1**:
```
rg "\-\-breakpoint-" public/css/tokens/spacing.css  # must be 0 matches
```

---

## Phase 2: PR 2 — Navbar + Footer

**Goal**: Extract header/nav and footer into dedicated component files; rename classes to BEM.
**Base branch**: `pr/1-tokens-base`
**Expected changed lines**: ~280

- [x] 2.1 Create `public/css/components/navbar.css` — copy lines 133–332 from `styles.css`; use BEM: `.navbar`, `.navbar__inner`, `.navbar__logo`, `.navbar__search`, `.navbar__search-input`, `.navbar__search-btn`, `.navbar__list`, `.navbar__list--left`, `.navbar__list--right`, `.navbar__item`, `.navbar__link`, `.nav-item`, `.nav-item__trigger`, `.nav-item__dropdown`, `.cart-link`, `.cart-link__badge`, `.navbar__greeting`, `.theme-toggle-btn`, `.theme-toggle-btn__text`, `.theme-toggle-btn__icon`; include responsive breakpoints from lines 1228–1237
- [x] 2.2 Create `public/css/components/footer.css` — copy lines 1056–1141 from `styles.css`; use BEM: `.footer`, `.footer__inner`, `.footer__section`, `.footer__bottom`, `.footer__copyright`, `.footer__social`
- [x] 2.3 Update `src/views/partials/head.ejs` — add `<link>` for `components/navbar.css` and `components/footer.css` (before styles.css); **do not remove styles.css yet** — leave it for remaining PRs
- [x] 2.4 Update `src/views/partials/header.ejs` — rename all 18 classes per BEM mapping (`.header-inner` → `.navbar__inner`, `.site-logo` → `.navbar__logo`, `.search-bar` → `.navbar__search`, `nav.barra-navegacion` → `.navbar__list`, etc.)
- [x] 2.5 Update `src/views/partials/footer.ejs` — rename 6 classes: `.containerSections` → `.footer__section`, `.containerFooter` → `.footer__inner`, `.containerCopyRedes` → `.footer__bottom`, `.containerCopyright` → `.footer__copyright`, `.containerRedes` → `.footer__social`
- [x] 2.6 **Remove from styles.css**: header/nav section (lines 133–332) and footer section (lines 1056–1141)
- [x] 2.7 Run `npm test` — must stay green
- [ ] 2.8 Visual verify: homepage, /products, /login — navbar + footer render identically to before
- [x] 2.9 Grep guard:

```
rg "barra-navegacion|containerSections|containerFooter|containerCopyRedes|containerCopyright|containerRedes" src/views/partials/
# must be 0 matches
```

---

## Phase 3: PR 3 — Carousel + Theme

**Goal**: Extract carousel component; update JS selectors; delete unused `.banner` and `.carousel-caption`.
**Base branch**: `pr/2-navbar-footer`
**Expected changed lines**: ~300

- [x] 3.1 Create `public/css/components/carousel.css` — copy lines 334–609 from `styles.css`; use BEM: `.carousel`, `.carousel__container`, `.carousel__slide`, `.carousel__prev`, `.carousel__next`, `.carousel__indicators`, `.carousel__indicator`, `.carousel--lcd`, `.carousel__text`, `.glow` (keep animation class as-is); include LCD panel overrides (lines 489–609)
- [x] 3.2 Update `src/views/partials/head.ejs` — add `<link>` for `components/carousel.css`
- [x] 3.3 Update `src/views/index.ejs` — rename carousel classes: `.carousel-container` → `.carousel__container`, `.carousel-slide` → `.carousel__slide`, `.carousel-prev` → `.carousel__prev`, `.carousel-next` → `.carousel__next`, `.carousel-indicators` → `.carousel__indicators`, `.carousel-indicators button` → `.carousel__indicator`, `.carousel.lcd-panel` → `.carousel--lcd`, `.lcd-text` → `.carousel__text`
- [x] 3.4 Update `public/js/carousel.js` — update 5 selectors: `.carousel-container` → `.carousel__container`, `.carousel-slide` → `.carousel__slide`, `.carousel-prev` → `.carousel__prev`, `.carousel-next` → `.carousel__next`, `.carousel-indicators button` → `.carousel__indicator`
- [x] 3.5 Update `public/js/theme.js` — update selector: `.theme-toggle-btn .theme-toggle-text` → `.theme-toggle-btn__text`
- [x] 3.6 **Delete from styles.css**: `.banner` (lines 335–346) and `.carousel-caption` (lines 363–381) — both are unused in EJS
- [x] 3.7 **Remove from styles.css**: carousel section (lines 348–609) and theme-toggle section (lines 455–486)
- [x] 3.8 Update `theme.test.js` — change mock selector from `.theme-toggle-btn .theme-toggle-text` to `.theme-toggle-btn__text`
- [x] 3.9 Run `npm test` — `theme.test.js` must stay green
- [ ] 3.10 Visual verify: homepage carousel auto-plays, prev/next buttons work, LCD panel renders in dark+light theme
- [x] 3.11 Grep guard (no old carousel class names in EJS):

```
rg "carousel-container|carousel-slide|carousel-caption|carousel-prev|carousel-next|carousel-indicators" src/views/
# must be 0 matches (except inside carousel.js which will be updated)
```

---

## Phase 4: PR 4 — Product Components

**Goal**: Extract product grid, product card, and product detail into 3 component files.
**Base branch**: `pr/3-carousel-theme`
**Expected changed lines**: ~320

- [x] 4.1 Create `public/css/components/product-grid.css` — unified grid wrapper for `.product-grid`; include responsive widths from `styles.css` lines 1239–1244, 1277–1282, 1312–1317
- [x] 4.2 Create `public/css/components/product-card.css` — `.page-heading` (`.index .titulo`), `.product-card`, `.product-card__category-img`, `.product-card__image`, `.product-card__body`, `.product-card__price`, `.product-card__action`, `.empty-state`, `.empty-state__image`; include mobile breakpoint (lines 1239–1244), tablet (lines 1277–1282), desktop (lines 1312–1317)
- [x] 4.3 Create `public/css/components/product-detail.css` — `.product-detail__title` (`.containerTitle`), `.product-detail__main` (`.containerMainProductDetail`), `.product-detail__image` (`.containerCardProducto img`), `.product-detail__info` (`.containerSectionDetalle`), `.product-detail__action`
- [x] 4.4 Update `src/views/partials/head.ejs` — add 3 `<link>` tags for product-grid, product-card, product-detail
- [x] 4.5 Update `src/views/index.ejs` — rename: `.containerSectionIndex` → `.product-grid`, `.containerProducto` → `.product-card`, `.containerProductoImg` → `.product-card__image`, `.containerCardFooter` → `.product-card__body`, `.pie_imagen button` → `.product-card__action`
- [x] 4.6 Update `src/views/products/products.ejs` — rename: `.contenido_produc` → `.product-grid`, `article.contenido` → `.product-card`, `article.contenido img` → `.product-card__image`, `.info_produc` → `.product-card__body`, `.price` → `.product-card__price`, `.product_container button` → `.product-card__action`
- [x] 4.7 Update `src/views/products/productDetail.ejs` — rename: `.containerTitle` → `.product-detail__title`, `.containerMainProductDetail` → `.product-detail__main`, `.containerCardProducto img` → `.product-detail__image`, `.containerSectionDetalle` → `.product-detail__info`, `.containerSectionDetalle button` → `.product-detail__action`
- [x] 4.8 **Remove from styles.css**: product grid (lines 658–666), product card (lines 668–732), product detail (lines 734–786), responsive rules for product cards (lines 1239–1244, 1277–1282, 1312–1317)
- [x] 4.9 Run `npm test` — must stay green
- [ ] 4.10 Visual verify: homepage product grid, /products listing, /product detail — all look unchanged
- [ ] 4.11 Grep guard:

```
rg "products_container|containerSectionIndex|contenido_produc|containerProducto|containerCardFooter|info_produc|pie_imagen|containerTitle|containerMainProductDetail|containerCardProducto|containerSectionDetalle" src/views/
# must be 0 matches
```

---

## Phase 5: PR 5 — Cart + Forms

**Goal**: Extract cart and forms components; rename `.text-danger` to `.form-card__error`.
**Base branch**: `pr/4-product-components`
**Expected changed lines**: ~350

- [x] 5.1 Create `public/css/components/cart.css` — `.cart`, `.cart__container`, `.cart__items`, `.cart__item`, `.cart__item-name`, `.cart__item-details`, `.cart__item-image`, `.cart__item-price`, `.cart__item-qty`, `.cart__item-subtotal`, `.cart__summary`, `.cart__summary-count`, `.cart__summary-shipping`, `.cart__btn-continue`, `.cart__btn-checkout`; include responsive from lines 1246–1256, 1284–1301, 1319–1355
- [x] 5.2 Create `public/css/components/forms.css` — `.form-layout`, `.form-card`, `.form-card--medium`, `.form-card--wide`, `.form-card__input`, `.form-card__input--invalid`, `.form-card__btn`, `.form-card__checkbox`, `.form-card__form`, `.form-card__error`; include responsive from lines 1258–1262
- [x] 5.3 Update `src/views/partials/head.ejs` — add `<link>` for cart.css and forms.css
- [x] 5.4 Update `src/views/products/productCart.ejs` — rename 15 classes: `main.carrito` → `.cart`, `div.contenedor-carrito` → `.cart__container`, `section.tarjeta-de-productos` → `.cart__items`, `article.producto` → `.cart__item`, `.nombre` → `.cart__item-name`, `div.tarjeta` → `.cart__item-details`, `.imagen-producto` → `.cart__item-image`, `.precio` → `.cart__item-price`, `.cantidad` → `.cart__item-qty`, `.subtotal` → `.cart__item-subtotal`, `section.total` → `.cart__summary`, `.cantProductos` → `.cart__summary-count`, `.envio` → `.cart__summary-shipping`, `.seguir` → `.cart__btn-continue`, `.finalizar` → `.cart__btn-checkout`
- [x] 5.5 Update `src/views/products/newProduct.ejs` — rename 8 classes: `.containerNP` → `.form-card--wide`, `.control` → `.form-card__input`, `.is-invalid` → `.form-card__input--invalid`, `#crear` → `.form-card__btn`, `#borrar` → `.form-card__btn`, `.text-danger` → `.form-card__error`
- [x] 5.6 Update `src/views/users/login.ejs` — rename: `.containerMainLogin` → `.form-layout`, `.containerRegistroLogin` → `.form-card`, `.control` → `.form-card__input`, `.is-invalid` → `.form-card__input--invalid`, `.login-btn` → `.form-card__btn`, `.remember-me` → `.form-card__checkbox`, `.text-danger` → `.form-card__error`
- [x] 5.7 Update `src/views/users/register.ejs` — rename: `.main-register` → `.form-layout`, `.containerRegistroLogin` → `.form-card`, `.register` → `.form-card__form`, `.control` → `.form-card__input`, `.is-invalid` → `.form-card__input--invalid`, `.subir-registro` → `.form-card__btn`, `.text-danger` → `.form-card__error`
- [x] 5.8 **Remove from styles.css**: cart section (lines 788–855), forms section (lines 857–992)
- [x] 5.9 Run `npm test` — must stay green
- [ ] 5.10 Visual verify: /cart, /login, /register, /products/new — forms and cart render correctly in dark+light
- [x] 5.11 Grep guard (12 occurrences of `.text-danger` in 3 views must all be renamed):

```
rg "contenedor-carrito|tarjetas-de-productos|containerRegistroLogin|containerNP|\.control|login-btn|remember-me|is-invalid|\.text-danger" src/views/
# must be 0 matches
```

---

## Phase 6: PR 6 — Profile + Users + Alerts + Error + About

**Goal**: Extract remaining components into 5 files.
**Base branch**: `pr/5-cart-forms`
**Expected changed lines**: ~300

- [x] 6.1 Create `public/css/components/profile.css` — `.profile`, `.profile__image`, `.profile__email`, `.profile-body`
- [x] 6.2 Create `public/css/components/users-list.css` — `.users-list`, `.users-list__card`, `.users-list__btn--danger`
- [x] 6.3 Create `public/css/components/alerts.css` — `.alert`, `.alert__text` (flash message styles)
- [x] 6.4 Create `public/css/components/error-pages.css` — `.error-page` (keep as-is — already BEM)
- [x] 6.5 Create `public/css/components/about.css` — `.about-content` (from styles.css lines 1198–1204)
- [x] 6.6 Update `src/views/partials/head.ejs` — add 5 `<link>` tags for profile, users-list, alerts, error-pages, about
- [x] 6.7 Update `src/views/users/userProfile.ejs` — rename: `main.profile-main` → `.profile`, `img.profile-image` → `.profile__image`, `p.profile-email` → `.profile__email`
- [x] 6.8 Update `src/views/users/users.ejs` — rename: `.users_container` → `.users-list`, `.user_container` → `.users-list__card`
- [x] 6.9 Update `src/views/users/user.ejs` — rename: `.users_container` → `.users-list`, `.user_container` → `.users-list__card`
- [x] 6.10 Update `src/views/aboutUs.ejs` — rename: `.containerMainLogin` → `.form-layout`, `.about-content` (already valid, keep)
- [x] 6.11 **No changes needed** for `403Forbidden.ejs` and `404NotFound.ejs` — `.error-page` is already valid BEM
- [x] 6.12 **Remove from styles.css**: profile section (lines 994–1012), users list (lines 1014–1054), alerts (lines 1143–1156), error pages (lines 1158–1195), about content (lines 1198–1204)
- [x] 6.13 Run `npm test` — must stay green
- [ ] 6.14 Visual verify: /profile, /users, /about, /403, /404 all render correctly
- [x] 6.15 Grep guard:

```
rg "profile-main|users_container|user_container|\.message|about-content" src/views/
# must be 0 matches (except `.error-page` which is kept as-is)
```

---

## Phase 7: PR 7 — Delete Monolith + Final Cleanup

**Goal**: Remove styles.css entirely; verify zero old class references remain.
**Base branch**: `pr/6-profile-users`
**Expected changed lines**: ~80

- [x] 7.1 Confirm styles.css is near-empty or empty — all sections should have been removed in PRs 1–6. If any sections remain, remove them first.
- [x] 7.2 Delete `public/css/styles.css`
- [x] 7.3 Update `src/views/partials/head.ejs` — remove `<link>` referencing `styles.css` (should already be absent if all PRs updated head.ejs correctly)
- [x] 7.4 Final grep sweep — zero matches for all old class names across entire codebase:

```
rg "barra-navegacion|containerSections|containerFooter|containerCopyRedes|containerCopyright|containerRedes|carousel-container|carousel-slide|carousel-caption|carousel-prev|carousel-next|carousel-indicators|products_container|containerSectionIndex|contenido_produc|containerProducto|containerCardFooter|info_produc|pie_imagen|containerTitle|containerMainProductDetail|containerCardProducto|containerSectionDetalle|contenedor-carrito|tarjeta-de-productos|containerRegistroLogin|containerNP|\.control|login-btn|remember-me|is-invalid|\.text-danger|profile-main|users_container|user_container|\.message|about-content|\.banner" src/views/ public/css/ 2>/dev/null
# must be 0 matches
```

- [x] 7.5 Run `npm test` — full test suite must be green
- [x] 7.6 Visual smoke test — load all pages in dark + light theme, verify layout, components, and interactive elements (carousel, theme toggle, forms, cart) all render correctly:
  - Homepage (`/`) — carousel, product grid, navbar, footer
  - Products (`/products`) — product grid, navbar, footer
  - Product Detail (`/products/:id`) — detail layout, navbar, footer
  - Cart (`/cart`) — cart items, summary, navbar, footer
  - Login (`/login`) — form card, theme toggle
  - Register (`/register`) — form card
  - New Product (`/products/new`) — form card
  - Profile (`/users/profile`) — profile card
  - Users List (`/users`) — user cards
  - About (`/about`) — about content
  - 403, 404 — error pages

---

## Implementation Notes

1. **head.ejs load order matters**: tokens → base → components; each component must appear after the tokens/base files it depends on.
2. **Grep verification is the primary test** for this change — no Jest tests for CSS class names. Run grep after each PR.
3. **Do not rename `.error-page`** — it is already valid BEM and keeps PR 6 scope minimal.
4. **LCD panel hardcoded colors** (in carousel.css lines 492, 494, 501, 502, 586, 592) are intentionally NOT tokenized — they are visual effects.
5. **Feature branch chain**: PR 1 → `feature/css-design-system`; PR 2 → `pr/1-tokens-base`; PR 3 → `pr/2-navbar-footer`; PR 4 → `pr/3-carousel-theme`; PR 5 → `pr/4-product-components`; PR 6 → `pr/5-cart-forms`; PR 7 → `pr/6-profile-users`. Only the final PR merges to main.
6. **Before `sdd-apply`**: confirm with user that `feature-branch-chain` strategy is acceptable given 7 PRs and ask-on-risk delivery.