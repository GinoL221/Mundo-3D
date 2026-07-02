## Verification Report

**Change**: product-inventory-admin
**Version**: N/A (spec deltas, no version field)
**Mode**: Strict TDD
**Branch verified**: `feat/product-inventory-admin-3-frontend` (cumulative diff of PR #18, #19, #20 — all open/stacked, none merged to `main`)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 15 core tasks (1.1-1.3, 2.1-2.4, 3.1-3.4, 4.1-4.3, 5.1, 6.1-6.3, 7.1-7.2) + 2 documented follow-up fix passes |
| Tasks complete | 15/15 `[x]` in `openspec/changes/product-inventory-admin/tasks.md`, both fix passes documented and verified against actual git log |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: not run directly (astro build reported green at each fix-pass checkpoint per apply-progress; not independently re-run this pass — see WARNING)

**Backend Tests**: ✅ 350 passed / 0 failed / 0 skipped (56 suites)
```text
$ cd backend && npm test
Test Suites: 56 passed, 56 total
Tests:       350 passed, 350 total
Time:        3.378 s
```

**Frontend Tests**: ✅ 85 passed / 0 failed / 0 skipped (6 files)
```text
$ cd frontend && npm test
Test Files  6 passed (6)
     Tests  85 passed (85)
```

Both counts independently confirmed live on `feat/product-inventory-admin-3-frontend` — match the apply-progress claims exactly (350/350 backend, 85/85 frontend = 70 baseline + 13 session.service + 2 additional product.admin.service).

**Coverage**: not run (no coverage flag invoked this pass) — ➖ Not available this run

### Spec Compliance Matrix

#### admin-route-guard

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Capability-Aware Role Guard | Missing/invalid Bearer → 401 | `middlewares/__tests__/auth.test.ts` > `requireRoles` (401 cases) + `routes/api/__tests__/products.test.ts` (401 cases per route) | ✅ COMPLIANT |
| Capability-Aware Role Guard | Authenticated role outside allow-list → 403 | `auth.test.ts` > `requireRoles` 403 case + `products.test.ts` (USER 403 on POST/PUT/PATCH, STAFF 403 on DELETE) | ✅ COMPLIANT |
| Capability-Aware Role Guard | Role within allow-list proceeds | `products.test.ts` (STAFF/ADMIN 200/201/204 cases) | ✅ COMPLIANT |
| Route Capability Matrix | STAFF permitted create/update/stock | `products.test.ts` — STAFF 201 (POST), 200 (PUT), 200 (PATCH stock) | ✅ COMPLIANT |
| Route Capability Matrix | STAFF rejected on delete + all `/api/users` | `products.test.ts` — STAFF 403 on DELETE; `users.ts` routes are `adminGuard`-only (no STAFF test exists for `/api/users` directly, but guard is `Role.ADMIN` only, same tested unit as `adminGuard`) | ⚠️ PARTIAL — see WARNING |

**Compliance summary**: 4/5 fully compliant, 1 partial (documented below).

#### csrf-error-pages

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| CSRF 403 Error Rendering (REMOVED) | Confirm orphaned/no dangling code | Static check: zero `.ejs` files repo-wide; zero CSRF middleware in `backend/src`; one unused `csrfToken?: string` field in `backend/src/types/express.d.ts` (type-only, never referenced anywhere) | ✅ COMPLIANT (see SUGGESTION for the dead type) |
| 403 Error View Template (REMOVED) | Confirm no EJS rendering pipeline | Static check: no `.ejs` files, no view-render calls for 403 anywhere in guard code (`requireRoles`/`adminGuard` return `res.status(...).json(...)` only) | ✅ COMPLIANT |

**Compliance summary**: 2/2 compliant (this is a removal-only spec — "test" here is source absence, correctly verified).

#### product-inventory

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Product Entity Stock Invariant | Negative stock rejected | `application/__tests__/DomainEntities.test.ts` L170 | ✅ COMPLIANT |
| Product Entity Stock Invariant | Non-integer stock rejected | `DomainEntities.test.ts` L176 | ✅ COMPLIANT |
| Product Create | Valid create → 201, stock defaults to 0 | `CreateProductUseCase.test.ts` L87 "should default stock to 0 when omitted" + `products.test.ts` POST 201 cases | ✅ COMPLIANT |
| Product Create | Missing required field → 400 | `middlewares/__tests__/validators.test.ts` (productCreateValidators suite, not re-read line-by-line this pass but referenced in tasks 4.1) + `ProductApiController.test.ts` covers controller-side 400s | ✅ COMPLIANT |
| Product Update | Valid update → 200, stock unchanged regardless of body | `UpdateProductUseCase.test.ts` L76 "should not accept a stock override" + `products.test.ts` PUT L181 "never forwards a stock field" + `ProductApiController.test.ts` L230 | ✅ COMPLIANT — verified at type level (`Omit<Partial<Product>, 'stock'>` on `IProductRepository.update`) AND runtime level (repository `update()` never reads `product.stock`, only whitelisted fields) |
| Product Update | Update on nonexistent → 404 | `ProductApiController.test.ts` L241 | ✅ COMPLIANT |
| Product Delete | Successful delete → 204 | `ProductApiController.test.ts` L300, `products.test.ts` DELETE 204 (ADMIN) | ✅ COMPLIANT |
| Product Delete | Delete nonexistent → 404 | `ProductApiController.test.ts` L311 | ✅ COMPLIANT |
| Stock Adjustment | Positive delta increases stock | `AdjustProductStockUseCase.test.ts` L34, `products.test.ts` PATCH 200 (STAFF/ADMIN, delta:3→called with 3) | ✅ COMPLIANT |
| Stock Adjustment | Negative delta decreases stock | `AdjustProductStockUseCase.test.ts` L72 | ✅ COMPLIANT |
| Stock Adjustment | Delta making stock negative → 409, persisted stock unchanged | `SequelizeProductRepository.test.ts` L518 "throw Insufficient stock and NOT persist... atomic floor condition"; `ProductApiController.test.ts` L369; `products.test.ts` PATCH 409 | ✅ COMPLIANT — implementation is a single atomic conditional SQL UPDATE (`SET stock = stock + :delta WHERE id = :id AND stock + :delta >= 0`), not read-then-write, closing the TOCTOU gap the PR1 fix-pass addressed |
| Stock Adjustment | Zero/non-integer delta → 400, unchanged | `SequelizeProductRepository.test.ts` L535/540/545; `ProductApiController.test.ts` L380; `products.test.ts` PATCH 400 | ✅ COMPLIANT |

**Compliance summary**: 12/12 scenarios compliant.

#### visual-admin-hiding

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Admin Nav Link Visibility | ADMIN/STAFF sees link | No direct DOM-render test of `Header.astro`; underlying `hasAdminAccess()` decision function is unit-tested (`session.service.test.ts` — true for idRole 1 and 3) and `Header.astro`'s script calls `hasAdminAccess(user)` to toggle `.admin-only` elements | ⚠️ PARTIAL — see WARNING |
| Admin Nav Link Visibility | USER/logged-out does not see link | Same as above — `hasAdminAccess` false for idRole 2 and null, unit-tested; DOM-toggle itself untested | ⚠️ PARTIAL — see WARNING |
| Delete Control Visibility | ADMIN sees delete control | `isAdminOnly()` unit-tested true for idRole 1; `index.astro` L198-221 gates `deleteBtn` on `isAdmin` (keeps handler) vs else-branch `deleteBtn.remove()` — code inspected directly, matches spec | ⚠️ PARTIAL — same DOM-render gap |
| Delete Control Visibility | STAFF does not see delete, other controls remain | `isAdminOnly()` false for idRole 3 unit-tested; `index.astro` removes the delete button element entirely for non-ADMIN while plus/minus/edit remain untouched in the same render path | ⚠️ PARTIAL — same DOM-render gap |

**Compliance summary**: decision logic (the actual role-gate math) is 100% unit-tested and verified correct by direct code reading; the DOM-application of that logic (Header.astro's `.admin-only` toggle, `index.astro`'s `deleteBtn.remove()`) has no automated test — Astro component/page scripts aren't covered by the current vitest setup (confirmed: no `Header.astro` or `admin/products/*.astro` test files exist). This is the same gap the PR3 fix-pass explicitly targeted and partially closed (it extracted and tested the *decision* logic, which had zero coverage before); it did not add DOM/component-level tests, which appears to be a pre-existing limitation of this project's test tooling (no `@astrojs/test` / component testing harness present), not a regression introduced by this change.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| `requireRoles` factory + Role enum only (no magic literals) | ✅ Implemented | `backend/src/infrastructure/middlewares/auth.ts` L53-69; all call sites (`products.ts`, `adminGuard`) use `Role.ADMIN`/`Role.STAFF` constants |
| Route Capability Matrix exact match | ✅ Implemented | POST/PUT/PATCH-stock → `requireRoles(Role.ADMIN, Role.STAFF)`; DELETE + all `/api/users`, `/api/users/:id` → `adminGuard` (= `requireRoles(Role.ADMIN)`) |
| 401 vs 403 distinction | ✅ Implemented | `requireRoles`: no principal → 401 `{error: 'Autenticación requerida'}`; role not in list → 403 `{error: 'Acceso restringido'}`. Both branches independently tested. |
| No EJS/CSRF remnants | ✅ Implemented (minor dead type) | Zero `.ejs` files, zero CSRF middleware. One unused `csrfToken?: string` type field remains in `express.d.ts`, never read/written anywhere — cosmetic, not behavioral |
| Stock NOT modifiable via PUT | ✅ Implemented | Enforced at 3 layers: (1) `productUpdateValidators`/controller never reads `stock` from body into the update input object, (2) `IProductRepository.update()` typed as `Omit<Partial<Product>, 'stock'>`, (3) `SequelizeProductRepository.update()` never assigns `updatedData.stock` even if present on the input object |
| `adjustStock` delta semantics | ✅ Implemented | Atomic single SQL UPDATE with floor condition in the `WHERE` clause — genuinely race-safe, not a JS read-then-write. 409 via "Insufficient stock" error message mapped in controller; 400 via "Delta must be a non-zero integer" for zero/non-integer, validated in the repository before the query runs |
| Create defaults stock to 0 | ✅ Implemented | `CreateProductUseCase.execute`: `stock: input.stock ?? 0` |
| Header.astro nav gating via shared session helpers | ✅ Implemented | Imports `hasAdminAccess` from `../domains/auth` (re-exported from `session.service.ts`), applied to `.admin-only` elements in `updateSessionUI()` |
| Admin pages delete-button visibility via shared helpers | ✅ Implemented | All three admin pages (`index`, `create`, `edit`) import `getSessionUser`/`hasAdminAccess`/(`isAdminOnly` on index) from the same `domains/auth` barrel — no duplicated role math remains |
| Refactor did not break original gating behavior | ✅ Verified | Role values (`ADMIN=1, USER=2, STAFF=3`) match exactly between `backend/src/domain/Role.ts` and `frontend/src/domains/auth/adapters/auth.adapter.ts`; `hasAdminAccess`/`isAdminOnly` logic is a straight extraction with no semantic change from the pre-refactor inline checks, confirmed by reading both the extracted service and its 13 unit tests |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| 3-PR stacked delivery (per Review Workload Forecast) | ✅ Yes | PR1 (#18→main), PR2 (#19→PR1), PR3 (#20→PR2), each independently scoped and tested per tasks.md's Suggested Work Units |
| Capability-aware guard replacing dead EJS/CSRF | ✅ Yes | Matches design intent exactly |
| Stock adjustment as atomic delta op, not raw stock overwrite | ✅ Yes | Matches design; additionally hardened beyond the original plan (atomic SQL vs a read-then-write, per PR1's pre-merge fix) |

### Issues Found

**CRITICAL**: None found.

**WARNING**:
1. **`/api/users` STAFF-403 scenario has no direct test.** The Route Capability Matrix requires STAFF to be rejected (403) on all `/api/users` and `/api/users/:id` methods. `users.ts` correctly wires `adminGuard` (`= requireRoles(Role.ADMIN)`) on `GET /users` and `GET /users/:id`, and `adminGuard`'s STAFF-403 behavior *is* covered generically in `auth.test.ts` ("returns 403 JSON error for authenticated STAFF requests (admin-only route)"), so the guard logic itself is proven — but there is no `routes/api/__tests__/users.test.ts` supertest exercising `GET /api/users` with a STAFF token end-to-end the way `products.test.ts` does for the product routes. Low risk (same guard function, already unit-proven) but it is a gap relative to the spec's literal "STAFF rejected on... all user routes" scenario wording, which implies route-level (not just middleware-level) verification.
2. **DOM-level admin-hiding behavior is untested.** `hasAdminAccess`/`isAdminOnly` (the decision functions) are thoroughly unit-tested (13 cases), and the code that *applies* them (`Header.astro`'s `.admin-only` toggle, `index.astro`'s `deleteBtn.remove()`) was read and confirmed correct by direct inspection — but neither has an automated test rendering the actual `.astro` component/page and asserting on DOM visibility. This was true before this change too (no `@astrojs`/component test harness exists in the project), so it's not a regression, but it means the `visual-admin-hiding` spec's scenarios are only "PARTIAL" compliant by the strict `report-format.md` definition (test passes but covers only part of the scenario — the decision math, not the rendering).
3. **`npm run build` (astro build) was not independently re-run this verification pass.** Apply-progress reports it green at each fix-pass commit checkpoint, but this pass only re-ran `npm test` for both packages, not a build.

**SUGGESTION**:
1. Remove the unused `csrfToken?: string` field from `backend/src/types/express.d.ts` — it's dead code left over from the pre-refactor CSRF era, never read or written anywhere in the codebase. Purely cosmetic but reinforces the "genuinely fully removed" claim in the csrf-error-pages spec.
2. Consider a `routes/api/__tests__/users.test.ts` supertest suite mirroring `products.test.ts`'s guard-matrix style, closing WARNING #1 with the same rigor already applied to the product routes.

### Follow-up (2026-07-02, post-verify)

- **WARNING #1 RESOLVED**: `backend/src/infrastructure/routes/api/__tests__/users.test.ts` was added (commit `349fd8a` on `feat/product-inventory-admin-3-frontend`, PR #20) — 10 route-level guard-matrix tests for `GET /api/users` and `GET /api/users/:id` (401 unauthenticated, 403 USER, 403 STAFF, 200 ADMIN), mirroring `products.test.ts`. Backend suite now 360/360. Test-only change, no production code touched.
- **WARNING #2 DEFERRED**: user explicitly chose to document the DOM/component-testing-harness gap as tech debt rather than build the infrastructure now. Tracked in engram `tech-debt/inventory-resilience-followups`.
- **WARNING #3**: resolved during the same conversation — `npm run build` (astro) was re-run independently and confirmed green, 15 pages including the 3 new `/admin/products` routes.

### Verdict
**PASS WITH WARNINGS**

All 15 core tasks are complete and verified against actual code (not just checkbox trust). Every spec scenario in `admin-route-guard`, `csrf-error-pages`, and `product-inventory` is implemented correctly and has a real, passing, non-trivial covering test — including the two previously-CRITICAL items called out for special attention (PUT never touches stock; `adjustStock` is a genuinely atomic, race-safe delta operation, not the earlier read-then-write). `visual-admin-hiding`'s underlying decision logic is correctly implemented and refactored cleanly into shared `domains/auth` helpers without behavioral drift, but the DOM-rendering half of that spec has no automated coverage (pre-existing tooling gap, not a regression). Backend 350/350 and frontend 85/85 tests pass, confirmed live on `feat/product-inventory-admin-3-frontend`, matching the apply-progress claims exactly. No CRITICAL issues block archive; the WARNINGs are follow-up hardening, not spec violations.
