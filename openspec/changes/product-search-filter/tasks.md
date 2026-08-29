# Tasks: Public Catalog Search & Filter

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900–1200 (own bottom-up estimate, higher than design's 500–700 — see Risks) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend domain/data) → PR 2 (backend wiring/API) → PR 3 (frontend) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Port + `searchPaged` repo impl + `FakeProductRepository` stub fix, unit-tested; not yet reachable via HTTP (~105 lines) | PR 1 | `npm test -- SequelizeProductRepository` | N/A — endpoint unwired, nothing to smoke-test yet | Revert `ProductRepositoryPort.ts`, `SequelizeProductRepository.ts`, both test files; no other code references `searchPaged` |
| 2 | Use case, validator, controller, route, OpenAPI, full integration suite, regression check (~459 lines) | PR 2 | `npm test -- SearchProductsUseCase productValidators ProductApiController products.search` | `curl 'localhost:3000/api/products/search?search=goku'` against local dev server | Revert route registration, controller handler, validator block, use case file; endpoint disappears cleanly, no schema change |
| 3 | Frontend: adapter, service, presenter, `ProductSearch.astro`, `products.astro` rewrite, E2E (~651 lines) | PR 3 | `npm test -- product.search.service productSearchPresenter` | `npx playwright test e2e/tests/product-search.spec.ts` | Revert `products.astro` to prior full-catalog fetch; delete new frontend files and adapter addition |

Note: Units 2 and 3 individually still forecast above 400 lines. If the orchestrator wants every slice under budget, Unit 2 can split further at (validator+controller) vs (route+OpenAPI+integration suite), and Unit 3 at (service+presenter+their tests) vs (`ProductSearch.astro`+`products.astro`+E2E). Not pre-decided here per instruction.

## Phase 1: Backend Domain & Data Layer (Work Unit 1, PR 1)

- [x] 1.1 RED: `SequelizeProductRepository.test.ts` — assert `searchPaged` options: `Op.or` across `name_product`/`description_product`, `Op.and` combining search+idCategory+idFranchise, `%`/`_`/`\` escaped, no `distinct`, `order: [['idProduct','ASC']]`, `limit`/`offset` forwarded.
- [x] 1.2 GREEN: Add `ProductSearchOptions`, `PagedProducts`, `searchPaged()` to `ProductRepositoryPort.ts` (additive; `findAll()` untouched).
- [x] 1.3 GREEN: Fix `CreateOrderUseCase.test.ts:152` `FakeProductRepository` — add `searchPaged` stub immediately (blocks `tsc` otherwise). Also fixed two more literal-typed `jest.Mocked<ProductRepositoryPort>` mocks the design didn't flag (`CancelOrderUseCase.test.ts`, `SyncCartUseCase.test.ts`) — both broke `tsc` the same way.
- [x] 1.4 GREEN: Implement `escapeLikePattern` + `searchPaged()` in `SequelizeProductRepository.ts` (belongsTo include, no `distinct`) until 1.1 passes. Extracted `escapeLikePattern`/`buildProductSearchWhere` into new `productSearchWhere.ts` (+ its own unit test) to keep the repository file under AGENTS.md's 250-line cap (was 268 lines with both inline).

## Phase 2: Backend Wiring & API Surface (Work Unit 2, PR 2)

- [x] 2.1 RED: `SearchProductsUseCase.test.ts` — defaults, `offset=(page-1)*pageSize`, `totalPages` incl. `total===0→0`, blank/whitespace search→`undefined`, DTO mapping (mocked port).
- [x] 2.2 GREEN: Create `SearchProductsUseCase.ts` (`DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=50`, `mapToProductDTO`).
- [x] 2.3 RED: Validator tests for `searchProductsValidation` — `INVALID_PAGINATION` precedence over `INVALID_FILTER`, empty-string `idCategory`/`idFranchise` pass, page/pageSize bounds incl. `pageSize=100000` rejected.
- [x] 2.4 GREEN: Append `searchProductsValidation` to `productValidators.ts`; widen `express-validator` import to `{ body, query }`.
- [x] 2.5 RED: `ProductApiController.test.ts` — query parsing/defaults, 200 empty page, `next(error)` on throw.
- [x] 2.6 GREEN: Add 8th ctor param `searchProductsUseCase` + `search` handler to `ProductApiController.ts`.
- [x] 2.7 Supertest suite covering one case per spec requirement: search/category/franchise alone and combined; original-case term forwarded untouched (collation, not the app layer, is case-insensitive — proven live against real MySQL data via the runtime harness below); literal `%` term forwarded untouched (escaping proven at the repository-unit level in PR1's `SequelizeProductRepository.test.ts`); `'`-bearing term returns plain 200; defaults; invalid pagination/filter 400s; empty-string idCategory/idFranchise pass; no matches → 200 empty; deterministic-ordering pass-through; route reaches the page envelope not a single product. **Deviation**: named `products.search.test.ts`, not `products.search.integration.test.ts` — this repo's `jest.config.js` excludes `*.integration.test.ts` from the default mock-only `npm test` run and reserves that suffix for real-DB suites (`npm run test:integration`, see `SequelizeProductRepository.integration.test.ts`); this suite mocks `SequelizeProductRepository` at the module boundary like `orders.test.ts`/`products.test.ts` already do, so the `.integration.test.ts` suffix would have silently excluded it from `npm test`.
- [x] 2.8 GREEN: Wired `SearchProductsUseCase` in `routes/api/products.ts`, registered `GET /products/search` after `/products/latest`. **Deviation**: the `@openapi` JSDoc block was extracted into a new sibling file `routes/api/productsSearchOpenapi.ts` (still scanned by `swagger-jsdoc`'s `routes/api/*.ts` glob, no runtime wiring needed) instead of living inline in `products.ts` — inline pushed `products.ts` to 296 lines, over AGENTS.md's 250-line cap; mirrors the `productSearchWhere.ts` extraction precedent from PR1. Also added `['/products/search', 'get']` to the `EXPECTED_ENDPOINTS` golden list in `openapi/openapiSpec.test.ts` (pre-existing regression test enumerating every mounted route) — required for the pre-existing full suite to stay green, not a spec change.

## Phase 3: Regression Gate

- [x] 3.1 Ran existing `ListProductsUseCase` (3/3), `SequelizeProductRepository` incl. `findAll`/`countByCategory`/`searchPaged` (35/35), and `products.test.ts` route guard-matrix incl. `GET /api/products` (28/28) suites unmodified — all pass, zero edits to those files. Full backend suite: 110/110 suites, 918/918 tests green (was 109/917 before `EXPECTED_ENDPOINTS` update, 108/916 before this work unit). `npx tsc --noEmit` clean. `npx eslint` clean on all touched files. Admin product pages (frontend) are unaffected by construction — no frontend file touched, and `GET /api/products`/`ListProductsUseCase` are byte-for-byte unchanged (confirmed via `git diff --stat main` showing zero changes to those files).

## Phase 4: Frontend (Work Unit 3, PR 3)

- [ ] 4.1 RED: `product.search.service.test.ts` — `fetchProductSearch` URL building (omits undefined/empty, trims search), `fetchFilterOptions` success + failure-to-empty-arrays.
- [ ] 4.2 GREEN: Add `ProductSearchPage` to `product.adapter.ts`; create `product.search.service.ts`.
- [ ] 4.3 RED: `productSearchPresenter.test.ts` — `prevHref`/`nextHref` preserve active filters, null at first/last page, `isEmpty`, `pageLabel`.
- [ ] 4.4 GREEN: Create `productSearchPresenter.ts`.
- [ ] 4.5 GREEN: Create `ProductSearch.astro` — form GET, URL-driven rehydration, fetch+render via presenter, migrated card/empty/error templates, disable-empty-controls-before-submit listener.
- [ ] 4.6 GREEN: Replace `products.astro` body with `Layout` + `<ProductSearch />`; remove old inline fetch/grid logic.
- [ ] 4.7 GREEN: Re-export new modules from `domains/products/index.ts`.

## Phase 5: E2E Verification (Work Unit 3, PR 3)

- [ ] 5.1 RED: `e2e/tests/product-search.spec.ts` — type term→submit→filtered grid; pick category→narrowed; click "Siguiente" with term preserved in URL; direct navigation with query params pre-applies state.
- [ ] 5.2 GREEN: verify against 4.5/4.6 implementation until 5.1 passes.
