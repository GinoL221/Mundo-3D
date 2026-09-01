# Proposal: Refresh Tokens with Rotation (HIGH-1)

**Baseline**: `main` @ `5017e55` · **Input**: `exploration.md` · **Approach fixed by user**: refresh tokens, not a `jti` denylist.

## Intent

`UserApiController.logout` (`backend/src/infrastructure/controllers/UserApiController.ts:107-117`) only calls `res.clearCookie`. The JWT is stateless and carries no `jti`, so a captured `m3d_auth` cookie keeps authenticating until its own `exp` — up to 30 days with "remember me". Logout is a client-side illusion. Split the session into a short access token plus a revocable, rotating refresh token so logout, and any future revocation, are real.

## Decisions (the four open questions)

| # | Decision | Reasoning | Accepted cost |
|---|---|---|---|
| 1 | **Rotate on every use**, and provision family columns in the same migration while shipping reuse-*revocation* as a fast-follow | A leak is bounded to one refresh cycle. Refresh tokens live up to 30d, so a *later* migration would leave a 30-day window with no family data to detect reuse against; one nullable column now costs far less than a second migration on a live auth table plus a backfill | `family_id` is written but not yet read; a test must assert it is populated |
| 2 | **Server-side grace window** (30s), *plus* per-tab single-flight in the retry wrapper | The exploration frames these as alternatives; they are complementary and single-flight is nearly free inside the wrapper we are already writing. A grace hit MUST NOT rotate again — see the corrected mechanic below, since returning the stored successor is impossible | A bounded 30s reuse window; `superseded_at`/`successor_hash` columns |
| 3 | **Access token fixed at 30 min (env-tunable); the refresh token carries `remember`** (2h / 30d) | `SESSION_MAX_AGE`/`REMEMBER_MAX_AGE` keep their meaning, reassigned to the refresh token. Nothing here wants a longer *access* token when remembered. Env-tunable TTL is also the rollback lever (see below) | Refresh traffic on every session; `m3d_csrf` and `m3d_user` must keep the **refresh** lifetime, or the UI appears logged out at 30 min while the session is alive |
| 4 | **Forced logout at deploy, via a required `typ: "access"` JWT claim** — *not* by hoping old tokens stop working | **Correction to the exploration.** The 2026-08-26 precedent worked because the transport changed and old clients had no cookie. Here the cookie name, secret and token shape are unchanged, so existing 30-day JWTs would keep passing `apiAuthMiddleware`. Requiring `typ` makes the cutover deterministic and testable, needs no ops step, and blocks refresh→access token-type confusion | Every live session ends at deploy; remember-me users log in once more |

Legacy tokens then 401 → the new frontend handler attempts refresh → no refresh cookie → clean redirect to login. Forced logout becomes a tested path, not an error.

## Mandatory schema migration

New hand-written raw-SQL Umzug migration with a working `down`, per `openspec/specs/schema-migrations/spec.md`, altering `RememberToken` (`backend/src/database/migrations/20260724000000-baseline.js:120-136`):

| Column | Type | Purpose |
|---|---|---|
| `family_id` | `char(36) NOT NULL`, indexed | One login's rotation chain |
| `superseded_at` | `datetime NULL` | NULL = current; grace = `superseded_at > NOW() - 30s` |
| `successor_hash` | `varchar(64) NULL` | Returned on a grace hit so grace never re-rotates |
| `revoked_at` | `datetime NULL` | Logout revokes the family without deleting rows |

**Drop `token_hash_2..5`: yes, same migration.** They are pure write amplification on a table that goes from zero traffic to one INSERT + one UPDATE per refresh. `token_hash` UNIQUE stays — it is the lookup key. `down` recreates all four. Risk is nil: the slice has zero production callers today.

**Retention (missed by the exploration):** a 30d session refreshing every 30 min is ~1,440 rows. On each successful refresh, delete that family's rows already past the grace window. Caps a family at ~2 rows and needs no cron.

## CSRF exemption for `POST /api/users/refresh`

Exempt from `csrfGuard` **and** not behind `apiAuthMiddleware` — a refresh happens exactly when `req.user.userId`, which `csrfGuard` requires, may be expired, so the current post-auth ordering cannot be reused. This is **not** logout's exemption: logout is fail-safe (it only removes authority), refresh *grants* it. Its own defenses:

1. The refresh cookie is httpOnly with `sameSite: 'lax'`, which does not accompany a cross-site POST — the primary defense.
2. Issue it with `path: '/api/users/refresh'`, so it is never sent on any other request. `cookieOptions` hardcodes `path: '/'` and must be extended.
3. Rotation makes a forged refresh self-revealing.
4. Rate-limit the route, reusing the login limiter pattern.

**`m3d_csrf` does not rotate.** Verified: `csrfToken.ts:45-46` HMACs `userId + "." + random`, binding to the user, not to the access token.

## Capabilities

### New
- `refresh-token-rotation`: refresh endpoint, rotate-on-use, grace window, family provisioning, logout revocation, retention.

### Modified
- `api-jwt-auth`: logout MUST revoke; access TTL fixed and short; remember-me moves to the refresh token; `typ` claim required. **This is the accurate live spec and the baseline `sdd-spec` must diff against.**
- `remember-token-store`: **also stale, in a second way the exploration missed** — it specifies `UserService.createRememberToken/verifyRememberToken/deleteRememberToken` and fields `UserId`/`TokenHash`/`ExpiresAt`, none of which exist. Live code is `RememberTokenRepositoryPort` + `Create/Verify/DeleteRememberTokenUseCase` with `idUser`/`tokenHash`/`expiryDate`. In scope because this change revives that exact slice.
- `csrf-protection`: the refresh-route exemption and its rationale.
- `session-cookie-security`: per-cookie lifetimes and the path-scoped refresh cookie.

## Scope

### In scope
- Migration above; revived `RememberToken` slice with rotation (reuse `Sha256TokenHasher`/`TokenHasherPort` unchanged).
- `POST /api/users/refresh`; logout revokes the family; `typ: "access"` enforced in `apiAuthMiddleware`.
- Split cookie lifetimes in `cookieOptions.ts`; path-scoped refresh cookie.
- Retry-on-401 + single-flight wrapper in `frontend/src/config.ts`, adopted across 9 services / 17 `fetch` sites.
- Tests first (strict TDD), including a new multi-tab refresh-race E2E alongside `cross-tab-session.spec.ts`.

### Out of scope (explicit)
- **`openspec/specs/user-auth/spec.md`** — verified stale at lines 12 and 46 ("JWT in the JSON body… MUST NOT issue session cookies"), but caused by the 2026-08-26 migration, not by this change. Correcting it here mixes an unrelated fix into a security change. Registered as a named follow-up; `sdd-spec` must not use it as a baseline.
- Reuse-detection *revocation* (columns ship now, logic later).
- Cross-tab leader election / Web Locks.
- **Other security-review findings**: account enumeration, IP-only rate limiting, and the four LOW hardening items are separate work.
- Any change to `m3d_csrf` issuance or the HMAC.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Forced logout is a real UX regression for remember-me users | High (certain) | Deliberate and precedented; surface to the user before apply |
| Grace window re-rotates under a tab storm | Med | Grace path returns `successor_hash`, never rotates |
| Refresh loop on a hard 401 | Med | Single-flight + refresh-once-then-redirect |
| `config.ts` concern-creep past 250 lines | Med | Split to `frontend/src/lib/http/*` re-exported from `config.ts` — legal under `frontend.domain.locality` |
| **Exceeds the 400-line review budget** | High | Chained PRs, below |

## Delivery — honest size signal

Backend (migration, entity, port, 4 use cases, repository, controller, routes, middleware, cookies) plus 9 frontend services / 17 fetch sites plus TDD tests will **clearly exceed 400 lines**.

**Chained PRs recommended: Yes** · **400-line budget risk: High** · **Decision needed before apply: Yes** (`ask-on-risk`)

1. Migration + revived slice with rotation semantics (backend data layer, no endpoint).
2. Refresh endpoint, `typ` claim, cookie split, logout revocation.
3. Frontend wrapper + call-site adoption + cross-tab race E2E.

## Rollback plan

- **Per PR**: revert the branch. PR1's migration `down` drops the four new columns and restores `token_hash_2..5`.
- **Incident lever without a deploy**: raise the access-token TTL env var, restoring long-lived sessions while refresh stays available.
- Reverting PR2 or PR3 alone would strand 30-minute sessions with no refresh — revert PR3 together with PR2, or widen the TTL first.
- Forced logout is not reversible; it is also harmless once users have re-authenticated.

## Success criteria

- [ ] After `POST /api/users/logout`, the prior **refresh** token is rejected immediately, and no new access token can be minted from it — verified by test, not by cookie clearing. See "Residual exposure" below for why the access token itself is not instantly invalidated.
- [ ] A pre-deploy 30-day JWT is rejected by `apiAuthMiddleware` and lands the user on login.
- [ ] Two tabs refreshing concurrently both stay logged in (E2E).
- [ ] A refresh token replayed after rotation + grace fails; `family_id` is populated on every row.
- [ ] `POST /api/users/refresh` succeeds with an expired access token and is rejected cross-site.
- [ ] The migration's `down` restores the baseline schema exactly.

## Decisions confirmed by the maintainer (2026-09-01)

The proposal's four questions were put to the maintainer and answered. **These answers are binding on `sdd-spec`, `sdd-design`, `sdd-tasks` and `sdd-apply`.**

| Question | Answer | Effect on this proposal |
|---|---|---|
| Delivery under the 400-line budget | **Three chained PRs, stacked to main**, merged in order | `delivery_strategy: auto-chain` resolved; `chain_strategy: stacked-to-main`. The three slices in "Delivery" stand as written |
| Forced-logout handling | **Low-traffic deploy window plus a notice on the login page.** No prior announcement | Matches the 2026-08-26 precedent. No extra engineering work; an operational note belongs in the runbook |
| Access-token TTL | **30 minutes**, not the proposed 15 | **Amended above.** Doubles the stolen-access-token window in exchange for less refresh chatter on slow catalogue browsing. Still env-tunable, so it remains the no-deploy rollback lever |
| Reuse revocation in slice 1 | **Deferred, as proposed** | `family_id` is still provisioned in the PR1 migration; revocation-on-reuse is a fast-follow. A replayed refresh token fails but does not revoke the family or alert |

Out of scope, decided by the orchestrator: `openspec/specs/user-auth/spec.md` stays stale here and is corrected in a separate small commit, so this over-budget change is not inflated further. `openspec/specs/remember-token-store/spec.md` remains **in** scope, since this change revives that exact slice.

## Residual exposure after logout — read this before assuming logout is instant

**Corrected 2026-09-01, raised by `sdd-spec`.** The original success criterion claimed logout would reject "the prior access **and** refresh tokens". That is **not achievable** under decision #1, which explicitly rejects a `jti` denylist: the access token is a stateless JWT, so nothing consults a store when it is verified, and there is no handle to revoke it by.

What logout actually guarantees:

1. The refresh token is revoked immediately and provably — its family is marked revoked, so no new access token can ever be minted from that session.
2. The access token therefore **cannot be renewed**, and dies on its own TTL.

**So a token captured before logout keeps working for up to the access TTL — currently 30 minutes.**

That is still a reduction from the pre-change exposure of **up to 30 days**, which is the point of HIGH-1. But it is a real residual window, and it doubled when the access TTL was set to 30 minutes instead of 15. The TTL env var is the dial: lowering it shrinks this window directly.

Closing the window completely requires the `jti` denylist that decision #1 declined, or short enough access TTLs that the residue is negligible. Reuse-revocation (the deferred fast-follow) does **not** close it either — it addresses stolen *refresh* tokens, not stolen access tokens.

## Corrected grace mechanic — the proposed one is impossible

**Corrected 2026-09-01, raised by `sdd-design`.** This proposal originally required that a grace hit "return the stored `successor_hash` token". **That cannot be done.** `successor_hash` is a SHA-256 digest and the plaintext token is never stored — a token cannot be recovered from its hash. Implementing this literally would have failed during apply.

The correct mechanic, which the design adopts and which is stronger anyway:

> **A grace hit issues a fresh access cookie and deliberately sets no `m3d_refresh` cookie at all.**

Why omitting the cookie is a *correctness* requirement rather than an optimisation: both tabs share one browser cookie jar. The rotation winner's `Set-Cookie` has already installed the successor refresh token. If the losing tab also wrote a refresh cookie, its response would overwrite that with the **superseded** value and pin the whole session to a token that expires in 30 seconds.

Only the rotation winner may ever write the refresh cookie.

## Additional corrections from `sdd-design`

- **`backend/src/database/checkPendingMigrations.js` must be updated in PR1.** Verified: it hardcodes `REQUIRED_SCHEMA.RememberToken` (line 17) and `REQUIRED_COLUMN_DEFINITIONS.RememberToken` (line 42), and its own comment says it exists to protect tables the app never queries — naming `RememberToken` — from silent schema drift. Miss it and the boot gate silently stops covering the four new columns. Neither the exploration nor this proposal found it.
- **There is no `csrfGuard` "exemption" to write.** It is mounted per write route, not globally; `EXEMPT_PATHS` is purely defensive. Exempting the refresh route means simply not mounting it.
- **Frontend scope is narrower and differently shaped than "17 fetch sites".** There are 19 real `fetch(` calls across 9 production service files, but only **9 are credentialed** (across 5 files) and belong in the retry wrapper. The other 10 must be excluded deliberately: 7 are public no-credential reads that cannot 401, and 3 are the auth endpoints themselves, where retrying on 401 would loop.
- **`typ` does not block token-type confusion "in both directions"** as claimed here — the refresh token is not a JWT. Confusion is blocked structurally (an opaque random string fails `jwt.verify`; an access JWT's hash is never in the table). `typ`'s real job is the deterministic legacy cutover.
- **`UserApiController.ts` is at 204 of its 250-line budget**, so PR2 must extract `sessionCookies.ts` before adding the refresh handler.

## One design decision the proposal did not make

**Refresh `expiry_date` is inherited across rotations, not slid.** A family carries one absolute deadline, matching how `m3d_csrf`/`m3d_user` set `maxAge` once at login. A sliding window would make a 30-day remember-me session effectively perpetual. If sliding sessions are wanted, this is the decision to revisit — it is the design's call, not the maintainer's, and is flagged here for visibility.
