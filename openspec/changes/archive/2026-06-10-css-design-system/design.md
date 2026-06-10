# Design: CSS Design System

## Technical Approach

Replace the 1360-line monolithic `styles.css` with a token-driven, BEM-named modular CSS system. Extract PICO-8 palette and semantic tokens into `tokens/`, reset and layout into `base/`, and 12 component files into `components/`. Every class name maps to a single canonical BEM Block in English. Media queries move into their owning component file (mobile-first via `min-width`). The monolith shrinks section-by-section across 7 PRs until deletion.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|----------|-------------|-----------|
| Plain `<link>` tags, no bundler | PostCSS, Sass, CSS `@import` | Zero build step, matches project's current simplicity; 14 files over localhost is negligible |
| BEM naming (`block__element--modifier`) | CUBE, ITCSS, utility-first | BEM is explicit, maps 1:1 to existing component boundaries, easiest to grep/verify |
| Mobile-first `min-width` breakpoints | Desktop-first `max-width` | Aligns with spec requirement; only theme overrides use `max-width` |
| `--bp-*` over `--breakpoint-*` | Keep both, deprecate one | Shorter, consistent with `--space-*` pattern; spec mandates removal of aliases |
| `.form-card` with modifier variants | Separate blocks per form type | Login/register/new-product share 90% of styles; modifiers avoid duplication |
| `.carousel--lcd` modifier | Separate `.lcd-panel` block | LCD is a variant of carousel, not a separate component |
| `.error-page` kept as-is | Rename to `.error` | Already valid BEM (single block), no Spanish, no rename needed |

## Complete BEM Class Name Mapping

### Navbar Component (`components/navbar.css`) — styles.css lines 133-332

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `header` (element) | `.navbar` | header.ejs |
| `.header-inner` | `.navbar__inner` | header.ejs |
| `.site-logo` | `.navbar__logo` | header.ejs |
| `.search-bar` | `.navbar__search` | header.ejs |
| `.search-bar input` | `.navbar__search-input` | header.ejs |
| `.search-bar button` | `.navbar__search-btn` | header.ejs |
| `nav.barra-navegacion` | `.navbar__list` | header.ejs |
| `.barra-izquierda` | `.navbar__list--left` | header.ejs |
| `.barra-derecha` | `.navbar__list--right` | header.ejs |
| `nav.barra-navegacion li` | `.navbar__item` | header.ejs |
| `nav.barra-navegacion a` | `.navbar__link` | header.ejs |
| `.nav-item` | `.nav-item` | header.ejs |
| `.perfil-dropdown` | `.nav-item__trigger` | header.ejs |
| `.dropdown-menu` | `.nav-item__dropdown` | header.ejs |
| `.cart-link` | `.cart-link` | header.ejs |
| `.cart-badge` | `.cart-link__badge` | header.ejs |
| `.user-greeting` | `.navbar__greeting` | header.ejs |
| `.theme-toggle-btn` | `.theme-toggle-btn` | header.ejs |
| `.theme-toggle-btn .theme-toggle-text` | `.theme-toggle-btn__text` | header.ejs |
| `.theme-toggle-btn .theme-toggle-icon` | `.theme-toggle-btn__icon` | header.ejs |

### Carousel Component (`components/carousel.css`) — styles.css lines 334-609

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `header section.banner` | `.banner` | (unused in EJS) |
| `section.banner img` | `.banner__image` | (unused in EJS) |
| `#homepage-carousel`, `.carousel` | `.carousel` | index.ejs |
| `.carousel-container` | `.carousel__container` | index.ejs, carousel.js |
| `.carousel-slide` | `.carousel__slide` | index.ejs, carousel.js |
| `.carousel-caption` | `.carousel__caption` | (unused in current EJS) |
| `.carousel-prev` | `.carousel__prev` | index.ejs, carousel.js |
| `.carousel-next` | `.carousel__next` | index.ejs, carousel.js |
| `.carousel-indicators` | `.carousel__indicators` | index.ejs, carousel.js |
| `.carousel-indicators button` | `.carousel__indicator` | index.ejs, carousel.js |
| `.carousel.lcd-panel` | `.carousel--lcd` | index.ejs |
| `.lcd-text` | `.carousel__text` | index.ejs |
| `.glow` | `.glow` (animation class) | index.ejs |

### Product Card Component (`components/product-card.css`) — styles.css lines 611-732

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.index .titulo` | `.page-heading` | index.ejs |
| `.product-category-img` | `.product-card__category-img` | index.ejs |
| `.empty-state` | `.empty-state` | index.ejs |
| `.empty-state-img` | `.empty-state__image` | index.ejs |
| `.containerProducto`, `article.contenido`, `.product_container` | `.product-card` | index.ejs, products.ejs |
| `.containerProductoImg img`, `article.contenido img` | `.product-card__image` | index.ejs, products.ejs |
| `.containerCardFooter`, `.info_produc`, `.pie_imagen` | `.product-card__body` | index.ejs, products.ejs |
| `.price` | `.product-card__price` | index.ejs, products.ejs |
| `.pie_imagen button`, `.product_container button` | `.product-card__action` | index.ejs |

### Product Grid Component (`components/product-grid.css`) — styles.css lines 658-666

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.containerSectionIndex`, `.contenido_produc`, `.products_container` | `.product-grid` | index.ejs, products.ejs |

### Product Detail Component (`components/product-detail.css`) — styles.css lines 734-786

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.containerTitle` | `.product-detail__title` | productDetail.ejs |
| `.containerMainProductDetail` | `.product-detail__main` | productDetail.ejs |
| `.containerCardProducto img` | `.product-detail__image` | productDetail.ejs |
| `.containerSectionDetalle` | `.product-detail__info` | productDetail.ejs |
| `.containerSectionDetalle button` | `.product-detail__action` | productDetail.ejs |

### Cart Component (`components/cart.css`) — styles.css lines 788-855

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `main.carrito` | `.cart` | productCart.ejs |
| `div.contenedor-carrito` | `.cart__container` | productCart.ejs |
| `section.tarjetas-de-productos` | `.cart__items` | productCart.ejs |
| `article.producto` | `.cart__item` | productCart.ejs |
| `.nombre` | `.cart__item-name` | productCart.ejs |
| `div.tarjeta` (inside cart) | `.cart__item-details` | productCart.ejs |
| `.imagen-producto` | `.cart__item-image` | productCart.ejs |
| `.precio` | `.cart__item-price` | productCart.ejs |
| `.cantidad` | `.cart__item-qty` | productCart.ejs |
| `.subtotal` | `.cart__item-subtotal` | productCart.ejs |
| `section.total` | `.cart__summary` | productCart.ejs |
| `.cantProductos` | `.cart__summary-count` | productCart.ejs |
| `.envio` | `.cart__summary-shipping` | productCart.ejs |
| `.seguir` | `.cart__btn-continue` | productCart.ejs |
| `.finalizar` | `.cart__btn-checkout` | productCart.ejs |

### Forms Component (`components/forms.css`) — styles.css lines 857-992

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.containerMainLogin` | `.form-layout` | login.ejs, aboutUs.ejs |
| `.containerRegistroLogin` | `.form-card` | login.ejs, register.ejs |
| `.containerNewUser` | `.form-card--medium` | (legacy, unused) |
| `.containerNP` | `.form-card--wide` | newProduct.ejs |
| `.control` | `.form-card__input` | login.ejs, register.ejs, newProduct.ejs |
| `.is-invalid` | `.form-card__input--invalid` | login.ejs, register.ejs, newProduct.ejs |
| `.login-btn` | `.form-card__btn` | login.ejs |
| `.remember-me` | `.form-card__checkbox` | login.ejs |
| `.register` (form class) | `.form-card__form` | register.ejs |
| `.subir-registro` | `.form-card__btn` | register.ejs |
| `#crear`, `#borrar` (IDs) | `.form-card__btn` | newProduct.ejs |
| `.main-register` | `.form-layout` | register.ejs |
| `.text-danger` | `.form-card__error` | login.ejs, register.ejs, newProduct.ejs |

### Profile Component (`components/profile.css`) — styles.css lines 994-1012

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `main.profile-main` | `.profile` | userProfile.ejs |
| `img.profile-image` | `.profile__image` | userProfile.ejs |
| `p.profile-email` | `.profile__email` | userProfile.ejs |
| `.profile-body` | `.profile-body` | userProfile.ejs |

### Users List Component (`components/users-list.css`) — styles.css lines 1014-1054

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.users_container` | `.users-list` | users.ejs, user.ejs |
| `.user_container` | `.users-list__card` | users.ejs, user.ejs |
| `.user_container form button` | `.users-list__btn--danger` | users.ejs |

### Footer Component (`components/footer.css`) — styles.css lines 1056-1141

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `footer` | `.footer` | footer.ejs |
| `footer .containerFooter` | `.footer__inner` | footer.ejs |
| `footer .containerSections` | `.footer__section` | footer.ejs |
| `.containerCopyRedes` | `.footer__bottom` | footer.ejs |
| `footer .containerCopyright` | `.footer__copyright` | footer.ejs |
| `footer .containerRedes` | `.footer__social` | footer.ejs |

### Alerts Component (`components/alerts.css`) — styles.css lines 1143-1156

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.message` | `.alert` | (used via flash messages, not in static EJS) |
| `.message p` | `.alert__text` | (flash messages) |

### Error Pages Component (`components/error-pages.css`) — styles.css lines 1158-1195

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.error-page` | `.error-page` | 403Forbidden.ejs, 404NotFound.ejs |

### Utilities (`base/utilities.css`) — styles.css lines 1206-1223

| Old Name(s) | New BEM Name | EJS Views Using |
|-------------|-------------|-----------------|
| `.text-center`, `.text-left`, `.text-right` | Keep as-is | newProduct.ejs |
| `.mt-xs` through `.mt-xl` | Keep as-is | (various) |
| `.mb-xs` through `.mb-xl` | Keep as-is | (various) |
| `.hidden` | Keep as-is | (various) |

## CSS Token System

### `tokens/colors.css`
- PICO-8 palette: `--pico-black`, `--pico-dark-blue`, `--pico-purple`, `--pico-dark-green`, `--pico-red`, `--pico-yellow`, `--pico-orange`, `--pico-white`, `--pico-light`, `--pico-muted`, `--pico-sky`
- Semantic aliases: `--bg`, `--fg`, `--accent`, `--danger`, `--warning`, `--surface`
- `[data-theme="light"]` overrides for all semantic tokens
- LCD panel hardcoded colors remain as-is (not tokenized — they are visual effects)

### `tokens/typography.css`
- `--font-heading: 'Press Start 2P', monospace`
- `--font-body: 'VT323', monospace`
- Heading scale: `--text-h1: 18px`, `--text-h2: 16px`, `--text-h3: 14px`, `--text-heading: 14px`
- Body: `--text-body: 18px`, `--text-small: 16px`, `--text-xs: 10px` (badge)

### `tokens/spacing.css`
- Existing 8px grid: `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`, `--space-lg: 24px`, `--space-xl: 32px`, `--space-2xl: 48px`
- Breakpoints: `--bp-mobile: 640px`, `--bp-tablet: 1024px`, `--bp-desktop: 1024px`
- **Remove**: `--breakpoint-mobile`, `--breakpoint-tablet`, `--breakpoint-desktop`

## Data Flow

```
head.ejs
  ├── normalize.css (external reset)
  ├── tokens/colors.css    (PICO-8 + semantic + light theme)
  ├── tokens/typography.css (font scale)
  ├── tokens/spacing.css   (spacing + breakpoints)
  ├── base/reset.css       (box-sizing, pixelated images)
  ├── base/layout.css      (.container, main, body flex)
  ├── base/utilities.css   (.text-*, .mt-*, .mb-*, .hidden)
  ├── components/navbar.css
  ├── components/carousel.css
  ├── components/product-grid.css
  ├── components/product-card.css
  ├── components/product-detail.css
  ├── components/cart.css
  ├── components/forms.css
  ├── components/profile.css
  ├── components/users-list.css
  ├── components/footer.css
  ├── components/alerts.css
  └── components/error-pages.css

EJS Views → use BEM class names → cascade resolves via token → base → component order
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `public/css/tokens/colors.css` | Create | PICO-8 palette + semantic aliases + light theme overrides |
| `public/css/tokens/typography.css` | Create | Font families + heading/body scale |
| `public/css/tokens/spacing.css` | Create | 8px spacing grid + consolidated breakpoints |
| `public/css/base/reset.css` | Create | Box-sizing reset, pixelated image rendering |
| `public/css/base/layout.css` | Create | `.container`, `main`, `body` flex, typography defaults |
| `public/css/base/utilities.css` | Create | `.text-*`, `.mt-*`, `.mb-*`, `.hidden` |
| `public/css/components/navbar.css` | Create | Header, nav, search, dropdown, cart badge, theme toggle |
| `public/css/components/carousel.css` | Create | Carousel, LCD panel variant, indicators, prev/next |
| `public/css/components/product-grid.css` | Create | Product grid flex container + responsive widths |
| `public/css/components/product-card.css` | Create | Card, image, body, title, price, action button, empty state |
| `public/css/components/product-detail.css` | Create | Detail title, main layout, image, info section |
| `public/css/components/cart.css` | Create | Cart container, items, summary, buttons |
| `public/css/components/forms.css` | Create | Form card + variants, inputs, buttons, error states |
| `public/css/components/profile.css` | Create | Profile container, image, email |
| `public/css/components/users-list.css` | Create | Users grid, user card, delete button |
| `public/css/components/footer.css` | Create | Footer inner, sections, bottom row, copyright, social |
| `public/css/components/alerts.css` | Create | Alert banner + text |
| `public/css/components/error-pages.css` | Create | Error page layout, heading, body, action link |
| `src/views/partials/head.ejs` | Modify | Replace single `styles.css` link with 14 ordered links |
| `src/views/partials/header.ejs` | Modify | 18 class renames (navbar BEM) |
| `src/views/partials/footer.ejs` | Modify | 6 class renames (footer BEM) |
| `src/views/index.ejs` | Modify | 12 class renames (carousel + product grid) |
| `src/views/products/products.ejs` | Modify | 6 class renames (product grid + card) |
| `src/views/products/productDetail.ejs` | Modify | 5 class renames (product detail) |
| `src/views/products/productCart.ejs` | Modify | 15 class renames (cart BEM) |
| `src/views/products/newProduct.ejs` | Modify | 8 class renames (form BEM) |
| `src/views/users/login.ejs` | Modify | 7 class renames (form BEM) |
| `src/views/users/register.ejs` | Modify | 7 class renames (form BEM) |
| `src/views/users/userProfile.ejs` | Modify | 4 class renames (profile BEM) |
| `src/views/users/users.ejs` | Modify | 3 class renames (users list BEM) |
| `src/views/users/user.ejs` | Modify | 3 class renames (users list BEM) |
| `src/views/aboutUs.ejs` | Modify | 1 class rename (form-layout) |
| `src/views/403Forbidden.ejs` | Modify | 0 renames (`.error-page` already BEM) |
| `src/views/404NotFound.ejs` | Modify | 0 renames (`.error-page` already BEM) |
| `public/js/theme.js` | Modify | Selector update: `.theme-toggle-btn__text` |
| `public/js/carousel.js` | Modify | Selector updates: `.carousel__container`, `.carousel__slide`, `.carousel__prev`, `.carousel__next`, `.carousel__indicators .carousel__indicator` |
| `public/css/styles.css` | Delete | Removed in PR 7 after all sections migrated |

## Interfaces / Contracts

### head.ejs CSS Load Order (14 files)

```html
<link rel="stylesheet" href="/css/normalize.css" />
<link rel="stylesheet" href="/css/tokens/colors.css" />
<link rel="stylesheet" href="/css/tokens/typography.css" />
<link rel="stylesheet" href="/css/tokens/spacing.css" />
<link rel="stylesheet" href="/css/base/reset.css" />
<link rel="stylesheet" href="/css/base/layout.css" />
<link rel="stylesheet" href="/css/base/utilities.css" />
<link rel="stylesheet" href="/css/components/navbar.css" />
<link rel="stylesheet" href="/css/components/carousel.css" />
<link rel="stylesheet" href="/css/components/product-grid.css" />
<link rel="stylesheet" href="/css/components/product-card.css" />
<link rel="stylesheet" href="/css/components/product-detail.css" />
<link rel="stylesheet" href="/css/components/cart.css" />
<link rel="stylesheet" href="/css/components/forms.css" />
<link rel="stylesheet" href="/css/components/profile.css" />
<link rel="stylesheet" href="/css/components/users-list.css" />
<link rel="stylesheet" href="/css/components/footer.css" />
<link rel="stylesheet" href="/css/components/alerts.css" />
<link rel="stylesheet" href="/css/components/error-pages.css" />
```

Note: 19 `<link>` tags total including normalize.css. The spec says "14 CSS files" counting tokens(3) + base(3) + components(12) + normalize(1) = 19. The spec's "14" likely refers to new files only (3+3+12=18 minus styles.css). We load all 19 in cascade order.

### Breakpoint Media Query Mapping

| Old (styles.css) | New Location | Breakpoint |
|-------------------|-------------|------------|
| `@media (max-width: 639px)` navbar | `components/navbar.css` | Mobile |
| `@media (max-width: 639px)` product-card | `components/product-card.css` | Mobile |
| `@media (max-width: 639px)` cart | `components/cart.css` | Mobile |
| `@media (max-width: 639px)` forms | `components/forms.css` | Mobile |
| `@media (max-width: 639px)` carousel | `components/carousel.css` | Mobile |
| `@media (max-width: 639px)` theme-toggle | `components/navbar.css` | Mobile (theme override) |
| `@media (min-width: 640px)` header-inner | `components/navbar.css` | Tablet+ |
| `@media (min-width: 640px) and (max-width: 1023px)` product-card | `components/product-card.css` | Tablet |
| `@media (min-width: 640px) and (max-width: 1023px)` cart | `components/cart.css` | Tablet |
| `@media (min-width: 640px) and (max-width: 1023px)` main padding | `base/layout.css` | Tablet |
| `@media (min-width: 1024px)` product-card | `components/product-card.css` | Desktop |
| `@media (min-width: 1024px)` cart | `components/cart.css` | Desktop |
| `@media (min-width: 1024px)` main | `base/layout.css` | Desktop |
| `@media (min-width: 1024px)` footer | `components/footer.css` | Desktop |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `theme.js` selectors still work after BEM rename | Update `theme.test.js` mock selector from `.theme-toggle-btn .theme-toggle-text` to `.theme-toggle-btn__text` |
| Unit | `head.ejs` CSS reference test | New test: parse `head.ejs`, verify all 19 `<link>` hrefs resolve to existing files, verify `styles.css` NOT referenced |
| Integration | Grep verification per PR | `rg` for old class names in `src/views/` and `public/css/` — must return zero matches |
| Integration | Breakpoint token removal | `rg "\-\-breakpoint-" public/css/` — must return zero matches |
| Visual | Dark/light theme parity | Manual verification at 3 breakpoints; screenshot diff if available |
| E2E | Full page render | `npm test` + manual navigation through all routes |

## Migration / Rollout

### PR 1: Tokens + Base
**Files created**: `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `base/reset.css`, `base/layout.css`, `base/utilities.css`
**head.ejs**: Add 6 new `<link>` tags BEFORE existing `styles.css` link (keep `styles.css` for now)
**EJS renames**: None
**styles.css deletion**: Lines 8-48 (custom properties), lines 58-69 (reset), lines 72-129 (typography + layout), lines 1206-1223 (utilities)
**Verification**: `npm test` green, visual check dark/light theme

### PR 2: Navbar + Footer
**Files created**: `components/navbar.css`, `components/footer.css`
**head.ejs**: Add 2 component `<link>` tags, remove `styles.css` link for navbar/footer sections
**EJS renames**: `header.ejs` (18 renames), `footer.ejs` (6 renames)
**styles.css deletion**: Lines 133-332 (header/nav), lines 1056-1141 (footer)
**Verification**: `rg "barra-navegacion|containerSections|containerFooter|containerCopyRedes|containerCopyright|containerRedes"` = 0

### PR 3: Carousel + Theme
**Files created**: `components/carousel.css`
**head.ejs**: Add carousel `<link>` tag
**EJS renames**: `index.ejs` (carousel classes only: `.carousel-container` → `.carousel__container`, etc.)
**JS updates**: `carousel.js` (5 selector updates), `theme.js` (1 selector update)
**styles.css deletion**: Lines 334-609 (carousel + theme toggle)
**Verification**: Carousel auto-plays, theme toggle works, LCD panel renders

### PR 4: Product Components
**Files created**: `components/product-grid.css`, `components/product-card.css`, `components/product-detail.css`
**head.ejs**: Add 3 component `<link>` tags
**EJS renames**: `index.ejs` (product grid + card), `products.ejs` (6 renames), `productDetail.ejs` (5 renames)
**styles.css deletion**: Lines 611-786 (product cards, grid, detail)
**Verification**: `rg "products_container|containerSectionIndex|contenido_produc|containerProducto|containerCardFooter|info_produc|pie_imagen|containerTitle|containerMainProductDetail|containerCardProducto|containerSectionDetalle"` = 0

### PR 5: Cart + Forms
**Files created**: `components/cart.css`, `components/forms.css`
**head.ejs**: Add 2 component `<link>` tags
**EJS renames**: `productCart.ejs` (15 renames), `newProduct.ejs` (8 renames), `login.ejs` (7 renames), `register.ejs` (7 renames)
**styles.css deletion**: Lines 788-992 (cart + forms)
**Verification**: `rg "contenedor-carrito|tarjetas-de-productos|containerRegistroLogin|containerNP|\.control|login-btn|remember-me|is-invalid"` = 0

### PR 6: Profile + Users + Alerts + Error + About
**Files created**: `components/profile.css`, `components/users-list.css`, `components/alerts.css`, `components/error-pages.css`
**head.ejs**: Add 4 component `<link>` tags
**EJS renames**: `userProfile.ejs` (4 renames), `users.ejs` (3 renames), `user.ejs` (3 renames), `aboutUs.ejs` (1 rename)
**styles.css deletion**: Lines 994-1204 (profile, users, alerts, error, about)
**Verification**: `rg "profile-main|users_container|user_container|\.message|error-page|about-content"` = 0 (except `.error-page` which is kept)

### PR 7: Delete Monolith
**Files deleted**: `public/css/styles.css`
**head.ejs**: Remove any remaining `styles.css` reference (should already be gone)
**Verification**: `ls public/css/styles.css` = not found, `npm test` green, full visual regression check

## Open Questions

- [ ] Should `.banner` styles be kept if unused in EJS? (lines 335-346 reference `header section.banner` — no EJS uses this)
- [ ] Should `.carousel-caption` be kept? (defined in CSS but not used in current `index.ejs`)
- [ ] The spec says "14 CSS files" but actual count is 19 including normalize.css — should we document 19 or align with spec's 14?
- [ ] Should `.text-danger` (used for form validation errors) be renamed to `.form-card__error` or kept as a utility class?
