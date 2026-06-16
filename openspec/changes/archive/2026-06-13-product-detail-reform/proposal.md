# Proposal: Product Detail Reform

## Intent
Address usability, navigation, and styling inconsistencies on the product detail page. Unify visual design under a retro-arcade pixel-art theme, fix navigation routes from the home page, and correct invalid HTML nesting.

## Scope

### In Scope
- Correct incorrect route in `index.ejs` from `/products/:id` to `/product/:id`.
- Re-route buttons to `/productCart` using `?action=buy` for "COMPRAR" and `?action=add` for "AGREGAR AL CARRITO".
- Vertically center content block with the product image in desktop mode (`align-items: center`).
- Apply sky-blue styling (`--pico-sky`, `#29adff`) to the secondary action button instead of outline-only.
- Relocate "← Volver a productos" link to the top of the detail card container.
- Create a shared `price.css` style sheet to deduplicate price formatting across pages.

### Out of Scope
- Consolidating general button classes into a global `.btn` style (deferred).
- Cart implementation, payment gateways, or layout modifications to other views.

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach
Implement Enfoque 1 (Unified Container Card). Center the detail block in a Synthwave card container with a glowing neon border. Re-factor action triggers into semantic `<a>` tags (removing nested buttons). Load shared price styles in `head.ejs`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `public/css/components/price.css` | New | Shared price utility classes. |
| `public/css/components/product-card.css` | Modified | Use shared price classes. |
| `public/css/components/product-detail.css` | Modified | Core layout, vertical alignment, and buttons styling. |
| `src/views/partials/head.ejs` | Modified | Embed new `price.css` dependency. |
| `src/views/index.ejs` | Modified | Fix product path navigation and apply shared price styling. |
| `src/views/products/products.ejs` | Modified | Replace old price classes with shared styling. |
| `src/views/products/productDetail.ejs` | Modified | Structural layout updates, top back-link, valid HTML. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Broken selector references | Low | Verify all pages displaying prices render correctly. |
| Stretched or distorted image aspect | Low | Maintain correct height/width rules and apply `object-fit`. |

## Rollback Plan
Discard active modifications using `git checkout -- .` and clean untracked files with `git clean -fd`.

## Dependencies
None

## Success Criteria
- [ ] Direct links from featured products load `/product/:id` instead of 404.
- [ ] Actions correctly link to `/productCart` with the correct `action` query param.
- [ ] Product details are centered and vertically aligned in desktop viewport.
- [ ] No HTML validation warnings exist for nested interactive elements.
