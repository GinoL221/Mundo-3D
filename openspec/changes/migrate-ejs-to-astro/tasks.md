# Tasks: Migrate EJS to Astro

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

## Review Workload Forecast

- **Estimated Changed Lines**: 1000+ (creates Astro frontend, deletes 21 EJS templates, modifies 10+ backend files, refactors 10+ test files)
- **400-line budget risk**: High
- **Chained PRs recommended**: Yes
- **Delivery strategy**: ask-on-risk
- **Chain strategy**: feature-branch-chain
- **Decision needed before apply**: Yes

### Proposed Work Units (PRs)
1. **PR 1: Headless REST API**: Backend routes and controllers (JWT auth, profile, cart sync) and `src/app.js` cleanup (sessions/cookies/EJS engine).
2. **PR 2: Astro Foundation & SSG**: Bootstrap Astro, base layout, Vanilla CSS integration, and static pre-rendered routes.
3. **PR 3: Astro Dynamic Logic & Cleanup**: User login/register views, products page, Nano Stores cart sync, EJS template deprecation, and test refactoring.

## Phase 1: Express REST API
- [x] Update `src/infrastructure/middlewares/auth.ts` to validate Bearer JWT token in requests.
- [x] Update `src/infrastructure/middlewares/upload.ts` to return errors as JSON payloads instead of rendering templates.
- [x] Implement registration endpoint controller method in `src/infrastructure/controllers/UserApiController.ts`.
- [x] Add route for user registration in `src/infrastructure/routes/api/users.ts`.
- [x] Create `src/infrastructure/controllers/CartApiController.ts` for cart API requests.
- [x] Create `src/infrastructure/routes/api/cart.ts` and mount cart routes.

## Phase 2: Express App Cleanup & CORS
- [x] Remove session, cookie-parser, CSRF middlewares, and EJS view configurations from `src/app.js`.
- [x] Configure `cors` middleware in `src/app.js` to authorize requests from Astro client.

## Phase 3: Express Backend Test Refactoring
- [x] Refactor integration tests in `src/__tests__/` to assert against API JSON responses instead of HTML view output.

## Phase 4: Astro Frontend Foundation
- [ ] Bootstrap Astro project under `frontend/` directory with layout structure.
- [ ] Import global Vanilla CSS styles inside `frontend/src/layouts/Layout.astro`.
- [ ] Create static pre-rendered pages in `frontend/src/pages/`: `aboutUs.astro`, `faq.astro`, `help.astro`, `privacy.astro`, `terms.astro`.

## Phase 5: Astro Frontend Dynamic Logic
- [ ] Implement login page `login.astro` and register page `register.astro` with JWT storing in `localStorage`.
- [ ] Fetch products list in frontend pages dynamically using client-side fetching from Express backend.
- [ ] Build reactive cart store in `frontend/src/store/cart.ts` via Nano Stores syncing with API.

## Phase 6: EJS Views and MVC Controller Removal
- [ ] Delete legacy controllers: `UserController.ts`, `ProductController.ts`, `CartController.ts`, `StaticPagesController.ts`.
- [ ] Remove unused routes: `staticPagesRoutes.ts`, `productRoutes.ts`, `userRoutes.ts`, `cartRoutes.ts`.
- [ ] Delete EJS files under `src/views/` and run final integration/build verification checks.
