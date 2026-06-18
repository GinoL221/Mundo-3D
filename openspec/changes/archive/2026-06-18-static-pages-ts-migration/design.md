# Design: Static Pages TypeScript Migration

Technical design for change 1 of 5. Migrates the six `src/controllers/main/*.js` controllers and `src/routes/mainRoutes.js` to TypeScript infrastructure, matching the conventions of the two prior archived migrations. HTTP behavior stays identical.

## 1. Technical Approach

Five pages are pure-render infrastructure (no domain). `home` is the only one with logic; it depends on the already-built `ListProductsUseCase`. We add one consolidated controller class, one route module, retarget brittle structural tests, add co-located unit tests, then delete the legacy files. No `domain/` or `application/` code is created — those layers already exist for products.

DI follows the existing `productRoutes.ts` pattern exactly: the route file builds the repository + use case and injects them into the controller constructor. Methods are arrow-function class properties (auto-bound), matching `ProductController`.

## 2. File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/infrastructure/controllers/StaticPagesController.ts` | Create | One class. `home(req,res)` uses injected `ListProductsUseCase`, then adapts each product's flat `Category` string into the nested `{ NameCategory }` shape `index.ejs` expects, before rendering; `aboutUs/faq/help/privacy/stepByStep/terms` are one-line renders. |
| `src/infrastructure/routes/staticPagesRoutes.ts` | Create | Router building DI and binding the 7 paths; `export default router`. |
| `src/infrastructure/controllers/__tests__/StaticPagesController.test.ts` | Create | Unit tests w/ mocked `res.render` + mocked use case, incl. home error-fallback branch and the Category shape adapter. |
| `src/views/index.ejs` | Unchanged | Stays out of scope per proposal. The DTO/view shape mismatch (flat vs. nested `Category`) is resolved by an adapter in the controller, not by editing the view. See Decision 2. |
| `src/app.js` | Modify | L24 + L105: replace `mainRoutes` require/mount with the TS route module. |
| `src/__tests__/backendLayeringPR3.test.js` | Modify | Retarget barrel (L88-92), mainRoutes (L133-137), home/aboutUs fs checks (L139-151). |
| `src/controllers/main/*.js` (7) + `index.js` barrel | Delete | Replaced by the TS controller. |
| `src/routes/mainRoutes.js` | Delete | Replaced by `staticPagesRoutes.ts`. |

## 3. Interfaces / Contracts

`ListProductsUseCase.execute()` returns `{ count, products: ProductDTO[], countByCategory }`. `home` renders `index` with the `products` array, preserving keys `IDProduct/NameProduct/Price/Image`. `ProductDTO.Category` is a flat string (not nested), but `index.ejs` (out of scope, unchanged) expects `product.Category.NameCategory` — so `home` adapts the shape before rendering. Drives Decision 2.

```typescript
// StaticPagesController.ts (shape)
import { Request, Response } from 'express';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase';

export class StaticPagesController {
  constructor(private readonly listProductsUseCase: ListProductsUseCase) {}

  home = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.listProductsUseCase.execute();
      // Adapt flat ProductDTO.Category to the nested shape index.ejs expects,
      // so the out-of-scope view stays untouched (Decision 2).
      const products = result.products.map((product) => ({
        ...product,
        Category: { NameCategory: product.Category },
      }));
      res.render('index', { products });
    } catch (error) {
      console.error('Error loading homepage:', error);
      res.render('index', { products: [] }); // degrade-to-empty (Decision 1)
    }
  };

  aboutUs = (req: Request, res: Response): void => { res.render('aboutUs'); };
  // faq, help, privacy, stepByStep, terms — identical one-liners
}
```

```typescript
// staticPagesRoutes.ts (shape) — mirrors productRoutes.ts default-export DI
const router = Router();
const productRepo = new SequelizeProductRepository();
const controller = new StaticPagesController(new ListProductsUseCase(productRepo));
router.get('/', controller.home);
router.get('/aboutUs', controller.aboutUs);
router.get('/terms', controller.terms);
router.get('/privacy', controller.privacy);
router.get('/faq', controller.faq);
router.get('/step-by-step', controller.stepByStep);
router.get('/help', controller.help);
export default router;
```

`app.js` change: L24 `const mainRoutes = require('./routes/mainRoutes.js');` is removed; near L28 add `const mainRoutes = require('./infrastructure/routes/staticPagesRoutes').default;` (after `require('ts-node/register')`). L105 `server.use(mainRoutes)` is unchanged in placement (kept BEFORE userRoutes/productsRoutes so `/` resolves identically).

## 4. Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|-----------------------|-----------|
| 1. home resilience | Keep degrade-to-empty (`products: []` on failure) | `next(error)` like `/products` | Proposal Decision 3 (closed): homepage is broad-purpose, degrades gracefully; `/products` is listing-only, fails fast. |
| 2. Category shape mismatch | Adapt the DTO in `home` — map flat `Category` string into `{ NameCategory }` before rendering | (a) leave as-is (breaks: all cards fall back to 'Otras'); (b) edit `index.ejs` to read the flat string | User decided against touching `index.ejs`: the proposal explicitly lists `views/*.ejs` as out of scope. Shaping output for a specific view is normal infrastructure-controller/adapter work in Hexagonal — the mismatch is contained entirely in the new TS file already being created. |
| 3. Controller shape | One consolidated `StaticPagesController` | Five standalone functions | Proposal Decision 2 (closed); matches `ProductController` cohesion. |
| 4. DI placement | Build repo+use case in `staticPagesRoutes.ts` | Build in controller / shared container | Identical to `productRoutes.ts`; no DI framework in this codebase. |
| 5. Test debt | Rewrite brittle `backendLayeringPR3` assertions in-place | Compatibility shims | Proposal Decision 4 (closed). |

## 5. Data Flow

```
GET /            -> staticPagesRoutes -> StaticPagesController.home
                      -> ListProductsUseCase.execute() -> SequelizeProductRepository.findAll()
                      -> res.render('index', { products })   (catch -> products: [])
GET /aboutUs ... -> staticPagesRoutes -> StaticPagesController.<page> -> res.render('<view>')
```

## 6. Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `StaticPagesController` | New `StaticPagesController.test.ts`. Mock `res.render`; inject a `{ execute: jest.fn() }` fake use case (same pattern as `ProductController.test.ts`). One `it` per render-only page asserts `res.render('<view>')`. |
| Unit | home error fallback | `mockListProductsUseCase.execute.mockRejectedValue(new Error('db'))`; assert `res.render` called with `('index', { products: [] })`. (DI injection — NOT module mocking, matching existing tests.) |
| Unit | home happy path | `mockResolvedValue({ count, products, countByCategory })`; assert `res.render` was called with `index` and a `products` array where each item's `Category` is `{ NameCategory: <original flat string> }` (locks the adapter contract). |
| Structural | `backendLayeringPR3.test.js` | Retarget per §7. |
| HTTP | `footerPages.test.js` | Unchanged; must still pass (terms/privacy/faq/step-by-step/help). |

## 7. backendLayeringPR3.test.js Retargeting

Confirmed current content:
- **Barrel block, L87-98 (`Main Controller Barrel`)**: L88-92 `require('../../src/controllers/main')` and asserts `home`/`aboutUs` are functions. Rewrite: import the TS class (`require('../../src/infrastructure/controllers/StaticPagesController').StaticPagesController`) and assert `typeof StaticPagesController.prototype` / instance has `home` + `aboutUs` methods, OR assert `fs.existsSync` for `src/controllers/main/index.js` is `false`. The `mainController.js` deleted check (L94-97) stays.
- **L133-137 (`mainRoutes.js should not use path.join`)**: file is deleted -> replace with `expect(fs.existsSync('src/routes/mainRoutes.js')).toBe(false)` and a positive check that `src/infrastructure/routes/staticPagesRoutes.ts` exists and matches `/export default/`.
- **L139-144 (`home.js` fs regex)**: retarget path to `src/infrastructure/controllers/StaticPagesController.ts`; assert content matches `/res\.render\('index'/` and `/ListProductsUseCase/`; assert NOT `/productService/i`.
- **L146-151 (`aboutUs.js` fs regex)**: same target file; assert `/res\.render\('aboutUs'/`.

## 8. Migration / Rollout — Commit Sequence

`chain_strategy: stacked-to-main`, small reviewable commits matching prior migrations:

1. `feat`: add `StaticPagesController.ts` + `StaticPagesController.test.ts` (new files only; nothing wired yet — green).
2. `feat`: add `staticPagesRoutes.ts`; switch `app.js` L24/L105 to mount it. Run `footerPages.test.js` + manual `/` parity here.
3. `test`: retarget `backendLayeringPR3.test.js` assertions (still pointing at legacy paths until next step — sequence so the suite is green after step 4).
4. `refactor`: delete `src/controllers/main/*.js` + barrel + `src/routes/mainRoutes.js`. Full suite green = parity verified.

Steps 3 and 4 may be one commit if preferred, since the fs-existence assertions in step 3 only pass once the legacy files are gone. Recommended: combine 3+4 to keep the suite green at every commit boundary.

## 9. Rollback

Pure file-level git revert. No data/schema/runtime-state changes. Restore legacy files and revert `app.js` L24/L105 to roll back. `index.ejs` is never touched, so nothing to revert there.

## Open Questions

None blocking. Decision 2 (Category shape mismatch) is the only design choice beyond the proposal's 4 closed decisions; it is required for `/` visual parity and was resolved by the user as a controller-side DTO adapter, keeping `views/*.ejs` out of scope per the proposal.
