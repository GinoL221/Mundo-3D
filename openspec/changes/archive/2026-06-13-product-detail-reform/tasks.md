# Tasks: Product Detail Reform

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | 150-250 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

## Phase 1: Foundation & Styling

- [x] 1.1 Create `public/css/components/price.css` with `.price` and `.price--lg` rules.
- [x] 1.2 Register `price.css` in `src/views/partials/head.ejs` as a stylesheet link.
- [x] 1.3 Remove duplicate price CSS styles from `public/css/components/product-card.css`.
- [x] 1.4 Update `.product-detail__card` layout in `public/css/components/product-detail.css` to use `flex-wrap: wrap`.
- [x] 1.5 Add `.product-detail__back-link` styles with `width: 100%` in `public/css/components/product-detail.css`.
- [x] 1.6 Update desktop layout (≥640px) in `public/css/components/product-detail.css` to use `align-items: center`.
- [x] 1.7 Add `.product-detail__action--secondary` styling using `--pico-sky` (#29adff) color in `public/css/components/product-detail.css`.
- [x] 1.8 Add `image-rendering: pixelated` to `.product-detail__image` in `public/css/components/product-detail.css`.
- [x] 1.9 Set title color to `--title-highlight` in `.product-detail__title` within `public/css/components/product-detail.css`.

## Phase 2: Template Modifications

- [x] 2.1 Update `src/views/index.ejs` to route details to `/product/:id` and use the `.price` class.
- [x] 2.2 Update `src/views/products/products.ejs` price elements to use the `.price` class.
- [x] 2.3 Insert the "← Volver a productos" link at the top of the card container in `src/views/products/productDetail.ejs`.
- [x] 2.4 Replace nested button markup with block-styled anchor (`<a>`) elements in `src/views/products/productDetail.ejs`.
- [x] 2.5 Add `?action=buy` and `?action=add` parameters to cart routes in `src/views/products/productDetail.ejs`.
- [x] 2.6 Apply `.price` and `.price--lg` shared classes to the price container in `src/views/products/productDetail.ejs`.

## Phase 3: Testing & Verification

- [x] 3.1 Verify homepage redirects successfully to detail views via the `/product/:id` route.
- [x] 3.2 Verify detail actions redirect to `/productCart` with correct `action` parameters.
- [x] 3.3 Verify responsive behavior: side-by-side centering on screens ≥640px and vertical stacking on mobile.
- [x] 3.4 Confirm no interactive nesting warnings (like `<a><button>`) are logged or rendered in console.
