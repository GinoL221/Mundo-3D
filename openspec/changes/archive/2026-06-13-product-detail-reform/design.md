# Design: Product Detail Reform

## Technical Approach

Unify price formatting and refactor layout, styling, and markup on the homepage and product detail page. We will extract shared price styles to `price.css` to reduce styling duplication. We will restructure the detail card using a wrapping flex layout to vertically center the column blocks (image and info) in desktop viewports, clean up invalid `<a><button>` nesting into semantic links, position the back link at the top, and resolve incorrect routes pointing to the detail page.

## Architecture Decisions

| Decision | Option / Choice | Tradeoffs / Alternatives | Rationale |
|----------|-----------------|--------------------------|-----------|
| **Back Link Position & Flex Grid** | Wrap `.product-detail__card` with `flex-wrap: wrap` and set the `.product-detail__back-link` to `width: 100%`. | 1) Absolute positioning.<br>2) Extract back-link outside the card. | Keeping the back link inside `.product-detail__card` satisfies the specification. Wrapping flex with a 100% width child ensures it sits at the top while allowing the image and info sections to sit side-by-side on desktop. |
| **Shared Price CSS Extraction** | Extract to a new `/css/components/price.css` file. | 1) Keep duplicate classes.<br>2) Import helper stylesheet dynamically. | Creating a shared component stylesheet deduplicates styling rules across `product-card` and `product-detail` views, following DRY principles and matching our BEM architecture. |
| **Nesting Cleanup** | Replace nested `<a><button>` with block-styled `<a>` tags. | Keep button and trigger JavaScript on click. | Standard HTML5 rules forbid nesting interactive components. Using block-styled `<a>` tags provides semantic validity and proper SEO/screen-reader behavior. |

## Data Flow

Data moves from the router to the controller which queries `ProductService.findAll()` (or `ProductService.findByPk()` for details) and outputs to the EJS template. Clicking action buttons directs the user to `/productCart` with actions.

    [User Click] ──→ GET /product/:id ──→ [Controller / ProductService]
                                                   │
    [Cart Page] ←── GET /productCart?action=... ←── [Render productDetail.ejs]

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `public/css/components/price.css` | Create | Contains `.price` (was `.product-card__price`) and `.price--lg` styles. |
| `public/css/components/product-card.css` | Modify | Remove duplicate price styles; use shared `.price` class. |
| `public/css/components/product-detail.css` | Modify | Update `.product-detail__card` layout to use flex vertical alignment, add `.product-detail__back-link` and `.product-detail__action--secondary` (sky blue) styles. Apply `image-rendering: pixelated` and `--title-highlight` color. |
| `src/views/partials/head.ejs` | Modify | Inject link to `price.css`. |
| `src/views/index.ejs` | Modify | Update product detail route to `/product/<%= product.IDProduct %>` and apply `.price`. |
| `src/views/products/products.ejs` | Modify | Update card price element to use `.price`. |
| `src/views/products/productDetail.ejs` | Modify | Insert back link at the top of the card container, replace nested buttons with styled `<a>` elements, use shared `.price` and `.price--lg` classes. |

## Interfaces / Contracts

No new backend interfaces or API contracts are introduced. The client-to-server interaction contract for cart additions is formalized via query parameters:
- Buy link: `/productCart?action=buy`
- Add link: `/productCart?action=add`

Styles contract:
```css
/* public/css/components/price.css */
.price {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--accent);
  margin: var(--space-xs) 0;
}
.price--lg {
  font-size: 18px;
  margin: var(--space-md) 0;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration | Detail page and homepage routes | Load `/` and `/product/:id` and verify status codes are 200. |
| UI/Manual | Visual responsive behavior and links | Verify vertical alignment at ≥640px, top back link positioning, and correct `?action=...` hrefs on action buttons. Verify color contrast of secondary button text on sky blue background is accessible. |

## Migration / Rollout

No migration required. This is a frontend layout and styling change.

## Open Questions

None. All constraints are defined and codebase conventions are clear.
