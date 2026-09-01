# Design: Refresh Tokens with Rotation (HIGH-1)

**Inputs**: `proposal.md` (its "Decisions confirmed by the maintainer (2026-09-01)" section is binding and not reopened here), `exploration.md`. **Baseline verified against live code on `main` @ `5017e55`.**

## Corrections to the inputs (verified against live code)

| Claim | Live code says | Effect |
|---|---|---|
| "A grace hit MUST return the stored `successor_hash` token" | `successor_hash` is a SHA-256 digest; the plaintext is never stored. A token cannot be returned from its hash | Restated below as its correct equivalent: a grace hit returns a **fresh access token only and sets no refresh cookie**. This is not a weakening — it is *required* for correctness (see D2) |
| "`typ` blocks refresh→access token-type confusion" | True only weakly. The refresh token is opaque random, not a JWT | Confusion is blocked **structurally in both directions** (D3); `typ`'s real job is the deterministic legacy-JWT cutover |
| "17 `fetch` call sites" across 9 service files | **19** real `fetch(` calls in 9 production service files (2 further grep hits are comment prose). Only **9 are credentialed**; 7 are public reads and 3 are the auth endpoints themselves | Adoption set is 9 sites in 5 files, not 17. The other 10 MUST NOT be wrapped (D6) |
| Refresh route is "exempt from `csrfGuard`" | `csrfGuard` is **never mounted globally** — it is attached per write route (`products.ts`, `cart.ts`, `orders.ts`, `categories.ts`, `franchises.ts`). `EXEMPT_PATHS` is defensive only | The exemption is *not mounting it*. Adding `/users/refresh` to `EXEMPT_PATHS` is consistent belt-and-braces, not the mechanism |
| Migration scope | **Missed by both prior phases**: `backend/src/database/checkPendingMigrations.js` holds a hardcoded `REQUIRED_SCHEMA` + `REQUIRED_COLUMN_DEFINITIONS` for `RememberToken` and fails boot on drift | The four new columns MUST be added there in PR1, or the boot gate never protects them |
| `UserApiController.ts` headroom | Already **204 lines** against the 250 cap | PR2 must extract the cookie helpers first (D4) |

## Technical Approach

Split the session into a short-lived **access JWT** (`m3d_auth`, 30 min, `typ: "access"`) and a long-lived **opaque refresh token** (`m3d_refresh`, 2h/30d, path-scoped, SHA-256 at rest in `RememberToken`). Rotation is claimed by one conditional `UPDATE` — the `SequelizeProductRepository.adjustStock` precedent — inside `SequelizeUnitOfWork.runInTransaction`. Composition stays in the route file; no DI container.

## Architecture Decisions

### D1 — Rotation atomicity: conditional UPDATE claim inside one transaction

**Choice.** `RotateRefreshTokenUseCase` runs, in one `runInTransaction`:

```sql
-- 1. claim (the authoritative gate; loser sees affectedRows = 0)
UPDATE `RememberToken`
   SET `superseded_at` = NOW(), `successor_hash` = :newHash
 WHERE `token_hash` = :presentedHash
   AND `superseded_at` IS NULL AND `revoked_at` IS NULL AND `expiry_date` > NOW()
-- 2. INSERT successor (same family_id, same id_user, expiry_date inherited verbatim)
-- 3. reap: DELETE FROM `RememberToken`
--    WHERE family_id = :family AND superseded_at < NOW() - INTERVAL 30 SECOND
```

`affectedRows === 0` → throw, transaction rolls back, caller falls to the grace lookup on a **fresh read outside the aborted transaction**. Only one transaction can hold the row lock; the loser re-evaluates `superseded_at IS NULL` after the winner commits and correctly gets 0. Steps 1–3 commit atomically, so `successor_hash` is never observable before its successor row exists.

**Successor `expiry_date` is inherited, never extended** — the family carries one absolute session deadline, matching `m3d_csrf`/`m3d_user`, whose `maxAge` was set once at login. Otherwise a 30-day session would become perpetual.

**Alternatives rejected**: `SELECT ... FOR UPDATE` then update (an extra round trip for the same lock, and no repo precedent); optimistic retry loop (a retry storm is exactly what we are preventing); `INSERT` before the claim (leaves an orphan row on the losing path, needing compensation).

### D2 — Grace window: 30s, non-rotating, sets no refresh cookie

**Row state machine.**

```
  current            superseded (grace, 30s)          expired grace         reaped
  superseded_at NULL  ──rotation claim──▶ superseded_at=NOW() ──▶ superseded_at ──▶ row DELETEd by
  revoked_at NULL     successor_hash set                         < NOW()-30s      the next rotation
        │                                                             │              in this family
        └──── logout ────▶ revoked_at set (whole family, terminal) ───┘
```

**Lookup order in `RefreshSessionUseCase`** (single indexed `findByHash`, then branch):

| Presented row P | Response |
|---|---|
| absent | 401 `invalid_refresh` |
| `revoked_at IS NOT NULL` | 401 — **logout beats grace**, checked before the grace branch |
| `expiry_date <= NOW()` | 401 |
| `superseded_at IS NULL` | **rotate** (D1) → new access cookie **+ new refresh cookie** |
| `superseded_at > NOW() - 30s` AND successor row exists, unrevoked, unexpired | **grace hit** → new access cookie, **no `Set-Cookie` for `m3d_refresh`** |
| otherwise (replay past grace) | 401. Per binding decision 4, this does **not** revoke the family or alert |

**Why a grace hit must not set a refresh cookie.** Both tabs share one cookie jar; the winner's `Set-Cookie` already installed the successor. If the loser also wrote a refresh cookie it would restore the *superseded* token, pinning the session to a value that dies in 30s. Not writing it is the correctness property, and it removes any need to store or return plaintext.

**Alternatives rejected**: storing the successor plaintext (defeats hash-at-rest); minting a second sibling on a grace hit (the rotation storm the proposal forbids); cross-tab Web Locks (out of scope per proposal, and no fallback on Astro static pages).

### D3 — `typ` claim and token-type confusion

`typ: "access"` is added in **exactly one place**: the `jwt.sign` call inside `issueAccessCookie` (`sessionCookies.ts`), used by login, register and refresh. It is **required** in exactly one place: `apiAuthMiddleware` rejects `decoded.typ !== 'access'` with 401 after `jwt.verify` succeeds. Pre-deploy JWTs carry no `typ` → deterministic forced logout, testable rather than hoped for.

Confusion is blocked in both directions **by construction**, with `typ` as defence in depth:

- *refresh used as access*: the refresh token is `crypto.randomBytes(32).toString('hex')`, not a JWT — `jwt.verify` fails.
- *access JWT used as refresh*: its SHA-256 was never inserted into `RememberToken`, so `findByHash` misses.
- *plus* the path scope (D4) means the browser cannot even send either cookie to the other route.

**Alternative rejected**: making the refresh token a JWT with `typ: "refresh"` — it would need a denylist to be revocable, which is the approach the user already rejected.

### D4 — Cookie path scoping without losing the set/clear symmetry

`cookieOptions` gains one optional field, `path?: string`, defaulting to `'/'` — every existing call is unchanged. The "every flag identical so clears never mismatch sets" property is preserved not by hoping callers pass the same literal, but by removing the choice: `cookieOptions.ts` exports **one named builder per cookie kind**, and both the set and the clear go through it.

```ts
export const REFRESH_COOKIE = 'm3d_refresh';
export const REFRESH_COOKIE_PATH = '/api/users/refresh'; // app.js mounts apiRouter at '/api'
export const ACCESS_TOKEN_TTL_SECONDS =
  Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 30 * 60; // the no-deploy rollback lever
export const accessCookieOptions = () =>
  cookieOptions({ httpOnly: true, maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000 });
export const refreshCookieOptions = (maxAge?: number) =>
  cookieOptions({ httpOnly: true, maxAge, path: REFRESH_COOKIE_PATH });
```

`logout` calls `refreshCookieOptions()` with no `maxAge` — same builder, same path, so the clear can never miss. `SESSION_MAX_AGE`/`REMEMBER_MAX_AGE` keep their names and now govern the **refresh** token and `m3d_csrf`/`m3d_user`; `authExpiresInSeconds` is retired.

Because `UserApiController.ts` is already at 204/250, PR2 first extracts `setSessionCookies`, `issueAccessCookie`, `issueRefreshCookie` and `clearSessionCookies` into `backend/src/infrastructure/controllers/sessionCookies.ts`.

### D5 — Refresh route middleware chain

```
router.post('/users/refresh', refreshLimiter, controller.refresh);
```

| Layer | Defends | Note |
|---|---|---|
| `helmet`, `cors` (origin allowlist + `credentials: true`, app.js) | cross-site **reading** of the new tokens | already global |
| `cookieParser` | reading `m3d_refresh` | already global |
| `refreshLimiter` (new, `loginLimiter` shape: `REFRESH_LIMIT_WINDOW`/`REFRESH_LIMIT_MAX`, same `JEST_WORKER_ID` escape hatch) | brute force / replay probing | proposal defence #4 |
| **no `apiAuthMiddleware`** | — | the access token is expired *by definition* here |
| **no `csrfGuard`** | — | it requires `req.user.userId`, which does not exist pre-auth. Replaced by: `sameSite: 'lax'` (defence #1), `path` scope (#2, D4), rotation self-revealing a forgery (#3) |
| use case | authenticity | possession of an unguessable 256-bit secret is the whole credential |

`/users/refresh` is added to `csrf.ts`'s `EXEMPT_PATHS` for consistency with the other three, documented as defensive only.

### D6 — Frontend: cycle-free `lib/http` facade, per-tab single flight

`frontend.domain.locality` (`engine.js:56`) permits a `domains/**` file to import only its own domain or `frontend/src/config.ts`; `layer()` returns `null` for `frontend/src/lib/**`, so that tree is unconstrained. The naive "put it in `lib/http` and re-export from `config.ts`" creates a **real import cycle** (`config.ts → lib/http/authFetch → config.ts` for `withCredentials`). Resolved by making `config.ts` a pure downward facade:

| File | Content |
|---|---|
| `frontend/src/lib/http/apiBase.ts` | the `API_URL` expression, moved verbatim |
| `frontend/src/lib/http/credentials.ts` | `readCookie`, `readCsrfToken`, `withCredentials`, `getSessionUser`, `SessionUser`, moved verbatim |
| `frontend/src/lib/http/refreshSingleFlight.ts` | module-scoped `let inFlight: Promise<boolean> \| null`; `ensureRefreshed()` returns the in-flight promise if set, else POSTs `${API_URL}/api/users/refresh` (`credentials: 'include'`, no CSRF header) and clears `inFlight` in `finally` |
| `frontend/src/lib/http/authFetch.ts` | `fetch(url, withCredentials(init))`; on 401 → `ensureRefreshed()`; on true retry **exactly once**, re-running `withCredentials` so the header is re-read; on false → `clearSession()` + redirect to `/login`. Never retries twice; never wraps the refresh call itself |
| `frontend/src/config.ts` | re-exports all of the above (~30 lines total, down from 118) |

Re-export keeps every domain import specifier unchanged — the same technique `session.service.ts`/`csrf.ts` already use, and the engine resolves the edge to `config.ts`, so the rule still passes.

**Adoption: the 9 credentialed sites in 5 files** — `order.service.ts` (2), `product.admin.service.ts` `create`/`update`/`remove`/`adjustStock` (4), `cartSync.ts` (1), `checkout.ts` (1), `cartHydration.ts` (1). **Excluded on purpose**: the 7 public no-credential reads (`product.service.ts` ×2, `product.search.service.ts` ×3, `product.admin.service.ts` `list`/`getById`) — they cannot 401; and the 3 auth endpoints (`auth.service.ts` login/register, `session.service.ts` logout) — a 401 there is a credentials failure, and refreshing on it would loop.

**Alternatives rejected**: keeping everything in `config.ts` (204→~200 lines is survivable but concentrates four unrelated concerns and blocks the cycle-free layering); accepting the ESM cycle (works until bundler ordering changes and fails silently); a service-worker or global `fetch` monkey-patch (invisible control flow, and would wrap the excluded 10).

### D7 — Retention without a cron

Step 3 of D1's transaction. It deletes only rows of *this* family whose grace has already elapsed, so it can never touch the current row or a row inside its grace window. Only the rotation winner reaps, so two reapers never contend on the same family. Result: a family holds ~2 rows regardless of session length, replacing the proposal's ~1,440-row worst case. Indexed by `family_id`.

**Alternative rejected**: a scheduled job — there is no scheduler in this codebase and adding one for two rows is disproportionate.

### D8 — PR slices, and why PR2 is safe to merge alone

| PR | Contents | Merge-alone safety |
|---|---|---|
| **1** | Migration (`family_id char(36) NOT NULL` + index, `superseded_at datetime NULL`, `successor_hash varchar(64) NULL`, `revoked_at datetime NULL`; drop `token_hash_2..5`; `down` restores all four), `RememberToken.js` model fields, **`checkPendingMigrations.js` `REQUIRED_SCHEMA`/`REQUIRED_COLUMN_DEFINITIONS`**, entity, port, repository, rotate/verify/revoke/reap use cases | Zero production callers before or after — the slice stays dead code. **Deploy-order constraint**: `pnpm db:migrate` must run with this deploy or the boot gate fails fast (existing, intended behaviour) |
| **2** | `sessionCookies.ts` extraction, `typ` set + required, cookie split and path scope, `POST /api/users/refresh` + `refreshLimiter`, logout revokes the family | **Functionally complete on its own**: auth works, and logout becomes genuinely revocable — the actual HIGH-1 fix. It is also the forced-logout deploy. Degradation without PR3 is UX-only: at 30 min a user hits a 401 that today's per-service handling surfaces as re-login (`order.service` maps it to `UNAUTHENTICATED`, `product.admin.service` to a typed 401, `cartHydration` to "logged out") — the same experience the deploy already imposes once. **Bounded by the env lever**: if PR2 ships without PR3, set `ACCESS_TOKEN_TTL_SECONDS` to the old session length; PR3 then lowers it with no code change |
| **3** | `lib/http/*`, `config.ts` facade, 9 call-site adoptions, multi-tab refresh-race E2E | Additive; reverting it restores PR2's behaviour exactly |

**Alternative rejected**: merging PR2+PR3 as one PR — it lands ~700 changed lines against a 400-line budget, and it couples a security cutover to a frontend refactor in one review.

## Data Flow

```
tab A ─┐                             ┌── claim UPDATE (affected=1) ──▶ INSERT successor ──▶ reap
       ├─▶ POST /api/users/refresh ──┤        [one SequelizeUnitOfWork transaction]
tab B ─┘   (m3d_refresh, path-scoped)└── claim UPDATE (affected=0) ──▶ ROLLBACK
                                                    │
   winner  ◀── 200 + Set-Cookie m3d_auth + Set-Cookie m3d_refresh
   loser   ◀── 200 + Set-Cookie m3d_auth ONLY  (grace hit; jar keeps the winner's refresh)
   replay  ◀── 401                             (past grace; no family revocation — deferred)
```

## File Changes

| File | Action | PR |
|---|---|---|
| `backend/src/database/migrations/2026090100000-refresh-token-rotation.js` | Create | 1 |
| `backend/src/database/models/RememberToken.js` | Modify — 4 fields | 1 |
| `backend/src/database/checkPendingMigrations.js` | Modify — 4 columns in both maps | 1 |
| `backend/src/domain/entities/RememberToken.ts` | Modify — 4 fields | 1 |
| `backend/src/domain/ports/RememberTokenRepositoryPort.ts` | Modify — `claimRotation`, `findByHash`, `insertSuccessor`, `revokeFamily`, `reapFamily` | 1 |
| `backend/src/infrastructure/repositories/SequelizeRememberTokenRepository.ts` | Modify — raw conditional UPDATE, tx-aware | 1 |
| `backend/src/application/use-cases/{Rotate,Revoke}RefreshTokenUseCase.ts` | Create | 1 |
| `backend/src/application/use-cases/{Create,Verify,Delete}RememberTokenUseCase.ts` | Modify — family/expiry semantics | 1 |
| `backend/src/infrastructure/controllers/sessionCookies.ts` | Create — extracted from the controller | 2 |
| `backend/src/infrastructure/security/cookieOptions.ts` | Modify — `path`, `REFRESH_COOKIE`, TTL, named builders | 2 |
| `backend/src/infrastructure/middlewares/auth.ts` | Modify — require `typ === 'access'` | 2 |
| `backend/src/infrastructure/middlewares/refreshLimiter.ts` | Create | 2 |
| `backend/src/infrastructure/middlewares/csrf.ts` | Modify — `EXEMPT_PATHS` (defensive) | 2 |
| `backend/src/infrastructure/controllers/UserApiController.ts` | Modify — `refresh`, revoking `logout` | 2 |
| `backend/src/infrastructure/routes/api/users.ts` | Modify — composition + route + OpenAPI JSDoc | 2 |
| `frontend/src/lib/http/{apiBase,credentials,refreshSingleFlight,authFetch}.ts` | Create | 3 |
| `frontend/src/config.ts` | Modify — pure re-export facade | 3 |
| 5 service files (9 call sites) | Modify — `fetch` → `authFetch` | 3 |
| `e2e/tests/refresh-race.spec.ts` | Create | 3 |
| `.env.example` | Modify — `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_LIMIT_*` | 2 |

`Sha256TokenHasher.ts` and `TokenHasherPort.ts` are reused **unchanged**.

## Interfaces / Contracts

```ts
// domain/ports/RememberTokenRepositoryPort.ts (additions)
claimRotation(input: {
  presentedHash: string; successorHash: string; tx: TransactionContext;
}): Promise<boolean>;                       // false === lost the race, caller must roll back
insertSuccessor(row: RememberToken, tx: TransactionContext): Promise<RememberToken>;
revokeFamily(familyId: string): Promise<number>;
reapFamily(familyId: string, graceSeconds: number, tx: TransactionContext): Promise<number>;
```

```
POST /api/users/refresh
  in : cookie m3d_refresh (opaque hex, path-scoped) — no body, no CSRF header
  200: { user: {...} } + Set-Cookie m3d_auth [+ Set-Cookie m3d_refresh on rotation only]
  401: { error: 'Sesión expirada' }      429: rate-limited
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `RotateRefreshTokenUseCase` branch table (D2's six rows); `authFetch` retry-once and no-retry-on-second-401; `refreshSingleFlight` collapses N concurrent callers into 1 request; `cookieOptions` set/clear flag symmetry incl. `path`; `apiAuthMiddleware` rejects missing/`refresh` `typ` | Jest, ports mocked |
| Integration | Two concurrent rotations against a real MySQL → exactly one `affectedRows=1`; grace hit issues no `m3d_refresh`; logout revokes and beats an in-grace token; reap caps a family at 2 rows; `family_id` populated on every row; migration `down` restores the baseline schema byte-for-byte | Existing `testDb.ts` harness |
| E2E | `e2e/tests/refresh-race.spec.ts` — two tabs, one context, simultaneous expiry; both stay logged in. Legacy `typ`-less JWT → 401 → refresh attempt → clean `/login` | Playwright, alongside `cross-tab-session.spec.ts` |

Strict TDD: every row above is RED first.

## Threat Matrix

The matrix in `references/threat-matrix.md` covers shell/VCS/PR/executable-file boundaries. This change touches none of them.

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification or execution |
| Git repository selection | N/A — no VCS invocation |
| Commit state | N/A — no index/worktree operation |
| Push state | N/A — no ref resolution |
| PR commands | N/A — no PR automation |

The real adversarial surface here is HTTP, and it is covered as first-class design in D2 (replay, grace abuse, logout-beats-grace), D3 (token-type confusion, legacy-JWT acceptance), D4 (cookie path/flag mismatch) and D5 (CSRF, cross-site read, brute force), each with a mapped RED test above.

## Migration / Rollout

One Umzug migration following `20260828000000-orders.js` conventions (raw SQL, `queryInterface.sequelize.transaction`, attributed try/catch naming exactly which statements already committed). MySQL/InnoDB implicitly commits per DDL statement, so the transaction is idiomatic scoping, **not** rollback protection — the error message must name the applied statements so an operator can clean up by hand.

`family_id char(36) NOT NULL` on a table with zero production rows needs no backfill or default. Deploy order: `pnpm db:migrate`, then PR1. Runbook: deploy PR2 in a low-traffic window with the login-page notice (binding decision 2).

## Open Questions

None blocking. Two calls made here that `sdd-tasks` should carry forward as stated: the grace response sets **no** refresh cookie (D2), and the successor inherits the predecessor's `expiry_date` rather than sliding it (D1).
