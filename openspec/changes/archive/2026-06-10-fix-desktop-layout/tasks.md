# Tasks: Fix Desktop Layout — Expand Max-Width to 1440px

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~5 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | N/A |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: CSS Max-Width Constraint Update

- [x] 1.1 `public/css/styles.css` L119 — `.container` max-width 1200px → 1440px
- [x] 1.2 `public/css/styles.css` L230 — Remove `max-width: 1200px` from `nav.barra-navegacion`
- [x] 1.3 `public/css/styles.css` L1071 — `footer .containerFooter` max-width 1200px → 1440px
- [x] 1.4 `public/css/styles.css` L1118 — `.containerCopyRedes` max-width 1200px → 1440px
- [x] 1.5 `public/css/styles.css` L1310 — `@media (min-width:1024px) main` max-width 1200px → 1440px

## Phase 2: Visual Verification

- [x] 2.1 Open site at 1920px+ — verify content centered at max 1440px, no horizontal overflow
- [x] 2.2 Verify mobile (<640px) and tablet (640–1023px) layouts unchanged
