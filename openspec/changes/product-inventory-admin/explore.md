# Exploration: product-inventory-admin

## Status: complete (verified by orchestrator spot-check)

## Current State (verified against live repo)

**Stack** — TypeScript/Express/hexagonal backend (`backend/src/{domain,application,infrastructure}`), Sequelize/MySQL, JSON-only API. Astro frontend under `frontend/src/pages` + `frontend/src/domains/*`. The cached `sdd-init/mundo-3d` engram memory is stale — it describes an old CommonJS/EJS architecture that no longer exists.

**Roles**: `backend/src/domain/Role.ts` = `{ ADMIN = 1, USER = 2 }`. No `STAFF`. `idRole` on the `User` Sequelize model is a bare `INTEGER` column (no FK to a roles table) — adding `STAFF` is a pure enum + guard-logic change, no DB migration needed for the role itself.

**Auth guard**: `adminGuard` (`backend/src/infrastructure/middlewares/auth.ts`) checks `principal.idRole !== Role.ADMIN` as a single equality — must become an allow-list to admit STAFF too. Working reuse pattern already exists: `users.ts` -> `router.get('/users', apiAuthMiddleware, adminGuard, controller.index)`.

**Product routes/controller**: `backend/src/infrastructure/routes/api/products.ts` registers ONLY GET routes; `ProductApiController` has ONLY `index/show/latest`. `CreateProductUseCase`/`UpdateProductUseCase`/`DeleteProductUseCase` (tested) are fully implemented but never imported anywhere — completely unwired.

**Product domain/DB**: no stock/quantity field anywhere (entity, DTO, `CreateProductInput`/`UpdateProductInput`, Sequelize model, or DB). Migrations are hand-applied dated `.sql` files (`backend/src/database/migrations/`) — no automated migration runner/CLI exists in `backend/package.json` (confirmed: no `migrat*` script). Adding `stock` means a manually-applied SQL file in every environment.

**Validators**: `productValidators.ts` is dead/stale code — validates old EJS field names (`productName`, `category`, `franchise`) instead of current entity fields, and only used by its own unit test, not wired to any route.

**Upload middleware**: `upload.ts` is generic and reusable as-is via `createUpload('products')`, following the exact pattern already used for `users`.

**CSRF discrepancy**: no CSRF middleware exists anywhere in `backend/src` (only a leftover unused `csrfToken?: string` type field). `openspec/specs/admin-route-guard/spec.md` describes a scenario where "the global CSRF middleware MUST reject the request with HTTP 403" — that middleware does not exist. Combined with the `/new-product` route (confirmed gone), this spec is doubly orphaned. `openspec/specs/csrf-error-pages/spec.md` is suspected to have the same issue (not deep-verified — flagged for the spec phase).

**Frontend — pre-existing bug relevant to this feature**: `frontend/src/domains/auth/adapters/auth.adapter.ts` drops `idRole` entirely when mapping the login response into `localStorage` (confirmed: zero occurrences of `idRole` in that file), even though the backend (`UserApiController.ts`) sends `idRole` in the payload. `frontend/src/components/Header.astro` already has a dead `admin-only` nav link to `/new-product` and JS gating logic (`user.IDRole === 1 || ...`) that is currently non-functional because `idRole` never reaches `localStorage`. This must be fixed for any ADMIN/STAFF gating in the new admin UI to work — in scope, not optional cleanup.

**Frontend auth pattern confirmed**: JWT in `localStorage.getItem('token')`, sent as `Authorization: Bearer <token>` (confirmed via `CartService.ts`). No admin page exists anywhere under `frontend/src/pages`; closest reusable pattern is the `frontend/src/domains/products` adapter/service split.

## Affected Areas
- `backend/src/domain/Role.ts`, `middlewares/auth.ts` (adminGuard), `routes/api/products.ts`, `controllers/ProductApiController.ts`
- `application/use-cases/{Create,Update,Delete}ProductUseCase.ts`, `dtos/ProductDTO.ts`, `domain/entities/Product.ts` — add `stock`
- `database/models/Product.js`, new `database/migrations/*.sql` file, `repositories/SequelizeProductRepository.ts`
- `middlewares/validators/productValidators.ts` (stale, needs rewrite), `middlewares/upload.ts` (reuse as-is)
- `openspec/specs/admin-route-guard/spec.md` (confirmed orphaned), `openspec/specs/csrf-error-pages/spec.md` (suspected orphaned)
- `frontend/src/domains/auth/adapters/auth.adapter.ts` (drops idRole — must fix), `frontend/src/components/Header.astro` (dead link/logic), `frontend/src/pages/` (net-new admin page), `frontend/src/domains/products/` (closest pattern)

## Business decisions already confirmed with the user
1. Scope = product catalog CRUD + stock/quantity tracking per product (new `stock` field, domain entity through DB migration).
2. Access = `Role.ADMIN` AND a new `STAFF` role must both be able to use the admin panel.
3. Image upload = reuse `upload.ts` as-is, wired into the new create/update product routes.
4. First-slice scope = Products only. Categories and Franchises stay as fixed/seed data, no admin UI for them in this change.

## Recommendation
Proceed to `sdd-propose`. Open questions for that phase: exact STAFF-vs-ADMIN permission parity, whether to rewrite `productValidators.ts` or replace it, how to reconcile the orphaned `admin-route-guard`/`csrf-error-pages` specs, and frontend admin domain structure.

## Risks
- Frontend admin/staff gating cannot function until the `idRole`-dropping bug in `auth.adapter.ts` is fixed — now in scope.
- Orphaned specs (`admin-route-guard`, likely `csrf-error-pages`) describe nonexistent behavior (`/new-product` route, CSRF middleware) and must be reconciled in `sdd-spec` or will conflict with new specs.
- No migration runner — `stock` column rollout is a manual per-environment step.
- Cached `sdd-init/mundo-3d` memory is stale; should be refreshed.
