# Exploration: auth-refresh-tokens

**Change**: `auth-refresh-tokens`
**Date**: 2026-09-01
**Baseline**: `main` @ `bb7fe09`
**Addresses**: HIGH-1 of the auth security review — logout does not revoke a stateless JWT that lives up to 30 days.

> **Approach already decided by the user**: refresh tokens, not a `jti` denylist. This exploration covers *how* to implement them here, not *whether*.

> **Provenance note**: the `sdd-explore` phase agent ran without `Write` or Engram tools and could not persist this artifact itself. The orchestrator wrote it, and independently re-verified the three claims that were new (stale `user-auth` spec, forced-logout precedent, what `cross-tab-session.spec.ts` actually covers) against the live repository before persisting. Everything below is grounded in on-disk code.

## Current state

Authentication is a single stateless JWT in the httpOnly `m3d_auth` cookie. `setSessionCookies` (`backend/src/infrastructure/controllers/UserApiController.ts:28-46`) issues three cookies that share one lifetime:

| Cookie | Flags | Contents |
|---|---|---|
| `m3d_auth` | httpOnly | the JWT |
| `m3d_csrf` | readable | signed double-submit token, HMAC bound to `userId` |
| `m3d_user` | readable | display JSON; UX-only, backend still enforces with `adminGuard` |

Lifetime is `SESSION_MAX_AGE` (2h) or `REMEMBER_MAX_AGE` (30d) selected by the `remember` flag, and the JWT's own `expiresIn` is derived from the same constant via `authExpiresInSeconds`, so cookie and token never drift.

`apiAuthMiddleware` reads only `req.cookies[AUTH_COOKIE]`. There is no `Authorization: Bearer` path and no server-side session store.

`logout` (`UserApiController.ts:107-117`) only calls `res.clearCookie` on all three. **That is the HIGH-1 gap**: a captured token keeps working until its own `exp`, for up to 30 days.

`csrfGuard` exempts `/users/login`, `/users/register`, `/users/logout` by path, runs *after* `apiAuthMiddleware` on every other write, and checks header==cookie plus HMAC(userId).

Cross-tab behaviour today is UI-only and orthogonal to token refresh: `session.service.ts`'s `clearSession()`/`broadcastSessionChanged()` and `sessionUI.ts` use `BroadcastChannel('m3d-session')` plus `visibilitychange`/`focus` to keep tabs' *display gating* in sync, because cookies fire no `storage` event.

## The decisive asset: a dead RememberToken slice

Confirmed by direct search — zero production callers anywhere in `backend/src`. The only references are the slice's own files and their own unit tests. `routes/api/users.ts` instantiates only `AuthenticateUserUseCase`, `ListUsersUseCase`, `GetUserByIdUseCase` and `RegisterUserUseCase`.

- `domain/entities/RememberToken.ts` — `idRememberToken`, `tokenHash`, `idUser`, `expiryDate`, `createdAt`
- `domain/ports/RememberTokenRepositoryPort.ts` — `create`, `findByHash`, `deleteByHash`
- `application/use-cases/{Create,Verify,Delete}RememberTokenUseCase.ts`
- `infrastructure/repositories/SequelizeRememberTokenRepository.ts`
- `infrastructure/security/Sha256TokenHasher.ts` — zero consumers anywhere
- `database/models/RememberToken.js`
- The `RememberToken` table from `database/migrations/20260724000000-baseline.js:120-136` — `token_hash varchar(64)` UNIQUE (exactly a SHA-256 hex), `expiry_date`, `created_at`, FK `id_user` → `User` ON DELETE CASCADE. It carries **five duplicate UNIQUE indexes** on `token_hash`, legacy `sync({alter:true})` cruft.

**Verdict: revive it, but not as-is.** The schema has no token-family or supersession concept, so any rotation model needs a migration — this is mandatory, not optional, and must be explicit in the proposal rather than discovered during apply.

## New finding, independent of this change

`openspec/specs/user-auth/spec.md` is **stale**. Line 46 requires that "the response MUST contain the generated JWT token in the JSON body, and the controller MUST NOT issue session cookies or render HTML views" — the exact opposite of live behaviour since the `2026-08-26-jwt-cookie-migration` change. Line 12 repeats it.

The spec phase must decide whether to reconcile or retire it. Left alone, `sdd-spec` would diff against a wrong baseline.

## The four open questions

### 1. Rotation

| Option | Pros | Cons | Effort |
|---|---|---|---|
| **Fixed until expiry** | reuses the port shape as-is; no race to design | a stolen token is valid for its whole lifetime, no reuse signal | Low |
| **Rotate on every use** | limits a leak to one refresh cycle; table shape suffices | this is exactly where the cross-tab race bites: two tabs race, the loser's hash is already deleted and is indistinguishable from a replayed stolen token | Medium |
| **Rotation + reuse detection (families)** | genuine breach detection; reuse revokes the whole family | needs `family_id` + a predecessor pointer the table lacks; and needs the race solved *first*, or every legitimate tab race reads as theft | High |

### 2. Cross-tab concurrency (only under rotation)

| Option | Pros | Cons | Effort |
|---|---|---|---|
| **Per-tab single-flight in the retry wrapper** | trivial in `config.ts`; fixes concurrent fetches within one page | does nothing across tabs — module state and `BroadcastChannel` do not share a JS heap | Low |
| **Server-side grace window** — the just-rotated token stays valid a few seconds | absorbs the realistic race with no client coordination; established pattern (Auth0 calls it a reuse interval) | reopens a bounded reuse window; needs a `superseded_at`/grace column | Medium |
| **Cross-tab leader election** (`BroadcastChannel` or Web Locks) | closest to eliminating the race outright | this is Astro static pages with vanilla scripts, not a SPA; the existing channel does fire-and-forget messaging, not request coordination. Building a correct mutex with timeout/fallback is materially harder than it looks; Web Locks has no fallback here today | High |

**These two questions are coupled.** Fixed tokens sidestep the race entirely. Rotation with only per-tab dedup is the fragile combination that logs a legitimate second tab out. Rotation plus a grace window is what "rotation with reuse detection" actually means in this codebase.

### 3. "Remember me" semantics

- **Access fixed, refresh carries the distinction** (2h vs 30d moves to the refresh token). Minimal conceptual change; the existing constants keep their meaning, just reassigned. Note today's 2h cookie is already persistent with `maxAge`, not a true session cookie, so this is not a new browser-close behaviour.
- **Both lifetimes vary with `remember`**. More granular, but nothing in this codebase currently asks for a longer *access* token when remembered.

Either is compatible with the existing `authMaxAge`/`authExpiresInSeconds` builder — a naming and assignment decision, not a new mechanism.

### 4. Migration for existing 30-day JWT holders

- **Forced logout at deploy.** Matches direct precedent: the 2026-08-26 jwt-cookie-migration design states "Every logged-in user is logged out at deploy and logs in once more (accepted in the proposal)" and "No blacklist exists or is needed." Zero new code. Costs a real if minor UX regression for users promised 30 days.
- **Compatibility bridge** — accept the old JWT once, mint a fresh pair transparently. No forced re-login, but meaningfully more code, and **every day the bridge is active is the same "stale token still works" exposure this change exists to close**.

## Other findings

**CSRF does not need to rotate.** `csrfToken.ts` signs `userId + "." + random` only — the HMAC binds to the user, not to the access token. So the CSRF cookie's validity is already independent of which access token is live. A genuine simplification: leave CSRF alone.

**But the refresh endpoint's CSRF exemption needs real reasoning.** A refresh call happens exactly when the access token — and therefore `req.user.userId`, which `csrfGuard` needs — may already be expired. `csrfGuard`'s current post-`apiAuthMiddleware` ordering cannot be reused unmodified for that route. This is not a copy-paste of `logout`'s exemption.

**Retry-wrapper placement.** `frontend/src/config.ts` is the only legal home under `frontend.domain.locality` (`backend/tools/architecture/engine.js:56`). It is currently 118 lines and already holds `withCredentials`, `getSessionUser` and `readApiErrorMessage`. There is room under the 250-line cap, but concern-creep is real. The architecture rule constrains only what `domains/**` may *import*, not how many files live outside the domain tree — so splitting into `frontend/src/lib/http/*` re-exported from `config.ts` is architecturally legal if line pressure becomes real.

## Recommendation to the proposal phase

Ship **rotation with a server-side grace window**, **the refresh token carrying the `remember` distinction**, and **forced logout at deploy**. Defer full reuse-family revocation as a fast-follow once the grace window is proven.

This closes HIGH-1 on day one — the refresh token is revocable immediately and the access token's exposure shrinks to its own short lifetime — without shipping the most complex piece before the concurrency behaviour is validated against a real multi-tab scenario.

Revive the RememberToken slice with a schema change: add a nullable supersession/grace pair, and drop the four redundant `UNIQUE KEY token_hash_2..5` indexes in the same migration. `Sha256TokenHasher`/`TokenHasherPort` can be reused unchanged — hashing a refresh token before storage is identical to hashing a remember token.

## Risks

- **A schema migration is mandatory**, not optional, for any rotation model. Must be explicit in the proposal, not discovered mid-apply.
- **The cross-tab race is realistically testable here.** `cross-tab-session.spec.ts` proves multi-tab same-context sessions already run in CI. It currently covers only BroadcastChannel-driven logout/login sync — a refresh-race scenario is new coverage, not a rename.
- **`openspec/specs/user-auth/spec.md` is already stale**, independent of this change. Decide in-scope or explicitly out-of-scope.
- **`config.ts` concern-creep** — budget for a possible split.
- **CSRF/refresh interaction is easy to get subtly wrong** (see above).
- **Forced logout is a real UX regression** for existing "remember me" users, even with precedent. Flag it to the user rather than assuming silent acceptance.
- **Blast radius on the frontend**: 9 service files, 17 `fetch` call sites need retry-on-401.
