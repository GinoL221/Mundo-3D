# Exploration: Gentleman Programming alignment revalidation

## Current State

Mundo-3D remains a pragmatic modular monolith: a layered, mostly hexagonal Express backend, an Astro frontend with `auth`, `cart`, and `products` domains, and a MySQL persistence layer. The previous baseline is materially stale because four related changes are now complete.

### Remediated findings

- **Verification baseline is operational.** `backend/jest.config.js` excludes both JavaScript and TypeScript integration suites; strict backend type-checking includes the installed Supertest declarations; CI runs fast tests, coverage, type-checking, Astro validation, and the frontend build.
- **Architecture boundaries are executable.** `pnpm --filter backend architecture:check` passes. The checker resolves ESM and static CommonJS edges, classifies production/non-production files, fails closed for unresolved locals, and uses an exact composition-root allowlist. The remediation change removed the currently reported production boundary violations without relocating application behavior.
- **Category and franchise API gaps are closed.** Their routes, controllers, use cases, repositories, validation, role guards, duplicate-name conflicts, referential-integrity conflicts, and route/controller tests are present. Coverage reports both API route modules at 100% statements and lines.
- **Current quality commands pass locally.** `pnpm run test:fast` passes 83 backend suites/557 tests plus 7 frontend files/93 tests; `pnpm run type-check`, `pnpm run lint`, `pnpm run frontend:check`, and `pnpm run frontend:build` pass. The build produces 15 static pages.
- **Coverage is now an honest diagnostic.** `pnpm run test:coverage` passes the 50% global thresholds and reports 93.4% statements, 84.61% branches, 85.47% functions, and 94.3% lines. The generated risk map still reports one Tier 0 gap (`backend/src/database/migrate.js`) and 11 other gaps; this is not a license to claim complete behavioral coverage.

### Remaining gaps

- **Migration state is not fully closed.** The baseline migration and boot-time `checkNoPendingMigrations` gate exist, but the baseline explicitly documents that the live development database lacks `Product.stock` and still requires the manual `ALTER`/baseline-adoption procedure. This exploration does not execute that procedure or any live database mutation.
- **Cart behavior is technically implemented but contractually unresolved.** `PUT /api/cart` is a full replacement inside a transaction; `SyncCartUseCase` performs sequential `findById` calls and silently drops missing products; the validator permits quantities 1–99 and does not reject duplicate product IDs. The browser has a request sequence guard, but no reconciling GET and no durable idempotency key. `checkout()` clears and synchronizes the cart but does not create an order or reserve/decrement stock.
- **Catalog reads remain unbounded.** `ProductRepositoryPort.findAll()` and `ListProductsUseCase.execute()` return the complete catalog and aggregate counts in memory. The frontend fetches `/api/products` without pagination, filtering, or ordering parameters. Any scalability slice must first lock the public response and ordering contract.
- **Authentication remains a mixed model.** The API issues bearer JWTs and the frontend stores the token locally, while the workspace still declares `express-session` and RememberToken infrastructure. Consolidation requires a security/product decision, not a silent architectural rewrite.
- **Runtime resilience is absent.** `backend/index.js` fails fast during database authentication, migration, and seeding, but no liveness/readiness endpoint or graceful `SIGTERM`/`SIGINT` shutdown path is present.
- **Feature locality is partial by design.** Domain services and adapters are organized under frontend domains, but pages and Astro components still contain fetch, transformation, DOM rendering, and error handling. The architecture checker intentionally does not parse Astro internals or dynamic imports/runtime `require()` calls.
- **Documentation/configuration has residual drift.** `README.md` is substantially current, but `openspec/config.yaml` still names the former `frontend/src/store/` structure, and Jest comments retain `npm` terminology. Frontend has no lint script; `frontend:check` and build are the current static validation surfaces.

## Affected Areas

- `backend/tools/architecture/{config.js,engine.js,check.js}` and `backend/src/architecture/__tests__/architecture-boundaries.test.js` — executable boundary rules now pass; future changes must preserve their explicit limitations and allowlist discipline.
- `backend/src/infrastructure/routes/api/{categories,franchises,products,cart}.ts` and related controllers/use cases — completed CRUD/API work is evidence, not a reason to broaden the next slice into cart or catalog semantics.
- `backend/src/application/use-cases/SyncCartUseCase.ts`, `backend/src/infrastructure/repositories/SequelizeShoppingCartRepository.ts`, `backend/src/infrastructure/middlewares/validators/cartValidators.ts`, and `frontend/src/domains/cart/services/CartService.ts` — unresolved cart ordering, duplicate, quantity, reconciliation, and checkout contracts.
- `backend/src/domain/ports/ProductRepositoryPort.ts`, `ListProductsUseCase.ts`, `SequelizeProductRepository.ts`, and `frontend/src/pages/products.astro` — unbounded catalog reads and a pending pagination/filtering contract.
- `backend/index.js`, `backend/src/app.js`, and `backend/src/database/{migrator.js,checkPendingMigrations.js,migrations/20260724000000-baseline.js}` — boot fail-fast behavior is present; health/shutdown and live baseline adoption remain separate concerns.
- `backend/package.json`, `backend/jest.config.js`, `openspec/config.yaml`, `README.md`, and `.github/workflows/ci.yml` — current commands and CI evidence; only documentation/configuration drift remains in this area.
- `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/layouts/`, and `frontend/src/domains/` — partial feature locality and limited direct component/page testing.

## Approaches

1. **Documentation and specification drift correction (recommended next)** — reconcile `openspec/config.yaml`, Jest command comments, and any verified README/spec discrepancies with the current pnpm/Astro/Jest/Vitest/CI topology.
   - Pros: autonomous, no product or schema decision, small rollback boundary, and likely below the 400-line review budget; prevents future SDD work from using stale repository context.
   - Cons: does not improve runtime behavior or close the migration, cart, catalog, or authentication gaps.
   - Effort: Low.

2. **Runtime resilience slice** — add narrowly defined liveness/readiness and graceful shutdown behavior with operational tests, without changing product or schema semantics.
   - Pros: addresses a real production gap and is largely independent of cart/auth/catalog decisions.
   - Cons: readiness semantics, shutdown timeouts, and deployment expectations still need an operational contract; likely requires more than documentation-only review.
   - Effort: Medium.

3. **Cart or catalog behavior slice** — formalize cart consistency or pagination/batching and then change implementation under the new contract.
   - Pros: addresses the highest remaining user-facing correctness/scalability risks.
   - Cons: blocked by explicit product/API decisions; changing code before those decisions would create rework and could exceed the 400-line budget.
   - Effort: Medium to High.

## Recommendation

Select a bounded **documentation-and-specification drift correction** as the next autonomous change. It should update only verified stale SDD/configuration statements, preserve the passing commands and CI gates, and stay below 400 authored changed lines. Do not select the live-development portion of `schema-migrations` as autonomous work: the repository documents a real `Product.stock` mismatch that requires controlled database inspection and the explicitly prohibited ALTER/adopt-baseline operation.

After that low-risk slice, the program should prepare a product-approved cart contract before optimizing cart/catalog behavior. Runtime resilience can proceed independently once its health, readiness, and shutdown semantics are written down.

### Decisions blocking later slices

- **Cart:** source of truth for authenticated users; duplicate IDs merged or rejected; quantity ceiling (current validator 99 versus prior domain expectations); full-state replacement versus idempotency keys; retry/reconciliation behavior; and whether checkout creates an order and decrements stock.
- **Authentication:** JWT in an HttpOnly cookie, bearer JWT in localStorage, or staged compatibility; intended lifetime of legacy session routes and RememberToken; logout, rotation, and migration behavior.
- **Catalog API:** page size, stable ordering, filtering/search semantics, response envelope, and backward compatibility for the current `{ count, products, countByCategory }` response.
- **Operations and storage:** readiness guarantees, shutdown timeout policy, and whether local upload storage is acceptable for the deployment target or must move to durable object storage.
- **Schema rollout:** how the legacy development database is verified, altered, and recorded against the baseline. This is an operational gate, not a silent application-code change.

## Risks

- The architecture gate does not prove dynamic imports, constructed runtime `require()`, or Astro component internals; a green command is strong static evidence, not whole-runtime proof.
- The coverage pass still exposes a Tier 0 migration gap and 11 other gaps. Raising thresholds or adding tests solely for percentages would risk shallow verification.
- Local quality commands do not prove current MySQL integration or Playwright execution; those remain CI/service-dependent evidence and were not rerun here.
- A cart, catalog, or authentication implementation started before its public semantics are approved could break clients, persistence, or security migration compatibility.
- The live development database must not be altered or baseline-adopted as part of this exploration.

## Ready for Proposal

Yes for a narrowly scoped `documentation-and-specification-drift` change with no application behavior, schema mutation, or product decision. No for cart consistency, catalog scalability, authentication consolidation, or live `schema-migrations` adoption until the decisions and operational evidence listed above are available. No proposal, spec, design, tasks, or application code were created by this exploration.
