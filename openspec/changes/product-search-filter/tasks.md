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

- [ ] 2.1 RED: `SearchProductsUseCase.test.ts` — defaults, `offset=(page-1)*pageSize`, `totalPages` incl. `total===0→0`, blank/whitespace search→`undefined`, DTO mapping (mocked port).
- [ ] 2.2 GREEN: Create `SearchProductsUseCase.ts` (`DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=50`, `mapToProductDTO`).
- [ ] 2.3 RED: Validator tests for `searchProductsValidation` — `INVALID_PAGINATION` precedence over `INVALID_FILTER`, empty-string `idCategory`/`idFranchise` pass, page/pageSize bounds incl. `pageSize=100000` rejected.
- [ ] 2.4 GREEN: Append `searchProductsValidation` to `productValidators.ts`; widen `express-validator` import to `{ body, query }`.
- [ ] 2.5 RED: `ProductApiController.test.ts` — query parsing/defaults, 200 empty page, `next(error)` on throw.
- [ ] 2.6 GREEN: Add 8th ctor param `searchProductsUseCase` + `search` handler to `ProductApiController.ts`.
- [ ] 2.7 RED: `products.search.integration.test.ts` (Supertest) — one case per spec requirement: search/category/franchise alone and combined; case-insensitive + accent-insensitive match on both columns; literal `%`/`_` match, `'`-bearing term returns plain 200; defaults; invalid pagination/filter 400s; no matches → 200 empty; stable ordering across 2 pages; route reaches `controller.search` not `.show`.
- [ ] 2.8 GREEN: Wire `SearchProductsUseCase` in `routes/api/products.ts`, register `GET /products/search` after line 205, add `@openapi` block between `/products/latest` and `/products/{id}` until 2.7 passes.

## Phase 3: Regression Gate

- [ ] 3.1 Run existing `ListProductsUseCase`/`ProductApiController`/products-route suites unmodified — confirm all pass with zero edits.

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
