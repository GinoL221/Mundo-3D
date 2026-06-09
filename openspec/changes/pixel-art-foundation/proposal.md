# Proposal: Pixel Art Foundation

## Intent

Mundo-3D's backend is solid after two SDD changes, but the frontend is fragmented (~16 CSS files, no design system, hardcoded products on index, no responsive breakpoints). This change consolidates the CSS foundation and establishes a pixel art visual identity that distinguishes the brand — PICO-8 palette, Press Start 2P/VT323 fonts, retro icons — making the site immediately recognizable and ready for Fase 2+ feature work.

## Scope

### In Scope
- Consolidate ~16 CSS files into ONE `public/css/styles.css` with PICO-8 design system
- Delete all old CSS files after migration
- Define CSS custom properties for palette, typography, spacing, breakpoints
- Implement global design rules (`image-rendering: pixelated`, `border-radius: 0`, font stack)
- PICO-8 color palette mapped to semantic roles (`--bg`, `--fg`, `--accent`, `--danger`, `--warning`, `--surface`)
- Press Start 2P (headings/prices ≥14px) + VT323 (body/nav/descriptions) via Google Fonts
- Pixel art icons from Kenney.nl (CC0) for UI elements
- 5 category illustrations (64×64 pixel art): Llavero, Busto, Figura, Máscara, Otras
- Rework `header.ejs` and `footer.ejs` with pixel art styling
- Rebuild `index.ejs` as dynamic page fetching products from ProductService
- Empty state: pixel art 3D printer illustration + "Próximamente" when no products
- Cart counter: distinct product count, hidden when empty (no "0" badge)
- New `carousel.js` with 3 linked slides
- Responsive breakpoints: Mobile (<640px), Tablet (640–1024px), Desktop (>1024px)
- Container max-width: 1200px with `margin: 0 auto`

### Out of Scope
- Search functionality wiring (Fase 2 — visual-only search bar here)
- Product catalog with filters (Fase 2)
- Swagger, Favorites, Reviews (Fase 3)
- Three.js 3D viewer (Fase 4)
- Deployment, README rewrite (Fase 5)
- Backend API changes (all endpoints already exist)

## Capabilities

### New Capabilities
- `pixel-art-identity`: PICO-8 design system, color palette, typography, global pixel art CSS rules, icon/illustration assets
- `dynamic-homepage`: Dynamic index.ejs powered by ProductService, empty state, carousel with linked slides

### Modified Capabilities
- `csrf-error-pages`: CSS consolidation replaces old stylesheet references; header/footer rework changes layout shared by error pages

## Approach

**Fase 0 — CSS Consolidation**: Extract all critical styles from ~16 files, merge into `styles.css` organized by design system layer (custom properties → reset → typography → layout → components → utilities). Delete old files. Update EJS templates to reference single stylesheet.

**Fase 1 — Visual Identity**: Layer PICO-8 design system on top. Implement font imports, pixel art global rules. Create/retrieve icon and illustration assets. Rework header/footer partials. Rebuild index.ejs as dynamic with ProductService. Build carousel.js. Wire cart counter with distinct-count logic.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `public/css/*.css` | Removed | ~16 files deleted, replaced by `styles.css` |
| `public/css/styles.css` | New | Single consolidated stylesheet with design system |
| `public/js/carousel.js` | Rewritten | New carousel with 3 linked slides |
| `public/images/icons/` | New | Kenney.nl pixel art icons |
| `public/images/illustrations/` | New | 5 category illustrations (64×64) + empty state |
| `src/views/index.ejs` | Rewritten | Dynamic homepage replacing hardcoded content |
| `src/views/partials/header.ejs` | Modified | Pixel art header with styled nav, cart counter |
| `src/views/partials/footer.ejs` | Modified | Pixel art footer |
| `src/controllers/indexController.js` | Modified | Wire ProductService to index view |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CSS merge loses obscure styles | Med | Audit each file before delete; visual QA across all pages |
| Press Start 2P renders poorly at small sizes | Low | Enforce ≥14px minimum per design rules |
| Carousel JS conflicts with existing scripts | Low | Isolate scope; no global pollution |
| Google Fonts CDN unavailable | Low | Define legible VT323 fallback stack |
| Product image missing in empty state | Low | Use CSS/illustration fallback, no DB dependency |

## Rollback Plan

1. `git revert` the merge commit — restores all 16 CSS files and old templates
2. Old CSS files remain in git history; no data loss
3. Carousel.js is additive — remove script tag from header to disable
4. Product assets (icons/illustrations) are static files — delete or ignore

## Dependencies

- Google Fonts CDN (Press Start 2P, VT323)
- Kenney.nl pixel art asset pack (CC0, included in repo)
- Existing ProductService.findAll() and ProductService.findLatest() methods
- Existing API endpoints: GET /api/products, GET /api/product/:id, GET /api/products/latest

## Success Criteria

- [ ] All pages render correctly from single `styles.css` — zero references to deleted CSS files
- [ ] PICO-8 palette applied via CSS custom properties on all pages
- [ ] Press Start 2P appears on all headings/prices ≥14px; VT323 on body text
- [ ] No `border-radius` anywhere; all images render with `image-rendering: pixelated`
- [ ] Homepage displays dynamic products from ProductService
- [ ] Empty state shows 3D printer illustration + "Próximamente" when DB has no products
- [ ] Cart counter shows distinct product count; hidden when cart is empty
- [ ] Responsive at Mobile/Tablet/Desktop breakpoints; container ≤1200px
- [ ] Carousel cycles 3 slides with correct navigation links
- [ ] Lighthouse Performance ≥80 on homepage