# Proposal: Static Pages TypeScript Migration

## Intent
Migrate the six static/main controllers in `src/controllers/main/` and their route wiring (`src/routes/mainRoutes.js`) from plain JavaScript to TypeScript, aligned with the Hexagonal/infrastructure conventions already established in the two prior archived migrations (`clean-hexagonal-migration`, `clean-hexagonal-users-auth`).

This is **change 1 of 5** in the broader JS-to-TS/Hexagonal migration sequence (`static-pages-ts-migration` -> `cart` -> `middlewares-and-api-routes` -> `sequelize-models` -> `dead-code-cleanup`). It is intentionally the lowest-risk slice: five of the six controllers are pure render-only infrastructure with zero domain, so it establishes the migration rhythm and pays down test debt before the heavier slices land.

Success means: every route under the main controllers (`/`, `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`) behaves byte-for-byte the same at the HTTP level, the legacy `src/controllers/main/*.js` and `src/routes/mainRoutes.js` are removed in favor of TS files, `home.js` consumes the existing `ListProductsUseCase` instead of legacy `productService.js`, and the test suite is green — including updated brittle assertions and new per-controller unit tests.

## Scope
* **In Scope**:
  * New `src/infrastructure/controllers/StaticPagesController.ts` — ONE consolidated class with one method per page for the five pure-render pages (`aboutUs`, `faq`, `help`, `privacy`, `stepByStep`, `terms`).
  * New `src/infrastructure/controllers/HomeController.ts` (or a `home` method depending on the existing class layout — design phase decides placement) that depends on `ListProductsUseCase`.
  * New `src/infrastructure/routes/staticPagesRoutes.ts` replacing `src/routes/mainRoutes.js`, exported as `default` and required directly by `app.js`.
  * Migrating `home.js` to call the already-built `ListProductsUseCase` instead of legacy `productService.js`, preserving the existing degrade-to-empty resilience behavior.
  * Removing the legacy files once parity is verified: `src/controllers/main/aboutUs.js`, `faq.js`, `help.js`, `privacy.js`, `stepByStep.js`, `terms.js`, `home.js`, `index.js` (barrel), and `src/routes/mainRoutes.js`.
  * Updating `src/app.js` line ~105 to mount the new TS route file via the already-active `ts-node/register`.
  * Updating the brittle assertions in `src/__tests__/backendLayeringPR3.test.js` to point at the new TS structure.
  * Adding lightweight per-controller unit tests (mocked `res.render`) under the co-located `src/infrastructure/controllers/__tests__/*.test.ts` convention, including a test exercising `home`'s error-fallback branch.
* **Out of Scope (explicitly untouched, not deleted)**:
  * `src/services/productService.js` — STAYS as-is. It still has a live consumer in `src/controllers/api/productApiController.js` (mounted at `/api/products`, `/api/product/:id`, `/api/products/latest`). This migration only removes `home.js`'s call site, not the service.
  * `src/controllers/products/getAllProducts.js` and `src/routes/productsRoutes.js` — dead-on-disk but still referenced by `getAllProducts.test.js` / `backendLayeringPR3.test.js`. Cleanup belongs to change 5 (`dead-code-cleanup`).
  * `ListProductsUseCase` itself — already built; zero changes. Its `execute()` signature and DTO shape are already render-compatible with `views/index.ejs`.
  * Any change to `views/*.ejs`, global middleware stack, CSRF/session/helmet wiring, or API routes.
  * Normalizing the `home` resilience pattern to match `ProductController.getAllProducts`'s `next(error)` — see Decisions.

## Capabilities
* **New**: `StaticPagesController` consolidated infra controller, `staticPagesRoutes.ts` route module, co-located TS unit tests for static pages and the home error-fallback branch.
* **Modified**: `home` controller now depends on `ListProductsUseCase`; `app.js` mounts the TS route; `backendLayeringPR3.test.js` assertions retargeted to the new TS paths/structure.
* **Removed**: all `src/controllers/main/*.js` files plus the barrel, and `src/routes/mainRoutes.js`.

## Approach
The five pure-render pages have NO domain: no entities, no use-cases, no ports. Forcing `src/domain/` + `src/application/` layers on a 5-line `res.render(...)` would be ceremony with negative value. So this migration deliberately keeps them as thin infrastructure only.

1. **Infrastructure — static pages**: Create `src/infrastructure/controllers/StaticPagesController.ts` as a single class with one method per page, each performing the equivalent `res.render('<view>')`. No domain/application layers.
2. **Infrastructure — home**: `home` is the one exception with logic. It gets a real use-case dependency: `ListProductsUseCase` (already built). The controller instantiates/injects the use case following the same manual-injection pattern used in the prior migrations, calls `execute()`, and renders `index` with the resulting products. On failure it catches and renders `index` with `products: []` (resilience preserved — see Decisions).
3. **Infrastructure — routing**: Create `src/infrastructure/routes/staticPagesRoutes.ts` exporting a router as `default`, wiring the same seven paths. No shim/bridge file is needed (unlike `logout.js`): `mainRoutes.js` has no legacy callers besides `app.js`, so `app.js` requires the new TS route file directly via `ts-node/register`.
4. **Tests**: Update `backendLayeringPR3.test.js` brittle assertions in-place to reference `infrastructure/controllers/StaticPagesController.ts` and `infrastructure/routes/staticPagesRoutes.ts`. Add co-located unit tests with mocked `res.render`, including one that forces `ListProductsUseCase.execute()` to reject and asserts `home` still renders `index` with `products: []`.
5. **Cleanup**: Remove the legacy `main/*.js` controllers, barrel, and `mainRoutes.js` once parity is verified.

## Affected Areas
* `src/infrastructure/controllers/StaticPagesController.ts` (New)
* `src/infrastructure/controllers/__tests__/*.test.ts` (New)
* `src/infrastructure/routes/staticPagesRoutes.ts` (New)
* `src/controllers/main/*.js` + `index.js` barrel (Removed)
* `src/routes/mainRoutes.js` (Removed)
* `src/app.js` (Modified — mount point ~line 105)
* `src/__tests__/backendLayeringPR3.test.js` (Modified — assertions retargeted)
* `src/__tests__/footerPages.test.js` (Unchanged — HTTP-level tests should pass as-is)

## Decisions (closed — not open questions)
1. **`productService.js` is out of scope and stays untouched.** It is NOT dead code: `productApiController.js` consumes it at runtime. This change only removes `home.js`'s call site by switching to `ListProductsUseCase`. No deletion, no scope creep toward it.
2. **`StaticPagesController` is ONE consolidated class** (one method per page) rather than five standalone functions. No architectural stakes either way; this follows the explore recommendation for cohesion.
3. **`home` keeps the degrade-to-empty resilience behavior.** On `ListProductsUseCase` failure it renders `index` with `products: []`, exactly as today. It deliberately does NOT adopt the `next(error)` fail-fast pattern of `ProductController.getAllProducts`. Rationale (validated against the project's Gentleman Book reference, chapter "Arquitectura de Software", section "Manejo de Fallos Parciales" / "Resiliencia ante Fallos Externos"): degrading to a partial response when an external service fails is a deliberate resilience pattern. The homepage has a broad purpose (nav, hero, footer; products is one section), so it should fail gracefully; `/products` exists solely to list products, so failing fast there is correct. Two different page roles, two intentional UX patterns — not an inconsistency to "unify later".
4. **Brittle `backendLayeringPR3.test.js` assertions are rewritten in-place**, not dodged with compatibility shims. The barrel-import checks (~lines 88-91), the `mainRoutes.js` content check (~lines 133-137), and the `home.js`/`aboutUs.js` `fs.readFileSync` regex checks (~lines 139-151) are retargeted to the new TS structure. This is an explicit task-level deliverable; test debt is paid now, not deferred.

## Risks and Mitigation
| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| `backendLayeringPR3.test.js` assertions break on moved paths/content | High (expected) | Rewrite the assertions in-place as a planned deliverable (Decision 4). |
| Scope creep into `productService.js` / `getAllProducts.js` | Medium | Explicit Out-of-Scope statement; only `home.js`'s call site changes. |
| `home` error-fallback branch silently regresses (HTTP tests don't force a DB failure) | Medium | Add a unit test that forces `ListProductsUseCase.execute()` to reject and asserts `products: []` render. |
| Hidden SEO/meta coupling in controllers | Low | Explore confirmed clean — controllers only reference view names, no embedded meta logic. |
| `ts-node/register` not loading the TS route at mount | Low | Already active in `app.js` and proven by `infrastructure/routes/productRoutes.ts` / `userRoutes.ts`. |

## Rollback Plan
The legacy `src/controllers/main/*.js` and `src/routes/mainRoutes.js` are removed only as the final step, after parity is verified. If issues appear, restore those files and revert the `app.js` mount line to `server.use(mainRoutes)`. No data, schema, or runtime-state changes are involved, so rollback is purely file-level via git.

## Dependencies
* `ListProductsUseCase` (already built, unchanged).
* `ts-node/register` already active in `app.js`.
* `jest.config.js` already matches `**/src/**/*.test.ts` with ts-jest configured — zero config changes.

## Success Criteria
* All seven main routes return identical HTTP behavior; `footerPages.test.js` passes unchanged.
* Legacy `main/*.js` controllers, barrel, and `mainRoutes.js` removed; TS replacements in place.
* `home` renders products via `ListProductsUseCase` and still degrades to `products: []` on failure (covered by a unit test).
* `backendLayeringPR3.test.js` assertions updated and green.
* New co-located unit tests for static pages pass; full suite green.
