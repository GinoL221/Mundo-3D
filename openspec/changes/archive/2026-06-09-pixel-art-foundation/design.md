# Design: Pixel Art Foundation

## Technical Approach

Replace the fragmented ~16-file CSS system with a single `styles.css` built on PICO-8 design tokens, rework shared partials (header/footer) for pixel art styling, and convert `index.ejs` from hardcoded product images to dynamic rendering via `ProductService.findAll()`. The existing `mainController.js` is empty — the index route handler lives inline in `mainRoutes.js` and must be wired to `ProductService`.

## Architecture Decisions

| Decision | Tradeoff | Choice |
|----------|----------|--------|
| CSS layer ordering in styles.css | Strict order vs flexible | Custom props → reset → typography → layout → components → utilities |
| Google Fonts vs self-hosted | CDN reliability vs offline | Google Fonts with `monospace` fallback stack |
| Carousel: rewrite vs extend | Clean slate vs incremental | Rewrite — current version lacks autoplay, infinite loop, pause-on-hover |
| Index route: inline vs controller | Consistency vs minimal change | Move to `mainController.index()` — controller file is empty, proper separation |
| Cart counter: server vs client | SSR accuracy vs SPA feel | Server-side via `req.session.cart` distinct count in header partial |
| Category illustration mapping | Hardcoded vs DB-driven | Hardcoded map `NameCategory → illustration.png` (5 categories, stable set) |

## Data Flow

```
GET /
  └─ mainRoutes → mainController.index()
       └─ ProductService.findAll()  (Product + Category + Franchise)
            └─ res.render('index', { products })
                 └─ index.ejs iterates products → product cards
                      └─ category name → /images/illustrations/{category}.png

Header partial (every page)
  └─ res.locals.isLogged, res.locals.userLogged (from userLoggedMiddleware)
  └─ res.locals.cartDistinctCount (from new cartCountMiddleware or inline)

POST (CSRF failure)
  └─ csrfProtection middleware → res.status(403).render('403Forbidden', { message })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `public/css/styles.css` | Rewrite | PICO-8 tokens, reset, typography, layout, components, utilities, responsive breakpoints |
| `public/css/index.css` | Delete | Merged into styles.css |
| `public/css/carousel.css` | Delete | Merged into styles.css |
| `public/css/products.css` | Delete | Merged into styles.css |
| `public/css/productsAll.css` | Delete | Merged into styles.css |
| `public/css/productDetail.css` | Delete | Merged into styles.css |
| `public/css/productCart.css` | Delete | Merged into styles.css |
| `public/css/login.css` | Delete | Merged into styles.css |
| `public/css/register.css` | Delete | Merged into styles.css |
| `public/css/newUser.css` | Delete | Merged into styles.css |
| `public/css/newProduct.css` | Delete | Merged into styles.css |
| `public/css/product.css` | Delete | Merged into styles.css |
| `public/css/profile.css` | Delete | Merged into styles.css |
| `public/css/users.css` | Delete | Merged into styles.css |
| `public/css/aboutUs.css` | Delete | Merged into styles.css |
| `public/css/normalize.css` | Keep | Third-party reset, no conflicts |
| `public/js/carousel.js` | Rewrite | Autoplay, infinite loop, pause-on-hover, 3 linked slides |
| `public/images/icons/` | Create | Kenney.nl CC0 pixel art icons (cart, search, nav) |
| `public/images/illustrations/` | Create | 5 category PNGs (64×64) + empty-state 3D printer |
| `src/views/partials/head.ejs` | Modify | Replace Open Sans font with Press Start 2P + VT323, single styles.css ref |
| `src/views/partials/header.ejs` | Rewrite | Pixel art nav, cart counter badge (hidden when empty), pixel icons |
| `src/views/partials/footer.ejs` | Modify | PICO-8 colors, VT323 font, pixel art social icons |
| `src/views/index.ejs` | Rewrite | Dynamic product grid from `products` local, carousel, empty state |
| `src/views/403Forbidden.ejs` | Modify | PICO-8 styling, Press Start 2P heading, VT323 body |
| `src/views/404NotFound.ejs` | Modify | PICO-8 styling consistency |
| `src/controllers/mainController.js` | Modify | Add `index(req, res)` method calling `ProductService.findAll()` |
| `src/routes/mainRoutes.js` | Modify | Import mainController, use `mainController.index` for `/` |
| `src/app.js` | No change | Already serves static from `public/`, CSRF middleware in place |

## Interfaces / Contracts

### CSS Custom Properties (in `:root`)

```css
/* Canonical PICO-8 palette */
--pico-black:    #000000;
--pico-dark-blue:#1d2b53;
--pico-purple:   #7e2553;
--pico-green:    #008751;
--pico-red:      #ff004d;
--pico-yellow:   #ffec27;
--pico-orange:   #ffa300;
--pico-white:    #ffffff;
--pico-light:    #c2c3c7;
--pico-muted:    #5f574f;
--pico-sky:      #29adff;

/* Semantic mappings */
--bg:       var(--pico-black);
--fg:       var(--pico-light);
--accent:   var(--pico-green);
--danger:   var(--pico-red);
--warning:  var(--pico-orange);
--surface:  var(--pico-dark-blue);

/* Typography */
--font-heading: 'Press Start 2P', monospace;
--font-body:    'VT323', monospace;

/* Breakpoints */
--bp-mobile:  640px;
--bp-tablet:  1024px;

/* Spacing (8px grid) */
--space-xs: 4px;  --space-sm: 8px;  --space-md: 16px;
--space-lg: 24px; --space-xl: 32px; --space-2xl: 48px;
```

### Global Rules

```css
* { box-sizing: border-box; border-radius: 0; }
img { image-rendering: pixelated; }
```

### View Locals Contract (index.ejs)

| Local | Type | Source |
|-------|------|--------|
| `products` | `Array<{IDProduct, NameProduct, Price, DescriptionProduct, Image, Category: {NameCategory}}>` | `ProductService.findAll()` |
| `isLogged` | `boolean` | `userLoggedMiddleware` |
| `userLogged` | `object\|undefined` | `userLoggedMiddleware` |
| `csrfToken` | `string` | `csrfProtection` |
| `cartDistinctCount` | `number` | Session cart (derived) |

### Carousel Config

```js
const CAROUSEL = {
  interval: 4000,    // ms between auto-advances
  slides: 3,
  links: ['/products', '/aboutUs', '/new-product'],
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Visual QA | All pages render from single styles.css | Manual check: index, products, login, register, aboutUs, 403, 404, cart |
| CSS tokens | Custom properties resolve correctly | Browser DevTools computed styles on `<html>` |
| Responsive | Mobile/Tablet/Desktop breakpoints | Chrome DevTools device emulation at 375px, 768px, 1280px |
| Dynamic index | Products render from DB | Seed DB, visit `/`, verify cards; empty DB, verify "Próximamente" |
| Carousel | Autoplay, pause, navigation | Manual interaction + console logs |
| Cart counter | Distinct count, hidden when empty | Session manipulation, verify header |
| CSRF 403 | Proper error page on CSRF failure | Submit form without token, verify 403 status + pixel styling |
| No deleted refs | Zero references to old CSS files | Grep `src/views/` for deleted filenames |
| Lighthouse | Performance ≥80 | Lighthouse CI on homepage |

## Migration / Rollout

**No migration required.** This is a frontend-only change. All CSS is static files; no database migration needed. The index route change is additive — `ProductService.findAll()` already exists.

**Rollback**: `git revert` restores all 16 CSS files and old templates. No data loss.

## Open Questions

- [ ] Confirm exact Kenney.nl icon filenames to use (cart, search, menu, social) — need to download asset pack
- [ ] Category illustration names: resolved — canonical names are Llavero, Busto, Figura, Máscara, Otras (from DB schema, aligned across all artifacts)
- [ ] Should the search bar get `aria-label` for accessibility, or defer to Fase 2?
