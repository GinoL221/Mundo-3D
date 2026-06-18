## Exploration: static-pages-ts-migration

### Current State
Six static controllers in `src/controllers/main/`: `aboutUs.js`, `faq.js`, `help.js`, `privacy.js`, `stepByStep.js`, `terms.js` — each is a 5-line function with zero params, zero logic, single `res.render('<view>')` call. No try/catch, no data. `index.js` is a pure barrel re-exporting all 7 (incl. `home`). `home.js` is the ONLY one with logic: calls `ProductService.findAll()` (legacy `src/services/productService.js`) wrapped in try/catch, falls back to `products: []` on error, renders `index` view.

Routes wired in `src/routes/mainRoutes.js`, mounted in `src/app.js` line 105 (`server.use(mainRoutes)`) — no path prefix, no middleware applied beyond global stack (helmet, cors, session, userLogged, cartCount, csrf — all global). Paths: `/`, `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`.

### CORRECTION to orchestrator's stated premise
The brief claimed `productService.js` has "zero other importers, confirmed by grep" and is fully dead code. **This is FALSE — verified by direct grep.** `productService.js` has 2 live runtime consumers:
1. `src/controllers/main/home.js` (in scope for this migration)
2. `src/controllers/api/productApiController.js` — mounted live at `/api/products`, `/api/product/:id`, `/api/products/latest` via `src/routes/api/products.js` → `src/routes/api/index.js` → mounted in `app.js` line 103 (`server.use('/api', apiRouter)`). This is OUT OF SCOPE for this migration (it's a plain-JS API controller, not a static page) and is untouched here.

A third consumer, `src/controllers/products/getAllProducts.js`, imports `ProductService` too but is reachable only through `src/routes/productsRoutes.js`, which itself is NEVER required by `app.js` (confirmed: `app.js` requires `./infrastructure/routes/productRoutes` as `productsRoutes`, NOT `./routes/productsRoutes.js`). So `src/routes/productsRoutes.js` + `getAllProducts.js` are genuinely dead-on-disk, kept only because `src/__tests__/getAllProducts.test.js` and `backendLayeringPR3.test.js` still require/assert against them directly (marked `@deprecated` in both files' header comments, explicitly "kept for legacy tests compatibility").

**Conclusion**: `productService.js` CANNOT be deleted in this change — `productApiController.js` still depends on it and is out of scope. Migrating `home.js` to use `ListProductsUseCase` is safe and recommended, but it only removes ONE of two live call sites. Full deletion of `productService.js` must wait for either (a) a future change that also migrates `productApiController.js`/the `/api/products` routes, or (b) explicit scope expansion the user has not approved. Flag this clearly in the proposal — do not silently expand scope to "kill productService.js" based on the incorrect premise.

### Domain/layering assessment
No real domain here. Five of six controllers (`aboutUs`, `faq`, `help`, `privacy`, `stepByStep`, `terms`) are pure infrastructure — render-only, no entities, no use-cases, no ports needed. Forcing `src/domain/` + `src/application/` layers on them would be pure ceremony with negative value (the prior two migrations earned hexagonal layering because Product and User/Auth had real business rules — validation, password hashing, DTO mapping, exceptions). Static pages have none of that.

Recommended approach: thin `src/infrastructure/controllers/StaticPagesController.ts` (one class, 5 methods or 5 trivial standalone functions) + `src/infrastructure/routes/staticPagesRoutes.ts`, NO domain/application layers for the 5 pure-render pages. `home.js` is the exception — it gets a real use-case dependency (`ListProductsUseCase`, already built, zero changes needed to it — verified its `execute()` signature and DTO shape are render-compatible with `views/index.ejs` expectations, same shape `ProductController.getAllProducts` already consumes for `/products`).

Bridge pattern confirmed via `src/controllers/users/logout.js` (3-line shim: `require('ts-node/register'); module.exports = require('./logout.ts');`) paired with `src/controllers/users/logout.ts` (real TS implementation, manually wires repos/hashers/use-cases, `export = logout`). Same shim approach should be used if any legacy `.js` callers need to keep requiring these controllers directly — but since `mainRoutes.js` itself will be replaced by a `.ts` route file (consistent with `infrastructure/routes/productRoutes.ts` / `userRoutes.ts` pattern, loaded via `ts-node/register` already active in `app.js`), shims are likely unnecessary here — `app.js` can just `require('./infrastructure/routes/staticPagesRoutes').default` directly, no legacy callers exist for `mainRoutes.js` itself (only `app.js` requires it).

### Test coverage found
- `src/__tests__/footerPages.test.js` — Supertest integration tests for `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`: asserts HTTP 200 + specific Spanish heading text in `res.text` for each. Does NOT test `/` (home) or `/aboutUs`. These tests hit the real Express app/EJS render — should pass unchanged through a TS migration since they test HTTP behavior, not implementation.
- `src/__tests__/backendLayeringPR3.test.js` — contains brittle file-content assertions that WILL need updating in this migration:
  - Line 88-91: `require('../../src/controllers/main')` expects `home` and `aboutUs` to be functions — barrel import path will change/disappear if controllers move to `infrastructure/controllers/`.
  - Line 139-144: reads `src/controllers/main/home.js` via `fs.readFileSync` and regex-checks for `path.join` absence and `res.render('index'` presence — will break/need rewrite if `home.js` is replaced by a `.ts` file at a different path.
  - Line 146-151: same pattern for `aboutUs.js`.
  - Line 133-137: checks `mainRoutes.js` content for absence of `path.join...views` — will need updating if `mainRoutes.js` is replaced/removed.
  These are "implementation detail" tests from a prior PR (PR3 layering cleanup) — the proposal must explicitly decide whether to update/remove these assertions or keep `mainRoutes.js`/`controllers/main/` as thin re-export shims to satisfy them without rewrite. No existing test for `faq.js`, `help.js`, `privacy.js`, `stepByStep.js`, `terms.js` content/structure beyond footerPages.test.js's HTTP-level checks.
- No unit tests exist today for any individual `main/` controller in isolation (no mocked-`res` style tests like `getAllProducts.test.js` has for products). Coverage is HTTP-integration-only via `footerPages.test.js`, plus the brittle structural checks in `backendLayeringPR3.test.js`.
- Established TS test convention (from both prior migrations): co-located `__tests__` folders inside the layer directory (`src/infrastructure/controllers/__tests__/*.test.ts`, `src/application/__tests__/*.test.ts`), NOT the flat legacy `src/__tests__/`. `jest.config.js` already matches `**/src/**/*.test.ts` via `testMatch` and transforms `.tsx?` via `ts-jest` — zero config changes needed.

### Risks
1. `backendLayeringPR3.test.js` has multiple hard-coded file-path/content assertions against `src/controllers/main/home.js`, `aboutUs.js`, and `mainRoutes.js` — must be explicitly addressed (updated or made obsolete) in tasks, or the migration will fail CI even with correct behavior.
2. Scope creep risk: orchestrator's stated premise that `productService.js` is fully dead is incorrect — must not delete it in this change; `productApiController.js` still needs it.
3. No per-controller unit tests exist for 5 of 6 static pages — migration relies on `footerPages.test.js` (HTTP-level) for behavioral parity; should add lightweight unit tests per the established pattern (mocked `res.render`) for true regression safety, especially for `home.js`'s error-fallback branch (`products: []`) which generic HTTP test won't exercise unless DB is forced to fail.
4. `home.js`'s catch-and-degrade behavior (render with empty products array instead of propagating error) differs from `ProductController.getAllProducts`'s pattern (which calls `next(error)`). Decide in proposal whether to preserve degrade-on-error (current UX: homepage still renders) or align with the `next(error)` convention used elsewhere in the hexagonal migrations. This is a product/UX decision, not just a technical one.
5. No SEO/meta-tag logic found embedded in any controller — confirmed clean, no hidden coupling beyond view names.
6. `aboutUs` is the only one of the 6 also asserted by name in `backendLayeringPR3.test.js`'s barrel-export check (line 89) alongside `home` — same risk as #1.

### Open questions for proposal phase
1. Should `productService.js` be left untouched in this change (recommended), given `productApiController.js` still depends on it?
2. Should `home.js`'s error-fallback-to-empty-array behavior be preserved as-is, or changed to `next(error)` for consistency with the Product domain controllers?
3. Should `backendLayeringPR3.test.js`'s brittle file-content assertions be updated in-place, or should the migration keep thin `.js`-named re-export shims (mirroring the `logout.js` pattern) purely to avoid touching that test file?
4. Should the 5 pure-render controllers be one consolidated `StaticPagesController` class (5 methods) or 5 standalone exported functions in one or more `.ts` files — no domain/application layers either way; this is purely an infrastructure-layer style choice with no architectural stakes.

### Ready for Proposal
Yes. This is a thin infrastructure-only slice (no domain/application layers needed for 5 of 6 controllers); only `home.js` gains a real use-case dependency (`ListProductsUseCase`, already built, no changes needed to it). The corrected `productService.js` finding and the `backendLayeringPR3.test.js` brittleness are the two findings that most need explicit decisions before/during `sdd-propose`.
