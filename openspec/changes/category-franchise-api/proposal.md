# Proposal: Category & Franchise CRUD API

## Intent

Category and Franchise are core catalog aggregates (FK targets of every Product), yet they have NO API surface: domain entities, ports, and `Sequelize{Category,Franchise}Repository` exist, but there are zero use-cases, controllers, routes, or validators. They are only mutable via seed scripts / direct DB access. This closes the gap deliberately deferred as a Non-Goal in `product-inventory-admin`, giving operators managed CRUD over the catalog's reference data through the same JSON+Bearer API as Products.

## Scope

### In Scope
- Backend CRUD for Category and Franchise (list, get-by-id, create, update, delete).
- Per entity: 5 use-cases (`List*/Get*ById/Create*/Update*/Delete*UseCase`), one `*ApiController`, one route module in `routes/api/`, one validators file, and DTOs (`CategoryDTO` exists; add `FranchiseDTO`).
- Reads open (no auth), mirroring Product GET routes.
- Writes guarded by `apiAuthMiddleware` + role check: create/update = `requireRoles(ADMIN, STAFF)`, delete = `adminGuard` (ADMIN-only) — mirrors Product exactly for both entities.
- Mount both routers in `routes/api/index.ts`.
- Tests per strict TDD (unit use-cases, controller + route integration via supertest).

### Out of Scope
- Any frontend `/admin` UI for Category/Franchise (deferred, matches prior slice rationale).
- Image upload / extra fields — both are plain single-name entities (`nameCategory`, `nameFranchise`); no multer.
- Changes to Product, cart, or user surfaces.
- Cascade-delete redesign of the Product FK.

## Capabilities

### New Capabilities
- `category-api`: JSON CRUD for Category reference data, open reads / role-guarded writes.
- `franchise-api`: JSON CRUD for Franchise reference data, open reads / role-guarded writes.

### Modified Capabilities
- None.

## Approach

Mirror the Product vertical slice exactly: repo → use-case (depends on port) → `*ApiController` (thin, `next(error)`, numeric-id 400 guard, Spanish messages) → Router with `express-validator` + `handleValidationErrors`. No FK-validation dependency needed (these ARE the referenced entities). Routes follow existing conventions; validators enforce required non-empty name.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `application/use-cases/*Category*,*Franchise*` | New | 10 use-cases |
| `application/dtos/FranchiseDTO.ts` | New | Franchise DTO |
| `infrastructure/controllers/{Category,Franchise}ApiController.ts` | New | Controllers |
| `infrastructure/routes/api/{categories,franchises}.ts` + `index.ts` | New/Modified | Routers + mount |
| `infrastructure/middlewares/validators/{category,franchise}Validators.ts` | New | Validators |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DELETE of a Category/Franchise referenced by Products → FK error | High | Catch FK constraint violation and return `409 Conflict` (Decision 2) |
| STAFF wrongly allowed to delete reference data | Low | Delete uses `adminGuard` (ADMIN-only), mirroring Product (Decision 1) |

## Rollback Plan

Additive-only. Revert the feature commits / unmount both routers from `routes/api/index.ts`; no schema or existing-behavior changes to undo.

## Dependencies

- Existing `Sequelize{Category,Franchise}Repository`, ports, `apiAuthMiddleware`, `requireRoles`, `handleValidationErrors`, `Role`.

## Success Criteria

- [ ] CRUD endpoints for both entities return correct JSON + status codes (201/200/204/400/404, 401/403 on guarded writes).
- [ ] Reads reachable without a token; create/update require ADMIN or STAFF; delete requires ADMIN.
- [ ] Deleting a Category/Franchise that still has associated Products returns `409 Conflict`.
- [ ] All new tests pass; coverage ≥ 50%.

## Resolved Decisions

All prior open questions are RESOLVED and locked — no open questions remain.

1. **Write authorization.** Mirror Product exactly for both entities: create/update use `requireRoles(Role.ADMIN, Role.STAFF)`; delete uses `adminGuard` (ADMIN-only). Note: `adminGuard = requireRoles(Role.ADMIN)` per `auth.ts:71` — the earlier handoff describing it as ADMIN+STAFF was incorrect; this decision follows the verified code.
2. **Referential integrity on delete.** Deleting a Category/Franchise still referenced by Products MUST return `409 Conflict` — catch the FK constraint error. No cascade, no soft-delete.
3. **Route naming + uniqueness.** Consistent REST: `/categories` (list) + `/categories/:id` (show/update/delete), and `/franchises` + `/franchises/:id`. Do NOT copy Product's singular `/product/:id` quirk. No name-uniqueness constraint added; validators only require a non-empty trimmed name.
