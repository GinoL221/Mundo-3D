# Design: Layout Redesign

## Technical Approach

CSS-first refactor across 5 independent areas. No backend changes. Each area is scoped to specific files with clear before/after behavior. Mobile-first throughout: base styles target mobile, `min-width` media queries add complexity at 640px+.

## Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|----------|----------|----------|--------|-----------|
| Product grid layout | CSS Grid `auto-fit/minmax` | Keep flex + calc breakpoints | **A** | One rule replaces 3 breakpoint blocks; intrinsic responsiveness; aligns with Gentleman-book "Grid for layout" |
| Grid column count at 1440px+ | Accept 5-6 columns | Cap with `max-width` on grid | **A** (accept) | More cards visible = better for e-commerce; can revisit if UX data shows cards too narrow |
| Feature strip layout | CSS Grid 3-col | Flexbox with `flex: 1` | **A** (Grid) | Equal-width tiles with no calc; collapses cleanly to 1-col on mobile |
| Product detail layout | Flex row at 640px+ | CSS Grid 2-col | **A** (Flex) | Only 2 children (image + info); Flexbox is simpler and matches existing `.product-detail__main` pattern |
| `--input-fg` value (light) | `#1a2a4a` (same as `--fg`) | `#000000` (black) | **B** (`#000000`) | `--fg` navy on `--input-bg` black is the bug; black text on black bg also fails — need `#333333` or similar dark-gray for contrast ≥4.5:1 on `#000000` |

### Decision: `--input-fg` token value

**Choice**: `--input-fg: var(--pico-light)` (#c2c3c7) in dark mode; `--input-fg: #1a2a4a` in light mode on a lightened input background.
**Alternatives considered**: Keep `--fg` for text and change `--input-bg` to a lighter color in light mode.
**Rationale**: The root cause is `--input-bg` stays `#000000` in light mode while `--fg` becomes `#1a2a4a` (navy). Navy on black = invisible. Two fixes needed: (1) override `--input-bg` in light mode to a light surface (e.g., `#ffffff` or `#f0ebe3`), (2) add `--input-fg` so input text color is decoupled from global `--fg`. In light mode, `--input-fg` can stay `#1a2a4a` (navy on light bg = good contrast). In dark mode, `--input-fg` = `--pico-light` (same as current `--fg`).

## Data Flow

No data flow changes. Pure CSS + template edits:

    colors.css (tokens) ──→ forms.css (consumes --input-fg, --input-bg)
    product-grid.css ──→ product-card.css (no longer overrides width)
    feature-strip.css ──→ index.ejs (markup) ──→ head.ejs (link)
    product-detail.css ──→ productDetail.ejs (existing wrapper, now styled)
    forms.css (.form-card--medium) ──→ register.ejs (class change)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `public/css/tokens/colors.css` | Modify | Add `--input-fg: var(--pico-light)` (dark); override `--input-bg: #f0ebe3` + add `--input-fg: #1a2a4a` (light) |
| `public/css/components/forms.css` | Modify | Replace `color: var(--fg)` with `color: var(--input-fg)` in all input/button selectors (3 blocks: lines 63-64, 84-85, 133-134) |
| `public/css/components/product-grid.css` | Modify | Replace flex + 2 breakpoint blocks with `display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))` |
| `public/css/components/product-card.css` | Modify | Remove `width: 250px` from `.product-card`; remove mobile `width: 100%; max-width: 320px` override (grid handles sizing) |
| `public/css/components/product-detail.css` | Modify | Add `.product-detail__card { display: flex; flex-direction: column; gap: var(--space-md); }` + `@media (min-width: 640px)` → `flex-direction: row` |
| `public/css/components/feature-strip.css` | Create | New component: CSS Grid 3-tile strip, mobile-first (1-col → 3-col at 640px+) |
| `src/views/index.ejs` | Modify | Insert `<section class="feature-strip">` between carousel and `<main>` with 3 tiles |
| `src/views/partials/head.ejs` | Modify | Add `<link rel="stylesheet" href="/css/components/feature-strip.css" />` |
| `src/views/users/register.ejs` | Modify | Change `class="form-card"` → `class="form-card--medium"` on line 9 |

## Interfaces / Contracts

### New Token: `--input-fg`

```css
/* colors.css — dark mode (default) */
--input-fg: var(--pico-light);  /* #c2c3c7 on #000000 bg */

/* colors.css — light mode override */
--input-bg: #f0ebe3;            /* light warm bg instead of black */
--input-fg: #1a2a4a;            /* navy on light bg = 7.2:1 contrast */
```

### Feature Strip BEM Contract

```css
.feature-strip              /* Grid container: 3 tiles */
.feature-strip__tile        /* Individual tile (flex column) */
.feature-strip__title       /* Tile heading */
.feature-strip__description /* Tile body text */
.feature-strip__icon        /* Reserved slot for future icons (empty div) */
```

### Product Detail Card

```css
.product-detail__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (min-width: 640px) {
  .product-detail__card {
    flex-direction: row;
  }
  .product-detail__image { flex: 1; }
  .product-detail__info  { flex: 1; }
}
```

### Register Form Modifier

No new CSS needed — `.form-card--medium` already exists in `forms.css` (line 30-32, width: 400px). Only template change: `class="form-card"` → `class="form-card--medium"`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Visual | Input text legible in dark + light mode | Manual: toggle theme, verify inputs/buttons readable |
| Visual | Product grid: 1-col mobile, 2-col tablet, 3+ col desktop | Manual: resize viewport; verify no `calc()` widths remain |
| Visual | Feature strip: 3 tiles visible, equal width, stacks on mobile | Manual: check at 375px, 768px, 1024px |
| Visual | Product detail: 2-col at ≥640px, stacked below | Manual: resize viewport |
| Visual | Register form: 400px width on desktop, full-width on mobile | Manual: verify `.form-card--medium` active |
| Regression | No layout shift on existing pages (cart, profile, login) | Manual smoke test on all form pages |

## Migration / Rollout

No migration required. All changes are CSS + two EJS edits. Single PR, zero data/state impact. Rollback = `git revert` or per-file `git checkout`.

## Open Questions

- [ ] Feature strip tile content: ship with text-only + CSS placeholder for icons, or reuse existing illustrations? (Proposal says text-only; confirm with stakeholder)
- [ ] `auto-fit` may show 5-6 cards at 1440px+ (currently caps at 4). Accept as intrinsic behavior or add `max-width` constraint? (Decision: accept for now)
