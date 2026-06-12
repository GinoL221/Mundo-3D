# Exploration: layout-redesign

**Date**: 2026-06-10
**Status**: done

## Summary

Explored 5 layout-redesign areas across 9 files. All areas have clear, low-effort implementation paths. One open decision: feature strip icon assets.

---

## Current State per Area

### 1. Button/Input Contrast Bug (`--input-fg`)

- `public/css/tokens/colors.css`: In `[data-theme="light"]`, `--input-bg` is NOT overridden and inherits `var(--pico-black)` (#000000 from `:root`), while `--fg` IS overridden to `#1a2a4a` (navy).
- Result: navy text on black background → nearly invisible in light mode.
- `--input-fg` token does NOT exist anywhere in the token system.
- Affected forms: login, register, search input, cart buttons, product action button.

### 2. Product Grid (flex → CSS Grid)

- `public/css/components/product-card.css`: `width: 250px` hardcoded on `.product-card`.
- `public/css/components/product-grid.css`: `display: flex; flex-wrap: wrap` with manual `calc()`-based width overrides at tablet and desktop breakpoints.
- The Gentleman-book recommends `repeat(auto-fit, minmax(250px, 1fr))` — one rule handles all viewport sizes without any breakpoints.

### 3. Product Detail 2-Column Layout

- `public/css/components/product-detail.css`: `.product-detail__main` wraps a `.product-detail__card` div. `.product-detail__card` has NO CSS rule — it's an unstyled wrapper.
- Image and info are both `width: 100%` → always single-column.
- A `.product-detail__card` flex rule at 640px+ is all that's needed.

### 4. Register Form Width

- `src/views/users/register.ejs`: uses `class="form-card"` (300px max-width).
- `public/css/components/forms.css`: `.form-card--medium` already exists (400px, mobile 100% override).
- Fix is a one-word class name change.

### 5. Feature Strip (Homepage)

- `src/views/index.ejs`: carousel section → `<main class="index">` with product grid. No feature-strip section exists.
- No `feature-strip.css` exists.
- No dedicated service/feature pixel art icons exist in `public/images/`.
- Available assets: product category illustrations and nav icons.

---

## Token Inventory (colors.css)

### `:root` (dark mode defaults)
| Token | Value |
|-------|-------|
| `--pico-black` | #000000 |
| `--pico-dark-blue` | #1d2b53 |
| `--pico-purple` | #7e2553 |
| `--pico-dark-green` | #008351 |
| `--pico-red` | #ff004d |
| `--pico-yellow` | #ffec27 |
| `--pico-orange` | #ffa300 |
| `--pico-white` | #ffffff |
| `--pico-light` | #c2c3c7 |
| `--pico-muted` | #5f574f |
| `--pico-sky` | #29adff |
| `--bg` | #0d1117 |
| `--fg` | `var(--pico-light)` |
| `--accent` | `var(--pico-dark-green)` |
| `--danger` | `var(--pico-red)` |
| `--warning` | `var(--pico-orange)` |
| `--surface` | `var(--pico-dark-blue)` |
| `--border` | #2c3e6a |
| `--input-bg` | `var(--pico-black)` |

### `[data-theme="light"]` overrides
| Token | Value |
|-------|-------|
| `--bg` | #f5f0e8 |
| `--fg` | #1a2a4a |
| `--accent` | #8b7355 |
| `--surface` | #ffffff |
| `--border` | #b0a895 |
| `--input-bg` | `var(--pico-black)` ← **BUG: not overridden** |

**Missing**: `--input-fg` (does not exist in either theme)

---

## Affected Files

| File | Change |
|------|--------|
| `public/css/tokens/colors.css` | Add `--input-fg` token; optionally fix `--input-bg` in light mode |
| `public/css/components/forms.css` | Replace `color: var(--fg)` → `color: var(--input-fg)` on input/button selectors |
| `public/css/components/product-card.css` | Remove `width: 250px` |
| `public/css/components/product-grid.css` | Replace flex+calc breakpoints with CSS Grid auto-fit/minmax |
| `public/css/components/product-detail.css` | Add `.product-detail__card` 2-col flex rule at 640px+ |
| `public/css/components/feature-strip.css` | NEW — 3-tile strip component |
| `src/views/users/register.ejs` | `form-card` → `form-card--medium` |
| `src/views/index.ejs` | Add `<section class="feature-strip">` between carousel and main |
| `src/views/partials/head.ejs` | Add `<link>` for feature-strip.css |

---

## Risks

1. **Feature strip icons**: No service-specific pixel art icons. Decision needed: reuse category illustrations, create CSS-only tiles, or leave as text-only tiles.
2. **auto-fit max columns**: At 1440px+ with many products, `minmax(250px, 1fr)` could render 5–6 columns. May want `max-width` on `.product-grid` or `max(3, auto-fit)` constraint.
3. **`--input-bg` consumers**: Before overriding in light mode, grep for non-form uses. Known safe: `.product-card__action` uses `var(--pico-black)` directly.
4. **`.form-card__input` selector**: Fix must cover this selector chain inside `form-card--medium` containers.

---

## Gentleman-Book Alignment

- **Grid for layout, Flexbox for components**: Product grid is page layout → CSS Grid. Card internals stay Flexbox.
- **`repeat(auto-fit, minmax(250px, 1fr))`**: Intrinsically responsive — no media queries needed for column count.
- **Mobile First**: Base rule (no breakpoint) = Grid. No override breakpoints needed.
- **Design tokens as shared vocabulary**: `--input-fg` fits naturally into the existing token architecture.

---

## Ready for Proposal

Yes. All 5 areas documented. The only content decision before implementation is the feature strip icon strategy.
