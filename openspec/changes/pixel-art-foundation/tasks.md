# Tasks: Pixel Art Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950-1100 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 4-phase chained PRs |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | CSS foundation — single styles.css, delete old files, update head.ejs | PR 1 | Base: main; self-contained; all pages reference single stylesheet |
| 2 | Visual identity — header/footer partials, error pages, PICO-8 tokens | PR 2 | Base: PR 1; pixel art nav, cart counter, error page styling |
| 3 | Dynamic homepage — index.ejs, ProductService wiring, carousel.js | PR 3 | Base: PR 2; product cards, empty state, carousel |
| 4 | Assets + verification — icons, illustrations, final QA | PR 4 | Base: PR 3; static assets, grep for old refs, Lighthouse |

## Phase 1: CSS Foundation

- [x] 1.1 Audit ~16 existing CSS files in `public/css/` — extract all unique selectors before delete
- [x] 1.2 Create `public/css/styles.css` with design system layers: custom properties → reset → typography → layout → components → utilities
- [x] 1.3 Define PICO-8 CSS custom properties (--bg, --fg, --accent, --danger, --warning, --surface)
- [x] 1.4 Define typography tokens (--font-heading: Press Start 2P, --font-body: VT323)
- [x] 1.5 Define spacing scale (--space-xs through --space-2xl) and breakpoints (--bp-mobile: 640px, --bp-tablet: 1024px)
- [x] 1.6 Add global pixel art rules: `* { border-radius: 0 }`, `img { image-rendering: pixelated }`
- [x] 1.7 Add container max-width rule (1200px, margin: 0 auto) and responsive breakpoints
- [x] 1.8 Update `src/views/partials/head.ejs` to reference only `styles.css`, remove old stylesheet links
- [x] 1.9 Delete old CSS files: index.css, carousel.css, products.css, productsAll.css, productDetail.css, productCart.css, login.css, register.css, newUser.css, newProduct.css, product.css, profile.css, users.css, aboutUs.css
- [x] 1.10 Verify: grep `src/views/` for any remaining references to deleted CSS files

## Phase 2: Visual Identity (Header/Footer/Error Pages)

- [ ] 2.1 Rewrite `src/views/partials/header.ejs` — pixel art nav with Press Start 2P logo, VT323 nav links
- [ ] 2.2 Add pixel art cart icon from `/images/icons/cart.png` in header
- [ ] 2.3 Implement cart counter badge: show distinct product count from session, hide when empty (no "0")
- [ ] 2.4 Add styled search bar (visually complete, non-functional — aria-label for accessibility)
- [ ] 2.5 Modify `src/views/partials/footer.ejs` — PICO-8 colors, VT323 font, pixel art social icons
- [ ] 2.6 Modify `src/views/403Forbidden.ejs` — Press Start 2P heading, VT323 body, PICO-8 styling
- [ ] 2.7 Modify `src/views/404NotFound.ejs` — PICO-8 styling consistency with design system
- [ ] 2.8 Test: Load all pages (index, products, login, register, cart, 403, 404) — verify single styles.css

## Phase 3: Dynamic Homepage + Carousel

- [ ] 3.1 Add `index(req, res)` method to `src/controllers/mainController.js` — call `ProductService.findAll()`
- [ ] 3.2 Modify `src/routes/mainRoutes.js` — import mainController, use `mainController.index` for GET `/`
- [ ] 3.3 Rewrite `src/views/index.ejs` — dynamic product grid from `products` local variable
- [ ] 3.4 Add product cards: name, price (Press Start 2P), category illustration (`/images/illustrations/{category}.png`)
- [ ] 3.5 Add product card links to detail page (`/products/{IDProduct}`)
- [ ] 3.6 Implement empty state: 3D printer pixel art illustration + "Próximamente" text (when products array empty)
- [ ] 3.7 Rewrite `public/js/carousel.js` — autoplay (4000ms interval), infinite loop, pause-on-hover
- [ ] 3.8 Configure carousel with 3 slides linked to `/products`, `/aboutUs`, `/new-product`
- [ ] 3.9 Add carousel navigation: prev/next arrows, slide indicators
- [ ] 3.10 Test: With products — verify cards render; without products — verify "Próximamente" empty state

## Phase 4: Assets + Verification

- [ ] 4.1 Download Kenney.nl pixel art icon pack (CC0) — extract cart, search, menu icons to `public/images/icons/`
- [ ] 4.2 Create/add 5 category illustrations (64×64 px): `Llavero.png`, `Busto.png`, `Figura.png`, `Máscara.png`, `Otras.png` to `public/images/illustrations/`
- [ ] 4.3 Add empty-state 3D printer illustration (`empty-state.png`) to `public/images/illustrations/`
- [ ] 4.4 Final grep: confirm zero references to deleted CSS files in `src/views/`
- [ ] 4.5 Visual QA: Chrome DevTools at 375px (mobile), 768px (tablet), 1280px (desktop)
- [ ] 4.6 CSRF test: POST form without `_csrf` — verify 403 status and pixel styling
- [ ] 4.7 Cart counter test: Add products to cart, verify distinct count; empty cart, verify hidden badge
- [ ] 4.8 Lighthouse Performance check on homepage — target ≥80