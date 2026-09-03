```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:761d8d2bc2fac5c7c739f7e5c1a959f3a737796e869a7b5276676e6e29bd5962
verdict: fail
blockers: 1
critical_findings: 1
requirements: 13/14
scenarios: 41/44
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:3fefec1661c1c4a8329c3a2836d8dce951f35746092afdb8c1f7e501928bca63
build_command: pnpm type-check
build_exit_code: 0
build_output_hash: sha256:142ca3df7a3750a463c37089b26580332e55f5eb2457dcf45594c700bb207c80
```

## Verification Report

**Change**: auth-refresh-tokens
**Version**: N/A (OpenSpec deltas, 5 spec files)
**Mode**: Strict TDD
**Verify round**: 4 — **supersedes the third FAIL report** previously stored at this path
**Verified against**: working tree of `feat/auth-refresh-tokens-03-frontend` @ `29b6821` (PR1+PR2 merged to `main`; PR3 branch-only)

### Supersession notice

This report replaces the third-round FAIL verdict. What changed since that verdict:

| Third-round finding | Independently re-checked | Outcome |
|---|---|---|
| CRITICAL — `specs/api-jwt-auth/spec.md:106` required the access **cookie**'s expiration to equal the access-token TTL | Line 106 now reads "the access **token**'s own `exp` MUST remain the fixed access-token TTL, while its cookie's `maxAge` follows the extended session" | ✅ **Resolved.** Consistent with `specs/session-cookie-security/spec.md:9`, with `cookieOptions.ts:78-79`, and with the prose nine lines above at `:97-99` |
| CRITICAL — the added scenario "An expired access token is still rejected" had no test; the existing case passed a malformed string that fails at parse | `middlewares/__tests__/auth.test.ts:48-61` now signs a real token with `expiresIn: -60`, same secret, `typ: 'access'` present — so it clears the `typ` gate and can only fail on `jwt.verify`'s expiry branch. Old case renamed "malformed token" at `:63` | ✅ **Resolved.** The assertion is genuine, not a parse failure in disguise |
| WARNING — stale statements in `sessionCookies.ts` | `sessionCookies.ts:49-52` and `:58-60` now state the token's `exp` is fixed while the cookie follows the session lifetime | ✅ **Resolved** |
| Predecessor finding — `reapFamily` never called on a `grace` outcome | Confirmed at source: `reapFamily` has exactly one production caller, `RotateRefreshTokenUseCase.ts:52`, inside the rotation transaction. `RefreshSessionUseCase.resolveGraceOrReject` performs only reads (`findByHash`, `findById`) and returns `{ outcome: 'grace' }`. `29b6821` narrowed the requirement to rotation rather than widening the code | ✅ **Spec now matches code.** The added scenario's *test* is a gap — see W1 |

**A new CRITICAL was found in a place none of the four rounds had looked: the refresh handler's own cookie issuance.** See C1.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 52 |
| Tasks complete | 52 |
| Tasks incomplete | 0 |

All 52 tasks are `[x]`. Four carry explicit `NOT EXECUTED` annotations (1.1, 1.2, 1.18, 1.19) for the integration tier — honestly disclosed, and consistent with the local MySQL constraint below.

### Build & Tests Execution

**Build**: ✅ Passed — `pnpm type-check` → `tsc --noEmit`, exit 0.

**Tests**: ✅ `pnpm test` exit 0 — **1007/1007 backend** (122 suites) + **242/242 frontend** (20 files). Matches the orchestrator's reported counts exactly.

**Tiers that could not run locally**: `pnpm test:integration` and `pnpm test:e2e` were **not executed** — host port 3306 is held by the maintainer's MariaDB, and no Playwright run was attempted. Every integration/e2e result credited in the matrix below rests on **CI**, not on local observation. CI was green at `691e41b` on all four checks of PR #116; `29b6821` is a docs-only commit touching one spec file with no code delta, so the code tiers are unchanged by it, but its CI run is **not confirmed complete** at the time of writing.

**Coverage**: ➖ Not collected this run (no coverage flag in the root `test` script).

### Spec Compliance Matrix

Totals: **14 requirements, 44 scenarios** across the five delta specs (api-jwt-auth 4/16, refresh-token-rotation 5/13, session-cookie-security 2/5, remember-token-store 2/8, csrf-protection 1/2).

#### api-jwt-auth — 16/16 ✅

| Scenario | Test | Result |
|---|---|---|
| Successful login sets an auth cookie | `apiUsersLogin.test.js:79`; `UserApiController.test.ts:210` | ✅ COMPLIANT |
| API login with invalid credentials | `apiUsersLogin.test.js:117`, `:129` | ✅ COMPLIANT |
| API login exceeds rate limit | `trustProxy.test.js:83` — **real** `loginLimiter` via `loadRealLoginLimiter`, real 429 | ✅ COMPLIANT |
| Access token TTL is fixed regardless of remember | `UserApiController.test.ts:263` — loops `[true,false,undefined]`, asserts `exp-iat === ACCESS_TOKEN_TTL_SECONDS` | ✅ COMPLIANT |
| Request to protected API without cookie | `auth.test.ts:28`; `users.test.ts:66` | ✅ COMPLIANT |
| Request to protected API with invalid or expired cookie | `auth.test.ts:48` (real expiry) + `:63` (malformed) | ✅ COMPLIANT |
| Request to protected API with valid cookie | `auth.test.ts:70`; `users.test.ts:94` | ✅ COMPLIANT |
| Bearer header alone is rejected | `auth.test.ts:104`; `apiUsersLogin.test.js:278` | ✅ COMPLIANT |
| Admin-only API view with non-admin cookie | `users.test.ts:80`, `:87` | ✅ COMPLIANT |
| Pre-deploy JWT without typ claim is rejected | `auth.test.ts:84`; e2e `refresh-race.spec.ts:105` (CI) | ✅ COMPLIANT |
| Logout clears the session cookies | `UserApiController.test.ts:351` | ✅ COMPLIANT |
| Logout revokes the refresh family | `UserApiController.test.ts:373`, `:398` (expired-token case) | ✅ COMPLIANT |
| Prior access token cannot be renewed after logout | `RefreshSessionUseCase.test.ts:69` (revoked beats grace); integration `:280` `claimRotation refuses a revoked row` (CI) | ✅ COMPLIANT |
| Logout without an active session | `UserApiController.test.ts:384`; `users.test.ts:152` | ✅ COMPLIANT |
| Remember-me extends the refresh token, not the access token | `apiAuthCookieLifecycle.test.ts:219`; `UserApiController.test.ts:263` | ✅ COMPLIANT |
| Remember-me not requested keeps default refresh lifetime | `apiAuthCookieLifecycle.test.ts:243` | ✅ COMPLIANT |

#### refresh-token-rotation — 11/13

| Scenario | Test | Result |
|---|---|---|
| Refresh succeeds with an expired access token | `UserApiController.test.ts:439`; e2e `refresh-race.spec.ts:50` (CI) | ✅ COMPLIANT |
| Refresh rejected without a valid refresh cookie | `UserApiController.test.ts:474`, `:484` | ✅ COMPLIANT |
| Cross-site refresh request is rejected | Preconditions asserted (`sameSite:'lax'` `cookieOptions.test.ts:147`; `Path` `:80` and e2e `auth.spec.ts:104`); no test performs an actual cross-site POST | ⚠️ PARTIAL |
| Refresh rate limit | `apiSecurity.test.js:254` — real limiter under `NODE_ENV=production`, exhausts 10, observes real 429 | ✅ COMPLIANT |
| Remembered session issues a 30-day refresh token | `apiAuthCookieLifecycle.test.ts:219`; e2e `auth.spec.ts:100` (CI) | ✅ COMPLIANT |
| Default session issues a 2-hour refresh token | `apiAuthCookieLifecycle.test.ts:243`; e2e `auth.spec.ts:132` (CI) | ✅ COMPLIANT |
| Successful refresh rotates the token | `RotateRefreshTokenUseCase.test.ts:62`; `RefreshSessionUseCase.test.ts:88`; integration `:88` (CI) | ✅ COMPLIANT |
| Grace hit issues an access cookie only, without re-rotating | `UserApiController.test.ts:458` (asserts refresh cookie **undefined**); `RefreshSessionUseCase.test.ts:105` | ✅ COMPLIANT |
| Replay past the grace window fails | `RefreshSessionUseCase.test.ts:125` | ✅ COMPLIANT |
| Family id is populated on every row | integration `:156` (CI) | ✅ COMPLIANT |
| Two tabs refresh concurrently and both stay logged in | e2e `refresh-race.spec.ts:50` (CI); integration `:88`, `:129` (CI) | ✅ COMPLIANT |
| Old superseded rows are reaped on rotation | `RotateRefreshTokenUseCase.test.ts:62`; integration `:221` (CI) | ✅ COMPLIANT |
| **A grace hit leaves the family untouched** | `RefreshSessionUseCase.test.ts:105` asserts only `mockRotate.execute` not called | ⚠️ PARTIAL — see W1 |

#### session-cookie-security — 4/5

| Scenario | Test | Result |
|---|---|---|
| The auth cookie outlives the token it carries | `UserApiController.test.ts:277` (cookie `maxAge` = session) + `:282` (token `exp` = TTL); `cookieOptions.test.ts:65`, `:70`; e2e `auth.spec.ts:111-114` | ✅ COMPLIANT |
| An expired access token is still rejected for authentication | `auth.test.ts:48` — signed with `expiresIn: -60` | ✅ COMPLIANT |
| CSRF and display cookies expire with the refresh token | `UserApiController.test.ts:287`; `apiAuthCookieLifecycle.test.ts:219`, `:243` | ✅ COMPLIANT |
| Refresh cookie is scoped to the refresh route | `cookieOptions.test.ts:80`; e2e `auth.spec.ts:104` | ✅ COMPLIANT |
| Refresh cookie is not sent to other endpoints | `Path=/api/users/refresh` asserted; browser non-attachment never observed | ⚠️ PARTIAL |

**Requirement-level violation not visible in this scenario set** — see C1. The requirement's prose ("All four session cookies MUST use the refresh-token lifetime") is unscoped, but all three of its scenarios are scoped `GIVEN a successful login`. The refresh path is therefore normatively covered and behaviourally unchecked.

#### remember-token-store — 8/8 ✅

| Scenario | Test | Result |
|---|---|---|
| User association is configured | `models/__tests__/index.test.js`; `RememberTokenModel.test.js` | ✅ COMPLIANT |
| New rows carry rotation metadata | integration `:156` (CI); `SequelizeRememberTokenRepository.test.ts` | ✅ COMPLIANT |
| Legacy duplicate indexes removed | `migrate.integration.test.js` (CI) | ✅ COMPLIANT |
| Migration down restores the baseline schema exactly | `migrate.integration.test.js` (CI) | ✅ COMPLIANT |
| Creating a token hashes and stores it | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |
| Verifying returns the user or cleans up expired | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |
| Verifying a revoked token fails without deleting it | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |
| Deleting removes the record | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |

#### csrf-protection — 2/2 ✅

| Scenario | Test | Result |
|---|---|---|
| Refresh request without a CSRF token succeeds | `csrf.test.ts:109` | ✅ COMPLIANT |
| Refresh route bypasses the guard entirely | `users.ts:200` mounts `refreshLimiter` only; exhaustive audit of all six route modules confirms `csrfGuard` is mounted per-route and never globally; `csrf.ts:23` keeps a defensive `EXEMPT_PATHS` entry so the outcome holds either way | ✅ COMPLIANT |

**Compliance summary**: **41/44 scenarios compliant**, 3 PARTIAL, 0 FAILING, 0 UNTESTED.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| API JWT Login Endpoint | ✅ Implemented | `ACCESS_TOKEN_TTL_SECONDS` default `30*60` (`cookieOptions.ts:21`), env-tunable; `loginLimiter` mounted `users.ts:176` |
| Cookie-Based Authorization | ✅ Implemented | `auth.ts:23-32` — cookie only, `typ === 'access'` required |
| Logout Endpoint | ✅ Implemented | `UserApiController.ts:114-126`; `readFamilyIdFromAccessToken` uses `ignoreExpiration` with signature still verified |
| Remember-Me Extended Session | ✅ Implemented | `authMaxAge` governs refresh + cookies; token `exp` fixed |
| Refresh Endpoint | ✅ Implemented | `users.ts:200`, no `apiAuthMiddleware`, no `csrfGuard`, `refreshLimiter` present |
| Refresh Token Carries the Remember Distinction | ✅ Implemented | `SESSION_MAX_AGE` 2h / `REMEMBER_MAX_AGE` 30d |
| Rotation on Every Use With a Grace Window | ✅ Implemented | `claimRotation` conditional UPDATE; grace path writes nothing; refresh cookie only on `rotated` (`UserApiController.ts:154`) |
| Concurrent Refresh From Multiple Tabs | ✅ Implemented | Grace window + single-flight frontend wrapper |
| Retention on Rotation | ✅ Implemented | `reapFamily` called only from `RotateRefreshTokenUseCase.ts:52` — matches the narrowed spec |
| Per-Cookie Lifetime Split | ❌ **Violated on the refresh path** | See C1 |
| Refresh Cookie Path Scoping | ✅ Implemented | `refreshCookieOptions` sets `path: REFRESH_COOKIE_PATH` |
| Model Schema and Associations | ✅ Implemented | Migration `20260901000000-refresh-token-rotation.js` |
| Service Hashed Token Management | ✅ Implemented | Create/Verify/Delete use cases |
| Refresh Endpoint CSRF Exemption | ✅ Implemented | Verified by exhaustive mount audit |

**Requirements complete: 13/14.**

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1 — claim → insert successor → reap in one transaction | ✅ Yes | `RotateRefreshTokenUseCase.ts:32-55` |
| D2 — six-row lookup table in `RefreshSessionUseCase` | ✅ Yes | Rows 1-6 present and individually tested |
| D2 — grace path free of side effects | ✅ Yes | Reads only |
| D3 — `typ: 'access'` set in exactly one place | ✅ Yes | `sessionCookies.ts:55` |
| D4 — access cookie carries the session lifetime | ⚠️ **Partially** | Honoured at login/register; **not** at refresh — C1 |
| D5 — refresh route defences (no auth mw, CSRF-exempt, rate-limited, path-scoped, `sameSite` lax) | ✅ Yes | All four verified |
| D7 — retention without a cron; only the rotation winner reaps | ✅ Yes | Matches the narrowed spec |
| Successor `expiry_date` inherited, never extended | ✅ Yes | `RotateRefreshTokenUseCase.ts:48` passes `current.expiryDate` |

### Accepted deviations — verified as shipped

| Deviation | Verified | Evidence |
|---|---|---|
| Grace hit issues a fresh access cookie and **no** refresh cookie | ✅ | `UserApiController.ts:154`; test `:458` |
| `successor_hash` is a SHA-256 digest, so returning the successor is impossible | ✅ | `Sha256TokenHasher` output stored; `RefreshSessionResult.grace` carries no token |
| Logout cannot invalidate the access token itself; residual ≤ `ACCESS_TOKEN_TTL_SECONDS` (1800) | ✅ | Stateless JWT, no `jti`; residual bounded by `exp` |
| Access TTL 30 minutes (amended from 15) | ✅ | `cookieOptions.ts:21` `30 * 60`; `cookieOptions.test.ts:40` |
| `reapFamily` uses `destroy()` with a DB-side `NOW() - INTERVAL` cutoff and `Op.lte` | ✅ | `SequelizeRememberTokenRepository.ts:130-136` |
| `m3d_auth` deliberately outlives its token; a stale cookie authenticates nothing | ✅ **at login only** | `accessCookieOptions` + `auth.ts:23`; **broken at refresh — C1** |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ⚠️ Partial | Table present for PR1 (19 tasks); **absent for PR2 and PR3 (33 tasks)** — apply-progress:145 discloses both phase agents were killed by provider rate limits before writing it |
| All tasks have tests | ✅ | Every implementation task maps to at least one test file that exists |
| RED confirmed (test files exist) | ✅ | 19/19 PR1 files verified on disk |
| GREEN confirmed (tests pass) | ✅ | 1007/1007 backend, 242/242 frontend at exit 0 |
| Triangulation adequate | ⚠️ | Strong at the branch level (six-row table, `[true,false,undefined]` loops). One added scenario lacks its own case — W1 |
| Safety Net for modified files | ✅ | Recorded for PR1's modified files |

**TDD Compliance**: 4/6 checks fully passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 1007 backend + 242 frontend (executed) | 122 + 20 | Jest, Vitest |
| Integration (real MySQL) | ~13 cases | 3 | Jest + `testDb.ts` — **not executed locally** |
| E2E (real browser) | ~13 cases | 3 relevant | Playwright — **not executed locally** |

### Assertion Quality

No tautologies, ghost loops, orphan-empty assertions, or assertion-without-production-call patterns were found in the change's test files. Mock/assertion ratios are within range. Two observations:

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `RefreshSessionUseCase.test.ts` | 122 | `expect(mockRotate.execute).not.toHaveBeenCalled()` | Does not assert the new scenario's actual claim (no row deleted/created/modified) | WARNING |
| `UserApiController.test.ts` | 452, 469 | `expect(authCookieCall).toBeDefined()` | Type-only — the refresh-issued access cookie's `maxAge` is never asserted, which is exactly what C1 exploits | WARNING |

**Assertion quality**: 0 CRITICAL, 2 WARNING.

### Quality Metrics

**Linter**: ✅ reported clean by the orchestrator; not re-run here.
**Type Checker**: ✅ `tsc --noEmit` exit 0 (re-run in this phase).

---

### Issues Found

#### CRITICAL

**C1 — `POST /api/users/refresh` downgrades a remembered session's `m3d_auth` cookie from 30 days to 2 hours, reopening the logout-cannot-revoke hole this change exists to close.**

`issueAccessCookie` takes a third parameter that selects the cookie lifetime:

```ts
// backend/src/infrastructure/controllers/sessionCookies.ts:54
export const issueAccessCookie = (res: Response, jwtPayload: JwtPayload, remember?: boolean): void
```

It has exactly two production callers. `setSessionCookies` passes `remember` through (`sessionCookies.ts:81`). The refresh handler does not:

```ts
// backend/src/infrastructure/controllers/UserApiController.ts:149
issueAccessCookie(res, { userId: user.idUser, email: user.email, category: user.category, idRole: user.idRole, familyId });
```

With `remember` undefined, `accessCookieOptions(undefined)` → `authMaxAge(undefined)` → `SESSION_MAX_AGE` (2h). Because `res.cookie` overwrites the same name/path/domain, **the first refresh of a 30-day remembered session rewrites `m3d_auth` with a 2-hour `Max-Age`**, and every later refresh renews only that 2 hours. `m3d_csrf` and `m3d_user` are not re-issued at all, so they keep their 30-day lifetime — the four cookies visibly diverge, which is the precise condition "Per-Cookie Lifetime Split" forbids.

Consequence, in the requirement's own words: *"giving the cookie the token's TTL made the browser delete it, and logout then had nothing to revoke from — silently leaving the session alive for up to 30 days."* A remembered user who refreshes, then is idle longer than two hours, then clicks logout, presents no `m3d_auth`. `logout` reads no `familyId` (`UserApiController.ts:117`), never calls `revokeRefreshTokenUseCase`, and the 30-day refresh family survives server-side. Cookies are cleared in that browser, so the user sees a logout — but a previously exfiltrated refresh token stays valid for the remainder of the 30 days. That is HIGH-1, the vulnerability this change was opened to fix, restored on a 2-hour trigger instead of a 30-minute one.

- **Spec violated**: `session-cookie-security` → "Per-Cookie Lifetime Split" — "All four session cookies MUST use the refresh-token lifetime (2h / 30d per 'remember me')".
- **Why every prior round missed it**: rounds 1-3 swept the *login* issuance path, where the fix is correct. No scenario in any of the five specs describes cookie lifetimes on the refresh path, and no test asserts the refresh-issued cookie's `maxAge` — `UserApiController.test.ts:452` and `:469` assert only `toBeDefined()`.
- **Why it is not a one-word fix**: `RefreshSessionResult` carries no remember/lifetime information. The `rotated` branch could derive it (`result.refreshToken.expiryDate` is already used at `:155` for the refresh cookie), but the `grace` branch returns `{ outcome, user, familyId }` with no expiry at all. Closing this needs a deliberate decision about what the grace branch returns — it is a design gap, not a dropped argument.
- **Not remediated here**: this phase is verification-only.

#### WARNING

**W1 — the scenario `29b6821` added has no test of its own.** `refresh-token-rotation` → "A grace hit leaves the family untouched" requires that "no row in that family MUST be deleted, created or modified". The nearest test, `RefreshSessionUseCase.test.ts:105`, asserts only `expect(mockRotate.execute).not.toHaveBeenCalled()`. That forecloses `claimRotation`/`insertSuccessor`/`reapFamily`, which are reachable only through the rotator, but nothing asserts that `RefreshSessionUseCase` does not itself call `create`, `deleteByHash`, `revokeFamily`, or `reapFamily` on the injected repo — all four are mocked and available at `:38-44`. The behaviour is correct in the current source; the property is unasserted. **This is the same defect class as round 3's second CRITICAL — an added scenario without a test — reproduced by the very commit that fixed round 3.** It is rated WARNING rather than CRITICAL only because partial covering coverage exists.

**W2 — stale sibling statement left behind by `29b6821`'s narrowing.** `proposal.md:33` still reads: *"**On each successful refresh**, delete that family's rows already past the grace window."* A grace hit is a successful refresh (200 OK) and deliberately deletes nothing. `29b6821` touched only `specs/refresh-token-rotation/spec.md`. `design.md:143` (D7, "Only the rotation winner reaps") is consistent and needs no change. This is round 1's failure mode — fix landed in `specs/`, sibling artifact missed.

**W3 — stale claims in `e2e/tests/auth.spec.ts`, contradicting assertions in the same test.**
- `:56` test **name**: `'Recuérdame puts 30 days on the refresh cookie while the access cookie stays short'`
- `:88` comment: `` `m3d_auth` is now always short-lived ``

Both assert the pre-fix model. The test's own assertion at `:114` is `expect(authRemaining).toBeGreaterThan(thirtyDaysSeconds - 3600)` — the opposite — and the comment at `:106-110` states the corrected model correctly. A test name is stronger than a comment: it is what a failure report prints, and it invites a future maintainer to "fix" the code back toward the vulnerability. `8e16941`/`691e41b` corrected this exact claim in `sessionCookies.ts` and the specs but never reached this file.

**W4 — the same stale claim twice inside `UserApiController.test.ts`, self-contradictory within a few lines.**
- `:263` test **name**: `'issues an access cookie fixed at ACCESS_TOKEN_TTL_SECONDS and a matching-exp JWT'` — the name attributes the TTL to the cookie and separately names the JWT, while `:277` asserts the cookie's `maxAge` is `REMEMBER_MAX_AGE`/`SESSION_MAX_AGE` and the comment at `:275-276` explains why.
- `:316-318` comment: *"CSRF/USER still share one maxAge ... but **AUTH_COOKIE diverges on purpose** — this re-asserts the CURRENT (post-2.4) shape."* Nine lines later, `:327-330` says *"AUTH used to diverge here. **It no longer does.**"* and `:331` asserts a single distinct `maxAge` across all four cookies. The comment describes a shape the test was rewritten to disprove.

This is round 3's failure mode (a stale statement inside a file the fix did not correct) at the test-file grain.

**W5 — stale claim in `tasks.md:79`**: *"access cookie fixed at 30 min regardless."* Identical wording to the claim that was CRITICAL in round 3 when it appeared in `specs/`; harmless in a completed task line, but it is drift in a required artifact.

**W6 — TDD cycle evidence missing for 33 of 52 tasks.** `apply-progress.md:145` discloses that PR2's and PR3's RED/GREEN records were never written because both phase agents were killed by provider rate limits. Under Strict TDD this would normally be CRITICAL; it is held at WARNING because the disclosure is explicit, the tests exist, and all 1007+242 pass. The record cannot prove test-first for those tasks.

**W7 — integration and e2e evidence is CI-only, and one commit's CI is unconfirmed.** `pnpm test:integration` and `pnpm test:e2e` could not run locally (port 3306 held by the maintainer's MariaDB). Thirteen scenarios in the matrix above are credited to CI at `691e41b`. `29b6821` is docs-only, so no code tier changed, but its run was still in flight. This is stated so no reader mistakes a CI credit for a local observation.

**W8 — two scenarios are covered only through their preconditions.** "Cross-site refresh request is rejected" and "Refresh cookie is not sent to other endpoints" both assert cookie attributes (`sameSite: 'lax'`, `Path=/api/users/refresh`) rather than the browser behaviour they specify. This is defensible — both are user-agent-enforced — but the existing Playwright suite could assert non-attachment directly.

#### Carried-over WARNING — closed, and an input error to report

**The claim "Login 429 covered only by a mocked `express-rate-limit`" is incorrect.** I re-checked it rather than carrying it a third time. `backend/src/__tests__/trustProxy.test.js` defines `loadRealLoginLimiter` at `:29-37`, which sets `NODE_ENV=production` (defeating `loginLimiter.ts`'s `NODE_ENV==='test' && JEST_WORKER_ID` bypass) and `LOGIN_LIMIT_MAX`/`LOGIN_LIMIT_WINDOW`, then `require`s the **real** middleware under `jest.isolateModules`. The test at `:73-89` mounts it and asserts `expect([a1.status, a2.status, a3.status]).toEqual([200, 200, 429])` — a genuine 429 from the real `express-rate-limit`, keyed on the forwarded IP. The two env vars named in the spec clause are what drive it.

The limiter is exercised on a synthetic `/login` route rather than on `/api/users/login`; the mount on the real route is static (`users.ts:176`). Together these fully discharge the preservation requirement. **Closing this WARNING.** (The refresh limiter, a genuinely new surface, is separately covered by a real 429 at `apiSecurity.test.js:254`.)

#### SUGGESTION

**S1 — the spec gap that let C1 through.** `session-cookie-security` states an unscoped MUST over all four cookies but gives it only login-scoped scenarios. Adding a scenario for the cookie lifetimes the **refresh** response sets would have made C1 a failing test instead of a fourth-round discovery. Recommend adding it alongside the C1 fix.

**S2 — assert lifetimes, not existence, in the refresh tests.** `UserApiController.test.ts:452` and `:469` assert only `toBeDefined()` on the refresh-issued auth cookie. Asserting its `maxAge` would have caught C1 at PR2.

**S3 — sweep by claim, not by file, when amending a contract.** All four rounds' misses share one shape: the claim was corrected where it was found and left standing in a sibling. A grep for the *sentence* (`access cookie.*short`, `fixed at ACCESS_TOKEN_TTL`, `each successful refresh`) across specs, proposal, design, tasks, source comments **and test names** locates every instance in one pass; `git show --name-only` cannot.

### Verdict

**FAIL** — 1 CRITICAL, 8 WARNING, 3 SUGGESTION. The three findings from round 3 are genuinely fixed and independently confirmed, and the carried-over login-429 WARNING is closed as an incorrect premise; but `UserApiController.refresh` re-issues `m3d_auth` with the 2-hour default for every session, violating "Per-Cookie Lifetime Split" and restoring — on a 2-hour trigger — the logout-cannot-revoke condition that motivated this change. Not archive-ready.
