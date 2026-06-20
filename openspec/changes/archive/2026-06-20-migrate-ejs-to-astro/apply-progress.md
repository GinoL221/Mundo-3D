# Apply Progress: Migrate EJS to Astro

## PR 1: Headless REST API

### Tasks Implemented

#### Phase 1: Express REST API
- [x] Update `src/infrastructure/middlewares/auth.ts` to validate Bearer JWT token in requests.
- [x] Update `src/infrastructure/middlewares/upload.ts` to return errors as JSON payloads instead of rendering templates.
- [x] Implement registration endpoint controller method in `src/infrastructure/controllers/UserApiController.ts`.
- [x] Add route for user registration in `src/infrastructure/routes/api/users.ts`.
- [x] Create `src/infrastructure/controllers/CartApiController.ts` for cart API requests.
- [x] Create `src/infrastructure/routes/api/cart.ts` and mount cart routes.

#### Phase 2: Express App Cleanup & CORS
- [x] Remove session, cookie-parser, CSRF middlewares, and EJS view configurations from `src/app.js`.
- [x] Configure `cors` middleware in `src/app.js` to authorize requests from Astro client.

#### Phase 3: Express Backend Test Refactoring
- [x] Refactor integration tests in `src/__tests__/` to assert against API JSON responses instead of HTML view output.

---

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| **1.1** | `src/infrastructure/middlewares/__tests__/auth.test.ts` | Unit | ✅ 16/16 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| **1.2** | `src/infrastructure/middlewares/__tests__/upload.test.ts` | Unit | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| **1.2** | `src/infrastructure/middlewares/__tests__/errorHandler.test.ts` | Unit | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| **1.3** | `src/infrastructure/controllers/__tests__/UserApiController.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Clean |
| **1.4** | Checked by route stack assertions | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| **1.5** | `src/infrastructure/controllers/__tests__/CartApiController.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Clean |
| **1.6** | `src/infrastructure/routes/api/__tests__/cart.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| **2.1** | `src/__tests__/appConfig.test.js` | Integration | ✅ 3/3 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| **2.2** | `src/__tests__/cors.test.js` | Integration | ✅ 4/4 | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Clean |
| **3.1** | `src/__tests__/apiSecurity.test.js` | Integration | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ Multiple | ✅ Clean |
| **3.1** | `src/__tests__/middlewareOrder.test.js` | Integration | ✅ 3/3 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |

### Test Summary (PR 1)
- **Total tests written**: 22 new tests / refactored assertions
- **Total tests passing**: 302 active tests passing, 10 retired test suites skipped
- **Layers used**: Unit (15), Integration (7)
- **Approval tests** (refactoring): N/A — no visual EJS rendering to preserve (EJS views retired)
- **Pure functions created**: `createUpload` fileFilter function, `SyncCartUseCase` logic, `adminGuard` route checker.

---

## PR 2: Astro Foundation & SSG

### Tasks Implemented

#### Phase 4: Astro Frontend Foundation
- [x] Bootstrap Astro project under `frontend/` directory with layout structure.
- [x] Import global Vanilla CSS styles inside `frontend/src/layouts/Layout.astro` (by copying `public/css/` to `frontend/src/styles/` and importing them).
- [x] Create static pre-rendered pages in `frontend/src/pages/`: `aboutUs.astro`, `faq.astro`, `help.astro`, `privacy.astro`, `terms.astro`, and `step-by-step.astro`.

### Build & Verification Evidence

| Step | Command | Output/Result | Safety Net / Build Check | Status |
|------|---------|---------------|--------------------------|--------|
| **4.1** | `npx create-astro@latest frontend` | Astro project bootstrapped | Setup completed | Passed ✅ |
| **4.2** | `cp -r public/css/ frontend/src/styles/` | CSS files placed locally | Styles imported in `Layout.astro` | Passed ✅ |
| **4.3** | Create pages: `aboutUs`, `faq`, `help`, `privacy`, `terms`, `step-by-step` | 6 static Astro pages created | Ported HTML from EJS templates | Passed ✅ |
| **4.4** | `npm run build` inside `frontend/` | 7 pages built (including `/`) | Astro production build output | Passed ✅ |

### Build Summary (PR 2)
- **Framework version**: Astro 6.4.6
- **Static routes generated**: `/`, `/aboutUs`, `/faq`, `/help`, `/privacy`, `/terms`, `/step-by-step`
- **Asset integration**: Global theme toggle and state hydration scripts embedded inside layouts and headers. Copying of image assets (`/img/` and `/images/`) to `frontend/public/` completed to ensure asset resolution.
