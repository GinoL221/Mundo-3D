# Tasks: JWT Cookie Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1000-1250 (additions+deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — user decision needed |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

15+ files across backend security/middleware/controllers/routes and frontend services/components, each needing new + updated tests, guarantees this exceeds 400 lines. Splitting keeps each PR independently reviewable and revertable.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Cookie/CSRF primitives + `apiAuthMiddleware`/`csrfGuard`, wired in `app.js`, unused by routes yet | PR 1 | `cd backend && npm test -- cookieOptions csrfToken auth.test csrf.test` | N/A — pure unit, no server boot needed | Revert new `security/`+`middlewares/csrf.ts` files; `auth.ts`/`app.js` diff isolated |
| 2 | Login/register/logout set/clear cookies; `csrfGuard` mounted on every write route | PR 2 | `cd backend && npm test -- UserApiController users.routes cart.routes franchises.routes categories.routes products.routes` | supertest agent (cookie jar) | Revert controller+route diffs; PR1 middleware stays inert without mounting |
| 3 | Frontend auth/session refactor: no token storage, cookie-based gating, cross-tab sync | PR 3 | `cd frontend && npm test -- session.service auth.service auth.adapter sessionUI csrf` | jsdom (existing frontend test harness) | Revert `domains/auth/**`, `scripts/sessionUI.ts`, `Header.astro`; backend already cookie-only from PR2 |
| 4 | Frontend consumer call sites (Cart, product admin) + integration/E2E + docs | PR 4 | `cd frontend && npm test -- CartService product.admin.service` then `npm run test:e2e` | Playwright (`4322→3032`, `NODE_ENV=test`) | Revert 2 service files + README/.env.example note; independent of PR3 internals |

## Phase 1: Backend Security Primitives

- [x] 1.1 RED: `cookieOptions.test.ts` — httpOnly/secure(prod only)/sameSite=Lax/domain(from `COOKIE_DOMAIN`)/`authMaxAge(remember)` = 30d or 2h
- [x] 1.2 GREEN: create `backend/src/infrastructure/security/cookieOptions.ts` (`AUTH_COOKIE`, `CSRF_COOKIE`, `USER_COOKIE`, `REMEMBER_MAX_AGE`, `SESSION_MAX_AGE`, `cookieOptions()`, `authMaxAge()`) — single shared source, no independent maxAge literals elsewhere
- [x] 1.3 RED: `csrfToken.test.ts` — issue/verify roundtrip; wrong `userId` rejected; tampered HMAC rejected
- [x] 1.4 GREEN: create `backend/src/infrastructure/security/csrfToken.ts` (`issueCsrfToken`, `verifyCsrfToken`, HMAC via `COOKIE_SECRET`)

## Phase 2: Auth & CSRF Middleware

- [x] 2.1 RED: update `middlewares/__tests__/auth.test.ts` — `apiAuthMiddleware` cookie present/absent/expired 401; `Authorization: Bearer` alone now 401
- [x] 2.2 GREEN: modify `middlewares/auth.ts` — `apiAuthMiddleware` reads `req.cookies.m3d_auth` only, drops header parsing
- [x] 2.3 Check-only: verify `requireRoles`'s `req.session?.userLogged || req.user` fallback still resolves under 2.2; touch only that line if the cookie-only path breaks it — no broader session-middleware cleanup
- [x] 2.4 RED: `middlewares/__tests__/csrf.test.ts` — safe methods pass; missing header 403; header≠cookie 403; bad HMAC 403
- [x] 2.5 GREEN: create `backend/src/infrastructure/middlewares/csrf.ts` (`csrfGuard`)

## Phase 3: App Wiring

- [x] 3.1 RED (if uncovered): CORS test — allowed origin echoes exact origin (never `*`) + `Access-Control-Allow-Credentials: true`
- [x] 3.2 GREEN: modify `backend/src/app.js` — `server.use(cookieParser())` between body parsing and `/api`
- [x] 3.3 modify `backend/.env.example` add `COOKIE_DOMAIN=` (blank); update `README.md` line ~178 (`COOKIE_SECRET` now used) — **README.md done; `backend/.env.example` NOT done, see PR1 apply-progress: this workspace's permission policy denies Read/Edit/Bash on every `.env*` path for every tool, with no exception for `.env.example`. Needs a manual one-line addition (`COOKIE_DOMAIN=`, blank, after `COOKIE_SECRET`) outside this agent session.**

## Phase 4: Login / Register / Logout

- [x] 4.1 RED: `UserApiController.test.ts` — login sets 3 `Set-Cookie`, no `token` in body; `remember:true` → 30d on all 3; omitted → 2h; JWT `exp` matches
- [x] 4.2 GREEN: modify `UserApiController.ts` `login`/`register` — set cookies via `cookieOptions`/`authMaxAge`, drop `token` from body; add `logout` (`clearCookie` ×3, byte-identical flags, 204)
- [x] 4.3 RED: `users.ts` route test — `POST /users/logout` 204 with cookie, 401 without, no body required
- [x] 4.4 GREEN: modify `routes/api/users.ts` — `router.post('/users/logout', apiAuthMiddleware, controller.logout)`
- [x] 4.5 RED: assert `POST /users/login` and `POST /users/register` succeed with no `X-CSRF-Token` header (pre-auth exemption)
- [x] 4.6 GREEN: confirm `csrfGuard` is not mounted on login/register/logout in `users.ts` (satisfied by 4.4 scope)

## Phase 5: Mount `csrfGuard` on Every Write Route

- [x] 5.1 RED: `cart.routes` test — `PUT /api/cart` without CSRF token → 403
- [x] 5.2 GREEN: mount `csrfGuard` after `apiAuthMiddleware` on `PUT /api/cart` in `routes/api/cart.ts`
- [x] 5.3 RED: `franchises.routes` test — `POST /franchises`, `PUT /franchises/:id`, `DELETE /franchises/:id` without CSRF → 403 each
- [x] 5.4 GREEN: mount `csrfGuard` on those 3 routes in `routes/api/franchises.ts`
- [x] 5.5 RED: `categories.routes` test — `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` without CSRF → 403 each
- [x] 5.6 GREEN: mount `csrfGuard` on those 3 routes in `routes/api/categories.ts`
- [x] 5.7 RED: `products.routes` test — `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `PATCH /products/:id/stock` without CSRF → 403 each
- [x] 5.8 GREEN: mount `csrfGuard` on those 4 routes in `routes/api/products.ts`

## Phase 6: Frontend CSRF & Session Services

- [x] 6.1 RED: `csrf.test.ts` — `readCsrfToken()` parses `m3d_csrf`; `withCredentials(init)` adds `credentials:'include'` + `X-CSRF-Token`
- [x] 6.2 GREEN: create `frontend/src/domains/auth/services/csrf.ts`
- [x] 6.3 RED: update `session.service.test.ts` — `getSessionUser()` reads `m3d_user`; `clearSession()` calls `POST /users/logout` + broadcasts
- [x] 6.4 GREEN: modify `session.service.ts`
- [x] 6.5 RED: update `auth.service.test.ts` — `login(email,password,remember)` sends `credentials:'include'`, no token persisted
- [x] 6.6 GREEN: modify `auth.service.ts`; update `auth.adapter.ts`/`auth.adapter.test.ts` — drop `token` from `AuthData`/`APILoginResponse`

## Phase 7: Forms & Stale-Storage Cleanup

- [x] 7.1 modify `LoginForm.astro` — read `#remember` checkbox into login call; drop `localStorage.setItem`; one-time `removeItem('token')`+`removeItem('user')` on init
- [x] 7.2 modify `RegisterForm.astro` — drop `localStorage.setItem`

## Phase 8: Consumer Call Sites

- [ ] 8.1 RED: `CartService.test.ts` — request at :50/:61 includes `credentials:'include'`+`X-CSRF-Token`, no `Authorization` header
- [ ] 8.2 GREEN: modify `CartService.ts` (:50,:61) via `withCredentials`
- [ ] 8.3 RED: `product.admin.service.test.ts` — same assertion for `getAuthHeaders()` call sites
- [ ] 8.4 GREEN: modify `product.admin.service.ts` — `getAuthHeaders()` becomes CSRF-only

## Phase 9: Cross-Tab Sync

- [x] 9.1 RED: `sessionUI.test.ts` — `BroadcastChannel` message triggers `update()`; `visibilitychange`/`focus` triggers `update()`; `cleanup()` closes channel + removes listeners; `storage` param dropped
- [x] 9.2 GREEN: modify `frontend/src/scripts/sessionUI.ts`
- [x] 9.3 modify `Header.astro` — `initializeSessionUI(document, window)`, drop `localStorage` arg

## Phase 10: Integration & E2E

- [ ] 10.1 Integration (supertest agent): login → 3 `Set-Cookie`, no body token; protected GET with jar → 200; write w/o CSRF → 403; logout → 3 clearing `Set-Cookie` + 204
- [ ] 10.2 Integration: `remember:true` → 30d Max-Age all 3 cookies; unchecked → 2h; `jwt.decode` matches
- [ ] 10.3 Playwright E2E: cross-origin login → cart write → admin page → logout → second tab reflects logout (`4322→3032`)

## Phase 11: Docs / Follow-Up Note

- [ ] 11.1 Confirm `README.md` auth section reflects cookie-only flow end to end
- [ ] 11.2 Known follow-up (no task here): `openspec/specs/navbar-and-footer/spec.md` and `openspec/specs/visual-admin-hiding/spec.md` still describe localStorage-based gating — deliberately left stale by `sdd-spec` since neither is a Modified Capability of this change; a future change must update them
