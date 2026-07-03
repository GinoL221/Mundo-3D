# Design: product-inventory-admin

## Technical Approach

Wire the already-tested Create/Update/DeleteProductUseCase into the JSON API, add `stock` end-to-end, introduce a `STAFF` role, and replace the single-equality `adminGuard` with a per-route capability-aware guard factory. Frontend gains a persisted `idRole` and an `/admin/products` Astro section. The API (Bearer + guard) is the sole authorization boundary; Astro gating is UX only. Follows existing hexagonal layering and the `users.ts` route pattern.

## Architecture Decisions

### Decision: Capability-aware guard via `requireRoles(...roles)` factory
**Choice**: Replace hard `adminGuard` (`idRole !== Role.ADMIN`) with a middleware factory `requireRoles(...allowed: Role[])` applied per route. Keep `adminGuard = requireRoles(Role.ADMIN)` as a thin alias so `users.ts` needs no behavioral change. Preserve 401 (no principal) vs 403 (principal not in allow-list) JSON semantics. Drop the EJS `403Forbidden.ejs` render branch — this is JSON-only.
**Alternatives considered**: (a) String permission map `requireCapability('product:delete')`; (b) keep single allow-list ADMIN||STAFF for all admin routes.
**Rationale**: (b) fails Q1 — STAFF must NOT delete or touch `/api/users`, so a blanket allow-list is wrong. (a) is over-engineered for 3 roles and ~4 capabilities; a role-list per route is explicit, greppable, and idiomatic here.

### Decision: `stock` as an entity field with non-negative integer invariant
**Choice**: Add `stock: number` to `Product` (default `0`, optional on create). Invariant mirrors `height/width/depth`: must be integer `>= 0`, else throw. DB column `stock INT NOT NULL DEFAULT 0`. Propagate through `ProductDTO`, `CreateProductInput`, Sequelize model (`field: 'stock'` + getter `Stock`), `db.ProductAttributes/Instance`, repo `toEntity`/`create`/`update`.
**Alternatives considered**: nullable stock; string/decimal.
**Rationale**: Default 0 + NOT NULL avoids null-handling churn and matches an inventory count; integer matches unit semantics.

### Decision: Stock adjustment is a signed DELTA on a dedicated endpoint + new use case
**Choice**: `PATCH /api/products/:id/stock` with body `{ delta: number }` (non-zero integer). New `AdjustProductStockUseCase` + repo method `adjustStock(id, delta)` that reads current stock, computes `next = current + delta`, rejects `next < 0`, persists, returns updated `ProductDTO`. The general `PUT /api/products/:id` MUST NOT accept `stock`.
**Alternatives considered**: absolute set via PUT body.
**Rationale**: Q3 resolved — delta prevents lost-update overwrites and keeps inventory changes auditable and distinct from catalog edits.

### Decision: Rewrite `productValidators.ts` in place
**Choice**: Rewrite the existing file's field names to match the JSON API/DTO (`nameProduct`, `price`, `descriptionProduct`, `idCategory`, `idFranchise`, optional `stock` int>=0). Image optional on update (only required on create). Export `productCreateValidators` / `productUpdateValidators`; wire into routes with the `handleValidationErrors` pattern from `users.ts`.
**Alternatives considered**: new module + delete old.
**Rationale**: Q2 — single consumer, no external importers; in-place keeps history and path stable.

## Route Table

| Method | Path | Capability (roles) | Body / Middleware | Success | Errors |
|--------|------|--------------------|-------------------|---------|--------|
| POST | `/api/products` | ADMIN, STAFF | multipart, `createUpload('products').single('image')`, create validators | 201 `ProductDTO` | 400 validation, 401, 403 |
| PUT | `/api/products/:id` | ADMIN, STAFF | multipart, optional image, update validators (no `stock`) | 200 `ProductDTO` | 400, 401, 403, 404 |
| DELETE | `/api/products/:id` | ADMIN only | — | 204 | 401, 403 (STAFF), 404 |
| PATCH | `/api/products/:id/stock` | ADMIN, STAFF | JSON `{ delta: number }` | 200 `ProductDTO` (new stock) | 400 (delta 0/NaN), 401, 403, 404, 409 (would go negative) |
| GET | `/api/products`, `/product/:id`, `/products/latest` | public (unchanged) | — | 200 | — |

Guard order per mutation: `apiAuthMiddleware` → `requireRoles(...)` → upload/validators → controller. New controller methods `create`/`update`/`destroy`/`adjustStock` on `ProductApiController` inject the existing use cases (+ new `AdjustProductStockUseCase`), mapping `req.file?.filename` to `image` and mirroring `users.ts` error handling (404 on "Product not found").

## Data Flow

    Astro admin form ──Bearer──▶ POST/PUT/DELETE/PATCH /api/products
         │                              │
    localStorage(token,user.idRole)  apiAuthMiddleware → requireRoles → validators/upload
         │                              │
    UX gate (hide delete for STAFF)  Controller → UseCase → SequelizeProductRepository → DB

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/domain/Role.ts` | Modify | Add `STAFF = 3` |
| `backend/src/infrastructure/middlewares/auth.ts` | Modify | Add `requireRoles(...roles)`; `adminGuard` = alias; JSON-only |
| `backend/src/domain/entities/Product.ts` | Modify | Add `stock` param + `>=0` integer invariant + `Stock` getter |
| `backend/src/application/dtos/ProductDTO.ts` | Modify | Add `stock: number` |
| `backend/src/application/use-cases/CreateProductUseCase.ts` | Modify | Add `stock` to input/output (default 0) |
| `backend/src/application/use-cases/UpdateProductUseCase.ts` | Modify | Map `stock` through DTO (no delta here) |
| `backend/src/application/use-cases/AdjustProductStockUseCase.ts` | Create | Delta adjust, reject negative |
| `backend/src/infrastructure/repositories/SequelizeProductRepository.ts` | Modify | `stock` in toEntity/create/update; add `adjustStock` |
| `backend/src/domain/ports/IProductRepository.ts` | Modify | Add `adjustStock` |
| `backend/src/database/models/Product.js` | Modify | `stock` column + `Stock` getter |
| `backend/src/database/models/db.ts` (types) | Modify | `stock` in ProductAttributes/Instance |
| `backend/src/infrastructure/controllers/ProductApiController.ts` | Modify | Add create/update/destroy/adjustStock |
| `backend/src/infrastructure/routes/api/products.ts` | Modify | Wire mutations + guards + upload + validators |
| `backend/src/infrastructure/middlewares/validators/productValidators.ts` | Modify | Rewrite field names + stock |
| `backend/src/database/migrations/YYYYMMDD-add-product-stock.sql` | Create | `ALTER TABLE "Product" ADD COLUMN stock INT NOT NULL DEFAULT 0;` |
| `frontend/src/domains/auth/adapters/auth.adapter.ts` | Modify | Add `idRole` to `APIUser`/`User` + both adapters |
| `frontend/src/components/Header.astro` | Modify | Gate on `idRole ∈ {ADMIN,STAFF}`; drop dead `IDRole` check; link `/admin/products` |
| `frontend/src/domains/products/services/product.admin.service.ts` | Create | Bearer CRUD + stock adjust |
| `frontend/src/pages/admin/products/*.astro` | Create | List/create/edit + client UX gate |

## Interfaces / Contracts

```ts
export type Role = { ADMIN: 1; USER: 2; STAFF: 3 };
export const requireRoles: (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => void | Response;
// AdjustProductStockUseCase
execute(id: number, delta: number): Promise<ProductDTO | null>; // throws on next<0
// PATCH body
interface AdjustStockRequest { delta: number } // non-zero integer
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `requireRoles` 401/403/pass per role; `Product` stock invariant; `AdjustProductStockUseCase` negative guard | Jest, existing patterns |
| Integration | Route guard matrix (STAFF create OK / delete 403 / users 403), stock delta 200/409 | supertest |
| Frontend | `createAuthAdapter` persists `idRole`; admin service sends Bearer | vitest (existing adapter tests) |

## Migration / Rollout

Single additive column, hand-applied dated `.sql` (no runner — per Non-Goals). **Q6 ordering (runbook)**: apply `YYYYMMDD-add-product-stock.sql` on each environment BEFORE deploying backend code that reads/writes `stock`; `NOT NULL DEFAULT 0` backfills existing rows safely. No rollback data loss risk (drop column reverts).

## Spec Reconciliation

- **`admin-route-guard/spec.md` → SUPERSEDE** (sdd-spec rewrites). Target behavior to assert: guard uses `Role` constants (no literals); missing/invalid Bearer → 401 JSON; authenticated role not in route allow-list → 403 JSON; role in allow-list → proceed; product create/update/stock allow {ADMIN, STAFF}; product delete and `/api/users*` allow {ADMIN} only (STAFF → 403); frontend admin UI visible when `idRole ∈ {ADMIN, STAFF}`, delete control visible only for ADMIN. **Drop** all EJS-redirect and CSRF scenarios.
- **`csrf-error-pages/spec.md` → SUPERSEDE/REMOVE**. Confirmed orphaned: no CSRF middleware exists; arch is JSON + Bearer; EJS error views are retired. No CSRF requirements preserved.

## Open Questions

- [ ] None blocking. STAFF DB seeding (how a user gets `idRole = 3`) is out of scope (bare int, per proposal).
