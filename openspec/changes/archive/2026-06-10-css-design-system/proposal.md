# Proposal: CSS Design System

## Intent

Dismantle the monolithic `styles.css` (1360 lines) into a modular, token-driven design system with full BEM naming in English — following Chapter 16 of the Gentleman Book (CSS Mantenible, Design Systems, Diseño Responsivo). The current file mixes Spanish/English ad-hoc names, duplicates breakpoint tokens, and uses three different class names for the same product grid component.

## Scope

### In Scope
- Split `styles.css` into `tokens/`, `base/`, `components/` structure loaded via `<link>` tags in `head.ejs`
- Migrate all class names to BEM in English (e.g. `.barra-navegacion` → `.navbar`, `.contenido_produc`/`.containerSectionIndex`/`.products_container` → `.product-grid`)
- Consolidate duplicate breakpoint tokens (`--bp-*` vs `--breakpoint-*`) into single `--bp-*` scheme
- Move media queries into their owning component file (mobile-first)
- Update all EJS views to use new BEM class names
- Add test validating `head.ejs` references existing CSS files
- Empty `styles.css` section by section (never broken mixed state)
- Chain 7 PRs matching the mandatory slicing order

### Out of Scope
- No new visual designs or pixel art assets
- No changes to `theme.js` logic or anti-flash script (selector-only updates if needed)
- No CSS bundler/PostCSS/import — plain `<link>` tags only
- No changes to backend controllers, routes, or models
- No new components not already in `styles.css`

## Capabilities

### New Capabilities
- `css-design-system`: Token-driven CSS architecture with BEM naming, modular files, and mobile-first responsive queries per component

### Modified Capabilities
- `pixel-art-identity`: CSS custom properties move from monolith to `tokens/` files; breakpoint tokens consolidated; "single stylesheet" requirement replaced by multi-file `<link>` loading
- `dynamic-homepage`: EJS class renames for product grid and carousel (`.products_container` → `.product-grid`, carousel BEM)
- `csrf-error-pages`: EJS class renames for error page markup if any; CSS moves to `components/error-pages.css`

## Approach

Slice the monolith in 7 incremental PRs. Each PR: (1) creates new component CSS files, (2) moves rules from `styles.css` to the new files, (3) updates EJS class names, (4) adds `<link>` in `head.ejs`, (5) verifies visually + via `npm test`. The old `styles.css` shrinks section by section until PR 7 deletes it.

Token consolidation: keep `--bp-mobile`/`--bp-tablet`/`--bp-desktop` (shorter, aligned with spacing `--space-*`). Drop `--breakpoint-*` aliases. Update `pixel-art-identity` spec scenario accordingly.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `public/css/styles.css` | Removed | Monolith emptied and deleted in PR 7 |
| `public/css/tokens/` | New | colors.css, typography.css, spacing.css |
| `public/css/base/` | New | reset.css, layout.css |
| `public/css/components/` | New | 12 component files |
| `src/views/partials/head.ejs` | Modified | Replace single `<link>` with multiple |
| `src/views/partials/header.ejs` | Modified | BEM rename: `.barra-navegacion` → `.navbar` |
| `src/views/partials/footer.ejs` | Modified | BEM rename: `.containerSections` → `.footer__section` |
| `src/views/index.ejs` | Modified | BEM rename: `.products_container` → `.product-grid` |
| `src/views/products/*.ejs` | Modified | BEM rename: `.contenido_produc`, `.containerProducto`, etc. |
| `src/views/users/*.ejs` | Modified | BEM rename: form and profile classes |
| `src/views/aboutUs.ejs` | Modified | BEM rename: `.containerMainLogin` reuse |
| `src/views/403Forbidden.ejs` | Modified | BEM rename: `.error-page` |
| `src/views/404NotFound.ejs` | Modified | BEM rename: `.error-page` |
| `src/__tests__/theme.test.js` | Unchanged | No selector changes needed in test |
| New test file | New | Validate head.ejs CSS references |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| HTTP waterfall from many `<link>` tags | Low | 14 files over localhost is negligible; no bundler needed |
| Missed class rename breaks layout | Med | Each PR is visually verified; grep for old names before merge |
| `pixel-art-identity` spec says "single stylesheet" | Med | Spec update is part of this change; PR 1 updates the spec |
| Theme toggle selector `.theme-toggle-btn` changes | Low | BEM name stays `.theme-toggle-btn` (already valid BEM); no JS change needed |
| Spec reference to `--breakpoint-*` breaks | Med | Migrate to `--bp-*` consistently; update spec scenarios |

## Rollback Plan

Each PR is independently revertible. `styles.css` always contains the remaining unmigrated rules, so reverting any single PR restores only that slice's classes. Full rollback: revert all 7 PRs in reverse order to restore original `styles.css`.

## Dependencies

- Existing `pixel-art-identity` and `dynamic-homepage` specs must be updated in PR 1
- `npm test` (theme.test.js) must stay green across all PRs
- No external dependencies introduced

## Success Criteria

- [ ] `styles.css` deleted; all CSS lives in `tokens/`, `base/`, `components/`
- [ ] Zero Spanish or mixed-language class names in CSS or EJS
- [ ] One canonical name per component (e.g. single `.product-grid`, not three)
- [ ] Duplicate breakpoint tokens consolidated (`--bp-*` only)
- [ ] `npm test` green (including new head.ejs CSS reference test)
- [ ] Visual parity: no layout regression on dark/light theme at mobile/tablet/desktop
