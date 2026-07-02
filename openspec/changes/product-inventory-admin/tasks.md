# Tasks: product-inventory-admin

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1400–1800 (18 impl files + ~10 test files + migration, across 2 languages) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend foundation+data) → PR 2 (backend app+API+integration tests) → PR 3 (frontend) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — orchestrator must ask user |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phases 1–2: Role/guard/entity + data layer (model, types, migration, repo) | PR 1 | Self-contained, all unit-tested, no route exposure yet |
| 2 | Phases 3–4+7(backend half): use cases, API surface, guard-matrix + stock-delta integration tests | PR 2 | Depends on PR 1; exposes the routes |
| 3 | Phases 5–6+7(frontend half): auth fix + admin UI + manual e2e check | PR 3 | Depends on PR 2's API existing (can build UI against it) |

## Phase 1: Domain + Role Foundation

- [x] 1.1 `backend/src/domain/Role.ts`: add `STAFF = 3`. Test-first: extend `domain/__tests__/Role.test.ts`. Satisfies: guard spec — Route Capability Matrix (roles referenced by constant, no literals).
- [x] 1.2 `backend/src/domain/entities/Product.ts`: add `stock` ctor param + `Stock` getter + `>=0` integer invariant (mirrors height/width/depth). Test-first: extend `application/__tests__/DomainEntities.test.ts`. Satisfies: inventory spec — Product Entity Stock Invariant (negative + non-integer rejected).
- [x] 1.3 `backend/src/infrastructure/middlewares/auth.ts`: add `requireRoles(...roles)` factory (401 no principal / 403 not in list / next() otherwise); `adminGuard = requireRoles(Role.ADMIN)`; drop EJS 403 render branch (JSON-only). Test-first: extend `middlewares/__tests__/auth.test.ts`. Satisfies: guard spec — Capability-Aware Role Guard (all 3 scenarios). Depends: 1.1.

## Phase 2: Data Layer

- [x] 2.1 `backend/src/domain/ports/IProductRepository.ts`: add `adjustStock(id, delta): Promise<Product | null>` to interface.
- [x] 2.2 `backend/src/database/models/Product.js` + `backend/src/database/models/db.ts`: add `stock` column/field + `Stock` getter + `ProductAttributes`/`Instance` types.
- [x] 2.3 Create `backend/src/database/migrations/20260701-add-product-stock.sql`: `ALTER TABLE "Product" ADD COLUMN stock INT NOT NULL DEFAULT 0;` (dated convention, hand-applied). Depends: 2.2.
- [x] 2.4 `backend/src/infrastructure/repositories/SequelizeProductRepository.ts`: propagate `stock` through `toEntity`/`create`/`update`; implement `adjustStock` (read → compute `next=current+delta` → reject `next<0` → persist). Test-first: extend `repositories/__tests__/SequelizeProductRepository.test.ts`. Satisfies: inventory spec — Stock Adjustment (delta math, 409 case). Depends: 1.2, 2.1, 2.2.

## Phase 3: Application Layer

- [x] 3.1 `backend/src/application/dtos/ProductDTO.ts`: add `stock: number`.
- [x] 3.2 `backend/src/application/use-cases/CreateProductUseCase.ts`: accept/default `stock` to `0`, map into DTO. Test-first: extend `application/__tests__/CreateProductUseCase.test.ts`. Satisfies: inventory spec — Product Create (stock defaults to 0). Depends: 3.1, 1.2.
- [x] 3.3 `backend/src/application/use-cases/UpdateProductUseCase.ts`: pass `stock` through to DTO read-only (no delta logic here). Test-first: extend `application/__tests__/UpdateProductUseCase.test.ts`. Satisfies: inventory spec — Product Update (stock unchanged by PUT). Depends: 3.1.
- [x] 3.4 Create `backend/src/application/use-cases/AdjustProductStockUseCase.ts`: `execute(id, delta)`, throws on negative result. Test-first: create `application/__tests__/AdjustProductStockUseCase.test.ts`. Satisfies: inventory spec — Stock Adjustment (all 4 scenarios). Depends: 2.1, 2.4.

## Phase 4: API Surface

- [x] 4.1 Rewrite `backend/src/infrastructure/middlewares/validators/productValidators.ts` in place: `productCreateValidators`/`productUpdateValidators` matching DTO field names (`nameProduct`, `price`, `descriptionProduct`, `idCategory`, `idFranchise`, optional `stock` int≥0); image required only on create. Test-first: extend `middlewares/__tests__/validators.test.ts`. Satisfies: inventory spec — Product Create/Update validation (400 on missing field).
- [x] 4.2 `backend/src/infrastructure/controllers/ProductApiController.ts`: add `create`/`update`/`destroy`/`adjustStock`, injecting use cases; 404 on "Product not found"; `adjustStock` maps use-case negative-throw to 409. Test-first: extend `controllers/__tests__/ProductApiController.test.ts`. Satisfies: inventory spec — Create 201/Update 200/Delete 204/404s/Stock 200/409. Depends: 3.2, 3.3, 3.4.
- [x] 4.3 `backend/src/infrastructure/routes/api/products.ts`: wire `POST/PUT/DELETE /api/products[/:id]` + `PATCH /api/products/:id/stock` with `apiAuthMiddleware` → `requireRoles(...)` (per Route Capability Matrix) → `createUpload('products')`/validators → controller. Test-first: create `routes/api/__tests__/products.test.ts` (supertest). Satisfies: guard spec — Route Capability Matrix (STAFF allowed create/update/stock, 403 on delete/users; missing token 401). Depends: 1.3, 4.1, 4.2.

### Phase 4 follow-up: review fix pass (PR2, post-tasks)

Not new scoped tasks — a surgical fix pass closing WARNING-level findings from
a 4-lens (risk/resilience/readability/reliability) review of PR2's diff, on
the same branch/PR. Covers: audit logging on stock adjustments, `price`
lower-bound validation, orphaned-upload cleanup on validation failure/404,
`Number.isNaN(id)` guards on non-numeric `:id`, `handleValidationErrors`
extraction, `adminGuard` reuse, and required (non-optional) use-case
constructor params on `ProductApiController`. The 2 CRITICAL findings from
the same review (stock-adjustment idempotency, upload disk-failure crash
safety) were deliberately deferred — see engram
`tech-debt/inventory-resilience-followups`.

## Phase 5: Frontend Auth Fix

- [x] 5.1 `frontend/src/domains/auth/adapters/auth.adapter.ts`: add `idRole` to `APIUser`/`User` + both adapters. Test-first: extend `auth.adapter.test.ts`. Satisfies: hiding spec — prerequisite for Admin Nav Link Visibility / Delete Control Visibility (idRole must persist).

## Phase 6: Frontend Admin UI

- [x] 6.1 `frontend/src/components/Header.astro`: replace dead `IDRole===1` check with `idRole ∈ {ADMIN,STAFF}`; point link to `/admin/products`. Satisfies: hiding spec — Admin Nav Link Visibility (both scenarios). Depends: 5.1.
- [x] 6.2 Create `frontend/src/domains/products/services/product.admin.service.ts`: Bearer-authed create/update/delete/adjustStock calls (pattern: `CartService`). Test-first: create `product.admin.service.test.ts`. Depends: 4.3 (API contract).
- [x] 6.3 Create `frontend/src/pages/admin/products/*.astro` (list/create/edit): gated on `idRole`, delete control ADMIN-only per row. Satisfies: hiding spec — Delete Control Visibility (both scenarios). Depends: 6.1, 6.2.

## Phase 7: Integration / Verification

- [x] 7.1 Run backend guard-matrix + stock-delta integration suite (from 4.3) green; run full `npm test` (backend jest) and `npm test` (frontend vitest). Depends: all above. (Frontend: 70/70 green. Backend: unchanged from PR2's 350/350 — no backend files touched in PR3, per scope constraint.)
- [x] 7.2 Manual e2e check: ADMIN full CRUD+stock; STAFF create/update/stock OK, delete 403 + hidden; USER/logged-out cannot see or reach `/admin/products`. Satisfies: proposal Success Criteria. (No browser available in this environment — done as a careful code-level self-review tracing all 3 role paths through the actual implementation; see PR3 apply-progress for the full trace.)

### Phase 6 follow-up: review fix pass (PR3, post-tasks)

Not new scoped tasks — a surgical fix pass closing a BLOCKER, 3 CRITICAL, and
2 WARNING findings from a 4-lens (risk/resilience/readability/reliability)
review of PR3's diff, on the same branch/PR. Covers: extracting
`getSessionUser`/`hasAdminAccess`/`isAdminOnly`/`clearSession` into
`domains/auth/services/session.service.ts` (closing the BLOCKER — zero test
coverage of the admin pages' role-gate/delete-visibility logic, now unit
tested), in-flight/double-click guards on the stock adjust and delete
buttons, a typed `ProductAdminApiError` carrying `res.status` with a 401 →
clear-session-and-redirect-to-login handler in each admin page, inline
validation messaging for invalid stock-delta input, and a clarifying comment
on the `users-list` CSS reuse. 2 resilience findings (live session
revalidation on bfcache, fetch timeout/AbortController) were deliberately
deferred as app-wide tech debt — see engram
`tech-debt/inventory-resilience-followups`.

### Known limitation (PR3, out of scope to fix here)

No `GET /api/categories` or `GET /api/franchises` endpoint exists in the
backend, so the admin create/edit forms cannot offer a category/franchise
picker — `idCategory`/`idFranchise` are plain numeric ID inputs the admin
must know. Adding such listing endpoints would require backend changes,
which are explicitly out of scope for this frontend-only PR. Tracked as
follow-up tech debt, not a spec violation (the spec only requires the
fields to be submitted correctly, not resolved from a picker).
