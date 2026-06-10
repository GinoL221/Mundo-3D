# Design: Expand Desktop Max-Width to 1440px

## Technical Approach

CSS-only change: increase the content constraint from `max-width: 1200px` to `max-width: 1440px` at 4 locations in `public/css/styles.css`, and remove 1 redundant constraint on `nav.barra-navegacion` (line 230) which already inherits `.container` width.

## Architecture Decisions

### Decision: Increase max-width to 1440px

| Option | Tradeoff | Decision |
|--------|----------|----------|
| 1440px | Comfortable on WUXGA/2K, readable text width | **Chosen** |
| 1200px (current) | Feels cramped on 1920px+ screens | Rejected |
| 1600px | Too wide for VT323 font readability (~90 chars/line) | Rejected |
| CSS `clamp()` dynamic width | Over-engineering for single-page PHP app | Rejected |

**Rationale**: 1440px is the standard max-width for comfortable reading on 1920px+ displays. The existing content grids (4-column `.product_container`, 25%-width cards) cap individual card width regardless of container size, so readability is preserved.

### Decision: Remove nav.barra-navegacion max-width instead of increasing it

**Rationale**: `nav.barra-navegacion` sits inside `header > .container` in the DOM. The `.container` already constrains width to 1440px at root level. A second `max-width` on the nav is pure duplication — removing it simplifies the CSS and makes the constraint hierarchy explicit.

## File Changes

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `public/css/styles.css` | Modify | L119 | `.container { max-width: 1440px }` |
| `public/css/styles.css` | Modify | L230 | Remove `max-width: 1200px` from `nav.barra-navegacion` |
| `public/css/styles.css` | Modify | L1071 | `footer .containerFooter { max-width: 1440px }` |
| `public/css/styles.css` | Modify | L1118 | `.containerCopyRedes { max-width: 1440px }` |
| `public/css/styles.css` | Modify | L1310 | `@media (min-width: 1024px) main { max-width: 1440px }` |

No new files. No new dependencies. No JavaScript or backend changes.

## Testing Strategy

Visual verification only. No automated tests — CSS layout constraint changes are deterministic and testable by observation:

| Viewport | Check |
|----------|-------|
| 1920px | Content centered, max 1440px width, no overflow |
| 1366px | Content fills viewport with padding, no overflow |
| 1024px | Desktop breakpoint triggers, content fills with padding |
| 768px | Tablet — layout unchanged from current behavior |
| 375px | Mobile — layout unchanged from current behavior |

## Migration / Rollout

No migration required. Single CSS file change, no data or state affected.
