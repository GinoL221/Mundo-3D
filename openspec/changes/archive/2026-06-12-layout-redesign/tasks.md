# Tasks: Layout Redesign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~130–150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (single PR — no chain needed) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

---

## Phase 1: Foundation — Token Fixes

### Task 1.1: Add `--input-fg` token to `colors.css`
- **File**: `public/css/tokens/colors.css`
- **Action**: Add `--input-fg: var(--pico-light)` to `:root` block (after `--input-bg`)
- **Action**: In `[data-theme="light"]` block, override `--input-bg: #f0ebe3` and add `--input-fg: #1a2a4a`
- **Verification**: Toggle light mode; input text must be legible (navy on warm white)

### Task 1.2: Update `forms.css` to use `--input-fg`
- **File**: `public/css/components/forms.css`
- **Action**: Replace `color: var(--fg)` with `color: var(--input-fg)` in three selector blocks:
  - `.form-card__input`, `.form-card--medium input`, `.form-card--wide input` (line 64)
  - `.form-card__btn`, `.form-card--wide button` (line 85)
  - `.form-card__form input` (line 134)
- **Verification**: Inputs and buttons on all form pages use `--input-fg`; visible in both themes

---

## Phase 2: Product Grid CSS Grid Migration

### Task 2.1: Replace `product-grid.css` flex layout with CSS Grid
- **File**: `public/css/components/product-grid.css`
- **Action**: Replace the entire file content with:
  ```css
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-lg);
    padding: var(--space-md) 0;
  }
  ```
- **Verification**: No `calc(` or `flex` on `.product-grid`; grid auto-fits columns at all viewports

### Task 2.2: Remove hardcoded widths from `product-card.css`
- **File**: `public/css/components/product-card.css`
- **Action**: Remove `width: 250px` from `.product-card` selector (line 61)
- **Action**: Remove the entire `@media (max-width: 639px)` block (lines 120–124)
- **Verification**: `grep -c "width:" product-card.css` returns 0 for `.product-card`; grep for `calc(` on `.product-card` returns 0

---

## Phase 3: Product Detail 2-Column Layout

### Task 3.1: Add `.product-detail__card` flex styles to `product-detail.css`
- **File**: `public/css/components/product-detail.css`
- **Action**: Add at end of file:
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
- **Verification**: Product detail page shows image + info side-by-side at ≥640px; stacks below

---

## Phase 4: Feature Strip Component

### Task 4.1: Create `feature-strip.css`
- **File**: `public/css/components/feature-strip.css`
- **Action**: Create new file with mobile-first CSS Grid:
  ```css
  /* ============================================================
     feature-strip.css — Feature strip component
     ============================================================ */

  .feature-strip {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-md);
    padding: var(--space-lg) var(--space-md);
    background-color: var(--surface);
    border-top: 2px solid var(--pico-muted);
    border-bottom: 2px solid var(--pico-muted);
  }

  .feature-strip__tile {
    display: flex;
    flex-direction: column;
    padding: var(--space-md);
    border: 2px solid var(--pico-muted);
    background-color: var(--bg);
  }

  .feature-strip__title {
    font-family: var(--font-heading);
    font-size: 16px;
    color: var(--pico-yellow);
    margin-bottom: var(--space-xs);
  }

  .feature-strip__description {
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--fg);
  }

  @media (min-width: 640px) {
    .feature-strip {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  ```
- **Verification**: CSS loads without errors; strip renders 3 tiles at ≥640px

### Task 4.2: Link `feature-strip.css` in `head.ejs`
- **File**: `src/views/partials/head.ejs`
- **Action**: Add `<link rel="stylesheet" href="/css/components/feature-strip.css" />` after `carousel.css` (line 21)
- **Verification**: Feature strip styles apply after refresh

### Task 4.3: Insert feature strip markup in `index.ejs`
- **File**: `src/views/index.ejs`
- **Action**: Between closing `</section>` (carousel, line 34) and opening `<main class="index">` (line 36), insert:
  ```html
        <section class="feature-strip">
          <div class="feature-strip__tile">
            <h3 class="feature-strip__title">Calidad Premium</h3>
            <p class="feature-strip__description">Materiales de alta resistencia para cada proyecto.</p>
          </div>
          <div class="feature-strip__tile">
            <h3 class="feature-strip__title">Envío Rápido</h3>
            <p class="feature-strip__description">Recibí tu pedido en tiempo récord, preparado con cuidado.</p>
          </div>
          <div class="feature-strip__tile">
            <h3 class="feature-strip__title">Soporte 24/7</h3>
            <p class="feature-strip__description">Estamos para vos en cada paso del proceso.</p>
          </div>
        </section>
  ```
- **Verification**: Three tiles visible between carousel and product grid; tiles stack on mobile

---

## Phase 5: Register Form Width Fix

### Task 5.1: Update register page to use `--medium` modifier
- **File**: `src/views/users/register.ejs`
- **Action**: Change `class="form-card"` to `class="form-card--medium"` on line 9
- **Verification**: Register form renders at 400px wide on desktop; full-width on mobile

---

## Phase 6: Verification

- [x] Run `npm test` — all tests pass (90/90)
- [x] Manual: toggle light/dark theme, verify inputs/buttons legible in both modes
- [x] Manual: resize viewport — product grid (1→2→3+ cols), product detail (stacked→row), feature strip (stacked→3-col)
- [x] Manual: register form at 400px on desktop, full-width on mobile
- [x] Manual: smoke test cart, profile, login — no layout regressions
- [x] Verify no `calc(` widths remain in `product-grid.css`
- [x] Verify no `width: 250px` remains on `.product-card` in `product-card.css`