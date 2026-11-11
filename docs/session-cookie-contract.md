# Session Cookie and Revocation Contract

This document specifies the cookie lifecycle, refresh rotation, revocation endpoints, and client logout sequencing for Mundo-3D.

## Session Cookies

| Cookie Name | Scope / Path | httpOnly | SameSite | Secure | Lifetime | Responsibility |
| --- | --- | --- | --- | --- | --- | --- |
| `m3d_auth` | `/` | Yes | `Lax` | Yes (prod) | Refresh TTL | Carries short-lived access JWT (`typ: "access"`, 30m TTL). Cookie outlives JWT so logout can extract `familyId` on expired access token. |
| `m3d_refresh` | `/api/users/refresh` | Yes | `Lax` | Yes (prod) | 2h / 30d | Carries high-entropy plaintext refresh token for rotation and revocation. |
| `m3d_csrf` | `/` | No | `Lax` | Yes (prod) | Refresh TTL | Signed double-submit CSRF token checked by `csrfGuard`. |
| `m3d_user` | `/` | No | `Lax` | Yes (prod) | Refresh TTL | URL-encoded JSON payload for client-side navigation/UI gating. |

## CSRF Controls

- `POST /api/users/refresh` and `POST /api/users/refresh/revoke` are exempt from `csrfGuard`.
- CSRF defense against cross-site POSTs relies on explicit `SameSite=lax` on the cookie transport (which prevents cross-site POST requests from attaching ambient credentials), though `SameSite=lax` does not protect against same-site cross-origin requests (such as a sibling origin on the same site forcing logout or revocation).
- Cookie `Path` scoping (`path: '/api/users/refresh'`) restricts browser transmission surface to refresh endpoints, but is not an HTTP CSRF defense mechanism.

## Logout and Revocation Endpoints

### 1. `POST /api/users/logout`
- **Scope**: General session clearing endpoint.
- **Cookie clearing**: Clears all four cookies (`m3d_auth`, `m3d_refresh`, `m3d_csrf`, `m3d_user`).
- **Server-side revocation**: Reads `m3d_auth` cookie. When a readable access JWT containing `familyId` is present, it revokes the entire token family server-side (`revoked_at` timestamp recorded).
- **Tolerance & Limitation**: Succeeds with HTTP `204` even when `m3d_auth` is missing, expired, or invalid. Because `m3d_refresh` is path-scoped to `/api/users/refresh`, the browser does not send `m3d_refresh` to `/api/users/logout`. **Consequently, cookieless logout alone does NOT revoke the refresh-token family server-side.**

### 2. `POST /api/users/refresh/revoke`
- **Scope**: Refresh-path-scoped revocation endpoint.
- **Transport**: Reached under `/api/users/refresh/revoke` so the browser attaches `m3d_refresh` without expanding cookie path exposure.
- **Server-side revocation**: Hashes presented `m3d_refresh` token, locates family via `RememberTokenRepositoryPort.findByHash`, and revokes every active token in the family via `revokeFamily`.
- **Non-oracle & Idempotent**: Always responds HTTP `204` with an empty body whether the token exists, is valid, is already revoked, or is absent. Genuine database/repository failures reject with HTTP `500`.
- **Throttling**: Protected by `revokeRefreshLimiter` with `skipSuccessfulRequests: false`. Unlike `refreshLimiter` (which permits normal rotations without burning allowance), every request to `/api/users/refresh/revoke` consumes rate-limiting budget.

## Client-Side Logout Protocol (Two-Request Sequence)

To attempt refresh family revocation even when no valid `m3d_auth` cookie is present, the client dispatches both requests concurrently using `Promise.allSettled` on a best-effort basis (revocation is best-effort: client-side network failures or 429 rate-limiting responses are silently dropped without preventing client logout):

```typescript
await Promise.allSettled([
  fetch(`${API_URL}/api/users/logout`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
  }),
  fetch(`${API_URL}/api/users/refresh/revoke`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
  }),
]);
```

- `keepalive: true` ensures the network requests complete even when the user is immediately navigated to `/login`.
- Both client logout call sites independently implement this two-request sequence:
  1. **User-initiated logout**: `frontend/src/domains/auth/services/session.service.ts` (`clearSession()`).
  2. **Failed-refresh recovery**: `frontend/src/lib/http/authFetch.ts` (`endSessionAndRedirect()`).
