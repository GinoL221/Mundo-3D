# Proposal: JWT Cookie Migration

## Intent

The API returns the JWT in the login body; the browser keeps it in `localStorage` and re-sends it as `Authorization: Bearer`. Any XSS can read and exfiltrate a valid 2h token, and the server cannot invalidate it. It is the last script-readable credential after `express-session` removal. An httpOnly cookie removes script-level theft and returns session control to the server. No production deployment exists, so cutting over is cheap now and expensive later.

## Scope

### In Scope
- Login/register set the JWT as an httpOnly cookie; new logout endpoint clears it.
- `apiAuthMiddleware` reads the token from the cookie only.
- CSRF protection for state-changing requests — none exists today, designed from scratch here.
- Credentialed CORS (frontend/backend are cross-origin even locally).
- Frontend stops storing/reading `token`; API calls send credentials.
- Non-sensitive session data so navbar/admin UI gating still works.
- Cross-tab logout sync preserved (replacement for the `storage` event, which cookies don't fire).
- Real `POST /api/users/logout` endpoint (none exists today — logout is currently a client-side `localStorage.clear()` only).
- **"Recuérdame" checkbox made functional**: `LoginForm.astro` renders it today but the submit handler never reads it (dead UI, flat 2h expiry regardless). When checked, issues a longer-lived cookie; unchecked keeps the current 2h session. Confirmed in-scope by the user — this is new functionality riding on the cookie migration, not a byproduct.
- Updated tests, `.env.example`, README auth docs.

### Out of Scope
- **Dual transport.** Hard cutover: existing tokens invalidated, everyone logs in once more.
- Refresh tokens, sliding sessions, revocation lists, changed 2h expiry.
- Role/permission rules and the route capability matrix.
- **Dead `req.session?.userLogged` branches** in `isUser`/`guestMiddleware`/`authMiddleware` (`backend/src/infrastructure/middlewares/auth.ts`). Dead since PR #49 but unrelated to transport: deliberate non-goal, immediate follow-up. Exception: the `requireRoles` fallback may be touched if the auth path forces it.

## Capabilities

### New Capabilities
- `csrf-protection`: token issuance and validation for state-changing requests under cookie auth.

### Modified Capabilities
- `api-jwt-auth`: cookie transport; Bearer no longer accepted; logout added.
- `session-cookie-security`: auth-cookie flags, credentialed CORS.
- `admin-route-guard`: unauthenticated detection becomes cookie-based.
- `astro-frontend`: no client token storage; credentialed fetch.

## Approach

Single atomic cutover: the server becomes sole holder of the credential, the client keeps only display data. CSRF ships in the same change because cookie auth without it is a regression, not a neutral swap. Cookie flags and CSRF mechanism are `sdd-design` decisions.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/infrastructure/middlewares/auth.ts` | Modified | Cookie read replaces header parse |
| Backend login/register/logout controllers + routes | Modified | Set/clear cookie; new logout |
| Backend app bootstrap | Modified | Credentialed CORS, cookie-parser, CSRF |
| `frontend/src/domains/auth/**` (`LoginForm.astro`, `RegisterForm.astro`, `session.service.ts`) | Modified | No token persistence; credentialed fetch |
| `frontend/src/scripts/sessionUI.ts` | Modified | New gating source; cross-tab sync |
| `frontend/src/domains/cart/services/CartService.ts` (Bearer at :50, :61) | Modified | Drop manual header, add `credentials: 'include'` |
| `frontend/src/domains/products/services/product.admin.service.ts` (`getAuthHeaders` :41-42) | Modified | Drop manual header, add `credentials: 'include'` |
| Backend + frontend auth tests | Modified | Bearer assertions rewritten |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| New CSRF surface built wrong | Med | Design picks mechanism; spec covers reject paths |
| Cross-origin cookie blocked in local dev | High | Design sets SameSite/secure per env; verify in a real browser |
| UI gating regresses (httpOnly unreadable to JS) | High | Design question; restore cross-tab logout without `storage` event |
| Forgotten Bearer call site | Low | All three attach sites already enumerated (Affected Areas): `CartService.ts:50,61`, `product.admin.service.ts:41-42`. No other `Authorization` header write found in the frontend. |
| Longer-lived "Recuérdame" cookie widens the device-theft window | Med | httpOnly still blocks XSS read regardless of lifetime; design picks a bounded max lifetime (not indefinite) and documents the tradeoff explicitly |

## Rollback Plan

Single revert of the change branch. No schema or data migration, so revert restores Bearer auth exactly; users log in once more.

## Dependencies

- `COOKIE_SECRET` already in `backend/.env.example` and README, reserved for this migration. No new env var needed.
- **Update (post-design):** production is confirmed to deploy frontend and backend under the same root domain as subdomains (e.g. `mundo3d.com` + `api.mundo3d.com`) — user-confirmed. This validates `SameSite=Lax` for the auth cookies (see `design.md`) and requires one new **optional** env var: `COOKIE_DOMAIN` (unset in dev/CI, both `localhost`; set to the root domain in production so the frontend's subdomain can read the non-httpOnly display/CSRF cookies). No-op change to local dev.

## Success Criteria

- [ ] No JWT readable from client JavaScript.
- [ ] Protected requests succeed with the cookie, rejected without it.
- [ ] State-changing requests without a valid CSRF token are rejected.
- [ ] Logout clears the cookie server-side; session ends across tabs.
- [ ] Navbar/admin gating and cross-tab logout behave as before.
- [ ] Checking "Recuérdame" issues a longer-lived cookie; unchecked keeps the 2h default.
- [ ] Full login → cart → admin flow passes cross-origin in a real browser.
