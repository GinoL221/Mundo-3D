# Design: Category & Franchise CRUD API

## Technical Approach

Clone the Product vertical slice per entity: DI-wired route module → thin `*ApiController` → use-case (depends on domain port) → existing `Sequelize*Repository`. Ports, entities, and repositories already exist with the exact CRUD signatures needed (`findAll`, `findById`, `create(Omit<E,'id*'>)`, `update(id, Partial<E>)`, `delete(id): boolean`) — only the application and HTTP layers are new, plus repository translations for FK and unique-constraint violations.

## Delivery Split

PR7 is design/task alignment only and deliberately contains no executable changes. PR8 restores the preserved duplicate-conflict implementation, tests, and verification evidence onto a branch serially based on PR7. This separation keeps the contract reviewable before executable delivery; FK-delete behavior remains unchanged.

## Architecture Decisions

### Decision: Use-case naming and semantics

**Choice**: `ListCategoriesUseCase`, `GetCategoryByIdUseCase`, `CreateCategoryUseCase`, `UpdateCategoryUseCase`, `DeleteCategoryUseCase` (same pattern for Franchise) — mirrors `ListProductsUseCase`/`GetProductByIdUseCase`/etc. exactly. GetById throws `Error('Category not found')` (mapped to 404 by controller, like `'Product not found'`); Update returns `DTO | null`; Delete returns `boolean`.
**Alternatives considered**: Result objects / typed error classes.
**Rationale**: The codebase's established convention is string-message domain errors mapped in controllers (`ProductApiController.ts:50,201`). Follow it.

### Decision: 409-on-FK-violation implemented in the repository layer

**Choice**: Modify `SequelizeCategoryRepository.delete()` / `SequelizeFranchiseRepository.delete()` to catch Sequelize's `ForeignKeyConstraintError` (import `{ ForeignKeyConstraintError } from 'sequelize'`; runtime name `SequelizeForeignKeyConstraintError`) and rethrow `new Error('Category has associated products')` / `new Error('Franchise has associated products')`. The use-case propagates; the controller's `destroy` catches that message and returns `409 { error: 'No se puede eliminar la categoría porque tiene productos asociados' }` (Spanish message, per convention).
**Alternatives considered**: (a) Catch `error.name === 'SequelizeForeignKeyConstraintError'` in the controller — leaks ORM specifics past the adapter and breaks the message-mapping convention. (b) Pre-check "has products?" in the use-case — `IProductRepository` has no such query and it's a TOCTOU race. (c) Global `errorHandler` mapping — any FK error anywhere would become 409.
**Rationale**: In hexagonal terms the Sequelize adapter is the only layer allowed to know Sequelize error types; the application layer stays ORM-free and unit-testable with plain mocks. Matches the existing `'Insufficient stock'` → 409 mapping pattern. **Deviation from "all files new"**: both repositories get a small modification (delete method only).

### Decision: Unique names use semantic conflict codes

**Choice**: `SequelizeCategoryRepository` and `SequelizeFranchiseRepository` catch Sequelize `UniqueConstraintError` from both `create()` and `update()` and rethrow `Error('DUPLICATE_CATEGORY_NAME')` or `Error('DUPLICATE_FRANCHISE_NAME')`. The corresponding controllers map only those codes to `409 { error: <same code> }`.

**Rationale**: The persistence adapter owns Sequelize-specific errors, while the controller owns the HTTP contract. Semantic codes make duplicate behavior deterministic without coupling tests or clients to localized prose. The existing FK-delete translation and its Spanish response body remain separate and unchanged.

### Decision: List response is a plain DTO array

**Choice**: `ListCategoriesUseCase.execute(): Promise<CategoryDTO[]>` (same for Franchise) — no wrapper object.
**Alternatives considered**: Mirroring Product's `{ count, products, countByCategory }` wrapper.
**Rationale**: Product's wrapper exists to carry Product-specific aggregation (`countByCategory`). Reference-data lists have no aggregation; a wrapper would be cargo-culting. **Flagged deviation** from copying Product literally.

### Decision: Name required on update (not optional)

**Choice**: `categoryUpdateValidators` requires a non-empty trimmed `nameCategory` (identical to create), unlike Product's optional-field update validators.
**Alternatives considered**: Optional field mirroring `productUpdateValidators`.
**Rationale**: These are single-field entities — a PUT without the only mutable field is a meaningless no-op. Proposal locks "validators only require non-empty trimmed name" (no length/uniqueness rules). **Flagged deviation**, low risk.

### Decision: One controller and one route module per entity

**Choice**: `CategoryApiController` + `routes/api/categories.ts`; `FranchiseApiController` + `routes/api/franchises.ts`. Controller methods `index/show/create/update/destroy`. Repos and use-cases instantiated at module scope in the route file (like `products.ts:20-39`), mounted via `router.use(...)` in `routes/api/index.ts`; `app.js:73` already mounts that at `/api`.
**Rationale**: Exact existing convention; no shared "reference data" controller exists to reuse.

## Data Flow

    DELETE /api/categories/:id
      → apiAuthMiddleware → adminGuard
      → CategoryApiController.destroy (NaN id → 400)
      → DeleteCategoryUseCase.execute(id)
      → SequelizeCategoryRepository.delete(id)
           ├─ ok → boolean → 204 / 404
           └─ ForeignKeyConstraintError → Error('Category has associated products') → 409

    POST|PUT /api/categories[/:id]
      → Create|UpdateCategoryUseCase.execute(...)
      → SequelizeCategoryRepository.create|update(...)
           └─ UniqueConstraintError → Error('DUPLICATE_CATEGORY_NAME') → 409 { error: 'DUPLICATE_CATEGORY_NAME' }

Franchise follows the identical flow with `DUPLICATE_FRANCHISE_NAME`.

Writes: `apiAuthMiddleware` → `requireRoles(Role.ADMIN, Role.STAFF)` → `*CreateValidators`/`*UpdateValidators` → `handleValidationErrors` → controller. Reads: no middleware. No multer anywhere.

## File Changes

| File (relative to `backend/src/`)                                                                                                                         | Action        | Description                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `application/use-cases/{List,GetById,Create,Update,Delete}×{Category,Franchise}` (10 files, e.g. `ListCategoriesUseCase.ts`, `GetCategoryByIdUseCase.ts`) | Create        | Use-cases per naming decision                                                                                |
| `application/dtos/FranchiseDTO.ts`                                                                                                                        | Create        | `{ idFranchise: number; nameFranchise: string }` (mirrors existing `CategoryDTO`)                            |
| `infrastructure/controllers/CategoryApiController.ts`, `FranchiseApiController.ts`                                                                        | Create/Modify | Thin controllers, `next(error)`, FK-delete mapping, and semantic duplicate-name 409 mapping                  |
| `infrastructure/routes/api/categories.ts`, `franchises.ts`                                                                                                | Create        | DI wiring + routes `/categories`, `/categories/:id`, `/franchises`, `/franchises/:id`                        |
| `infrastructure/routes/api/index.ts`                                                                                                                      | Modify        | `router.use(categoriesApiRouter); router.use(franchisesApiRouter);`                                          |
| `infrastructure/middlewares/validators/categoryValidators.ts`, `franchiseValidators.ts`                                                                   | Create        | `body('nameCategory').trim().notEmpty().withMessage(...).bail().isString()` — create and update exports      |
| `infrastructure/repositories/SequelizeCategoryRepository.ts`, `SequelizeFranchiseRepository.ts`                                                           | Modify        | Translate FK-delete `ForeignKeyConstraintError` and create/update `UniqueConstraintError` into domain errors |

## Interfaces / Contracts

```ts
// Create/Update inputs
export interface CreateCategoryInput {
  nameCategory: string;
}
export interface UpdateCategoryInput {
  nameCategory?: string;
}
// Franchise mirrors with nameFranchise.
```

| Endpoint                     | Auth         | Success             | Errors                        |
| ---------------------------- | ------------ | ------------------- | ----------------------------- |
| GET `/api/categories`        | none         | 200 `CategoryDTO[]` | —                             |
| GET `/api/categories/:id`    | none         | 200                 | 400 bad id, 404               |
| POST `/api/categories`       | ADMIN\|STAFF | 201 DTO             | 400 validation, 401/403       |
| PUT `/api/categories/:id`    | ADMIN\|STAFF | 200 DTO             | 400, 401/403, 404             |
| DELETE `/api/categories/:id` | ADMIN only   | 204                 | 400, 401/403, 404, **409 FK** |

Franchise endpoints identical under `/api/franchises`.

## Testing Strategy

| Layer       | What to Test                                                        | Approach                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | 10 use-cases (happy path, not-found, FK-error propagation)          | `application/__tests__/`, mocked ports — mirrors `DeleteProductUseCase.test.ts`                                                                                                                                   |
| Unit        | Repository FK and unique translation                                | `repositories/__tests__/` — mock Sequelize constraint errors; duplicate-update assertions preserve the original entity                                                                                            |
| Unit        | Controllers (status codes, 400 NaN guard, FK/duplicate 409 mapping) | mirrors `ProductApiController.test.ts`                                                                                                                                                                            |
| Integration | Routes + auth matrix (open reads, 401/403, 409)                     | Supertest with a stateful in-memory use-case boundary proves duplicate create leaves the collection unchanged and duplicate update leaves the target unchanged; no real DB is required for the HTTP pipeline test |

Strict TDD: tests first per slice.

## Migration / Rollout

No migration required. Additive; rollback = unmount routers in `routes/api/index.ts`.

## Open Questions

None — all proposal decisions locked.
