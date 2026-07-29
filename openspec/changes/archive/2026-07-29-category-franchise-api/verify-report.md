```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2b4030e51cec1558bc5ad57f8659d6318e3df8a741ae85299d45ea02fd70ea1b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 14/14
scenarios: 36/36
test_command: pnpm --dir backend exec jest --runInBand
test_exit_code: 0
test_output_hash: sha256:2b4030e51cec1558bc5ad57f8659d6318e3df8a741ae85299d45ea02fd70ea1b
build_command: pnpm --dir backend run type-check
build_exit_code: 0
build_output_hash: sha256:8366207267355d3e3d5bf3bf6e8c94c5f93f6078c34f08973fa2b38cdda6cc92
```

## Verification Report

**Change**: category-franchise-api
**Version**: N/A
**Mode**: Standard (no `apply-progress.md` artifact tracked for this change; tasks.md treated as checklist of record per orchestrator instruction; a stale Engram apply-progress observation predating PR8 was found and is noted as a WARNING below)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 31 |
| Tasks complete | 31 |
| Tasks incomplete | 0 |
| Requirements total | 14 (7 Category + 7 Franchise) |
| Requirements fully implemented | 14 |
| Scenarios total | 36 (18 Category + 18 Franchise) |
| Scenarios compliant | 36 |
| Scenarios partial | 0 |
| Scenarios untested | 0 |

### Build & Tests Execution

**Focused Category/Franchise tests**: ✅ 18 suites passed, 101 tests passed, exit 0
Command: `pnpm --dir backend exec jest --runInBand --testPathPatterns "(Category|Franchise)"`
Output hash: `sha256:e24ca41689c632b3b76c4cbc172512b70ada8ec0b5e0f44f20bd2cbe09310e5a`

**Type check**: ✅ exit 0, zero diagnostics
Command: `pnpm --dir backend run type-check` (`tsc --noEmit`)
Output hash: `sha256:8366207267355d3e3d5bf3bf6e8c94c5f93f6078c34f08973fa2b38cdda6cc92`

**Full backend suite (MySQL 8.0 container available, integration tests included)**: ✅ 82/82 suites, 543/543 tests passed, exit 0
Command: `pnpm --dir backend exec jest --runInBand`
Output hash: `sha256:2b4030e51cec1558bc5ad57f8659d6318e3df8a741ae85299d45ea02fd70ea1b`

**Coverage (per tasks.md work-unit table command)**: ✅ exit 0, 543/543 tests passed
Command: `npx jest --coverage --runInBand` (run from `backend/`)

| Changed file | Line % | Branch % | Rating |
|--------------|--------|----------|--------|
| `application/use-cases/{List,GetById,Create,Update,Delete}CategoryUseCase.ts` (5 files) | 100 | 100 | ✅ Excellent |
| `application/use-cases/{List,GetById,Create,Update,Delete}FranchiseUseCase.ts` (5 files) | 100 | 100 | ✅ Excellent |
| `infrastructure/controllers/CategoryApiController.ts` | 100 | 100 | ✅ Excellent |
| `infrastructure/controllers/FranchiseApiController.ts` | 95.08 | 89.28 | ✅ Excellent |
| `infrastructure/repositories/SequelizeCategoryRepository.ts` | 94.11 | 83.33 | ✅ Excellent |
| `infrastructure/repositories/SequelizeFranchiseRepository.ts` | 94.11 | 83.33 | ✅ Excellent |
| `infrastructure/middlewares/validators/categoryValidators.ts` | 100 | 100 | ✅ Excellent |
| `infrastructure/middlewares/validators/franchiseValidators.ts` | 100 | 100 | ✅ Excellent |
| `infrastructure/routes/api/categories.ts` | 100 | 100 | ✅ Excellent |
| `infrastructure/routes/api/franchises.ts` | 100 | 100 | ✅ Excellent |

All changed files are far above the proposal's ≥50% coverage success criterion. Repository-wide statement coverage is 89.08%.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Category List/Get Open Reads | List all categories | `categories.test.ts > GET /api/categories > returns 200...open read` | ✅ COMPLIANT |
| Category List/Get Open Reads | Get by id | `categories.test.ts > GET /api/categories/:id > returns 200...open read` | ✅ COMPLIANT |
| Category List/Get Open Reads | Get by id not found | `categories.test.ts > returns 404 when the category does not exist` | ✅ COMPLIANT |
| Category List/Get Open Reads | Non-numeric id | `categories.test.ts > returns 400 when :id is not numeric` | ✅ COMPLIANT |
| Category Name Validation | Missing name rejected | `categories.test.ts > returns 400 when nameCategory is missing` | ✅ COMPLIANT |
| Category Name Validation | Whitespace-only rejected | `categories.test.ts > returns 400 when nameCategory is whitespace-only` | ✅ COMPLIANT |
| Category Duplicate Name Conflict | Duplicate create 409 | `categories.test.ts > returns the stable duplicate conflict for an existing category name` | ✅ COMPLIANT |
| Category Duplicate Name Conflict | Duplicate update 409 | `categories.test.ts > returns the stable duplicate conflict without updating the target category` | ✅ COMPLIANT |
| Category Duplicate Name Conflict | Unique create/update succeeds | `categories.test.ts > returns 201 for STAFF/ADMIN`, `returns 200 for STAFF/ADMIN` | ✅ COMPLIANT |
| Category Create/Update Require ADMIN/STAFF | Valid create 201 | `categories.test.ts > returns 201 for STAFF/ADMIN with a valid nameCategory` | ✅ COMPLIANT |
| Category Create/Update Require ADMIN/STAFF | Valid update 200 | `categories.test.ts > returns 200 for STAFF/ADMIN` | ✅ COMPLIANT |
| Category Create/Update Require ADMIN/STAFF | Update nonexistent 404 | `categories.test.ts > returns 404 when the category does not exist` (PUT block) | ✅ COMPLIANT |
| Category Create/Update Require ADMIN/STAFF | Unauthenticated write 401 | `categories.test.ts > returns 401 without an Authorization header` (POST+PUT) | ✅ COMPLIANT |
| Category Delete Requires ADMIN Only | Successful delete 204 | `categories.test.ts > returns 204 for ADMIN` | ✅ COMPLIANT |
| Category Delete Requires ADMIN Only | STAFF delete rejected 403 | `categories.test.ts > returns 403 for STAFF (delete is ADMIN-only)` | ✅ COMPLIANT |
| Category Delete Requires ADMIN Only | Delete nonexistent 404 | `categories.test.ts > returns 404 when the category does not exist` (DELETE block) | ✅ COMPLIANT |
| Category Delete Blocked by Referential Integrity | FK-referenced delete 409 | `categories.test.ts > returns 409 when the category is referenced by existing products` | ✅ COMPLIANT |
| Category Conflict Response Semantics | Conflict response is stable | `categories.test.ts` duplicate create/update tests assert `{ error: 'DUPLICATE_CATEGORY_NAME' }` shape | ✅ COMPLIANT |
| Franchise List/Get Open Reads | List all franchises | `franchises.test.ts > mounts through the API router and keeps reads open` | ✅ COMPLIANT |
| Franchise List/Get Open Reads | Get by id | `franchises.test.ts > gets an existing franchise and maps a missing one to 404` | ✅ COMPLIANT |
| Franchise List/Get Open Reads | Get by id not found | `franchises.test.ts > gets an existing franchise and maps a missing one to 404` | ✅ COMPLIANT |
| Franchise List/Get Open Reads | Non-numeric id | `franchises.test.ts > rejects invalid id %s without calling a use case` | ✅ COMPLIANT |
| Franchise Name Validation | Missing name rejected | `franchises.test.ts > rejects invalid franchise names before creation` (`{}` case) | ✅ COMPLIANT |
| Franchise Name Validation | Whitespace-only rejected | `franchises.test.ts > rejects invalid franchise names before creation` (`'   '` case) | ✅ COMPLIANT |
| Franchise Duplicate Name Conflict | Duplicate create 409 | `franchises.test.ts > returns the stable duplicate conflict for an existing franchise name` | ✅ COMPLIANT |
| Franchise Duplicate Name Conflict | Duplicate update 409 | `franchises.test.ts > returns the stable duplicate conflict without updating the target franchise` | ✅ COMPLIANT |
| Franchise Duplicate Name Conflict | Unique create/update succeeds | `franchises.test.ts > creates for %s`, `updates for %s and maps a missing franchise to 404` | ✅ COMPLIANT |
| Franchise Create/Update Require ADMIN/STAFF | Valid create 201 | `franchises.test.ts > creates for %s` (ADMIN/STAFF) | ✅ COMPLIANT |
| Franchise Create/Update Require ADMIN/STAFF | Valid update 200 | `franchises.test.ts > updates for %s and maps a missing franchise to 404` | ✅ COMPLIANT |
| Franchise Create/Update Require ADMIN/STAFF | Update nonexistent 404 | `franchises.test.ts > updates for %s and maps a missing franchise to 404` | ✅ COMPLIANT |
| Franchise Create/Update Require ADMIN/STAFF | Unauthenticated write 401 | `franchises.test.ts > rejects POST for %s` / `rejects PUT for %s` (missing token) | ✅ COMPLIANT |
| Franchise Delete Requires ADMIN Only | Successful delete 204 | `franchises.test.ts > deletes for ADMIN and maps missing and FK-conflict responses` | ✅ COMPLIANT |
| Franchise Delete Requires ADMIN Only | STAFF delete rejected 403 | `franchises.test.ts > rejects unauthenticated and STAFF deletes` | ✅ COMPLIANT |
| Franchise Delete Requires ADMIN Only | Delete nonexistent 404 | `franchises.test.ts > deletes for ADMIN and maps missing and FK-conflict responses` | ✅ COMPLIANT |
| Franchise Delete Blocked by Referential Integrity | FK-referenced delete 409 | `franchises.test.ts > deletes for ADMIN and maps missing and FK-conflict responses` | ✅ COMPLIANT |
| Franchise Conflict Response Semantics | Conflict response is stable | `franchises.test.ts` duplicate create/update tests assert `{ error: 'DUPLICATE_FRANCHISE_NAME' }` shape | ✅ COMPLIANT |

**Compliance summary**: 36/36 scenarios compliant; 0 partial; 0 untested; 0 failing.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| 5 use-cases per entity, mirroring Product naming | ✅ Implemented | `List/GetById/Create/Update/Delete{Category,Franchise}UseCase.ts`, 10 files, unit-tested with mocked ports. |
| `FranchiseDTO` added, mirrors `CategoryDTO` | ✅ Implemented | `application/dtos/FranchiseDTO.ts` — `{ idFranchise, nameFranchise }`. |
| Thin controllers, numeric-id 400 guard, Spanish 404/409 FK messages | ✅ Implemented | `CategoryApiController.ts`, `FranchiseApiController.ts` — `next(error)` fallback, NaN guard, FK-delete Spanish 409 body. |
| Duplicate-name 409 mapped in both repositories and controllers | ✅ Implemented | Both `Sequelize{Category,Franchise}Repository.{create,update}` catch `UniqueConstraintError` and rethrow `DUPLICATE_{CATEGORY,FRANCHISE}_NAME`; both controllers map that message to `409 { error: <code> }`. |
| FK-delete 409 mapped via `ForeignKeyConstraintError` | ✅ Implemented | Repository `delete()` catches `ForeignKeyConstraintError`, controller `destroy` catches the resulting message and returns Spanish 409 body. |
| Reads open, writes role-guarded (ADMIN\|STAFF create/update, ADMIN-only delete) | ✅ Implemented | `routes/api/categories.ts`, `routes/api/franchises.ts` wire `apiAuthMiddleware` + `requireRoles`/`adminGuard` exactly per design's Data Flow section. |
| Both routers mounted in `routes/api/index.ts` | ✅ Implemented | `router.use(categoriesApiRouter); router.use(franchisesApiRouter);` |
| Validators require non-empty trimmed name on create AND update (no length/uniqueness rule in validator layer) | ✅ Implemented | `categoryValidators.ts`, `franchiseValidators.ts` — same validator array reused for create/update. |
| List response is a plain DTO array (no wrapper) | ✅ Implemented | `ListCategoriesUseCase`/`ListFranchisesUseCase` return `Promise<{Category,Franchise}DTO[]>`; controllers `res.json(result)` directly. |
| Route naming: `/categories`, `/categories/:id`, `/franchises`, `/franchises/:id` (no Product's singular quirk) | ✅ Implemented | Confirmed in both route files. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Use-case naming/semantics mirrors Product convention (string-message errors) | ✅ Yes | `GetById` throws `Error('Category not found')`/`Error('Franchise not found')`; Update returns `DTO \| null`; Delete returns `boolean`. |
| 409-on-FK-violation implemented in repository layer only | ✅ Yes | Controllers never inspect Sequelize error types directly; only repositories import `ForeignKeyConstraintError`/`UniqueConstraintError`. |
| Unique names use semantic conflict codes (`DUPLICATE_{CATEGORY,FRANCHISE}_NAME`) | ✅ Yes | Exact codes match design; controllers map only those codes to 409, distinct from the Spanish FK-delete message. |
| List response is a plain DTO array (deviation from Product's wrapper, flagged) | ✅ Yes | Confirmed no `{count, ...}` wrapper. |
| Name required on update, not optional (deviation from Product, flagged) | ✅ Yes | Both validator files reuse the same non-empty-name rule for create and update. |
| One controller + one route module per entity | ✅ Yes | `CategoryApiController`/`categories.ts`, `FranchiseApiController`/`franchises.ts`; DI wired at module scope like `products.ts`. |
| PR7/PR8 delivery split (design-only then executable restore) | ✅ Yes | Git history confirms PR7 (#28, docs-only) then PR8 (#29, `c0e948c feat(categories,franchises): reject duplicate names with 409 conflict`) landed serially, matching `design.md`'s Delivery Split section. |

### Issues Found

**CRITICAL**:
None.

**WARNING**:
1. The Engram `sdd/category-franchise-api/apply-progress` observation (#1359) is stale: it predates PR8, reports Phase 7 as "0/6 delivered — deferred to PR8" and states "Archive remains blocked." Current `tasks.md` (source of truth per orchestrator instruction) and the merged PR8 commit (`c0e948c`) show Phase 7 fully complete and passing at runtime. No `apply-progress.md` file exists in the change folder to reconcile this — the stale Engram artifact should be refreshed or superseded before archive to avoid confusing future readers.
2. The baseline migration (`backend/src/database/migrations/20260724000000-baseline.js`) declares 5 redundant `UNIQUE KEY` entries on `name_category` (`name_category`, `name_category_2`..`_5`) and 5 on `name_franchise`, all functionally equivalent. This does not break the duplicate-name 409 behavior (MySQL still enforces uniqueness) but is untidy and outside this change's stated scope (schema-migrations work landed later on `main`); flagged for cleanup in the appropriate migration-owning change, not blocking this verification.

**SUGGESTION**:
1. Consider writing a fresh `apply-progress.md`/Engram observation (or explicitly marking the old one superseded) now that PR8 is merged, so the SDD trail for this change is self-consistent before archive.
2. The redundant unique-key duplication noted above is worth a follow-up cleanup migration, tracked separately from this change.

### Verdict
PASS WITH WARNINGS
All 14 requirements and 36 scenarios (Category + Franchise CRUD, role-guarded writes, FK-delete 409, and duplicate-name 409 for both create and update) are implemented and pass at runtime — 101/101 focused tests, 543/543 full backend suite (MySQL integration included), and a clean type-check. Warnings are limited to a stale (pre-PR8) Engram apply-progress artifact and a pre-existing, out-of-scope migration redundancy; neither affects the correctness of this change's deliverable.
