# Proposal: product-inventory-admin

## Status: draft (proposal phase)

## 1. Problem Statement

Mundo-3D has a product catalog that is **read-only in practice**. The backend already
contains fully implemented and unit-tested `CreateProductUseCase`, `UpdateProductUseCase`,
and `DeleteProductUseCase`, but none of them are wired to a route or controller method —
they are dead capabilities. There is no way for the business to add a product, correct a
price or description, retire a discontinued item, or upload a product image without a
developer editing the database or seed data by hand.

On top of that, the catalog has **no concept of stock**. There is no `stock`/quantity
field anywhere in the domain entity, DTOs, use-case inputs, Sequelize model, or database.
The business cannot express "how many of this item do we have" or eventually gate a sale on
availability.

Finally, the pieces needed to *govern* an admin experience are half-built or broken:
- The role model only knows `ADMIN` and `USER`; there is no operational `STAFF` role for
  people who manage the catalog but are not full administrators.
- `adminGuard` is a single hard equality (`principal.idRole !== Role.ADMIN`) that cannot
  admit more than one role.
- The frontend **silently drops `idRole`** when it stores the logged-in user
  (`auth.adapter.ts`), so any role-based UI gating is dead on arrival — the header already
  ships a non-functional `admin-only` link because of this.

This is worth doing now because the catalog is the core of the store, the CRUD engine is
already written (low incremental cost to expose it), and the current state forces
developer intervention for routine business operations.

## 2. Goals

- Expose product **create / update / delete** through the JSON API by wiring the existing
  use cases to real routes and controller methods.
- Introduce a first-class **`stock`** field on the product, end-to-end: domain entity →
  DTO → create/update inputs → Sequelize model → database column, with a hand-applied dated
  SQL migration consistent with the repo's existing convention.
- Add a **`STAFF`** role and convert `adminGuard` into an **allow-list** that admits both
  `ADMIN` and `STAFF`.
- Wire the existing generic **upload middleware** into the new create/update routes via
  `createUpload('products')`, mirroring the `users` usage — no new upload infrastructure.
- Replace the stale **`productValidators.ts`** with validators that match the *current*
  product entity (including `stock`), so create/update requests are validated at the edge.
- Fix the frontend **`idRole` drop bug** so role-based gating works, then deliver a new
  Astro **admin section** for products: list, create, edit, delete, and stock adjustment,
  visible only to `ADMIN`/`STAFF`.
- **Reconcile the orphaned specs** (`admin-route-guard`, and `csrf-error-pages` if
  confirmed) so the spec baseline reflects the real JSON-API + Astro architecture instead
  of the retired EJS/CSRF web-route model.

### Success looks like
- An `ADMIN` or `STAFF` user logs in, opens the admin product section, and can create a
  product (with image and stock), edit it, adjust its stock, and delete it — all through
  the API, with changes reflected in the public catalog.
- A `USER` (or unauthenticated) request to any product mutation route is rejected with the
  correct 401/403 JSON, and the admin UI is not reachable/usable for them.
- The spec baseline no longer references `/new-product`, EJS web-route redirects, or a
  CSRF middleware that does not exist.

## 3. Non-Goals (explicit)

- **No Category or Franchise admin UI** this round. They remain fixed/seed data. Products
  reference existing categories/franchises; managing those catalogs is out of scope.
- **No migration-runner / migration CLI adoption** this round. The `stock` column ships as
  a hand-applied dated `.sql` file following the existing `backend/src/database/migrations/`
  convention. (See Risk R3 — flagged, but judged *avoidable*: a single additive column does
  not justify introducing migration tooling as part of this change.)
- **No CSRF middleware** is introduced or restored. The API is JSON + `Authorization: Bearer`
  token auth; CSRF-token web-form protection does not apply to this architecture.
- **No new auth mechanism.** We keep JWT-in-localStorage + `Bearer` header exactly as the
  rest of the frontend already does.
- **No order/checkout stock enforcement** (e.g. decrementing stock on purchase, blocking
  out-of-stock sales). This change *introduces and tracks* `stock`; consuming it in the
  purchase flow is a separate future change.
- **No public-facing display changes** beyond whatever naturally follows from the new
  `stock` field being present in the product payload (deciding whether/how the storefront
  surfaces stock is out of scope here).

## 4. Scope of Work

### Backend
1. **Role**: add `STAFF` to `backend/src/domain/Role.ts`. `idRole` is a bare integer column
   (no roles FK table), so this is an enum + guard-logic change with **no DB migration for
   the role itself**.
2. **Guard**: rewrite `adminGuard` (`middlewares/auth.ts`) from a single equality into an
   allow-list admitting `ADMIN` and `STAFF`, preserving the existing 401 (unauthenticated)
   vs 403 (authenticated-but-forbidden) JSON contract.
3. **Routes**: add `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
   (exact verbs/paths to be finalized in spec) in `routes/api/products.ts`, guarded by
   `apiAuthMiddleware` + `adminGuard`, following the `users.ts` pattern.
4. **Controller**: add `create` / `update` / `destroy` methods to `ProductApiController`
   that invoke the existing `Create/Update/DeleteProductUseCase`.
5. **Stock field end-to-end**: add `stock` to `domain/entities/Product.ts`,
   `dtos/ProductDTO.ts`, `CreateProductInput` / `UpdateProductInput`,
   `database/models/Product.js`, and `SequelizeProductRepository.ts`; plus a new dated
   `database/migrations/*.sql` adding the `stock` column.
6. **Validators**: replace the stale `productValidators.ts` (validates retired EJS field
   names) with validators matching the current entity + `stock`, wired into the create/update
   routes. (Open question Q2: rewrite-in-place vs replace-with-new-file — deferred to design.)
7. **Upload**: wire `createUpload('products')` into the create/update routes, identical to
   the `users` usage. No changes to `upload.ts`.

### Frontend
1. **Fix `idRole` drop** in `frontend/src/domains/auth/adapters/auth.adapter.ts` so the
   logged-in user's `idRole` is persisted to `localStorage` (backend already sends it).
   Reconcile the existing dead gating in `Header.astro` (currently keys off `user.IDRole`).
2. **Admin product section** under `frontend/src/pages` (e.g. `/admin/products`) plus a
   `frontend/src/domains/products` adapter/service extension for the write operations:
   - product **list** with admin actions,
   - **create** (fields + image upload + stock),
   - **edit**,
   - **delete**,
   - **stock adjustment** for a product.
   Gated so only `ADMIN`/`STAFF` can see and use it, using the persisted `idRole` and the
   existing `Bearer` token pattern.

### Spec reconciliation
- **`openspec/specs/admin-route-guard/spec.md`** is orphaned: it references the retired
  `/new-product` EJS web route, EJS redirect-to-403 behavior, and a **global CSRF
  middleware that does not exist**. This change's spec phase will **supersede** it with a
  guard spec written against the real world: JSON API mutation routes for products (and the
  existing `/api/users` routes), `ADMIN`+`STAFF` allow-list, 401 vs 403 JSON responses, and
  frontend gating via persisted `idRole` — dropping all CSRF/EJS/web-redirect scenarios.
- **`openspec/specs/csrf-error-pages/spec.md`** is *suspected* orphaned (same dead
  architecture). The spec phase will confirm and, if so, mark it superseded/removed since no
  CSRF layer exists in the JSON-API design. The proposal's intent: **do not preserve
  CSRF-based requirements**; the token-auth JSON model replaces them.

The actual rewrite is the spec phase's job; this proposal fixes the *intent* — the new
guard/admin specs are authoritative and the CSRF/EJS specs are retired, not merged.

## 5. Approach & Rationale

- **Wire, don't rewrite.** The CRUD use cases are already implemented and tested; the
  cheapest correct path is to expose them via controller + routes rather than reinvent
  logic. This keeps the change surface small and leverages existing test coverage.
- **Allow-list over branching.** Making `adminGuard` an allow-list (rather than adding a
  second `STAFF`-specific guard) keeps one guard as the single choke point and makes future
  role additions a data change, not a control-flow change.
- **Follow existing conventions.** Dated SQL migration (repo convention), `createUpload`
  pattern (from `users`), `Bearer` token auth (from `CartService`), and the
  `domains/products` adapter/service split (existing frontend pattern) — minimizing novelty
  and review risk.
- **Fix the gating bug at the root.** Persisting `idRole` in `auth.adapter.ts` is a
  prerequisite, not optional cleanup: without it, no admin/staff UI gating can work at all.
- **Retire dead specs explicitly.** Leaving the CSRF/EJS specs in place would create a
  conflicting baseline for the spec phase; the proposal declares them superseded so the new
  specs are unambiguous.

## 6. Open Design Questions (resolve in sdd-design / sdd-spec)

- **Q1 — STAFF vs ADMIN permission parity (PRIMARY OPEN QUESTION).** The business decision
  only said "STAFF should have access to the admin panel"; it did **not** say what STAFF
  *cannot* do. Design must decide whether STAFF has full parity with ADMIN or restricted
  permissions — e.g. can STAFF **delete** products, or only create/update and adjust stock?
  Does STAFF get access to `/api/users` admin routes (currently ADMIN-gated) or only
  product routes? This materially affects the guard design (single allow-list vs
  per-capability checks) and the admin UI. **Recommended default to validate with the user:
  STAFF = create/update/stock, ADMIN-only = delete + user management.** Flagged for explicit
  decision — do not assume full parity silently.
- **Q2 — Validators: rewrite in place vs replace.** `productValidators.ts` is dead code with
  wrong field names. Decide whether to rewrite the file or delete it and introduce a fresh
  validator module aligned with the current entity.
- **Q3 — Stock semantics.** Is `stock` a non-negative integer with a default (e.g. `0`)?
  Is it required on create or optional? Is "stock adjustment" an absolute set or a relative
  delta (+/-)? Does the update route handle stock, or is there a dedicated stock endpoint?
- **Q4 — Route shape.** Confirm REST verbs/paths for mutations and whether stock adjustment
  is part of `PUT /api/products/:id` or a dedicated sub-resource route.
- **Q5 — Frontend admin structure.** Confirm the Astro route layout (`/admin/products`,
  nested pages vs single page with modals) and how gating is enforced (client-side redirect
  for UX + server-side guard as the real boundary).
- **Q6 — Migration rollout coordination.** Since migrations are hand-applied per environment,
  design should note the ordering constraint: the `stock` SQL file must be applied before the
  code that reads/writes `stock` is deployed to that environment.

## 7. Risks

- **R1 — Frontend gating depends on the `idRole` fix.** No admin/staff UI can function until
  `auth.adapter.ts` persists `idRole`. This is now in scope; if it regresses, the whole admin
  UI is invisible/broken. (Mitigation: fix + cover early.)
- **R2 — Orphaned specs cause baseline conflict.** If `admin-route-guard` /
  `csrf-error-pages` are not explicitly superseded, the spec phase inherits requirements for
  behavior that doesn't exist (CSRF middleware, `/new-product`, EJS redirects). (Mitigation:
  proposal declares them retired; spec phase executes the supersede.)
- **R3 — No migration runner (manual stock rollout).** The `stock` column is a manual,
  per-environment SQL step. Missing it in an environment breaks product reads/writes there.
  Judged *avoidable* to fix via tooling this round (see Non-Goals). (Mitigation: clear dated
  migration file + deploy-ordering note in design.)
- **R4 — Unresolved STAFF permission scope (Q1) risks over/under-building.** Building full
  parity when the business wanted restrictions (or vice-versa) is rework. (Mitigation: get an
  explicit answer before design finalizes the guard.)
- **R5 — Stale `sdd-init/mundo-3d` memory.** The cached project context describes a retired
  CommonJS/EJS architecture. Downstream phases must trust the exploration artifact, not the
  stale init memory. (Mitigation: exploration already corrected the record; flag persists.)
