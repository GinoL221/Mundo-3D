# Archive Report: Backend Layering

**Change**: backend-layering
**Archived on**: 2026-06-10
**Archived to**: `openspec/changes/archive/2026-06-10-backend-layering/`
**Verdict**: PASS WITH WARNINGS
**Mode**: Strict TDD

---

## Task Completion Gate

| Metric | Value |
|--------|-------|
| Tasks total (Phase 0-7) | 58 |
| Tasks complete | 58 |
| Tasks incomplete | 0 |
| Verification verdict | PASS WITH WARNINGS |
| CRITICAL issues | 0 |

All 58 implementation tasks are checked in `tasks.md`. The verify report recorded 0 CRITICAL issues; 1 PARTIAL spec scenario (validation-dedup end-to-end integration test) and 2 WARNING items (cartService branch coverage 60%, remaining `path.join` usage in other controllers) — all acceptable for a refactoring change and tracked in follow-up suggestions.

---

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `user-auth` | Already in sync | Main spec already contained the 3 requirements from the delta (Password Verification, No Direct bcrypt in Controllers, Render Without path.join). No modification required. |
| `cart-computation` | Already in sync | Main spec already contained the 3 requirements from the delta. No modification required. |
| `middleware-pipeline` | Already in sync | Main spec already contains the `Auth Middleware Uses UserService` requirement added by this change (alongside pre-existing Middleware Registration Order, Controller Error Propagation, and Global Error Handler Activation). No modification required. |
| `upload-middleware` | Already in sync | Main spec already contained the 2 requirements (Parameterizable Upload Factory, Routes Use Shared Factory). No modification required. |
| `product-validators` | Already in sync | Main spec already contained the 2 requirements (Product Form Validators Module, Image Validation Uniqueness). No modification required. |
| `user-validators` | Already in sync | Main spec already contained the 3 requirements (User Registration Validators Module, Login Validators Module, userRoutes Imports Validators). No modification required. |
| `api-products-layer` | **Created** | New domain. Copied delta spec verbatim into `openspec/specs/api-products-layer/spec.md`. 3 requirements (API Product Controller, Category Count Transformation in Service, API Route Has No Inline Logic). |
| `controller-consistency` | **Created** | New domain. Copied delta spec verbatim into `openspec/specs/controller-consistency/spec.md`. 3 requirements (One-File-Per-Action for Main Controllers, AboutUs Handled by Controller, View Rendering Without path.join). |
| `validation-dedup` | **Created** | New domain. Copied delta spec verbatim into `openspec/specs/validation-dedup/spec.md`. 1 requirement (No Duplicate File Validation in postNewProduct) with 2 scenarios. |

**Summary**: 0 requirements added to existing main specs, 7 requirements created across 3 new main-spec domains, 0 requirements modified, 0 requirements removed.

The main specs that already matched the delta content were synced in an earlier archive cycle (the proposal and design note that delta specs and main specs share the same purpose). Re-syncing them was a no-op.

---

## Archive Contents

- `proposal.md` (6,307 bytes)
- `design.md` (10,498 bytes)
- `specs/` — 9 delta spec files across 9 domains
- `tasks.md` (8,824 bytes; 58/58 tasks complete)
- `verify-report.md` (12,041 bytes; PASS WITH WARNINGS)

---

## What Was Archived

The change eradicated scattered business logic from routes and controllers in the Mundo-3D Express app, driving every backend file toward the clean-architecture rule: **routes declare, controllers orchestrate, services own business logic**.

### Delivered Capabilities

| Capability | Domain | Implementation |
|------------|--------|----------------|
| Auth Encapsulation | `user-auth` | `UserService.verifyPassword(plain, hash)` created; `processLogin.js` cleaned of direct `bcrypt` import |
| Cart Logic | `cart-computation` | `CartService.computeTotal(cartItems)` created; inline `calcularTotal` removed from `viewShoppingCart.js` |
| Middleware via Service | `middleware-pipeline` | `userLogged.js` uses `UserService.findByEmail` instead of direct `User.findOne` ORM call |
| Upload Shared | `upload-middleware` | `src/middlewares/upload.js` factory created; `productsRoutes.js` and `userRoutes.js` deduplicated |
| Product Validators | `product-validators` | `src/middlewares/validators/productValidators.js` extracted; `productsRoutes.js` imports from it |
| User Validators | `user-validators` | `src/middlewares/validators/userValidators.js` extracted (registration + login chains); `userRoutes.js` imports from it |
| API Layered | `api-products-layer` | `src/controllers/api/productApiController.js` created; `ProductService.transformWithCategoryCount` created; `routes/api/products.js` route file slimmed to delegation only |
| Controller Consistency | `controller-consistency` | `mainController.js` removed; replaced by `src/controllers/main/` barrel (`home.js`, `aboutUs.js`, `index.js`); `/aboutUs` inline route handler replaced by controller; `app.js` `views` config set |
| Validation Dedup | `validation-dedup` | Duplicate `if (!req.file)` check removed from `postNewProduct.js`; express-validator's `validationsForm` image rule is now the sole source of image validation |

### Out of Scope (Per Proposal)

- Auth on `/api` endpoints (security feature, not refactoring)
- Admin role guard (security feature, not refactoring)
- Database schema or model changes
- Frontend or EJS template changes

---

## Source of Truth Updated

The following main specs now reflect the new behavior:

- `openspec/specs/api-products-layer/spec.md` (created)
- `openspec/specs/controller-consistency/spec.md` (created)
- `openspec/specs/validation-dedup/spec.md` (created)

Pre-existing main specs (`user-auth`, `cart-computation`, `middleware-pipeline`, `upload-middleware`, `product-validators`, `user-validators`) were already in sync with the delta content and required no changes this cycle.

---

## Verification Snapshot

- **Tests**: 69 passed / 0 failed / 0 skipped (12 suites)
- **Coverage**: 98.59% statements (threshold 50%) — all service files ≥ 94.44%
- **TDD Compliance**: 6/6 checks passed
- **Spec Compliance**: 16/17 in-scope scenarios COMPLIANT, 1 PARTIAL (acceptable), 6 correctly OUT OF SCOPE

### Non-Blocking Warnings Carried Forward

- `validation-dedup` "Missing image still produces validation error" is PARTIAL — express-validator handles it in route, no integration test confirms end-to-end. Acceptable for refactoring; should be covered in a follow-up Phase 7 integration test pass.
- `cartService.js` branch coverage 60% — `item.Price || 0` fallback tested, `item.product?.Price` optional-chaining branch not fully exercised. Non-blocking.
- Remaining `path.join` for view renders in controllers outside this change's scope (`getAllUsers`, `getUserById`, `postNewUser`, `getAllProducts`, `getProductById`, `confirmModifyProduct`, `mainController` history, `userProfile`, `loginUsers`, `formNewUser`, `formNewProduct`). Tracked as follow-up suggestion in verify report.

---

## SDD Cycle Complete

The `backend-layering` change has been fully planned, implemented, verified, and archived. The next change can begin from a clean SDD state.
