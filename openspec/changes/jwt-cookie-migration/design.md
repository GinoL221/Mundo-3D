# Design: JWT Cookie Migration

## Technical Approach

The server becomes the sole writer of session state. Login/register issue three cookies from one options builder (`cookieOptions.ts`): the httpOnly JWT, a JS-readable CSRF token, and a JS-readable display blob. `apiAuthMiddleware` reads `req.cookies` only. A new `csrfGuard` protects state-changing routes. The frontend writes no session state at all — it reads `document.cookie` synchronously (same shape as today's `storage.getItem`) and sends `credentials: 'include'` plus `X-CSRF-Token`.

**Load-bearing fact that resolves the proposal's "High" cross-origin risk**: `SameSite` is scoped to *site* (scheme + registrable domain), **not** origin. Port is not part of a site. `localhost:4321 → localhost:3031` is cross-origin but **same-site**, so `SameSite=Lax` cookies flow in local dev and in Playwright (`4322 → 3032`) with no HTTPS and no `SameSite=None`.

## Architecture Decisions

### Decision: CSRF = signed double-submit cookie + required `X-CSRF-Token` header

| Option | Tradeoff | Verdict |
|---|---|---|
| Synchronizer token (server-side state) | Reintroduces the server-side session store PR #49 just deleted; contradicts stateless JWT | Rejected |
| Custom-header-only (rely on CORS preflight) | Zero token, but the entire defense collapses on any CORS regression and gives nothing against a same-site sibling host | Rejected as *sole* mechanism; kept as a second layer |
| Plain double-submit cookie | Standard, stateless — but a sibling subdomain that can set a cookie also knows its value | Rejected |
| **Signed double-submit, HMAC-bound to `userId`** | ~40 lines; finally consumes the reserved `COOKIE_SECRET` | **Chosen** |

Token = `<random-base64url>.<HMAC-SHA256(COOKIE_SECRET, userId + "." + random)>`. `csrfGuard` runs after `apiAuthMiddleware`, so it verifies the HMAC against the *authenticated* `req.user.userId` (primary check) **and** timing-safe-compares the header against the `m3d_csrf` cookie (secondary). An attacker who can plant a cookie still cannot forge the HMAC.

**Exemptions**: `POST /users/login`, `POST /users/register` (no session exists yet; already rate-limited), and `POST /users/logout` (fail-safe — it only ever *removes* authority, and requiring a token there would strand a user whose CSRF cookie was lost). Applies to `POST|PUT|PATCH|DELETE` on every `apiAuthMiddleware`-protected route.

### Decision: Cookie flags

| Cookie | httpOnly | Secure | SameSite | Path | Domain | Max-Age |
|---|---|---|---|---|---|---|
| `m3d_auth` (JWT) | **yes** | `NODE_ENV==='production'` | `Lax` | `/` | `COOKIE_DOMAIN` or host-only | 2h / 30d |
| `m3d_csrf` | no | same | `Lax` | `/` | same | same as auth |
| `m3d_user` (display) | no | same | `Lax` | `/` | same | same as auth |

`SameSite=Lax` over `None`: the deployment is same-site in both environments, and `None` would be strictly weaker (it re-opens cross-site subresource POSTs that Lax blocks for free) while forcing `Secure`, hence HTTPS, hence dev certs. `__Host-` prefix rejected: it mandates `Secure` and forbids `Domain`, so the cookie name would have to differ per environment — fragile, and it blocks the subdomain read below.

**Production assumption (stated explicitly; the proposal found no deployment evidence)**: apex + API subdomain of one registrable domain, e.g. `mundo3d.com` + `api.mundo3d.com` — same-site, so Lax holds. Because `m3d_csrf`/`m3d_user` must be readable by `document.cookie` on the *frontend* host, production needs `Domain=mundo3d.com`. This requires an **optional `COOKIE_DOMAIN` env var** — a deliberate deviation from the proposal's "no new env var needed". It is unset in dev/test (both origins are `localhost`, and cookies ignore ports, so a cookie set by `:3031` is readable at `:4321`) and therefore changes nothing locally or in CI. If the deployment turns out to be two unrelated domains, this design does not hold and `SameSite=None; Secure` must be revisited.

### Decision: Local dev needs no HTTPS

`Secure` is set **only** when `NODE_ENV === 'production'`. Because we chose `Lax` and not `None`, no browser requires a secure context. Dev (`4321→3031`) and Playwright (`4322→3032`, `NODE_ENV=test`) run plain HTTP. **mkcert / self-signed certs are explicitly not needed** — that cost only exists on the `SameSite=None` path we rejected.

### Decision: Display data in a non-httpOnly `m3d_user` cookie

| Option | Tradeoff | Verdict |
|---|---|---|
| `GET /api/users/me` per page load | Single source of truth, but async → guest-UI flash before the flip (today's read is synchronous), extra credentialed request on every navigation, new endpoint + use-case wiring, and cross-tab sync still unsolved | Rejected |
| Keep display data in `localStorage` | Preserves the `storage` event for free, but its lifetime is uncoupled from the credential — with two lifetimes now (2h vs 30d) the UI would drift out of sync with the cookie and the client would still be writing session state | Rejected |
| **`m3d_user` cookie, URL-encoded JSON `{firstName, image, idRole, category}`** | Browser deletes it at exactly the credential's Max-Age; `update()` stays synchronous; server is the only writer | **Chosen** |

Tamper risk is accepted and already documented policy: `session.service.ts` states the client check is presentation-only and `requireRoles` is the real boundary. Exposure is identical to `localStorage` under XSS. Express `res.cookie` URL-encodes by default, so non-ASCII names (`José`) survive without base64.

### Decision: Cross-tab sync = `session-changed` + `BroadcastChannel` + `visibilitychange`

Cookies fire no `storage` event. Three composed layers, no polling:

| Layer | Covers |
|---|---|
| `session-changed` CustomEvent (**existing, unchanged**) | Same-tab login/logout |
| `BroadcastChannel('m3d-session')` — logout posts `{type:'session-changed'}` | Other tabs, instantly |
| `visibilitychange` + `focus` → re-read cookie | Cookie expiry, BC-unsupported browsers, safety net |

All three call the same `update()`, which is now a synchronous cookie read. `sessionUI.ts`'s `cleanup()` gains `bc.close()` and the two listener removals.

### Decision: "Recuérdame" = 30 days, unchecked = current 2h

Bounded, never indefinite. httpOnly blocks XSS read regardless of lifetime, so the residual risk is physical device theft; 30 days caps that window while being long enough to be worth the feature. **The JWT `expiresIn` and the cookie `maxAge` must be derived from one value** — a 30-day cookie carrying a 2h JWT dies server-side at 2h. Unchecked stays a persistent 2h cookie (not a session cookie), matching today's browser-close behavior.

## Data Flow

```
POST /users/login {email, password, remember}
        │
        └─→ authenticate → jwt.sign(exp = remember ? 30d : 2h)
                 │
                 ├─ Set-Cookie m3d_auth  (httpOnly)
                 ├─ Set-Cookie m3d_csrf  (random.HMAC(userId))
                 └─ Set-Cookie m3d_user  ({firstName,image,idRole,category})
                        │
                 200 {user}   (no token in body)
                        │
   frontend: dispatch session-changed  +  BroadcastChannel.post
                        │
                 sessionUI.update() ── reads m3d_user ──→ navbar

PUT /api/cart  credentials:'include' + X-CSRF-Token (read from m3d_csrf)
        │
   apiAuthMiddleware ─ req.cookies.m3d_auth ─ jwt.verify ─→ req.user
        │
   csrfGuard ─ HMAC(header) == userId?  &&  header == cookie? ──→ handler
                                    │
                                   403 { error: 'CSRF token inválido' }

POST /users/logout  →  clear all 3 (identical flags) → 204
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/infrastructure/security/cookieOptions.ts` | Create | Single source of cookie flags + `authMaxAge(remember)`; used by set **and** clear |
| `backend/src/infrastructure/security/csrfToken.ts` | Create | `issueCsrfToken(userId)`, `verifyCsrfToken(token, userId)` — HMAC with `COOKIE_SECRET` |
| `backend/src/infrastructure/middlewares/csrf.ts` | Create | `csrfGuard`; skips safe methods; 403 on failure |
| `backend/src/app.js` | Modify | `server.use(cookieParser())` (unsigned — nothing uses signed cookies) between body parsing and `/api`; CORS already has `credentials: true` and reflects request headers, so `X-CSRF-Token` needs no `allowedHeaders` change |
| `backend/src/infrastructure/middlewares/auth.ts` | Modify | `apiAuthMiddleware` reads `req.cookies.m3d_auth`; `Authorization` header no longer parsed |
| `backend/src/infrastructure/controllers/UserApiController.ts` | Modify | `login`/`register` set 3 cookies, drop `token` from body; add `logout` |
| `backend/src/infrastructure/routes/api/users.ts` | Modify | `router.post('/users/logout', apiAuthMiddleware, controller.logout)`; mount `csrfGuard` on protected writes |
| `backend/src/infrastructure/routes/api/{cart,products,categories}.ts` | Modify | Add `csrfGuard` after `apiAuthMiddleware` on write routes |
| `frontend/src/domains/auth/services/session.service.ts` | Modify | `getSessionUser()` reads `m3d_user`; `clearSession()` calls `POST /users/logout` + broadcasts |
| `frontend/src/domains/auth/services/csrf.ts` | Create | `readCsrfToken()` + `withCredentials(init)` fetch helper |
| `frontend/src/domains/auth/services/auth.service.ts` | Modify | `credentials: 'include'`; `login(email, password, remember)` |
| `frontend/src/domains/auth/adapters/auth.adapter.ts` | Modify | Drop `token` from `AuthData` / `APILoginResponse` |
| `frontend/src/domains/auth/components/{LoginForm,RegisterForm}.astro` | Modify | No `localStorage.setItem`; LoginForm reads `#remember`; one-time `removeItem('token'\|'user')` cleanup |
| `frontend/src/scripts/sessionUI.ts` | Modify | Drop the `storage` param/listener; cookie read; BroadcastChannel + visibilitychange |
| `frontend/src/components/Header.astro` | Modify | `initializeSessionUI(document, window)` — drop the `localStorage` arg |
| `frontend/src/domains/cart/services/CartService.ts` (:50,:61) | Modify | Drop Bearer; `credentials: 'include'` + `X-CSRF-Token` |
| `frontend/src/domains/products/services/product.admin.service.ts` (:41-42) | Modify | Same; `getAuthHeaders()` becomes CSRF-only |
| `backend/.env.example`, `README.md` | Modify | `COOKIE_DOMAIN` (optional, blank locally); README line 178 no longer says `COOKIE_SECRET` is unused |

## Interfaces / Contracts

```ts
// backend/src/infrastructure/security/cookieOptions.ts
export const AUTH_COOKIE = 'm3d_auth', CSRF_COOKIE = 'm3d_csrf', USER_COOKIE = 'm3d_user';
export const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60 * 1000;  // 30d
export const SESSION_MAX_AGE  = 2 * 60 * 60 * 1000;        // 2h
export function cookieOptions(opts: { httpOnly: boolean; maxAge?: number }): CookieOptions;
```

`POST /api/users/logout` — **no auth required**, CSRF exempt, **no request body**. Clears all three cookies via `res.clearCookie(name, cookieOptions({...}))` with **byte-identical** `path`/`domain`/`sameSite`/`secure` (a mismatch silently leaves the cookie in place). Always responds `204 No Content`, even with no/expired auth cookie — logout only ever removes authority, so it must be idempotent and never error (`specs/api-jwt-auth/spec.md` "Logout without an active session"). Corrected during `sdd-verify`: the original decision gated this behind `apiAuthMiddleware` (401 without a cookie), which directly contradicted the spec's "MUST NOT error" requirement written during `sdd-spec` — an inconsistency between two SDD artifacts that slipped past 4 apply runs because the covering test asserted the spec-violating behavior as correct.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `csrfToken` issue/verify; wrong `userId` rejected; tampered HMAC rejected | Direct calls, fixed `COOKIE_SECRET` |
| Unit | `csrfGuard`: safe methods pass; missing header 403; header≠cookie 403 | Mock `req`/`res` (existing `auth.test.ts` pattern) |
| Unit | `apiAuthMiddleware`: cookie present/absent/expired; **`Authorization: Bearer` alone now 401** | Mock `req.cookies` |
| Unit | `cookieOptions`: `secure` true only under `NODE_ENV=production`; `domain` only when `COOKIE_DOMAIN` set | Env matrix |
| Integration | login → `Set-Cookie` ×3, no `token` in body; protected GET with cookie jar; write without CSRF 403; logout → 3 clearing `Set-Cookie` + 204 | supertest agent (persists cookies across requests) |
| Integration | Remember: `remember:true` → 30d Max-Age on all three; omitted → 2h; JWT `exp` matches | Decode `Set-Cookie` + `jwt.decode` |
| Unit (fe) | `sessionUI` gating from cookie; BroadcastChannel message → `update()`; `visibilitychange` → `update()`; cleanup removes all | jsdom, stub `document.cookie` |
| E2E | Real browser cross-origin login → cart write → admin page → logout, second tab reflects logout | Playwright (`4322→3032`, already `CORS_ORIGIN`-configured) |

## Threat Matrix

The change alters HTTP routing only. No shell, subprocess, VCS/PR automation, executable-file classification, or process integration is introduced.

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification |
| Git repository selection | N/A — no VCS invocation |
| Commit / push state | N/A |
| PR commands | N/A |

## Migration / Rollout

**What actually invalidates existing tokens**: nothing cryptographic. `JWT_SECRET` is *not* rotated, so every previously issued token still passes `jwt.verify`. Invalidation is **by construction**: `apiAuthMiddleware` stops reading `req.headers.authorization` entirely, so there is no code path that accepts a Bearer token, and the frontend no longer attaches one. Old tokens become unusable because nothing consumes them — not because they were revoked. No blacklist exists or is needed.

Two consequences for the cutover:
1. Every logged-in user is logged out at deploy and logs in once more (accepted in the proposal).
2. Stale `localStorage` `token`/`user` entries linger in existing browsers. `sessionUI.ts` must `removeItem` both once on init, otherwise nothing renders a fake logged-in navbar but the dead keys persist indefinitely.

No schema or data migration. `COOKIE_DOMAIN` is optional with a safe empty default, so existing `.env` files keep working. Rollback is a single branch revert.

## Open Questions

- [ ] `COOKIE_DOMAIN` deviates from the proposal's "no new env var needed". It is a no-op locally and in CI, but confirm the apex+`api.` subdomain deployment assumption before production — two unrelated domains would invalidate the `SameSite=Lax` decision.
