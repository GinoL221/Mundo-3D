# Design: Public Catalog Search & Filter

## Technical Approach

Additive sibling of the existing catalog endpoint, mirroring the order-history slice end to end: new port method → `findAndCountAll` repository method → paginating use case with its own constants → `{error, code}` query validator → controller handler → route + inline OpenAPI. Frontend follows the `OrderList.astro` precedent: a self-contained domain component reading `window.location.search`, backed by a unit-tested service and presenter. `GET /api/products`, `ListProductsUseCase`, `findAll()`, and `countByCategory` are not touched.

## Verified Codebase Findings

These three were open questions in the proposal. All are now answered from source, not assumed.

**1. Collation — `_ci` is confirmed in effect; no `LOWER()` needed.**
`backend/src/database/migrations/20260724000000-baseline.js:101` ends the `Product` `CREATE TABLE` with `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`. Lines 85 and 87 declare `` `name_product` varchar(255) NOT NULL `` and `` `description_product` text DEFAULT NULL `` with **no per-column `CHARACTER SET`/`COLLATE` override**, so both inherit `utf8mb4_unicode_ci`. MySQL `LIKE` is therefore already case-insensitive on both columns. The proposal's `LOWER(...) LIKE LOWER(?)` fallback is **not** taken. Side effect worth a spec scenario: `utf8mb4_unicode_ci` is also accent-insensitive, so `mascara` matches `Máscara`.

**2. `distinct: true` is NOT needed here.**
`backend/src/database/models/index.js:45,55` declare `ProductModel.belongsTo(CategoryModel, { as: 'Category' })` and `ProductModel.belongsTo(FranchiseModel, { as: 'Franchise' })`. Both are N:1, so each `Product` row joins at most one `Category` and one `Franchise` row — the join cannot multiply rows and `COUNT(*)` already equals the product count. `SequelizeOrderRepository.ts:128` needs `distinct: true` only because its include is `hasMany(OrderItem, as: 'items')` (`models/index.js:67`), which does multiply rows. Copying it would emit a needless `COUNT(DISTINCT ...)`. Omit it, with a comment stating why.

**3. No route-ordering hazard.**
`routes/api/products.ts:203-205` registers only `GET /products`, `GET /product/:id` (singular — a *separate* path), and `GET /products/latest`. `/products/:id` exists solely for PUT (`:218`), DELETE (`:229`) and PATCH (`:231`). Express matches method **and** path, so no GET route can capture `/products/search`. This is strictly safer than order-history, where `GET /orders/{id}` really did exist. Register the new route after line 205 for symmetry with `/products/latest`.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|---|---|---|---|
| 1 | Query mechanism | Sequelize `Op.like` + `Op.or`/`Op.and` via `findAndCountAll` | Raw `db.sequelize.query` with backtick-quoted identifiers | The repo's raw SQL (`SequelizeProductRepository.ts:188+`, `SequelizeOrderRepository.ts:137`) exists for **atomic guarded UPDATEs** where affected-row-count is the concurrency primitive — not for identifier quoting. `Product`, `name_product`, `description_product` are not MySQL reserved words. Raw SQL would also force a second hand-written `COUNT` query and manual row→entity mapping without `include` aliasing. Decisive: `__tests__/SequelizeProductRepository.test.ts:6-19` mocks `db`, so the ORM options object is directly assertable; a raw query would only be string-matchable. |
| 2 | Wildcard escaping | Manual escape of `\`, `%`, `_` before building the pattern | Trusting Sequelize | Sequelize parameterizes the *value* (no SQL injection) but does **not** escape LIKE wildcards — that is a semantic layer above SQL. Relies on MySQL's default `\` LIKE escape character, so no `ESCAPE` clause. |
| 3 | Port shape | Extend `ProductRepositoryPort` with `searchPaged` | New `ProductSearchPort` | Matches the order-history precedent (`findByUserId` added to `OrderRepositoryPort`) and the repo's one-port-per-aggregate convention. Cost is explicit and bounded: see Risks. |
| 4 | OpenAPI response | Inline object schema in the route JSDoc | New `ProductPage` component schema | Exactly how `/orders/mine` documents its envelope (`routes/api/orders.ts:110-119`); no schema was added to `orderOpenapiSchemas.ts` for it. Keeps the diff small. |
| 5 | Frontend state transition | Native `<form method="get" action="/products">` + `<a href>` pagination | JS `history.pushState` | `frontend/astro.config.mjs:19` is `defineConfig({})` — no `output`, no adapter, so Astro builds **static**. `Astro.url.searchParams` is a *build-time* value and must not be used. There is no `<ClientRouter/>` in the repo. A real form GET serializes controls to the query string for free; back/refresh/share work with zero JS. `orderPresenter.ts:77-78` already paginates with plain `/orders?page=N` anchors. |
| 6 | Frontend structure | New self-contained `ProductSearch.astro` domain component; `products.astro` shrinks to wiring | Keep all logic inline in `products.astro` | Mirrors `OrderList.astro` + `orders.astro` (12 lines) and keeps every file under the 250-line cap. |

## Data Flow

    products.astro  ──renders──→  ProductSearch.astro
                                        │
             (form GET → /products?search=…&idCategory=…&page=…, full reload)
                                        │
                    new URLSearchParams(window.location.search)
                                        │
                          product.search.service.ts ──fetch──→ GET /api/products/search
                          categories/franchises fetch ────────→ GET /api/categories, /api/franchises
                                        │
                          productSearchPresenter.ts (rows, pageLabel, prevHref, nextHref)
                                        │
                                  ProductCard template clones

    route → searchProductsValidation → controller.search → SearchProductsUseCase → searchPaged() → findAndCountAll

## Interfaces / Contracts

### `backend/src/domain/ports/ProductRepositoryPort.ts` (Modify — additive)

```ts
export interface ProductSearchOptions {
  search?: string;      // already trimmed by the use case; undefined when blank
  idCategory?: number;
  idFranchise?: number;
  limit: number;
  offset: number;
}

export interface PagedProducts {
  products: Product[];
  total: number;
}

// added to the interface body; findAll() and every other member unchanged:
searchPaged(options: ProductSearchOptions): Promise<PagedProducts>;
```

Named `searchPaged`, not `findAndCountAll` — the port is domain-facing and must not leak a Sequelize method name.

### `backend/src/infrastructure/repositories/SequelizeProductRepository.ts` (Modify)

Module-level, next to the existing `PRODUCT_TABLE` constants:

```ts
// Sequelize parameterizes the LIKE *value* but does not escape LIKE
// wildcards — an unescaped `%` would silently match everything. Escapes
// `\`, `%` and `_` in one pass (so the backslash case is handled before
// the wildcards it would otherwise re-escape). MySQL's default LIKE
// escape character is `\`, so no ESCAPE clause is needed.
const escapeLikePattern = (term: string): string => term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
```

```ts
async searchPaged({ search, idCategory, idFranchise, limit, offset }: ProductSearchOptions): Promise<PagedProducts> {
  const conditions: WhereOptions[] = [];

  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    conditions.push({
      [Op.or]: [
        { nameProduct: { [Op.like]: pattern } },
        { descriptionProduct: { [Op.like]: pattern } },
      ],
    });
  }
  if (idCategory !== undefined) conditions.push({ idCategory });
  if (idFranchise !== undefined) conditions.push({ idFranchise });

  const { rows, count } = await db.Product.findAndCountAll({
    where: conditions.length > 0 ? { [Op.and]: conditions } : {},
    include: [
      { model: db.Category, as: 'Category', attributes: ['idCategory', 'nameCategory'] },
      { model: db.Franchise, as: 'Franchise', attributes: ['idFranchise', 'nameFranchise'] },
    ],
    order: [['idProduct', 'ASC']],
    limit,
    offset,
    // NO `distinct: true`: unlike SequelizeOrderRepository.findByUserId's
    // hasMany `items` include, Category/Franchise are belongsTo (N:1,
    // models/index.js:45,55) — the join cannot multiply rows, so COUNT(*)
    // is already the product count.
  });

  return { products: rows.map((inst) => this.toEntity(inst)), total: count };
}
```

Emitted SQL shape: `WHERE (name_product LIKE ? OR description_product LIKE ?) AND id_category = ? AND id_franchise = ? ORDER BY id_product ASC LIMIT ? OFFSET ?`. Reuses the existing private `toEntity` — no new mapping code.

### `backend/src/application/use-cases/SearchProductsUseCase.ts` (New)

Byte-for-byte structural twin of `ListMyOrdersUseCase.ts`.

```ts
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface ProductSearchPageDTO {
  products: ProductDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchProductsInput {
  search?: string;
  idCategory?: number;
  idFranchise?: number;
  page: number;
  pageSize: number;
}

export class SearchProductsUseCase {
  constructor(private readonly productRepo: ProductRepositoryPort) {}

  async execute(input: SearchProductsInput): Promise<ProductSearchPageDTO> {
    const trimmed = input.search?.trim();
    const offset = (input.page - 1) * input.pageSize;

    const { products, total } = await this.productRepo.searchPaged({
      search: trimmed ? trimmed : undefined,   // blank/whitespace-only == absent
      idCategory: input.idCategory,
      idFranchise: input.idFranchise,
      limit: input.pageSize,
      offset,
    });

    return {
      products: products.map(mapToProductDTO),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }
}
```

`mapToProductDTO` is a new private module function producing the existing `ProductDTO` shape (`application/dtos/ProductDTO.ts`) — the same field set `ListProductsUseCase.ts:42-58` builds inline, including `category: p.Category?.nameCategory ?? 'Sin categoría'` and `stock: p.Stock ?? 0`. It is **not** extracted out of `ListProductsUseCase`, which must stay byte-for-byte unchanged (success criterion 4). Like `ListMyOrdersUseCase:25-28`, `page`/`pageSize` are trusted as HTTP-validated — no defensive clamping.

### `backend/src/infrastructure/middlewares/validators/productValidators.ts` (Modify — append)

```ts
export const searchProductsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos', code: 'INVALID_PAGINATION' });
    }
    next();
  },
  query('idCategory').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('idFranchise').optional({ values: 'falsy' }).isInt({ min: 1 }),
  (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: 'Filtro inválido', code: 'INVALID_FILTER' });
    }
    next();
  },
];
```

Two short-circuit stages, in this order, so `INVALID_PAGINATION` and `INVALID_FILTER` stay distinguishable when a request is wrong in both ways — a single `validationResult` pass could not tell them apart. `search` is deliberately unvalidated (any string is a legal search term; trimming and escaping happen downstream). `optional({ values: 'falsy' })` on the id filters makes `?idCategory=` (empty string, which a native form GET can emit) mean "no filter" rather than a 400. This file currently imports only `body` from `express-validator` (line 1) — the import must widen to `{ body, query }`, plus `Request/Response/NextFunction` from `express`, `validationResult`, and `MAX_PAGE_SIZE` from the new use case, exactly as `orderValidators.ts:1-3` does.

### `backend/src/infrastructure/controllers/ProductApiController.ts` (Modify)

New 8th constructor parameter `private readonly searchProductsUseCase: SearchProductsUseCase`, appended (all existing positions preserved). New handler, following `OrderApiController.listMine:111-122` — a read raises no domain exception, so errors go straight to `next`:

```ts
search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : DEFAULT_PAGE_SIZE;
    const result = await this.searchProductsUseCase.execute({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      idCategory: req.query.idCategory ? parseInt(req.query.idCategory as string, 10) : undefined,
      idFranchise: req.query.idFranchise ? parseInt(req.query.idFranchise as string, 10) : undefined,
      page,
      pageSize,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};
```

No 404 branch: no matches is a 200 empty page (decision #9).

### `backend/src/infrastructure/routes/api/products.ts` (Modify)

Wire `const searchProductsUseCase = new SearchProductsUseCase(productRepo);` after line 31, append it as the controller's 8th argument, and register **after line 205**:

```ts
router.get('/products/search', searchProductsValidation, controller.search);
```

Public and unauthenticated, exactly like `/products` and `/products/latest` above it. New `@openapi` block for `/products/search` inserted between the `/products/latest` and `/products/{id}` blocks (the JSDoc is path-ordered): five query params (`search` string; `idCategory`/`idFranchise` integer min 1; `page` integer min 1 default 1; `pageSize` integer min 1 max 50 default 20); `'200'` with an **inline** object schema `{ products: array of $ref Product, page, pageSize, total, totalPages }` mirroring `orders.ts:110-119`; `'400'` → `$ref: '#/components/schemas/ErrorWithCode'`, described as `INVALID_PAGINATION` or `INVALID_FILTER`. No new entry in `openapiSchemas.ts`.

### Frontend

`frontend/src/domains/products/adapters/product.adapter.ts` (Modify) — append only:

```ts
export interface ProductSearchPage {
  products: APIProduct[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

`APIProduct` already covers every field the cards render; `idCategory`/`idFranchise` are absent from it today and are not needed by the grid, so it stays unchanged otherwise.

`frontend/src/domains/products/services/product.search.service.ts` (New) — modelled on `order.service.ts:91-120`:

```ts
export interface ProductSearchCriteria {
  search?: string; idCategory?: number; idFranchise?: number; page?: number;
}
export type FetchProductSearchResult =
  | { ok: true; page: ProductSearchPage }
  | { ok: false; reason: 'network' | 'server' };

export async function fetchProductSearch(criteria: ProductSearchCriteria): Promise<FetchProductSearchResult>;
export async function fetchFilterOptions(): Promise<{ categories: FilterOption[]; franchises: FilterOption[] }>;
```

`fetchProductSearch` builds a `URLSearchParams`, setting only defined/non-empty members, and calls `${API_URL}/api/products/search?…`. `fetchFilterOptions` issues one `Promise.all` over `${API_URL}/api/categories` and `${API_URL}/api/franchises` (both public: `categories.ts:129`, `franchises.ts:124`); on failure it resolves to empty arrays so the grid still renders with the dropdowns left empty.

`frontend/src/domains/products/services/productSearchPresenter.ts` (New) — pure, unit-tested, mirroring `orderPresenter.ts:66-79`. Critically, `prevHref`/`nextHref` must **preserve the active filters**, not just `page`:

```ts
export function presentProductSearchPage(
  page: ProductSearchPage,
  criteria: ProductSearchCriteria,
): { isEmpty: boolean; pageLabel: string; prevHref: string | null; nextHref: string | null };
```

built as `/products?${new URLSearchParams({...activeCriteria, page: String(n)})}` — a plain `/products?page=2` would silently drop the user's search term.

`frontend/src/domains/products/components/ProductSearch.astro` (New) — self-contained per the domain-locality rule; imports only from this domain and `../../../config`.

```html
<form method="get" action="/products" class="product-search__form">
  <input type="search" name="search" id="product-search-input" placeholder="Buscar productos..." />
  <select name="idCategory" id="product-search-category"><option value="">Todas las categorías</option></select>
  <select name="idFranchise" id="product-search-franchise"><option value="">Todas las franquicias</option></select>
  <button type="submit">Buscar</button>
</form>
<section class="product-grid" id="product-grid-container">…</section>
<nav class="product-search__pagination">
  <a id="product-search-prev" href="#" style="display:none;">&laquo; Anterior</a>
  <span id="product-search-page-label"></span>
  <a id="product-search-next" href="#" style="display:none;">Siguiente &raquo;</a>
</nav>
```

Client `<script>` responsibilities, in order:

1. Read criteria: `const params = new URLSearchParams(window.location.search)` — the `OrderList.astro:58` pattern. `page` parses to `1` when absent or `< 1`.
2. Rehydrate the form from the URL so a shared link shows its own state: set `input.value`, and after `fetchFilterOptions()` resolves, append `<option>`s and set each `select.value` from the URL param.
3. `fetchProductSearch(criteria)` → `presentProductSearchPage` → clone `#product-card-template` into `#product-grid-container` (the existing loop from `products.astro:64-109` moves here **unchanged**, including `getCategoryImg`, `isPlaceholderImage`, the `/product?id=` link and the `img` error fallback) → `renderPagination`.
4. Empty/error states reuse the existing `#empty-state-template` / `#error-state-template` templates, moved into this component. Empty gets a "no results for this search" variant distinct from the "Próximamente" catalog-is-empty copy.
5. One `submit` listener that disables any empty-valued control immediately before submission (a disabled control is not serialized), so a plain search yields `/products?search=goku` rather than `/products?search=goku&idCategory=&idFranchise=`. There is intentionally **no** `page` control in the form, so any submit implicitly resets to page 1 — correct by construction.

No debounce and no `pushState`: submission is an explicit button/Enter press causing a real navigation.

`frontend/src/pages/products.astro` (Modify) — collapses to `Layout` + `<ProductSearch />` + `<ProductCard />`, matching `orders.astro`'s 12-line shape. The `<h1 class="sr-only">` and `<h2 class="page-heading">` stay.

`frontend/src/domains/products/index.ts` (Modify) — export the new service, presenter, and `ProductSearch` component.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/domain/ports/ProductRepositoryPort.ts` | Modify | `+ProductSearchOptions`, `+PagedProducts`, `+searchPaged()` |
| `backend/src/infrastructure/repositories/SequelizeProductRepository.ts` | Modify | `+escapeLikePattern`, `+searchPaged()` |
| `backend/src/application/use-cases/SearchProductsUseCase.ts` | Create | Constants, `mapToProductDTO`, offset/totalPages math |
| `backend/src/infrastructure/middlewares/validators/productValidators.ts` | Modify | `+searchProductsValidation` (two-stage) |
| `backend/src/infrastructure/controllers/ProductApiController.ts` | Modify | 8th ctor param, `+search` handler |
| `backend/src/infrastructure/routes/api/products.ts` | Modify | Wiring, `GET /products/search`, `@openapi` block |
| `backend/src/application/__tests__/CreateOrderUseCase.test.ts` | Modify | `FakeProductRepository:152` needs a `searchPaged` stub — see Risks |
| `frontend/src/domains/products/adapters/product.adapter.ts` | Modify | `+ProductSearchPage` |
| `frontend/src/domains/products/services/product.search.service.ts` | Create | `fetchProductSearch`, `fetchFilterOptions` |
| `frontend/src/domains/products/services/productSearchPresenter.ts` | Create | Filter-preserving prev/next hrefs |
| `frontend/src/domains/products/components/ProductSearch.astro` | Create | Form + grid + pagination, self-contained |
| `frontend/src/domains/products/index.ts` | Modify | Re-export the three new modules |
| `frontend/src/pages/products.astro` | Modify | Collapses to wiring |
| `e2e/tests/product-search.spec.ts` | Create | Click-through, per the order-history precedent |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — repository | WHERE construction: `Op.or` across both columns; each filter AND'd; `%`/`_`/`\` escaped; `order: [['idProduct','ASC']]`; **`distinct` absent**; `limit`/`offset` forwarded | Assert the options object passed to the mocked `db.Product.findAndCountAll` (`__tests__/SequelizeProductRepository.test.ts:6-19` pattern) |
| Unit — use case | Defaults, `offset = (page-1)*pageSize`, `totalPages` incl. `total === 0 → 0`, blank/whitespace `search` → `undefined`, DTO mapping | `jest.Mocked<ProductRepositoryPort>` |
| Unit — validator | `INVALID_PAGINATION` vs `INVALID_FILTER` precedence; omitted and empty-string params pass | Supertest against a minimal router |
| Unit — controller | Query parsing, 200 empty page, `next(error)` | Mocked use case |
| Unit — frontend | `fetchProductSearch` URL building (omits undefined/empty); presenter preserves filters in prev/next hrefs and nulls them at the boundaries | Vitest, `order.service.test.ts` / `orderPresenter.test.ts` shape |
| Integration | `GET /api/products/search` combinations; case-insensitive match proven; `%` matches literally | Supertest |
| Regression | `GET /api/products` unchanged | Existing `ListProductsUseCase`/`ProductApiController` tests must pass **untouched** |
| E2E | Type a term → submit → filtered grid; pick a category → narrowed; click "Siguiente" → page 2 with the term preserved in the URL | Playwright click-through (`e2e/tests/order-history.spec.ts` precedent) |

## Threat Matrix

Applicable boundary: **HTTP routing** only. No shell, subprocess, VCS/PR automation, executable-file classification, or process integration.

| Row | Status | Expected behavior / RED test |
|---|---|---|
| Route shadowing | **Applicable** | `GET /products/search` must reach `controller.search`, never `controller.show`. Verified safe by construction (no `GET /products/:id` exists), but pinned by a test asserting `/api/products/search` returns the page envelope, not a product. |
| Untrusted input reaching a query | **Applicable** | `search` is parameterized by Sequelize **and** wildcard-escaped. RED tests: `%` and `_` in the term match literally; a `'`-bearing term returns a normal 200. |
| Authorization bypass | **N/A** | Endpoint is intentionally public, like `GET /products` and `/products/latest`. No auth surface introduced. |
| Resource exhaustion | **Applicable** | `pageSize` capped at 50 by the validator; a `?pageSize=100000` request must 400, not stream the catalog. |
| Shell / subprocess / VCS / executable classification | **N/A** | No such boundary in this change. |

## Migration / Rollout

No migration required. No schema, index, or data change — the accepted full-table-scan tradeoff (proposal risk 1) is precisely what avoids one. A future `FULLTEXT` index remains the named deferred alternative.

## Risks

- **Adding `searchPaged` to the port breaks one `implements` site.** `backend/src/application/__tests__/CreateOrderUseCase.test.ts:152` declares `class FakeProductRepository implements ProductRepositoryPort` and will fail `tsc` until it gains a `searchPaged` stub (`async searchPaged() { throw new Error('not used'); }`). The `as unknown as jest.Mocked<ProductRepositoryPort>` mocks (e.g. `CreateProductUseCase.test.ts:20`) are unaffected. `SequelizeProductRepository.ts:15` is the only other `implements` site. Must be an explicit task.
- **Accent-insensitivity is inherited, not chosen.** `utf8mb4_unicode_ci` makes `mascara` match `Máscara`. Desirable for a Spanish catalog, but it is a behavior the spec should pin so a future collation change cannot silently alter it.
- **`NO_BACKSLASH_ESCAPES` `sql_mode`** would break the `\` LIKE escape. Not set in this repo's config, and unaffected by parameterized values, but noted.
- **400-line review budget: High.** 7 backend files + 5 frontend files + tests. The natural seam is backend-complete / frontend-consumes; the chaining decision belongs to `sdd-tasks`.

## Open Questions

None. All three proposal-deferred verifications (collation, `distinct`, route ordering) are resolved above from source.
