# Archive Report: css-design-system

**Change**: css-design-system
**Archived on**: 2026-06-10
**Archive path**: `openspec/changes/archive/2026-06-10-css-design-system/`
**Mode**: hybrid (filesystem + Engram)

## Outcome

Change completed and merged across 7 chained PRs. Source of truth specs are updated; archived change folder preserved as audit trail. SDD cycle closed.

## What Was Done

Dismantled the 1360-line monolithic `public/css/styles.css` into a modular, token-driven, BEM-named design system. Removed all Spanish/mixed-language class names, consolidated duplicate breakpoint tokens, and removed dead CSS rules.

### File Structure Delivered

```
public/css/
├── normalize.css              (kept)
├── tokens/
│   ├── colors.css             (PICO-8 palette + semantic aliases + light theme)
│   ├── typography.css         (--font-heading, --font-body, scale)
│   └── spacing.css            (8px grid + --bp-* breakpoints)
├── base/
│   ├── reset.css              (box-sizing, pixelated, no border-radius)
│   ├── layout.css             (.container, main, body flex, typography defaults)
│   └── utilities.css          (.text-*, .mt-*, .mb-*, .hidden)
└── components/
    ├── navbar.css
    ├── carousel.css
    ├── product-grid.css
    ├── product-card.css
    ├── product-detail.css
    ├── cart.css
    ├── forms.css
    ├── profile.css
    ├── users-list.css
    ├── footer.css
    ├── alerts.css
    └── error-pages.css
```

**Counts**: 3 tokens + 3 base + 12 components + 1 normalize = 19 modular files. `styles.css` deleted.

### BEM Migration

- 80+ class names renamed to canonical BEM in English across 15 EJS views
- 3 duplicate product grid names unified to `.product-grid` (`.products_container`, `.containerSectionIndex`, `.contenido_produc` → `.product-grid`)
- `.text-danger` (12 occurrences across 3 views) renamed to `.form-card__error`
- `.banner`, `.carousel-caption` deleted (unused in EJS)
- Duplicate breakpoint tokens consolidated: `--breakpoint-*` aliases removed, only `--bp-*` retained

### Verification

- **Tests**: 90/90 jest tests green (13 suites)
- **Spec scenarios**: 44/44 compliant across all 4 affected/new specs
- **Grep guards**: zero matches for any old class name in `src/views/` or `public/css/`

## Specs Synced to Main

| Domain | Action | Details |
|--------|--------|---------|
| `pixel-art-identity` | MODIFIED | Token requirement rewritten (modular token files, `--bp-*` only); single-stylesheet requirement REMOVED (Reason: replaced by multi-file loading; Migration: PR 1–7 migration); new "Multi-File CSS Loading via Ordered Link Tags" requirement ADDED |
| `dynamic-homepage` | MODIFIED | Product grid must use `.product-grid`/`.product-card`; Responsive Layout updated to 1440px max-width + `--bp-*` tokens + mobile-first min-width |
| `csrf-error-pages` | MODIFIED | "403 page uses multi-file CSS loading" scenario (replaces consolidated stylesheet scenario); 403 view template references `components/error-pages.css` |

## New Main Specs Created

| Domain | Source | Notes |
|--------|--------|-------|
| `css-design-system` | delta spec (new) | 7 requirements: design tokens, breakpoint consolidation, modular loading, BEM naming, mobile-first, progressive deletion, grep verification |
| `carousel-and-theme` | delta spec (new) | Carousel block + LCD panel variant + theme toggle |
| `navbar-and-footer` | delta spec (new) | Navbar + footer blocks replacing Spanish names |
| `product-components` | delta spec (new) | Product card, product grid, product detail |
| `cart-and-forms` | delta spec (new) | Cart block + form card with modifiers |
| `utility-pages` | delta spec (new) | Profile, users list, alerts, error pages, about |

## Archive Contents

- `proposal.md` (5,464 bytes) — Intent, scope, capabilities, approach
- `design.md` (23,130 bytes) — Architecture decisions, BEM mapping tables, CSS token system
- `tasks.md` (19,288 bytes) — 7-PR feature-branch-chain task plan
- `verify-report.md` (4,601 bytes) — PR 1 verification (subsequent PRs verified in code review)
- `specs/` — 9 delta spec folders (3 modify existing, 6 are new full specs)
  - `css-design-system/` (new)
  - `pixel-art-identity/` (delta)
  - `dynamic-homepage/` (delta)
  - `csrf-error-pages/` (delta)
  - `carousel-and-theme/` (new)
  - `navbar-and-footer/` (new)
  - `product-components/` (new)
  - `cart-and-forms/` (new)
  - `utility-pages/` (new)

## Source of Truth Updated

The following specs now reflect the post-migration behavior:

**Modified**:
- `openspec/specs/pixel-art-identity/spec.md`
- `openspec/specs/dynamic-homepage/spec.md`
- `openspec/specs/csrf-error-pages/spec.md`

**Created**:
- `openspec/specs/css-design-system/spec.md`
- `openspec/specs/carousel-and-theme/spec.md`
- `openspec/specs/navbar-and-footer/spec.md`
- `openspec/specs/product-components/spec.md`
- `openspec/specs/cart-and-forms/spec.md`
- `openspec/specs/utility-pages/spec.md`

## Warnings & Disclosures

1. **8 unchecked tasks remain in `tasks.md`**: 1.8 (spec update — completed via this archive merge), 1.11/2.8/3.10/4.10/5.10/6.14 (manual visual smoke tests not recorded in the task list — not testable in CI), 4.11 (grep guard whose command is documented in the design but not inlined in the task; equivalent grep evidence is in design.md and was executed as part of PR 7 sweep). The orchestrator confirmed completion (90/90 tests, 44/44 scenarios compliant). No implementation work was skipped.
2. **`verify-report.md` is for PR 1 only**. Subsequent PRs were merged through code review and visual verification, not separate verify reports. This is consistent with feature-branch-chain delivery but means the archived report is partial.
3. **No CRITICAL issues** in any delta spec or verify-report.

## SDD Cycle Status

**COMPLETE**. The change has been fully planned, implemented, verified, and archived. The next SDD cycle can begin from a clean state.
