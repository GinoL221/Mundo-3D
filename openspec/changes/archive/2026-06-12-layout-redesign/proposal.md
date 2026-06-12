# Proposal: Layout Redesign

## Intent

Five small layout/visual gaps degrade the experience on the modular CSS design system:

1. **Light-mode contrast bug (accessibility)**: Inputs and buttons render navy `--fg` (#1a2a4a) on black `--input-bg` (#000000) because light mode never overrides `--input-bg`. Text is effectively invisible — a real accessibility defect.
2. **Fragile product grid**: `.product-grid` is flexbox with hardcoded card widths and three manual `calc()` breakpoints. Card sizing is owned by `product-grid.css` overriding `product-card.css` — a cross-component smell.
3. **Empty homepage**: Carousel jumps straight to products. No value proposition between them — weak first impression.
4. **Cramped product detail**: `.product-detail__card` wrapper exists in HTML with no CSS; image and info always stack, even on wide screens.
5. **Narrow register form**: Uses 300px `form-card`; the wider 400px variant already exists.

Success = legible inputs/buttons in both themes, an intrinsically responsive grid with zero manual breakpoints, a homepage value strip, a 2-column detail on desktop, and a comfortable register form.

## Scope

### In Scope

- Add `--input-fg` token (dark + light) and override `--input-bg` in light mode (`colors.css`).
- Repoint inputs and buttons to `--input-fg` (`forms.css`).
- Migrate `.product-grid` to `display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`; remove `calc()` breakpoint widths and the hardcoded `width: 250px` on `.product-card`.
- New `feature-strip` component: 3-tile section between carousel and `<main>` on `index.ejs` (+ CSS file + `head.ejs` link).
- Style `.product-detail__card` as a 2-column flex layout at `min-width: 640px`.
- Switch register form `form-card` → `form-card--medium` (`register.ejs`).

### Out of Scope

- New pages, routes, controllers, or any backend/data changes.
- Navigation redesign, carousel rework, checkout/cart flow changes.
- Sourcing new pixel art icon assets (feature strip ships text/CSS or reused illustrations).
- Per-page CSS splitting (head.ejs keeps loading all components globally).
- Fixing the pre-existing 300px `form-card` mobile overflow (unrelated).

## Capabilities

### New Capabilities

- `feature-strip`: 3-tile homepage value section between carousel and products, with mobile-first responsive layout.

### Modified Capabilities

- `css-design-system`: add `--input-fg` token contract (dark + light) and `--input-bg` light-mode override.
- `product-components`: product grid becomes CSS Grid auto-fit/minmax (no manual breakpoints); product detail gains 2-column layout at ≥640px.
- `cart-and-forms`: inputs and buttons use `--input-fg` for legible text in both themes; register uses the 400px form variant.

## Approach

CSS-first. One new token decouples input text from global `--fg`. The grid migration replaces three breakpoint rules and a cross-component width override with a single `auto-fit/minmax` line. Product detail reuses the existing `.product-detail__card` wrapper as the flex container. Register and feature strip are template edits plus one new CSS component. Mobile-first throughout (base = mobile, `min-width` adds columns).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `public/css/tokens/colors.css` | Modified | Add `--input-fg`; override `--input-bg` in light mode |
| `public/css/components/forms.css` | Modified | Inputs + buttons use `--input-fg` (incl. `.form-card__input`) |
| `public/css/components/product-grid.css` | Modified | Flex → CSS Grid auto-fit/minmax; drop calc widths |
| `public/css/components/product-card.css` | Modified | Remove hardcoded `width: 250px` and mobile override |
| `public/css/components/product-detail.css` | Modified | 2-col `.product-detail__card` at ≥640px |
| `public/css/components/feature-strip.css` | New | 3-tile strip component |
| `src/views/index.ejs` | Modified | Insert feature-strip markup |
| `src/views/partials/head.ejs` | Modified | Add `<link>` for feature-strip.css |
| `src/views/users/register.ejs` | Modified | `form-card` → `form-card--medium` |

## Gentleman-Book Alignment

- **Grid for layout, Flexbox for components**: `.product-grid` = CSS Grid; card internals and detail/feature tiles = Flexbox.
- **`repeat(auto-fit, minmax(250px, 1fr))`**: one rule replaces three breakpoints; `250px` preserves the current min card size; cards fill space intrinsically.
- **Tokens as shared vocabulary**: `--input-fg` extends the existing semantic-token architecture instead of hardcoding colors.
- **Mobile First**: every component bases on mobile and adds columns via `min-width`.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Feature strip lacks dedicated service icons | Med | Ship text-only or reused-illustration tiles; treat real icons as later refinement — flagged open decision |
| `auto-fit` renders 5-6 cards/row at ≥1440px (today caps at 4) | Med | Accept intrinsic count, or cap via `max-width`/container; decide in spec |
| Light-mode `--input-bg` override hits unintended consumers | Low | Grep `--input-bg` usage before edit; confirm only inputs/buttons consume it |
| `.product-detail__card` reused elsewhere | Low | Grep confirms it appears only in `productDetail.ejs` — safe |
| Selector overlap on register inputs (`.form-card__input` vs `.form-card--medium input`) | Low | `--input-fg` fix covers `.form-card__input` directly |

## Rollback Plan

All changes are CSS + two EJS edits with no data/state impact. Revert the single PR (or per-file `git checkout`) to restore prior behavior. New `feature-strip.css` is additive — removing its `<link>` and markup fully disables it.

## Dependencies

- Open decision: feature strip tile content (text-only / reused illustrations / new icons). Not a code blocker.

## Recommended Delivery

Single PR. All five areas are low-effort CSS plus two EJS tweaks, well under the 400-line review budget. First slice = all five areas together; splitting would add overhead without reducing risk.

## Success Criteria

- [ ] Inputs and buttons show legible text in both dark and light themes.
- [ ] `.product-grid` uses CSS Grid auto-fit/minmax; no `calc()` breakpoint widths remain; `product-card.css` no longer hardcodes width.
- [ ] Homepage renders a 3-tile feature strip between carousel and products.
- [ ] Product detail shows a 2-column layout at ≥640px and stacks below.
- [ ] Register form renders at 400px (`form-card--medium`).
- [ ] Total diff stays under 400 changed lines.
