# Archive Report: stabilization-bugfixes

**Change**: stabilization-bugfixes
**Archived**: 2026-06-09
**Verdict**: PASS — all 42 tasks complete, 47/47 tests passing, no CRITICAL issues
**Mode**: Strict TDD

## Summary

Four focused patches shipped to fix production-visible bugs and remove dead code:

1. **Middleware reordering** in `src/app.js` — `helmet()` and `cors()` moved to top, `cookie-parser` moved before session/auth, `express.static` reordered per Express convention.
2. **Cart image path** fix in `src/views/products/productCart.ejs` — `/img/` → `/img/products/`.
3. **Error handler activation** — replaced 11 inline `res.status(500)` responses with `next(err)` across products and users controllers. Also fixed a security leak in `deleteUser.js` that was exposing `${error.message}` to clients.
4. **Dead code removal** — deleted 3 unreachable EJS views (`product.ejs`, `productMenu.ejs`, `newUser.ejs`), removed 2 unused imports (`guestMiddleware` in productsRoutes, `User` model in viewShoppingCart), removed 1 debug `console.log`.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `middleware-pipeline` | **Created** | New domain — covers middleware registration order, controller error propagation, global error handler activation. 3 requirements, 6 scenarios. |
| `asset-paths` | **Created** | New domain — covers cart image path correction, dead view removal, no debug statements. 3 requirements, 6 scenarios. |
| `csrf-error-pages` | **Modified** | `CSRF 403 Error Rendering` requirement extended to require controller errors on CSRF-validated POST routes to propagate through `next(err)` to the global handler. 1 new scenario added. |
| `session-cookie-security` | **Modified** | Added `Remember-Me Cookie Readability` requirement (new). Expanded `Dead Code Removal from Route Imports` to cover `guestMiddleware` removal from productsRoutes, `User` model removal from viewShoppingCart, and debug `console.log` removal. Header changed from "Delta" to canonical spec title. 4 new scenarios added. |

## Archive Contents

- `proposal.md` — Intent, scope, capabilities, approach, risks, rollback
- `specs/middleware-pipeline/spec.md` — Middleware ordering + error propagation contract
- `specs/asset-paths/spec.md` — Cart image path + dead view removal
- `specs/csrf-error-pages/spec.md` — Modified CSRF error rendering (delta from pre-existing spec)
- `specs/session-cookie-security/spec.md` — Modified session/cookie security (delta from pre-existing spec)
- `design.md` — Technical design with before/after blocks, special cases, testing strategy
- `tasks.md` — 42 tasks across 6 phases, all complete (Phase 1 tests, Phases 2–5 patches, Phase 6 verification)
- `verify-report.md` — Full verification: 47/47 tests pass, 22/22 spec scenarios compliant, TDD 6/6 checks passed

## Verification Snapshot

- **Tests**: 47 passed / 0 failed / 0 skipped (11 test suites)
- **Coverage**: All services meet 50% threshold (cartService 100%, categoryService 100%, franchiseService 100%, productService 55.55%, userService 94.11%)
- **TDD compliance**: 6/6 — tests written first, RED confirmed, GREEN confirmed, triangulation adequate
- **Spec compliance**: 22/22 scenarios compliant
- **Issues**: 0 CRITICAL, 0 WARNING, 1 SUGGESTION (productService coverage above threshold but has uncovered lines — address in a future change)

## Source of Truth Updated

The following specs now reflect the new behavior:

- `openspec/specs/middleware-pipeline/spec.md` (new)
- `openspec/specs/asset-paths/spec.md` (new)
- `openspec/specs/csrf-error-pages/spec.md` (updated)
- `openspec/specs/session-cookie-security/spec.md` (updated)

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. The codebase now starts from a known-good baseline: middleware in correct order, remember-me cookie actually works, controller errors reach the global handler, no dead code, no debug `console.log` statements.

Ready for the next change.
