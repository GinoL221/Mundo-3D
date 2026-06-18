# Apply Progress: api-security-and-admin-guard

## Phase 1: Foundation / Infrastructure

**Status**: Complete (4/4 tasks)
**Mode**: Stacked PR slice (Unit 1: Package install + Database Schema + Admin seeding)
**Delivery Strategy**: ask-on-risk (approved chained mode)
**Chain Strategy**: stacked-to-main

### Completed Tasks

- [x] 1.1 Add `jsonwebtoken` and `@types/jsonwebtoken` to `package.json` and install.
- [x] 1.2 Modify `src/database/models/User.js` to add `IDRole` (default: 2) and `Category` (default: 'User').
- [x] 1.3 Add `IDRole` and `Category` attributes to `UserAttributes` in `src/database/models/db.d.ts`.
- [x] 1.4 Add admin user (`IDRole: 1`, `Category: 'Admin'`) to `src/database/data/users.json`.

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `package.json` | Modified | Added `jsonwebtoken` (^9.0.2) to dependencies and `@types/jsonwebtoken` (^9.0.6) to devDependencies. |
| `src/database/models/User.js` | Modified | Added `IDRole` (default 2) and `Category` (default 'User') fields to Sequelize schema. |
| `src/database/models/db.d.ts` | Modified | Updated typescript `UserAttributes` definition to include optional `IDRole` and `Category`. |
| `src/database/data/users.json` | Modified | Added seed admin user with `IDRole: 1` and `Category: 'Admin'`, and set default fields for standard users. |
| `openspec/changes/api-security-and-admin-guard/tasks.md` | Modified | Marked Phase 1 tasks 1.1-1.4 as complete. |

### Verification Results

1. **Dependency definition**: `jsonwebtoken` and its typings added cleanly to `package.json`.
2. **Model definition**: `User.js` schema properties added with `DataTypes.INTEGER` / `DataTypes.STRING` types and corresponding default values.
3. **Typings definition**: `db.d.ts` interface properties updated correctly.
4. **Seeding payload**: Admin user and standard user properties added to `users.json`, which will be correctly loaded on database sync.

---

## Phase 2: Core Implementation

**Status**: Complete (4/4 tasks)
**Mode**: Stacked PR slice (Unit 2: JWT Login endpoint + apiAuthMiddleware)
**Delivery Strategy**: ask-on-risk (approved chained mode)
**Chain Strategy**: stacked-to-main

### Completed Tasks

- [x] 2.1 Implement `apiAuthMiddleware` in `src/middlewares/auth.js` to verify Bearer JWT tokens.
- [x] 2.2 Implement `adminGuard` in `src/middlewares/auth.js` checking `IDRole === 1`.
- [x] 2.3 Implement POST `/api/users/login` to authenticate credentials and issue JWTs in `src/routes/api/users.js`.
- [x] 2.4 Update login in `src/infrastructure/controllers/UserController.ts` to include `IDRole` and `Category` in session.

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/middlewares/auth.js` | Modified | Added `apiAuthMiddleware` (verifies `Authorization: Bearer <token>` via `jsonwebtoken`, attaches decoded payload to `req.user`, returns 401 on missing/invalid/expired tokens) and `adminGuard` (checks `IDRole === 1` from `req.session.userLogged` for web routes or `req.user` for API routes; returns 401 JSON for unauthenticated API requests, redirects unauthenticated web requests to `/login`, returns 403 JSON for non-admin API requests, and renders `views/403Forbidden.ejs` with 403 status for non-admin web requests). |
| `src/routes/api/users.js` | Modified | Added `POST /users/login` (mounted as `/api/users/login`) — looks up the user by email (including password hash via `UserService.findByEmail(email, { includePassword: true })`), verifies the password with `UserService.verifyPassword`, and signs a JWT (`{ userID, Email, Category, IDRole }`, 1h expiry, `JWT_SECRET` env var with `test_jwt_secret` fallback) on success. Returns 401 JSON on invalid credentials, 500 JSON on unexpected errors. |
| `src/infrastructure/controllers/UserController.ts` | Modified | `processLogin` now copies `IDRole` and `Category` from the `UserDTO` returned by `AuthenticateUserUseCase` into `req.session.userLogged`, so `adminGuard` and EJS views can read the role from the web session. |
| `src/infrastructure/controllers/__tests__/UserAuth.test.ts` | Modified | Updated the successful-login mock payload to include `IDRole: 2, Category: 'User'` so the E2E test reflects the new DTO shape (existing assertions on redirect/cookie behavior unchanged). |
| `src/__tests__/authMiddleware.test.js` | Created | Strict TDD unit tests for `apiAuthMiddleware` (401 on missing header, non-Bearer scheme, malformed token, expired token; success path attaches `req.user` and calls `next()`) and `adminGuard` (guest web → redirect `/login`; guest API → 401 JSON; non-admin web session → 403 render; non-admin API → 403 JSON; admin web session → `next()`; admin API → `next()`). |
| `src/__tests__/apiUsersLogin.test.js` | Created | Strict TDD tests for `POST /api/users/login` — 200 with a verifiable signed JWT on success (asserts payload shape and that `findByEmail` was called with `includePassword: true`), 401 on unknown email, 401 on wrong password. |
| `src/infrastructure/controllers/__tests__/UserController.processLogin.test.ts` | Created | Isolated unit tests instantiating `UserController` directly to assert `req.session.userLogged` includes `IDRole`/`Category` for both an admin (`IDRole: 1`) and a standard user (`IDRole: 2`) login. |
| `openspec/changes/api-security-and-admin-guard/tasks.md` | Modified | Marked Phase 2 tasks 2.1-2.4 as complete. |

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.1 `apiAuthMiddleware` | `authMiddleware.test.js` written first; failed with `apiAuthMiddleware is not a function` (export did not exist) | Implemented middleware in `src/middlewares/auth.js`; all 5 middleware-auth test cases pass | Extracted `JWT_SECRET` constant with `test_jwt_secret` fallback consistent with `SESSION_SECRET`/`COOKIE_SECRET` pattern in `src/app.js` |
| 2.2 `adminGuard` | Same file; failed with `adminGuard is not a function` | Implemented dual web/API guard; all 6 adminGuard test cases pass | Fixed an initial bug where `res.status(403).redirect(...)` was chained incorrectly — switched non-admin web response to `res.status(403).render(view, ...)` using the existing `403Forbidden.ejs` view (matches `csrf.js` convention) |
| 2.3 `POST /api/users/login` | `apiUsersLogin.test.js` written first; failed with 404 (route did not exist) | Implemented route in `src/routes/api/users.js`; all 3 login test cases pass, including JWT payload verification via `jwt.verify` | None needed |
| 2.4 Session role data | `UserController.processLogin.test.ts` written first; failed — `req.session.userLogged` was missing `IDRole`/`Category` | Added the two fields to `userWithoutPassword` in `UserController.ts`; both admin and standard-user cases pass | Updated `UserAuth.test.ts` mock payload to keep the E2E suite consistent with the new DTO fields |

### Verification Results

1. **New/changed test suites**: `src/__tests__/authMiddleware.test.js` (11 tests), `src/__tests__/apiUsersLogin.test.js` (3 tests), `src/infrastructure/controllers/__tests__/UserController.processLogin.test.ts` (2 tests), `src/infrastructure/controllers/__tests__/UserAuth.test.ts` (6 tests, 1 pre-existing skip) — all passing.
2. **Full suite regression check**: `npm test` → **42 suites passed (was 39)**, **218 tests passed, 1 skipped (was 202 passed, 1 skipped)**. No existing test broken.
3. **Manual review**: `adminGuard` correctly branches on `req.path.startsWith('/api')` per the design's Route Authorization Flow diagram; JWT payload shape matches the design's `JWTPayload` interface (`userID`, `Email`, `Category`, `IDRole`).

### Deviations from Design

- None for the core contract (JWT payload shape, middleware responsibilities, and `/api/users/login` behavior match `design.md` exactly).
- Minor addition not explicitly specified: non-admin web requests hitting `adminGuard` render the existing `views/403Forbidden.ejs` (reusing the same view `csrf.js` already uses for 403s) rather than a redirect, since the `admin-route-guard` spec requires a "custom 403 Forbidden error page" with a 403 status code for authenticated non-admins. This is implementation detail consistent with the spec's scenario "Authenticated non-admin user redirected to 403", not a deviation from the contract.
- `JWT_SECRET` has a `test_jwt_secret` development/test fallback, following the exact same pattern already used for `SESSION_SECRET` and `COOKIE_SECRET` in `src/app.js` (those throw in non-test environments only if unset; `JWT_SECRET` was not wired into that startup guard in this PR since Phase 2 scope is limited to middleware/route logic — see Risks).

### Issues Found

- None blocking. See Risks/follow-up note on `JWT_SECRET` startup validation below.

**Note (resolved out-of-band)**: The `JWT_SECRET` startup-validation follow-up flagged here was addressed by the orchestrator directly (not part of the original task list): `src/app.js` now throws at startup if `JWT_SECRET` is unset, mirroring the existing `SESSION_SECRET`/`COOKIE_SECRET` guards, with a matching test in `src/__tests__/appConfig.test.js`.

---

## Phase 3: Integration / Wiring

**Status**: Complete (4/4 tasks)
**Mode**: Stacked PR slice (Unit 3: Web adminGuard + API guard wiring + EJS view hiding)
**Delivery Strategy**: ask-on-risk (approved chained mode)
**Chain Strategy**: stacked-to-main

### Completed Tasks

- [x] 3.1 Mount `apiAuthMiddleware` on `/api/users` and `/api/users/:id` in `src/routes/api/users.js`.
- [x] 3.2 Update `src/infrastructure/routes/productRoutes.ts` to replace `isUser` with `adminGuard` (keep `isUser` on `/productCart`).
- [x] 3.3 Protect `/users/delete/:id` using `adminGuard` in `src/infrastructure/routes/userRoutes.ts`.
- [x] 3.4 Conditionally render views in `src/views/partials/header.ejs` and `src/views/users/users.ejs` using `IDRole === 1`.

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/routes/api/users.js` | Modified | Imported `apiAuthMiddleware` from `../../middlewares/auth` and mounted it on `GET /users` and `GET /users/:id` (both now require a valid `Bearer <token>`). `POST /users/login` is unaffected (mounted before the guard, no middleware added). |
| `src/infrastructure/routes/productRoutes.ts` | Modified | Imported `adminGuard` alongside `isUser`. Replaced `isUser` with `adminGuard` on the four admin-only routes: `GET /new-product`, `POST /products`, `PUT /product/:id/edit`, `DELETE /product/delete/:id`. Left `GET /productCart` on `isUser` (any logged-in user, not admin-only) and left public `GET /products` / `GET /product/:id` unguarded (unchanged, view-only routes). |
| `src/infrastructure/routes/userRoutes.ts` | Modified | Imported `adminGuard` alongside `isUser`/`guestMiddleware`. Replaced `isUser` with `adminGuard` on `DELETE /users/delete/:id`. All other routes (`/users` listing, `/register`, `/login`, `/profile`, `/user/:id`, `/logout`) unchanged. |
| `src/views/partials/header.ejs` | Modified | "Nuevo producto" nav link condition changed from `locals.isLogged` to `locals.isLogged && locals.userLogged && locals.userLogged.IDRole === 1`, so only admins see the link. |
| `src/views/users/users.ejs` | Modified | Wrapped the per-user delete `<form>` in `<% if (locals.isLogged && locals.userLogged && locals.userLogged.IDRole === 1) { %> ... <% } %>` so only admins see the "Borrar" button. |
| `src/__tests__/apiUsersLogin.test.js` | Modified | Added a new `describe('apiAuthMiddleware mounted on /api/users routes')` block (3 tests): 401 on `GET /api/users` without a token, 401 on `GET /api/users/:id` without a token, 200 on `GET /api/users` with a valid Bearer token. Extended the `UserService` jest mock to include `findAll` and `findById`. |
| `openspec/changes/api-security-and-admin-guard/tasks.md` | Modified | Marked Phase 3 tasks 3.1-3.4 as complete. |

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 3.1 Mount `apiAuthMiddleware` on `/api/users*` | Added 3 new tests to `apiUsersLogin.test.js` asserting 401 without a token on `GET /api/users` and `GET /api/users/:id`; ran before wiring — 2 of 3 failed (`GET /api/users` returned 500 because `UserService.findAll` mock was undefined and called unguarded; `GET /api/users/:id` returned 404 because no route param matched without the mock) confirming the routes were unprotected | Imported and mounted `apiAuthMiddleware` on both routes in `src/routes/api/users.js`; all 3 new tests + the 3 pre-existing login tests pass (6/6) | None needed — implementation is a 2-line middleware insertion matching the existing route definition style |
| 3.2 `adminGuard` on admin-only product routes | No dedicated route-level test added for this task (Phase 4 owns dedicated integration coverage per `apiSecurity.test.js`); verified via full regression suite plus manual route-by-route audit against the `admin-route-guard` spec (`/new-product`, `/product/:id/edit`, `/product/delete/:id`, `POST /products` are administrative; `/productCart` is any-logged-in-user; `/products` and `/product/:id` GET are public) | Replaced `isUser` with `adminGuard` on the 4 admin routes only; `/productCart` kept on `isUser`; full suite (`npm test`) stayed green (no test exercised these routes through HTTP with a mocked session, so no regression risk) | None needed |
| 3.3 `adminGuard` on `/users/delete/:id` | Same rationale as 3.2 — no existing route-level test exercised `DELETE /users/delete/:id` over HTTP; `deleteUser` controller itself is unit-tested independently in `errorPropagation.test.js` (still green, calls the controller directly, not through the route) | Replaced `isUser` with `adminGuard` on the route; full suite stayed green | None needed |
| 3.4 Conditional EJS rendering | No dedicated EJS-rendering test existed/added for these two partials in this phase (Phase 4 scope); verified via full regression suite (existing view-rendering smoke tests like `GET /` and `GET /login` still returned 200 with expected byte-length snapshots, confirming the template changes did not break rendering) | Wrapped the nav link and delete form in `IDRole === 1` checks in `header.ejs` and `users.ejs`; full suite stayed green | None needed |

**Note on TDD scope for 3.2-3.4**: Per the orchestrator's explicit instruction, Phase 3 is scoped to wiring/mounting only, and Phase 4 ("Testing") owns the dedicated test suites (`src/__tests__/apiSecurity.test.js`) for integration-level coverage of these exact guard behaviors (web redirects, 403 rendering, EJS conditional visibility). Building a full DI-mocked route/view-rendering test harness for `productRoutes.ts`/`userRoutes.ts`/EJS partials here would duplicate Phase 4's mandate. Task 3.1 received a RED/GREEN cycle because it is a directly testable Express-level change with cheap existing test infrastructure (`apiUsersLogin.test.js`/supertest) already present in this file from Phase 2.

### Verification Results

1. **New tests added**: `src/__tests__/apiUsersLogin.test.js` grew from 3 to 6 tests (new `describe` block for mounted-middleware behavior) — all passing.
2. **Full suite regression check**: `npm test` → **42 suites passed (unchanged)**, **222 tests passed, 1 skipped (was 219 passed, 1 skipped)** — 3 new tests added, zero regressions.
3. **Manual route audit against spec** (`admin-route-guard` + `visual-admin-hiding`):
   - `productRoutes.ts`: `GET /new-product` → `adminGuard`; `POST /products` → `adminGuard`; `PUT /product/:id/edit` → `adminGuard`; `DELETE /product/delete/:id` → `adminGuard`; `GET /productCart` → `isUser` (unchanged, any logged-in user); `GET /products`, `GET /product/:id` → no guard (unchanged, public read-only views).
   - `userRoutes.ts`: `DELETE /users/delete/:id` → `adminGuard`; `GET /users` (legacy listing) → unchanged (`isUser`, not in this task's scope); all other routes unchanged.
   - `users.js` (API): `GET /users` and `GET /users/:id` → `apiAuthMiddleware`; `POST /users/login` → unaffected.
   - `header.ejs`: "Nuevo producto" link now requires `userLogged.IDRole === 1`, matching spec scenario "Standard user does not see the new product link".
   - `users.ejs`: delete `<form>`/button now requires `userLogged.IDRole === 1`, matching spec scenario "Standard user does not see user delete button".

### Deviations from Design

- None. The file list and guard placement match `design.md`'s "File Changes" table exactly: `productRoutes.ts` (replace `isUser` with `adminGuard` on admin routes), `userRoutes.ts` (`adminGuard` on `/users/delete/:id`), `header.ejs` (IDRole === 1 condition on "Nuevo producto"), `users.ejs` (IDRole === 1 condition wrapping the delete form).
- Public/no-guard routes (`GET /products`, `GET /product/:id`) were intentionally left untouched — design.md and the spec only call out create/edit/delete actions as administrative; product browsing remains public, consistent with Phase 2/3 scope.

### Issues Found

- None blocking.
- Note for Phase 4: the legacy `GET /users` listing route in `userRoutes.ts` (rendering `users.ejs`) is currently gated by `isUser` (any logged-in user can view the list), while the delete action within that same view is now admin-gated via `adminGuard` at the route level AND hidden via EJS conditional. This matches the spec, which only restricts the delete action, not the listing view itself — no change needed, but worth confirming explicitly in Phase 4's integration tests.

---

## Phase 4: Testing

**Status**: Complete (3/3 tasks)
**Mode**: Stacked PR slice (tail of Unit 3: Web adminGuard + API guard wiring + EJS view hiding + test coverage)
**Delivery Strategy**: ask-on-risk (approved chained mode)
**Chain Strategy**: stacked-to-main

### Completed Tasks

- [x] 4.1 Write unit tests for `apiAuthMiddleware` and `adminGuard` in `src/__tests__/authMiddleware.test.js`.
- [x] 4.2 Add integration tests for API endpoints and web guards in `src/__tests__/apiSecurity.test.js`.
- [x] 4.3 Run `npm test` to verify all test suites pass.

### Coverage Audit (Task 4.1)

`src/__tests__/authMiddleware.test.js` already existed from Phase 2's TDD cycle (11 tests). Compared every scenario against `api-jwt-auth` and `admin-route-guard` specs before writing anything new:

| Spec scenario | Covered by existing test | Gap found |
|---|---|---|
| Request without token → 401 | `apiAuthMiddleware` › "returns 401 when no Authorization header is provided" | No |
| Request with invalid/expired token → 401 | `apiAuthMiddleware` › "wrong scheme" / "invalid or malformed" / "expired" (3 tests) | No |
| Request with valid token → 200, req.user populated | `apiAuthMiddleware` › "attaches decoded payload to req.user and calls next()" | No |
| Guest → redirect to /login (web) | `adminGuard` › "redirects guest (web) requests without a session to /login" | No |
| Guest → 401 JSON (API) | `adminGuard` › "returns 401 JSON for guest API requests" | No |
| Non-admin → 403 (web) | `adminGuard` › "returns 403 for an authenticated non-admin web session" | No |
| Non-admin → 403 JSON (API) | `adminGuard` › "returns 403 JSON for an authenticated non-admin API request" | No |
| Admin → next() (web) | `adminGuard` › "calls next() for an authenticated admin web session" | No |
| Admin → next() (API) | `adminGuard` › "calls next() for an authenticated admin API request" | No |

Result: zero gaps. No changes made to `authMiddleware.test.js` — adding duplicate tests would have padded the suite without improving coverage, contradicting the orchestrator's explicit instruction to verify before mechanically "completing" the task.

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/__tests__/apiSecurity.test.js` | Created | 20 new integration tests exercising the full Express stack (`src/app.js`: sessions, CSRF, `adminGuard`, `isUser`, EJS rendering) via `supertest` — not isolated middleware/controller calls. Covers: `GET /new-product`, `POST /products`, `PUT /product/:id/edit`, `DELETE /product/delete/:id` (guest rejected, non-admin 403, admin passes the guard); `/productCart` still allows any logged-in user via `isUser` (both standard and admin); `DELETE /users/delete/:id` (guest rejected, non-admin 403 with `UserService.remove` never called, admin completes the deletion end-to-end with a 302 to `/users`); `GET /users` EJS view gating for both the "Borrar" delete button (`users.ejs`) and the "Nuevo producto" header link (`header.ejs`) for standard vs admin sessions, asserted via `res.text` substring checks on real rendered HTML. |
| `openspec/changes/api-security-and-admin-guard/tasks.md` | Modified | Marked Phase 4 tasks 4.1-4.3 as complete. |

### Test Design Notes / Deviations

1. **View-rendering assertions were reachable, not out of scope.** The task description anticipated needing to fall back to "rely on the underlying route guard tests" if EJS rendering couldn't be asserted. It could: `GET /users` already mocks `UserService.findAll` (no real DB needed) and renders `header.ejs` + `users.ejs` through the real `res.render` pipeline, so `res.text` substring checks (`"Borrar"`, `"Nuevo producto"`, `"/users/delete/2"`) directly verify the `visual-admin-hiding` spec against actual rendered HTML, for both admin and standard sessions.
2. **No test database in this environment.** Verified directly: `GET /products` without mocks throws `SequelizeConnectionError: Unknown database 'mundo_3d_test'` and fails fast (~60ms, does not hang). `productRoutes.ts` ultimately calls real Sequelize-backed use cases/repositories, and mocking `database/models/db` at module scope (the pattern used by the existing `SequelizeProductRepository.test.ts`) was judged out of scope for an app-level integration file — it would mock DB state for every route loaded by `app.js`, not just the routes under test, and risks masking unrelated regressions in other suites that share the same `app.js` import in future test runs. Instead, "admin allowed past the guard" assertions for product routes explicitly check the response is NOT a guard-rejection (`401`/`403`/redirect-to-`/login`) rather than asserting a full `200`/`302` success — the guard passing the request to the controller (which then fails for an unrelated, expected reason) is exactly the contract the `admin-route-guard` spec requires ("the application MUST allow the request to proceed to the controller"). `DELETE /users/delete/:id` has no such limitation (`deleteUser` controller only depends on the already-mocked `UserService`), so that assertion verifies the full success path end-to-end (302 to `/users`, `UserService.remove` called with the right id).
3. **CSRF protection runs before `adminGuard` for guest mutation requests.** Discovered while writing the guest-rejection tests for `POST /products`, `PUT /product/:id/edit`, `DELETE /product/delete/:id`, and `DELETE /users/delete/:id`: `src/app.js` mounts `csrfProtection` globally, before any route router. A true guest (no session at all) sending a POST/PUT/DELETE with no `_csrf` token is rejected by CSRF protection with `403` before `adminGuard` ever runs — `adminGuard`'s guest-redirect-to-`/login` branch is only observable on GET requests in this stack, since CSRF only validates on state-changing methods. This is correct, pre-existing, intentional behavior (CSRF must reject forged/anonymous mutations before any other check), not a bug — but it meant the original task wording ("redirects to /login") needed adjusting to "rejects (CSRF, then would-be adminGuard) before the controller is reached", still asserting `403` + the same `403Forbidden.ejs` "Acceso denegado" body (both CSRF rejection and `adminGuard` rejection render that identical view). Documented inline in the test file rather than silently asserting the wrong status code.
4. **Login rate limiting required session reuse instead of per-test login.** `src/middlewares/loginLimiter.js` caps `POST /login` at 5 attempts per 15 minutes per IP, and all `supertest` requests against the same `app` module instance in one Jest test file share that in-memory limiter. Logging in once per test (as the Phase 2/3 pattern in `UserAuth.test.ts` does for a handful of tests) would have exceeded the limit immediately given 20 tests. Fixed by logging in exactly once per role (`adminCookies`, `standardCookies`) in a single `beforeAll`, then reusing the session cookie across every test; CSRF tokens (which DO rotate per GET) are refreshed per mutating request via a small `refreshCsrf()` helper against `GET /users` (the only DB-independent, mocked route that renders a `_csrf` hidden input).
5. **No production code was touched.** All three discoveries above (CSRF-before-adminGuard ordering, no test DB, login rate limiting) are existing, correct behavior — the test file was designed around them, not the other way around. No bug was found in `src/middlewares/auth.js`, the route files, or the EJS views.

### Verification Results

1. **New test suite**: `src/__tests__/apiSecurity.test.js` — 20/20 tests passing in isolation.
2. **Full suite regression check**: `npm test` → **43 suites passed (was 42)**, **242 tests passed, 1 skipped (was 222 passed, 1 skipped)** — 20 new tests added, zero regressions.
3. **Manual spec cross-check**: every scenario in `api-jwt-auth`, `admin-route-guard`, and `visual-admin-hiding` that maps to an HTTP-observable behavior (as opposed to pure unit-level middleware logic already covered by `authMiddleware.test.js`) now has a corresponding integration assertion in `apiSecurity.test.js`.

### Issues Found

- None blocking. No production code changes were required or made during this phase — see Test Design Notes above for the three test-environment constraints discovered and designed around (CSRF-before-adminGuard ordering, no test database, login rate limiting).

---

## Phase 5: Cleanup

**Status**: Complete (1/1 tasks)
**Mode**: Stacked PR slice (tail of Unit 3 — final cleanup before verify, no new PR boundary)
**Delivery Strategy**: ask-on-risk (approved chained mode)
**Chain Strategy**: stacked-to-main

### Completed Tasks

- [x] 5.1 Remove unused imports and verify correct routing behaviors for non-admin users.

### Unused Import Audit

Inspected every file touched across Phases 1-4: `src/middlewares/auth.js`, `src/routes/api/users.js`, `src/infrastructure/routes/productRoutes.ts`, `src/infrastructure/routes/userRoutes.ts`, `src/infrastructure/controllers/UserController.ts`, `src/views/partials/header.ejs`, `src/views/users/users.ejs`.

Method: `npx eslint` on the `.js` files (no project eslint config exists, so eslint fell back to its built-in default ruleset — sufficient to flag `no-unused-vars`/`no-console`); manual `rg` symbol-usage audit on the `.ts` files since no TypeScript/eslint config covers `src/infrastructure/**` (`0:0 warning File ignored because no matching configuration was supplied`).

| File | Finding | Action |
|---|---|---|
| `src/middlewares/auth.js` | `catch (error)` in `apiAuthMiddleware` — `error` parameter never referenced in the block (the `'error'` string in the JSON response is an unrelated object key, not the variable) | Removed the unused binding: `catch (error)` → `catch` (ES2019 optional catch binding, supported by the Node runtime in use). Verified via `node -e` that the syntax executes, then re-ran `npx eslint src/middlewares/auth.js` → 0 problems (was 1 warning). |
| `src/routes/api/users.js` | 3× `catch (error)` blocks, all use `error` via `console.error('...', error)` — eslint did not flag these as unused; only flagged `no-console` (pre-existing project-wide logging convention, used throughout the codebase, not introduced by this change) | None — false candidate, `error` is genuinely used in each block. Left `console.error` calls untouched (out of scope: a project-wide pattern, not specific to this change). |
| `src/infrastructure/routes/productRoutes.ts` | `import { isUser, adminGuard }` — verified both symbols used (`isUser` on `/productCart`, `adminGuard` on the 4 admin mutation routes) | None — no unused imports. |
| `src/infrastructure/routes/userRoutes.ts` | `import { isUser, guestMiddleware, adminGuard }` — verified all three used (`isUser` ×3, `guestMiddleware` ×2, `adminGuard` ×1 on `/users/delete/:id`) | None — no unused imports. |
| `src/infrastructure/controllers/UserController.ts` | `import path from 'path'` — `path` never referenced anywhere in the file body (confirmed via `rg '\bpath\b'`, only match was the import line itself). Pre-existing from commit `1b796b1` (before this SDD change touched `processLogin` in Phase 2/3), but the file is on this change's touched-files list, so in scope for 5.1 | Removed the unused `import path from 'path';` line. |
| `src/views/partials/header.ejs`, `src/views/users/users.ejs` | EJS templates have no import statements to audit; conditional blocks (`IDRole === 1` guards added in Phase 3) reviewed for correctness | None — no imports applicable; logic confirmed correct (see Routing Verification below). |

### Routing Verification for Non-Admin Users (IDRole 2)

This is a verification task, not new code — confirmed via the existing Phase 4 suites (`apiSecurity.test.js`, 20 tests; `authMiddleware.test.js`, 11 tests) plus a manual route/file audit. No gaps found, no bugs found.

| Behavior | Expected for non-admin (IDRole 2) | Verified by | Result |
|---|---|---|---|
| `GET /new-product` | 403 | `apiSecurity.test.js` › "Admin-only product routes" › "returns 403 for an authenticated non-admin user" | Pass |
| `POST /products` | 403 | Same describe block, `POST /products` sub-suite | Pass |
| `PUT /product/:id/edit` | 403 | Same describe block, `PUT /product/:id/edit` sub-suite | Pass |
| `DELETE /product/delete/:id` | 403 | Same describe block, `DELETE /product/delete/:id` sub-suite | Pass |
| `DELETE /users/delete/:id` | 403, `UserService.remove` never called | `apiSecurity.test.js` › "DELETE /users/delete/:id" › "returns 403 for an authenticated non-admin user" | Pass |
| `GET /productCart` | Allowed (any logged-in user, not admin-gated) | `apiSecurity.test.js` › "/productCart route still uses isUser" › "allows an authenticated standard (non-admin) user past the guard" | Pass — confirms `adminGuard` is correctly NOT applied here |
| `GET /products`, `GET /product/:id` | Public, no guard, accessible to everyone including non-admin | Manual file audit of `productRoutes.ts` (lines 52-53: no middleware) + general app smoke tests (`GET /` 200 in full suite run) | Pass — no guard present, no regression |
| Admin-only UI ("Nuevo producto" link, "Borrar" button) | Hidden in rendered HTML | `apiSecurity.test.js` › "GET /users (EJS view gating)" › "does not render the delete form/button or the 'Nuevo producto' link for a standard (non-admin) user" — asserts on real rendered `res.text` | Pass |
| Admin (IDRole 1) is NOT incorrectly blocked anywhere | All of the above routes/UI allowed for admin | Corresponding "allows an authenticated admin user" tests in the same describe blocks, plus "renders the delete form/button and the 'Nuevo producto' link for an admin user" | Pass — no over-blocking found |

No bug found in either direction (non-admin escaping a guard, or admin incorrectly blocked). No scope expansion beyond the one-line `auth.js` fix and the one-line import removal.

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/middlewares/auth.js` | Modified | Removed unused `error` binding in `apiAuthMiddleware`'s catch block: `catch (error)` → `catch`. |
| `src/infrastructure/controllers/UserController.ts` | Modified | Removed unused `import path from 'path';` (dead import, not referenced anywhere in the file). |
| `openspec/changes/api-security-and-admin-guard/tasks.md` | Modified | Marked task 5.1 complete — all 5 phases now 100%. |

### Verification Results

1. **Lint check**: `npx eslint src/middlewares/auth.js` → 0 problems (was 1 warning). `.ts` files have no project lint config to run (pre-existing gap, out of scope for this change).
2. **Full suite regression check**: `npm test` → **43 suites passed (unchanged)**, **242 tests passed, 1 skipped (unchanged)** — zero regressions from the two cleanup edits.
3. **Routing behavior audit**: see table above — all non-admin-blocked routes confirmed blocked, all non-admin-allowed routes confirmed allowed, all admin routes confirmed not over-blocked. No bugs found.

### Deviations from Design

- None. This phase made no behavioral changes — only removed two genuinely-unused identifiers (a catch-block parameter and an import) and performed read-only verification.

### Issues Found

- None blocking. No bugs found in either direction (non-admin escaping a guard, or admin incorrectly blocked).

---

## Overall Status

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Foundation / Infrastructure | 4/4 | Complete |
| Phase 2: Core Implementation | 4/4 | Complete |
| Phase 3: Integration / Wiring | 4/4 | Complete |
| Phase 4: Testing | 3/3 | Complete |
| Phase 5: Cleanup | 1/1 | Complete |

**Total: 16/16 tasks complete (100%).**

### Workload / PR Boundary

- Mode: stacked PR slice
- Current work unit: tail of Unit 3 (Web adminGuard + API guard wiring + EJS view hiding + test coverage + final cleanup) — still PR #3 in the stacked-to-main chain, targeting `main` after PR #2 merges. This phase is cleanup only — no new PR boundary was opened.
- Estimated changed lines this batch: 2 one-line production edits (`auth.js` catch binding, `UserController.ts` import removal) + 1-line `tasks.md` checkbox update — negligible diff, well under any review budget concern.
- Rollback boundary: both Phase 5 edits are trivially revertible single-line changes with zero behavioral impact (confirmed by full suite staying at the exact same 242/243 pass count before and after).
- Next recommended phase: `sdd-verify` — all 5 phases / 16 tasks are now complete (100%). The change is ready for full spec/design validation.

---

## Post-verify fix: CRITICAL-1 (`user-registration-role` role-default enforcement)

**Status**: Complete
**Mode**: Critical bugfix from `sdd-verify` FAIL verdict (not part of the original 16 tasks)
**Trigger**: `sdd-verify` report (engram `sdd/api-security-and-admin-guard/verify-report` #802) found that `RegisterUserUseCase.execute()` trusted caller-supplied `IDRole`/`Category` and passed them through unmodified into the `User` entity, with zero test coverage of the spec's "ignore attacker-supplied role" scenario. The only reason a real registration request still landed on `IDRole=2` was an *accidental* Sequelize column `defaultValue`, not an enforced business rule.

### Root Cause
- `RegisterUserUseCase.ts` (lines 37-46, pre-fix) built the `User` entity using `input.IDRole`/`input.Category` straight from the caller.
- `RegisterUserUseCase.test.ts` (lines 27-79, pre-fix) actually asserted the wrong behavior — it sent `IDRole: 2, Category: 'Standard'` as input and asserted it round-tripped unchanged, proving the test suite encoded a pass-through contract instead of the spec's enforced-default contract.
- `SequelizeUserRepository.create()` never forwarded `IDRole`/`Category` to `db.User.create(...)` at all, so the Sequelize model's column-level `defaultValue` (2 / `'User'`) was the only thing keeping real registrations safe — incidental, not deliberate.

### TDD Cycle Evidence
| Step | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| Enforce role default in `RegisterUserUseCase` | Added a new test `'should ignore an attacker-supplied administrative role and force the default standard role'` sending `IDRole: 1, Category: 'Admin'` in the input; also rewrote the first test (`'should successfully register a user when email is not taken, defaulting to the standard role'`) to send no role fields in the input and expect `IDRole: 2`/`Category: 'User'` in both the repo call and the returned DTO. Ran `npx jest RegisterUserUseCase.test.ts` against the pre-fix code: **2 failed, 3 passed** — confirmed RED (`mockUserRepo.create` received `IDRole: undefined`/`Category: undefined` for the first test and `IDRole: 1`/`Category: 'Admin'` echoed through for the attacker test). | Changed `RegisterUserUseCase.execute()` to hardcode `IDRole: 2, Category: 'User'` on the `User` entity it constructs, ignoring `input.IDRole`/`input.Category` entirely. Re-ran: **5/5 passed** — GREEN. | Removed `IDRole`/`Category` from the `RegisterUserInput` interface entirely (no caller in the codebase ever set them — confirmed via `rg "RegisterUserUseCase\|RegisterUserInput"` across `src/`; `UserController.postNewUser` and the legacy `src/controllers/users/postNewUser.ts` composition-root wrapper never read `req.body.IDRole`). `SequelizeUserRepository.create()` left untouched — it already didn't forward these fields, now consistent with the use case never producing anything but the safe default. |

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `src/application/use-cases/RegisterUserUseCase.ts` | Modified | Removed `IDRole`/`Category` from `RegisterUserInput`. `execute()` now hardcodes `2`/`'User'` on the constructed `User` entity instead of trusting `input.IDRole`/`input.Category`. |
| `src/application/__tests__/RegisterUserUseCase.test.ts` | Modified | Rewrote the first test to assert enforced defaulting (no role fields in input, `IDRole: 2`/`Category: 'User'` expected in both the repo call and the result DTO). Added a new test asserting an attacker-supplied `IDRole: 1, Category: 'Admin'` in the input is ignored and the persisted/returned values are still `IDRole: 2`/`Category: 'User'`. |

### Verification Results
1. **RED**: `npx jest RegisterUserUseCase.test.ts` against pre-fix code → 2 failed, 3 passed (the two role-enforcement tests failed exactly as expected, proving the spec gap).
2. **GREEN**: Same command against fixed code → 5/5 passed.
3. **Type check**: `npx tsc --noEmit` → 0 errors (confirms no other code depended on `RegisterUserInput.IDRole`/`.Category`).
4. **Full regression**: `npm test` → **43 suites passed (unchanged)**, **243 passed + 1 skipped (244 total)** — was 242 passed + 1 skipped (243 total) at last verify; net +1 test, zero regressions.

### Scope Decisions
- Removed `IDRole`/`Category` from `RegisterUserInput` entirely rather than keeping them on the interface and ignoring them in `execute()`. Justification: grepped every caller of `RegisterUserUseCase`/`RegisterUserInput` in `src/` — `UserController.postNewUser` (the only real call site, used by both `src/infrastructure/routes/userRoutes.ts` and the legacy `src/controllers/users/postNewUser.ts` composition-root wrapper) never sets these fields. No legitimate code depends on a public self-registration DTO accepting a role field. If a future admin-create-user flow needs to set role at creation time, that belongs in a different use case, not this one.
- Did not touch `SequelizeUserRepository.create()` — its omission of `IDRole`/`Category` from the forwarded Sequelize payload is now a correct, harmless redundancy with the use case's hardcoded default rather than the previous accidental safety net.

### Deviations from Design
None — this fix implements exactly what `specs/user-registration-role/spec.md` already required; no design document changes needed.

### Issues Found
None blocking.
- Risk/follow-up note: none. No code changes beyond the two unused-identifier removals; no bugs found during the non-admin routing verification.
