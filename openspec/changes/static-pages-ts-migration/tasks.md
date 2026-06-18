# Tasks: Static Pages TypeScript Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~370-430 (new: ~70 controller + ~70 test ≈140; routes ~25; app.js ~3; test retarget ~40 diff; deletes ~140 removed lines counted as deletions) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (controller+tests) -> PR 2 (routes+app.js wiring+parity) -> PR 3 (test retarget+legacy delete) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `StaticPagesController.ts` + unit tests, unwired | PR 1 | Base: main. New files only, nothing mounted yet, suite green. ~140-160 lines. |
| 2 | `staticPagesRoutes.ts` + `app.js` wiring + manual/HTTP parity check | PR 2 | Base: main (after PR 1 merged). ~30-40 lines. Legacy files still present (dual-mount risk - see Risks). |
| 3 | Retarget `backendLayeringPR3.test.js` + delete legacy `main/*.js`, barrel, `mainRoutes.js` | PR 3 | Base: main (after PR 2 merged). ~140-180 lines (mostly deletions). Suite green = parity proof. |

## Phase 1: Controller (PR 1)

- [x] 1.1 Create `src/infrastructure/controllers/StaticPagesController.ts`: class with constructor `(private readonly listProductsUseCase: ListProductsUseCase)`; arrow-function class properties `aboutUs`, `faq`, `help`, `privacy`, `stepByStep`, `terms` each doing `res.render('<viewName>')` only (no use-case calls) — covers spec Requirement "Pure-Render Static Page Parity" + "No domain or application layer for pure-render pages".
- [x] 1.2 In same file, implement `home = async (req, res) => {...}`: call `this.listProductsUseCase.execute()`, map `result.products` to `{ ...product, Category: { NameCategory: product.Category } }`, `res.render('index', { products })` — covers spec Requirement "Home Route Product Listing" + Decision 2 (Category adapter).
- [x] 1.3 In `home`, wrap step 1.2 in try/catch: on rejection, `console.error('Error loading homepage:', error)` then `res.render('index', { products: [] })`, do NOT call `next`/`next(error)` — covers spec Requirement "Home Degrade-to-Empty Resilience".
- [x] 1.4 Create `src/infrastructure/controllers/__tests__/StaticPagesController.test.ts` following `ProductController.test.ts`'s mock pattern (`mockListProductsUseCase = { execute: jest.fn() }`, `res = { render: jest.fn(), ... }`). One `it` per pure-render page asserting `res.render('<view>')` called with no args beyond the view name.
- [x] 1.5 In same test file, add `home` happy-path test: `mockListProductsUseCase.execute.mockResolvedValue({ count, products: [...], countByCategory })` with at least one product whose `Category` is a flat string; assert `res.render` called with `('index', { products: [{ ..., Category: { NameCategory: '<original string>' } }] })` — locks the adapter contract (design §6).
- [x] 1.6 In same test file, add `home` error-fallback test: `mockListProductsUseCase.execute.mockRejectedValue(new Error('db'))`; assert `res.render` called with `('index', { products: [] })` and assert no `next` call.
- [x] 1.7 Run the new test file in isolation; confirm all assertions pass and no existing test is broken (nothing wired yet — `StaticPagesController.ts` is unreferenced by app.js at this point).
- [x] 1.8 Commit: `feat(static-pages): add StaticPagesController with unit tests` (PR 1, base `main`).

## Phase 2: Routing and Wiring (PR 2)

- [x] 2.1 Create `src/infrastructure/routes/staticPagesRoutes.ts` mirroring `productRoutes.ts`'s DI shape: `const productRepo = new SequelizeProductRepository();`, `const controller = new StaticPagesController(new ListProductsUseCase(productRepo));`, register `GET /`, `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help` bound to the matching controller methods, `export default router`.
- [x] 2.2 In `src/app.js`, remove line 24 (`const mainRoutes = require('./routes/mainRoutes.js');`) and add `const staticPagesRoutes = require('./infrastructure/routes/staticPagesRoutes').default;` directly below the existing `require('ts-node/register')` block (alongside `productsRoutes`/`userRoutes` requires, ~line 28-29).
- [x] 2.3 In `src/app.js` line 105, replace `server.use(mainRoutes);` with `server.use(staticPagesRoutes);`, keeping its position before `server.use(userRoutes)` / `server.use(productsRoutes)` unchanged so `/` resolution order is identical.
- [x] 2.4 Run `footerPages.test.js` and confirm it passes unmodified (HTTP-level coverage for terms/privacy/faq/step-by-step/help) — covers spec Requirement "Test Suite Parity and Retargeting" (footerPages portion).
- [x] 2.5 Manually verify `/` and all 5 static pages locally (`npm run dev` or test server): confirm HTTP 200 and identical rendered view/content for `/`, `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help` — parity checkpoint before any legacy deletion, per spec Requirement "Legacy Removal After Parity Verification".
- [x] 2.6 Confirm `src/controllers/main/*.js`, barrel `index.js`, and `src/routes/mainRoutes.js` still exist on disk unchanged at this point (not yet deleted) and that `src/services/productService.js`, `src/controllers/products/getAllProducts.js`, `src/routes/productsRoutes.js` are untouched — covers spec Requirement "Out-of-Scope Boundaries".
- [x] 2.7 Commit: `feat(static-pages): wire staticPagesRoutes into app.js` (PR 2, base `main`).

**PR 2 status: COMPLETE.** `staticPagesRoutes.ts` created mirroring `productRoutes.ts` DI shape; `app.js` wired (require swapped at L24-26, mount swapped at L105). `footerPages.test.js` passed unmodified (5/5). Manual supertest parity check confirmed `/` and `/aboutUs` return HTTP 200 (ad-hoc test file, not committed — exercised and removed). Full suite: 44/44 suites green, 251 passed + 1 skipped — identical to PR 1 baseline. Legacy `main/*.js` + barrel + `mainRoutes.js` confirmed present/unchanged; out-of-scope product files confirmed untouched; `index.ejs` confirmed zero diff. See `sdd/static-pages-ts-migration/apply-progress` for full evidence.

## Phase 3: Test Retargeting and Legacy Removal (PR 3)

- [x] 3.1 In `src/__tests__/backendLayeringPR3.test.js`, replace the `Main Controller Barrel` block (current L88-92): drop `require('../../src/controllers/main')` barrel-import assertion; assert `fs.existsSync(path.join(__dirname, '../../src/controllers/main'))` is `false` and that `StaticPagesController` (imported from `src/infrastructure/controllers/StaticPagesController`) exposes `home` and `aboutUs` as functions on its prototype/instance. Keep the unrelated `old mainController.js should be deleted` test (L94-97) as-is.
- [x] 3.2 In the same file, replace the `mainRoutes.js should not use path.join for renders` test (current L133-137): assert `fs.existsSync(path.join(__dirname, '../../src/routes/mainRoutes.js'))` is `false`, and add a positive check that `src/infrastructure/routes/staticPagesRoutes.ts` exists and its content matches `/export default/`.
- [x] 3.3 In the same file, replace the `home.js should use view names not path.join` test (current L139-144): retarget `filePath` to `src/infrastructure/controllers/StaticPagesController.ts`; assert content matches `/res\.render\('index'/` and `/ListProductsUseCase/`, and assert it does NOT match `/productService/i`.
- [x] 3.4 In the same file, replace the `aboutUs.js should use view names not path.join` test (current L146-151): retarget `filePath` to `src/infrastructure/controllers/StaticPagesController.ts`; assert content matches `/res\.render\('aboutUs'/`.
- [x] 3.5 Delete `src/controllers/main/home.js`, `aboutUs.js`, `terms.js`, `privacy.js`, `faq.js`, `stepByStep.js`, `help.js`, and the barrel `src/controllers/main/index.js`.
- [x] 3.6 Delete `src/routes/mainRoutes.js`.
- [x] 3.7 Run the full test suite (`backendLayeringPR3.test.js`, `footerPages.test.js`, `StaticPagesController.test.ts`, and the rest) and confirm 100% green — this is the parity proof gate, since the new fs-existence assertions in 3.1/3.2 only pass once legacy files are gone (matches design §8 guidance to combine retarget+delete in one commit boundary).
- [x] 3.8 Confirm `src/services/productService.js`, `src/controllers/products/getAllProducts.js`, `src/routes/productsRoutes.js` still exist on disk, unchanged (final out-of-scope boundary check).
- [x] 3.9 Commit: `refactor(static-pages): retarget structural tests and remove legacy main controllers` (PR 3, base `main`).

**PR 3 status: COMPLETE.** `backendLayeringPR3.test.js` retargeted in place: barrel block now asserts `src/controllers/main` is absent and `StaticPagesController` exposes `home`/`aboutUs` as functions; mainRoutes block now asserts `mainRoutes.js` absence plus `staticPagesRoutes.ts` existence/`export default`; home/aboutUs regex blocks retarget to `StaticPagesController.ts` content. RED confirmed first (2 failing fs-existence assertions while legacy files were still present), then `src/controllers/main/*` (7 files + barrel) and `src/routes/mainRoutes.js` deleted, then GREEN confirmed (23/23 in that file). Full suite: 44/44 suites green, 253 passed + 1 skipped (254 total). Out-of-scope files (`productService.js`, `getAllProducts.js`, `productsRoutes.js`) confirmed present/unchanged.

## Phase 4: Final Verification

- [x] 4.1 Confirm `src/views/index.ejs` has zero diff (untouched) across all 3 PRs — design Decision 2 boundary.
- [x] 4.2 Run full suite once more post-merge-simulation (all 3 PRs applied in order) to confirm no regression in unrelated suites (user/auth/products).

**Phase 4 status: COMPLETE.** `git diff 9d7f394~1..HEAD -- src/views/index.ejs` returns empty — zero diff confirmed across the entire 3-PR change. Full suite re-run after Phase 3 commit: 44/44 suites green, 253 passed + 1 skipped, including `userAuth`/`adminGuard`/products suites — no regressions. **The entire `static-pages-ts-migration` change is now IMPLEMENTATION-COMPLETE — ready for `sdd-verify`.**
