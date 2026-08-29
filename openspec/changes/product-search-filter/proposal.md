# Proposal: Public Catalog Search & Filter

## Intent

`frontend/src/pages/products.astro` fetches the entire catalog in one unpaginated `GET /api/products` call and offers no way to search or narrow it. Buyers must eyeball every product. We add a dedicated public, paginated search/filter endpoint plus the storefront UI to drive it — without touching the endpoint admin depends on.

## Scope

### In Scope
- New public endpoint `GET /api/products/search` — substring name search + single-select category + single-select franchise + page-based pagination, all combinable in one request.
- New port method, `SequelizeProductRepository` implementation (`findAndCountAll`), use case, page DTO, query validator, controller method, route, OpenAPI JSDoc.
- Storefront UI: search input, two dropdowns (fed by existing public `GET /categories` + `GET /franchises`), pagination controls, query-string-driven refetch.

### Out of Scope
- Any change to `GET /api/products`, `ListProductsUseCase`, `ProductRepositoryPort.findAll()`, or admin product pages. `countByCategory` stays on the old endpoint, unchanged.
- Full-text/relevance/fuzzy search, price-range filter, multi-select filters, sort-by param.

## Capabilities

### New Capabilities
- `product-catalog-search`: public paginated product search and filtering.

### Modified Capabilities
- None.

## Approach

Additive sibling endpoint, mirroring the order-history precedent (`ListOrdersUseCase` left untouched, `ListMyOrdersUseCase` added alongside).

**Settled (do not re-litigate):** separate endpoint; `countByCategory` absent from the new response (verified dead on the frontend); single-select filters; order-history pagination convention.

**Decisions resolved here:**

| # | Decision |
|---|---|
| 1 | Path `GET /api/products/search`. Safe: sibling of the existing literal `/products/latest`; no `:id` route lives under `/products/`. |
| 2 | Params `search`, `idCategory`, `idFranchise`, `page`, `pageSize` — camelCase FK names, `page`/`pageSize` verbatim from order-history. |
| 3 | Envelope `{ products, page, pageSize, total, totalPages }` — resource-named key, exactly like `MyOrdersPageDTO`'s `orders`. |
| 4 | Product-local `DEFAULT_PAGE_SIZE = 20` / `MAX_PAGE_SIZE = 50`. Same values, own constants — order-history deliberately kept its own too. |
| 5 | **Confirmed with user (2026-08-29)**: search is case-insensitive substring on **both** `name_product` and `description_product` (OR'd), not name-only. Design MUST confirm both columns' collation is `_ci` and rely on it; fall back to `LOWER(...) LIKE LOWER(?)` only if not. Widens the "no index" tradeoff (risk table below) to two full-table-scanned columns, not one — still accepted at this catalog's scale. |
| 6 | Design MUST escape `%` and `_` in the user term before building the `LIKE` pattern, and trim it; blank/whitespace-only `search` is treated as absent. |
| 7 | All params combine with AND. Deterministic `ORDER BY idProduct ASC` so pages are stable. |
| 8 | Invalid `page`/`pageSize` → 400 `{ error, code: 'INVALID_PAGINATION' }` (reused). Non-integer `idCategory`/`idFranchise` → 400 `{ error, code: 'INVALID_FILTER' }` (new — a distinct failure class). |
| 9 | No matches, or a well-formed id that matches nothing → 200 with `products: []`, `total: 0`, `totalPages: 0`. Never 404. |
| 10 | Design MUST verify whether `distinct: true` is needed: `Category`/`Franchise` are `belongsTo`, unlike order-history's `hasMany`. Do not copy it blindly. |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/domain/ports/ProductRepositoryPort.ts` | Modified | New search options + paged-result types and method; `findAll()` untouched |
| `backend/src/infrastructure/repositories/SequelizeProductRepository.ts` | Modified | New `findAndCountAll`-based method |
| `backend/src/application/use-cases/SearchProductsUseCase.ts` | New | Defaults, offset math, page DTO |
| `backend/src/infrastructure/middlewares/validators/productValidators.ts` | Modified | New `searchProductsValidation` (`{error, code}` short-circuit) |
| `backend/src/infrastructure/controllers/ProductApiController.ts` | Modified | New `search` handler reading `req.query` |
| `backend/src/infrastructure/routes/api/products.ts` | Modified | New route + OpenAPI JSDoc block |
| `frontend/src/domains/products/adapters/product.adapter.ts` | Modified | Paged-envelope type |
| `frontend/src/pages/products.astro` | Modified | Entirely new search/filter/pagination UI |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `name_product` has no index — `LIKE '%term%'` is a full table scan | High (certain) | **Accepted, deliberate tradeoff** at current small-catalog scale. Not silently assumed: a MySQL `FULLTEXT` index + `MATCH...AGAINST` is the named deferred alternative (needs a migration and changes match semantics from substring to word-boundary relevance). Revisit when catalog growth or slow-query logs justify it. |
| Frontend has zero prior art for list search/filter/pagination controls | High | Genuinely new UI. Crib `<select>` markup/CSS from the admin edit form, but the filter behaviour (an "All" empty option, query-string state, debounced input) is new and needs its own tests. |
| **400-line review budget exceeded** | High | 7 backend files + tests under strict TDD, plus a from-scratch frontend UI surface, plausibly lands at 500–700 changed lines. Chaining decision belongs to `sdd-tasks`, not here. A natural seam exists at backend-complete / frontend-consumes. |
| Unescaped `%`/`_` in the search term silently matches everything | Medium | Decision #6 makes escaping a design requirement, with a scenario in the spec. |
| Storefront regression while replacing the `products.astro` fetch | Medium | Frontend slice is additive UI over an existing grid renderer; E2E click-through per the order-history precedent. |

## Confirmed with User (2026-08-29)

- Search covers `name_product` **and** `description_product` (OR'd, both case-insensitive substring), not name-only.
- The new paginated view **replaces** `products.astro`'s current full-catalog grid entirely — no dual "old grid vs. new search view" to maintain.
- Search/filter/page state is **URL-driven** (query-string params, e.g. `?search=...&idCategory=...&page=...`) so it survives back/refresh and is shareable — not client-memory-only.

## Rollback Plan

Revert per slice. Backend: the new route/use case/port method are purely additive — deleting them restores the prior state with no schema, data, or shared-code change. Frontend: revert `products.astro` and the adapter type to the previous `GET /api/products` fetch. No migration, so no data rollback. Admin is untouched throughout, so no admin rollback exists.

## Dependencies

- Existing public `GET /categories` and `GET /franchises` (already shipped, unauthenticated, flat arrays) — no backend work needed for dropdown options.

## Success Criteria

- [ ] `GET /api/products/search` returns a correct `{ products, page, pageSize, total, totalPages }` page for search, category, and franchise filters used alone and all together.
- [ ] Case-insensitive substring matching is proven by test, and `%`/`_` in the term match literally.
- [ ] Invalid `page`/`pageSize` → 400 `INVALID_PAGINATION`; invalid filter ids → 400 `INVALID_FILTER`; no matches → 200 empty page.
- [ ] `GET /api/products`, `ListProductsUseCase`, `findAll()`, `countByCategory`, and both admin product pages are byte-for-byte unchanged, proven by their existing tests still passing untouched.
- [ ] Storefront users can search, filter, and page through the catalog, verified by an E2E click-through.
