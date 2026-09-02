```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:dbf7abed343ac9ec86e498910280b2fe58e6fd3d2f96b90e6ca21596900dcff2
verdict: fail
blockers: 2
critical_findings: 2
requirements: 7/14
scenarios: 36/43
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:3accb74fab8911f3b2bdc1a52778b490fc6735adf5544a9508c7684182efeb83
build_command: pnpm type-check
build_exit_code: 0
build_output_hash: sha256:1f8806d84b9ecaaf214bf27094860b3c350add8fdc51de892b5d1c98bf0ce9b3
```

## Verification Report

**Change**: auth-refresh-tokens
**Version**: N/A (OpenSpec change deltas)
**Mode**: Strict TDD
**Verified against**: working tree at `feat/auth-refresh-tokens-03-frontend`, HEAD `8e16941` (PR1+PR2 merged in `main`; PR3 branch-only)
**Date**: 2026-09-02

> **This report supersedes the SECOND FAIL verdict** previously recorded in this file.
>
> **What changed since that verdict.** Commit `8e16941` amended three documents to align the written contract with the shipped access-cookie lifetime. `git show 8e16941 --name-only` confirms it touched exactly the three claimed files plus this report — the previous cycle's "swept all five" claim was false and this one's file list is accurate. Each amendment was re-checked independently:
> 1. `specs/session-cookie-security/spec.md` — genuinely rewritten. All four cookies now share the refresh lifetime, `m3d_auth`'s inclusion is explained, and a new scenario asserts that an expired access token is still rejected. **Verified as written; see CRITICAL-2 for why that new scenario is not covered by a test.**
> 2. `specs/api-jwt-auth/spec.md` — **partially fixed.** The requirement prose now distinguishes the token's `exp` from the cookie's `maxAge`. The scenario nine lines below it was not updated and still carries the superseded MUST. See CRITICAL-1.
> 3. `design.md` — genuinely fixed. D4's snippet now matches `cookieOptions.ts:78-79` verbatim, including the `remember?: boolean` parameter.
>
> **Why the verdict is still FAIL.** The same failure mode has now produced a blocking finding three cycles running: a fix lands in code and tests, the sweep updates the prose it was looking for, and one MUST-language statement elsewhere is left describing the old behaviour. This cycle it survived *inside the very file the amendment edited*. The remedy for CRITICAL-1 is a two-line documentation amendment; CRITICAL-2 needs one test.

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 52 |
| Tasks complete | 52 |
| Tasks incomplete | 0 |

All 52 checkboxes in `tasks.md` are marked. The marks were treated as a claim, not as evidence: each was checked against live code. No task was found marked complete without a corresponding implementation. Task completion is **not** the reason for this verdict.

One stale artifact statement was found while doing this — see WARNING-3.

---

### Build & Tests Execution

**Build**: PASS

```text
$ pnpm type-check      # -> pnpm --filter backend type-check -> tsc --noEmit
EXIT=0
```

**Tests**: PASS — 1248 passed, 0 failed, 0 skipped

```text
$ pnpm test            # -> pnpm --filter "!e2e" test
backend   Test Suites: 122 passed, 122 total
backend   Tests:       1006 passed, 1006 total
frontend  Test Files   20 passed (20)
frontend  Tests        242 passed (242)
EXIT=0
```

A green run was executed independently for this report and reproduces the orchestrator's figures exactly. Note that a fully green suite is **not** evidence about the written contract: in this change the tests were updated alongside the code in the same commits, so agreement between code and tests says nothing about agreement between code and specs. That is the gap both blocking findings occupy.

**Integration and E2E tiers were NOT executed.** Port 3306 is held by the maintainer's MariaDB, so `pnpm test:integration` and `pnpm test:e2e` cannot run in this environment. Every scenario below marked as resting on those tiers is credited to CI, not to local observation. PR #116 CI at `047dec6` reported all four checks green; the run for `8e16941` was still in flight at the time of writing, though that commit is documentation-only.

**Coverage**: Not collected — no coverage threshold is configured for this project.

---

### Spec Compliance Matrix

Totals are taken from the retrieved spec files: **14 requirements, 43 scenarios** across five delta specs. (The previous report counted 42; the amendment added one scenario to `session-cookie-security`.)

#### api-jwt-auth (4 requirements, 16 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| API JWT Login Endpoint | Successful login sets an auth cookie | `apiUsersLogin.test.js`, `apiAuthCookieLifecycle.test.ts` | ✅ COMPLIANT |
| API JWT Login Endpoint | API login with invalid credentials | `apiUsersLogin.test.js` | ✅ COMPLIANT |
| API JWT Login Endpoint | API login exceeds rate limit | `loginLimiter.test.ts` only — mocks `express-rate-limit` wholesale | ⚠️ PARTIAL |
| API JWT Login Endpoint | Access token TTL is fixed regardless of remember | `apiAuthCookieLifecycle.test.ts:239` (`exp - iat === ACCESS_TOKEN_TTL_SECONDS`) | ✅ COMPLIANT |
| Cookie-Based Authorization | Request to protected API without cookie | `auth.test.ts:36` | ✅ COMPLIANT |
| Cookie-Based Authorization | Request to protected API with invalid **or expired** cookie | `auth.test.ts:42` — exercises `'invalid-token-value'` only; no expired token is ever presented | ⚠️ PARTIAL |
| Cookie-Based Authorization | Request to protected API with valid cookie | `auth.test.ts:49` | ✅ COMPLIANT |
| Cookie-Based Authorization | Bearer header alone is rejected | `auth.test.ts:83` | ✅ COMPLIANT |
| Cookie-Based Authorization | Admin-only API view with non-admin cookie | `auth.test.ts` (`requireRoles`), route suites | ✅ COMPLIANT |
| Cookie-Based Authorization | Pre-deploy JWT without typ claim is rejected | `auth.test.ts:63` | ✅ COMPLIANT |
| Logout Endpoint | Logout clears the session cookies | `UserApiController.test.ts` | ✅ COMPLIANT |
| Logout Endpoint | Logout revokes the refresh family | `UserApiController.test.ts:398` (`fam-expired`, `expiresIn: -60`) | ✅ COMPLIANT |
| Logout Endpoint | Prior access token cannot be renewed after logout | `RefreshSessionUseCase.test.ts` (revoked family → rejected) | ✅ COMPLIANT |
| Logout Endpoint | Logout without an active session | `UserApiController.test.ts:385` | ✅ COMPLIANT |
| Remember-Me Extended Session | Remember-me extends the refresh token, not the access token | `cookieOptions.test.ts:74` and `apiAuthCookieLifecycle.test.ts:228` assert the **negation** of the scenario's second bullet | ❌ FAILING |
| Remember-Me Extended Session | Remember-me not requested keeps default refresh lifetime | `cookieOptions.test.ts:75`, e2e `auth.spec.ts` | ✅ COMPLIANT |

#### session-cookie-security (2 requirements, 5 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Per-Cookie Lifetime Split | The auth cookie outlives the token it carries | `cookieOptions.test.ts:66-75`, `apiAuthCookieLifecycle.test.ts:228-239` — both halves asserted | ✅ COMPLIANT |
| Per-Cookie Lifetime Split | **An expired access token is still rejected for authentication** | (none found — see CRITICAL-2) | ❌ UNTESTED |
| Per-Cookie Lifetime Split | CSRF and display cookies expire with the refresh token | `apiAuthCookieLifecycle.test.ts`, e2e `auth.spec.ts` | ✅ COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie is scoped to the refresh route | `cookieOptions.test.ts:80`, e2e `auth.spec.ts:104` | ✅ COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie is not sent to other endpoints | Path attribute asserted; browser non-attachment not directly asserted | ⚠️ PARTIAL |

#### refresh-token-rotation (5 requirements, 12 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Refresh Endpoint | Refresh succeeds with an expired access token | `UserApiController.test.ts`; `users.ts:200` mounts no `apiAuthMiddleware` | ✅ COMPLIANT |
| Refresh Endpoint | Refresh rejected without a valid refresh cookie | `UserApiController.test.ts`, `RefreshSessionUseCase.test.ts` | ✅ COMPLIANT |
| Refresh Endpoint | Cross-site refresh request is rejected | No direct test; `sameSite: 'lax'` and absent-cookie→401 asserted separately | ⚠️ PARTIAL |
| Refresh Endpoint | Refresh rate limit | `apiSecurity.test.js:254` — real 429 via supertest against the real limiter | ✅ COMPLIANT |
| Refresh Carries Remember Distinction | Remembered session issues a 30-day refresh token | `cookieOptions.test.ts`, e2e `auth.spec.ts` | ✅ COMPLIANT |
| Refresh Carries Remember Distinction | Default session issues a 2-hour refresh token | `cookieOptions.test.ts`, e2e `auth.spec.ts` | ✅ COMPLIANT |
| Rotation With Grace Window | Successful refresh rotates the token | `RotateRefreshTokenUseCase.test.ts`; repo integration (CI) | ✅ COMPLIANT |
| Rotation With Grace Window | Grace hit issues an access cookie only, without re-rotating | `UserApiController.test.ts`, `RefreshSessionUseCase.test.ts` | ✅ COMPLIANT |
| Rotation With Grace Window | Replay past the grace window fails | `RefreshSessionUseCase.test.ts` | ✅ COMPLIANT |
| Rotation With Grace Window | Family id is populated on every row | Repo integration `:156` (CI, real DB) | ✅ COMPLIANT |
| Concurrent Refresh From Multiple Tabs | Two tabs refresh concurrently and both stay logged in | Repo integration `:88`; e2e `refresh-race.spec.ts` (CI) | ✅ COMPLIANT |
| Retention on Successful Refresh | Old superseded rows are reaped on refresh | Repo integration `:221`, `:298` (CI) — rotation path only | ⚠️ PARTIAL |

#### remember-token-store (2 requirements, 8 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Model Schema and Associations | User association is configured | `RememberTokenModel.test.js` | ✅ COMPLIANT |
| Model Schema and Associations | New rows carry rotation metadata | Repo integration `:156` (CI) | ✅ COMPLIANT |
| Model Schema and Associations | Legacy duplicate indexes removed | `migrate.integration.test.js:82` (CI) | ✅ COMPLIANT |
| Model Schema and Associations | Migration down restores the baseline schema exactly | `migrate.integration.test.js:132` (CI) | ✅ COMPLIANT |
| Service Hashed Token Management | Creating a token hashes and stores it | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |
| Service Hashed Token Management | Verifying returns the user or cleans up expired | `RememberTokenUseCases.test.ts:133` | ✅ COMPLIANT |
| Service Hashed Token Management | Verifying a revoked token fails without deleting it | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |
| Service Hashed Token Management | Deleting removes the record | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |

#### csrf-protection (1 requirement, 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Refresh Endpoint CSRF Exemption | Refresh request without a CSRF token succeeds | `apiSecurity.test.js:254` (no session, no CSRF header, reaches the limiter) | ✅ COMPLIANT |
| Refresh Endpoint CSRF Exemption | Refresh route bypasses the guard entirely | `csrf.test.ts`; `users.ts:200` mounts only `refreshLimiter` | ✅ COMPLIANT |

**Compliance summary**: 36/43 scenarios COMPLIANT — 1 FAILING, 1 UNTESTED, 5 PARTIAL. **7/14 requirements** have every scenario compliant.

---

### Correctness (Static Evidence)

| Requirement area | Status | Notes |
|---|---|---|
| Refresh endpoint wiring | ✅ Implemented | `users.ts:200` — `router.post('/users/refresh', refreshLimiter, controller.refresh)`. No `apiAuthMiddleware`, no `csrfGuard`. |
| Rotation transaction | ✅ Implemented | `RotateRefreshTokenUseCase:32-55` — claim / insert successor / reap in one unit of work. |
| Grace window | ✅ Implemented | `RefreshSessionUseCase:103-122` resolves the 30s deadline from `supersededAt`; `UserApiController.refresh:154` gates `issueRefreshCookie` on `outcome === 'rotated'`. Matches the accepted deviation exactly. |
| Logout revocation | ✅ Implemented | `readFamilyIdFromAccessToken` (`ignoreExpiration: true`, signature still verified) → `RevokeRefreshTokenUseCase`. One caller only: `UserApiController.logout:117`. |
| `reapFamily` mechanics | ✅ Implemented | `destroy()` with `Op.lte` against a database-side `literal('NOW() - INTERVAL ${grace} SECOND')`; `graceSeconds` coerced with `Math.max(0, Math.trunc(...))` before interpolation. Matches the accepted deviation. |
| Access cookie lifetime | ⚠️ Implemented, spec still contradicts | `cookieOptions.ts:78-79` uses `authMaxAge(remember)`. `session-cookie-security` and `design.md` now agree; `api-jwt-auth`'s scenario does not. See CRITICAL-1. |
| Expired-token rejection | ✅ Implemented, ❌ untested | `auth.ts:23` uses a plain `jwt.verify` with no `ignoreExpiration`, so `exp` is enforced. No test presents an expired token to it. See CRITICAL-2. |
| Frontend transparent refresh | ✅ Implemented | `authFetch` retries once on 401 behind single-flight `ensureRefreshed`; never wraps the refresh call itself; ends a session only when `getSessionUser()` shows one existed. |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1 — one transaction: claim, insert successor, reap | ✅ Yes | `RotateRefreshTokenUseCase:32-55`. |
| D2 — only the rotation winner writes the refresh cookie | ✅ Yes | `UserApiController:154`. |
| D3 — opaque refresh token; `typ: 'access'` set in exactly one place | ✅ Yes | `generateRefreshToken` is `randomBytes(32)`; `typ` added only in `issueAccessCookie`, required only in `apiAuthMiddleware`. |
| D4 — `accessCookieOptions` lifetime | ✅ **Now consistent** | `design.md:96-97` was amended by `8e16941` and matches `cookieOptions.ts:78-79` verbatim, including the `remember?: boolean` parameter. This resolves the previous report's D4 finding. |
| D5 — refresh defended by httpOnly + sameSite + path scoping + rotation + rate limiting | ✅ Yes | All five present; rate limiting has real runtime evidence. |
| D6 — `lib/http` avoids the `config.ts` import cycle | ✅ Yes | Documented in-code and in `apply-progress`. |

---

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ Partial | `apply-progress.md:25-36` has a TDD Cycle Evidence table covering PR1's 19 tasks only. |
| All tasks have tests | ✅ | Every task maps to a test file that exists on disk. |
| RED confirmed (tests exist) | ⚠️ 19/52 | RED/GREEN recorded for PR1 only. PR2's and PR3's 33 tasks have no recorded evidence — `apply-progress.md:145` states both apply agents were killed by provider rate limits before writing it. Disclosed honestly; treated as a record gap, not a fabrication. |
| GREEN confirmed (tests pass) | ✅ 52/52 | Every named test file passes in the executed run. |
| Triangulation adequate | ✅ | PR1's table shows 2+ cases per behaviour; the contested areas (grace branch table, cookie lifetimes, logout paths) each have multiple distinct-value cases. |
| Safety Net for modified files | ✅ | PR1's table records pre-existing counts for each modified file. |

**TDD Compliance**: 4/6 checks fully passed, 2 partial.

---

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 1006 (backend) + 242 (frontend) executed | 122 + 20 | Jest, Vitest |
| Integration (real MySQL) | ~7 written, **0 executed locally** | 2 | Jest + real MariaDB (CI only) |
| E2E | written, **0 executed locally** | `auth.spec.ts`, `refresh-race.spec.ts`, cart specs | Playwright (CI only) |
| **Total executed locally** | **1248** | **142** | |

The layering is appropriate, and it is what caught this cycle's escaped defects: the two `reapFamily` timestamp bugs were invisible to the mocked unit suite and only surfaced against real MySQL, and the guest-eviction regression only surfaced in a real browser. The one place that lesson was **not** applied is CRITICAL-2 — a property the e2e suite explicitly delegates to the unit suite, where it was never written.

---

### Changed File Coverage

Coverage analysis skipped — no coverage tool or threshold is configured for this project.

---

### Assertion Quality

Audited the test files this change created or modified for trivial assertions, ghost loops, tautologies, smoke-only tests, and mock-heavy ratios.

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `middlewares/__tests__/loginLimiter.test.ts` | 4-10, 40-48 | `jest.mock('express-rate-limit')` + `expect(rateLimitMock).toHaveBeenCalledWith({...statusCode: 429})` | Asserts configuration passed to a wholesale-mocked dependency; the 429 behaviour itself is never exercised | WARNING |
| `middlewares/__tests__/auth.test.ts` | 42-47 | `req.cookies = { m3d_auth: 'invalid-token-value' }` under the name *"invalid or expired"* | The test name claims expiry coverage the body does not provide; the malformed-string path and the `exp` path are different branches of `jwt.verify` | WARNING (contributes to CRITICAL-2) |

No tautologies, no ghost loops, no assertions that never reach production code, and no smoke-only tests were found. The cookie-lifetime tests are notably well-triangulated — `cookieOptions.test.ts:69-70` asserts both the expected value *and* explicitly `not.toBe` the superseded one, which is exactly the shape that makes a contract change visible rather than silent.

**Assertion quality**: 0 CRITICAL, 2 WARNING.

---

### Quality Metrics

**Linter**: ✅ No errors (`pnpm lint`, orchestrator-run, reproduced clean)
**Type Checker**: ✅ No errors (`pnpm type-check` → `tsc --noEmit`, exit 0, run for this report)
**Architecture guard**: ✅ Clean (`pnpm --filter backend architecture:check`)
**OpenAPI contract**: ✅ Clean (`pnpm check:openapi`)
**Dependency audit**: ✅ Clean (`pnpm audit`, both trees)

---

### Accepted Deviations — verified as shipped

| Deviation | Verified | Evidence |
|---|---|---|
| A grace hit issues a fresh access cookie and sets **no** refresh cookie | ✅ Confirmed | `UserApiController.refresh:149` always issues the access cookie; `:154` gates `issueRefreshCookie` on `outcome === 'rotated'`. `successor_hash` is a SHA-256 digest, so returning the successor is structurally impossible. |
| Logout cannot invalidate the access token; residual window up to `ACCESS_TOKEN_TTL_SECONDS` | ✅ Confirmed | No `jti` denylist exists. The token dies on its own `exp`; refresh is what becomes impossible. |
| Access TTL is 30 minutes, amended from 15 | ✅ Confirmed | `cookieOptions.ts:21` — `Number(process.env.ACCESS_TOKEN_TTL_SECONDS) \|\| 30 * 60`. |
| `reapFamily` uses `destroy()` with a DB-side `NOW() - INTERVAL` cutoff and `Op.lte` | ✅ Confirmed | `SequelizeRememberTokenRepository.ts:126-138`. |
| A stale `m3d_auth` authenticates nothing; its only capability is revoking its own family | ⚠️ **Confirmed by inspection, not by test** | `readFamilyIdFromAccessToken` has exactly one caller (`logout:117`); `ignoreExpiration` appears in exactly one place in production source; `apiAuthMiddleware` uses a plain `jwt.verify` and additionally requires `typ === 'access'`; `csrfGuard` reads `req.user`, which only `apiAuthMiddleware` sets. The reasoning holds — but the property is now written into the spec as a MUST and still has no test. See CRITICAL-2. |

---

### Issues Found

#### CRITICAL

**CRITICAL-1 — `api-jwt-auth/spec.md:106` still requires the superseded access-cookie lifetime. Third occurrence of this failure mode, inside the file the amendment edited.**

`8e16941` rewrote the *requirement prose* of "Remember-Me Extended Session" (`:97-99`) to distinguish the token's `exp` from the cookie's `maxAge`. It did not touch the scenario nine lines below, which still reads:

```
#### Scenario: Remember-me requested extends the refresh token, not the access token
- GIVEN a login request that indicates "remember me"
- WHEN the login succeeds
- THEN the refresh token's expiration MUST exceed the default 2h
- AND the access-token cookie's expiration MUST remain the fixed access-token TTL   <-- superseded
```

This contradicts three things simultaneously:
- **The implementation.** `cookieOptions.ts:78-79` — `accessCookieOptions(remember) => cookieOptions({ httpOnly: true, maxAge: authMaxAge(remember) })`, which returns `REMEMBER_MAX_AGE` (30 days) when `remember` is true.
- **The tests.** `cookieOptions.test.ts:74` asserts `accessCookieOptions(true).maxAge === REMEMBER_MAX_AGE`, and `apiAuthCookieLifecycle.test.ts:228` asserts all four cookies carry `REMEMBER_MAX_AGE / 1000`. Both assert the negation of this MUST.
- **The amended prose in the same file**, `:99`: "The `m3d_auth` **cookie** does follow the remember-me lifetime."

`session-cookie-security/spec.md:16` states the opposite of `:106` in equally binding MUST language. Two delta specs in the same change directly contradict each other on the same attribute — which is verbatim the blocking finding of the previous verify, one document over.

*Remedy*: amend that one bullet to refer to the token's `exp` rather than the cookie's expiration, e.g. `AND the access token's own exp MUST remain the fixed access-token TTL`. No code change. The behaviour is correct; only the contract is stale.

*Note on process*: the sweep for this cycle was verified rather than trusted, per instruction. `git show 8e16941 --name-only` returns exactly the three claimed files plus this report, so the commit's file list is honest — unlike `047dec6`, which claimed five and touched one. The gap this time is not a missed *file*; it is a missed *scenario inside an edited file*. A file-level sweep cannot catch that. The next sweep should grep for the asserted attribute (`access.*cookie.*TTL`, `maxAge`) across all five specs plus `design.md`, `tasks.md`, and source comments, not for file names.

---

**CRITICAL-2 — The newly-added scenario "An expired access token is still rejected for authentication" has no covering test, and the e2e suite explicitly delegates it to a backend test that does not exist.**

`session-cookie-security/spec.md:19-22` was added by `8e16941` precisely because it is the load-bearing safety property for a cookie now deliberately allowed to outlive its token. The entire justification for the amended contract — "a stale `m3d_auth` therefore authenticates nothing" (`:11`) — rests on it. It is asserted nowhere at runtime.

Evidence, exhaustive:
- The only candidate is `auth.test.ts:42`, `it('returns 401 JSON error when the auth cookie holds an invalid or expired token')`. Its body sets `req.cookies = { m3d_auth: 'invalid-token-value' }` — a malformed string. That exercises `jwt.verify`'s decode-failure branch. It never constructs a validly-signed token with a past `exp`, so the expiry branch is never reached. The test name asserts coverage the body does not provide.
- Every other `apiAuthMiddleware` test (`:49`, `:63`, `:73`, `:83`) signs with `expiresIn: '2h'` — deliberately unexpired.
- Searching all backend tests for a past expiry (`expiresIn: -`, `expiresIn: '0`, `exp:` arithmetic, fake timers) yields exactly one hit: `UserApiController.test.ts:402`, `{ expiresIn: -60 }`. That test drives **`logout`**, asserting the family *is* revoked from an expired token — the opposite direction. It proves `readFamilyIdFromAccessToken` accepts expiry; it says nothing about `apiAuthMiddleware` rejecting it.
- `e2e/tests/auth.spec.ts:106-110` states the position explicitly: *"What stays short is the TOKEN's own `exp`, which `apiAuthMiddleware` enforces — not observable from the cookie jar, so it is asserted in the backend unit suite instead of here."* The e2e tier consciously declined to cover it on the grounds that the unit suite does. The unit suite does not.

The same gap also downgrades `api-jwt-auth`'s "Request to protected API with invalid **or expired** cookie" to PARTIAL — two MUST scenarios in two different specs both depend on `exp` enforcement, and neither exercises it.

The implementation is almost certainly correct: `auth.ts:23` calls `jwt.verify(token, getJwtSecret())` with no `ignoreExpiration`, so `jsonwebtoken` throws `TokenExpiredError` and the `catch` returns 401. But "correct by reading the library's default" is exactly the standard this change has already been burned by four times — the two `reapFamily` timestamp bugs, the guest-eviction regression, and the refresh limiter were all things that read correctly and behaved otherwise. This one guards the security property that justifies a 30-day cookie.

*Remedy*: one test in `auth.test.ts`, mirroring `UserApiController.test.ts:399-403`:

```ts
const expired = jwt.sign({ userId: 1, email: 'a@b.c', typ: 'access' }, JWT_SECRET, { expiresIn: -60 });
req.cookies = { [AUTH_COOKIE]: expired };
apiAuthMiddleware(req as Request, res as Response, next);
expect(res.status).toHaveBeenCalledWith(401);
expect(next).not.toHaveBeenCalled();
```

Note the `typ: 'access'` claim is essential: without it the test would pass for the wrong reason, via the `typ` guard at `auth.ts:30` rather than the expiry check.

---

#### WARNING

**WARNING-1 — "API login exceeds rate limit" is covered only by a test that mocks `express-rate-limit` wholesale. Ranking re-examined and CONFIRMED at WARNING.**

The finding stands factually. `loginLimiter.test.ts:4-10` replaces `express-rate-limit` with a pass-through mock and asserts only the configuration object; no request is ever throttled. Real 429 supertests exist for `/register` (`apiSecurity.test.js:220`) and `/refresh` (`:254`) but not for `/login`, and `rg 'users/login' apiSecurity.test.js` returns nothing. `loginLimiter` also carries the same `NODE_ENV === 'test' && JEST_WORKER_ID` bypass that the refresh test had to defeat by setting `NODE_ENV = 'production'`, so no existing test exercises the real limiter on this route.

I re-ranked this rather than inheriting it, because the identical defect on `/refresh` was CRITICAL in the first verify. The distinction that keeps login at WARNING is not "the pattern is proven twice" — that is analogical reasoning, and it is precisely what let the refresh limiter ship unproven. It is this: **`loginLimiter.ts` and `loginLimiter.test.ts` are untouched by this change.** `git log bb7fe09..HEAD -- backend/src/infrastructure/middlewares/loginLimiter.ts` is empty. The spec clause is a preservation requirement — "MUST **remain** protected by the rate limiter" — and the one thing this change could plausibly have broken is the mount, since PR2 edited `users.ts`. That mount is statically confirmed intact at `users.ts:176`. By contrast `/refresh` was a brand-new, unauthenticated, CSRF-exempt endpoint whose limiter was one of five named defences in D5, introduced by this change with nothing else proving it.

So: a real pre-existing coverage gap on the codebase's most attacked endpoint, surfaced but not caused by this change. It should be fixed — the fix is ~15 lines mirroring `apiSecurity.test.js:243-273`, and it is the last remaining instance of this pattern in the auth surface — but it does not block this change's archive.

**WARNING-2 — `reapFamily` is never called on a `grace` outcome, so retention is narrower than the spec's wording. CONFIRMED; the spec overstates the implementation.**

`refresh-token-rotation/spec.md:87`: *"Each successful refresh MUST delete rows from that token's family that are already superseded past the grace window."* `reapFamily` has exactly one production caller: `RotateRefreshTokenUseCase.ts:52`, inside the rotation transaction. `RefreshSessionUseCase:122` returns `{ outcome: 'grace' }` without reaping, and a grace hit **is** a successful refresh — it returns 200 and issues an access cookie. So the requirement's own scenario ("GIVEN a family has rows superseded more than 30s ago, WHEN a refresh in that family succeeds") is not satisfied for the grace branch.

Practical impact is low: a grace hit is a narrow race artifact, and the next rotation in that family reaps. This is a wording defect, not a storage risk. The honest fix is to narrow the spec to "each successful **rotation**", which is what was designed and built, rather than widening the code to reap on a path deliberately kept side-effect-free (D2 exists to stop the grace branch from writing anything the winner owns). Either way, spec and code should say the same thing — the failure mode this change keeps hitting.

**WARNING-3 — Stale contract statements outside the five spec files.** The sweep did not extend past `specs/` and `design.md`, leaving four statements that now describe superseded behaviour. None is binding, but each is a future reader's trap and each is the same drift class as CRITICAL-1:

| Location | Stale text | Reality |
|---|---|---|
| `tasks.md:79` (task 2.16) | "access cookie fixed at 30 min regardless" | Cookie follows the session; only the token is fixed |
| `sessionCookies.ts:49-50` | "The cookie itself is fixed at `ACCESS_TOKEN_TTL_SECONDS` regardless of 'remember me'" | Contradicted by the amended comment at `:56-58` **in the same docblock's own function** |
| `sessionCookies.ts:67-69` | "`remember` governs the refresh token and the CSRF/display cookies — the access cookie's TTL is fixed" | The access cookie takes `remember` too (`:79`) |
| `cookieOptions.ts:24-26` | `authMaxAge` "governs... NOT the access token, whose TTL is fixed (see `accessCookieOptions`)" | `accessCookieOptions` calls `authMaxAge` directly (`:79`) |

**WARNING-4 — `apply-progress.md:141` still asserts the false sweep claim.** It reads "Two spec files contradicted each other on the grace mechanic. All five were swept this time." The commit it describes (`047dec6`) touched one spec file, as `8e16941`'s own commit message documents. The apply record still carries the claim that verify #2 disproved.

**WARNING-5 — 33 of 52 tasks have no recorded RED/GREEN evidence.** `apply-progress.md:145` discloses that PR2's and PR3's apply agents were killed by provider rate limits before writing their TDD tables. The disclosure is honest and the tests exist and pass, but Strict TDD's ordering claim is unverifiable for those tasks.

**WARNING-6 — Integration and E2E tiers unexecuted locally.** Port 3306 is held by the maintainer's MariaDB. Eleven scenarios above are credited to CI alone. This is environmental, not a defect, but it means the tier that caught both `reapFamily` bugs did not run for this verification.

#### SUGGESTION

1. **Add the two PARTIAL cross-site scenarios as real tests.** "Cross-site refresh request is rejected" and "Refresh cookie is not sent to other endpoints" are currently inferred from asserted cookie attributes (`sameSite: 'lax'`, `path`). Playwright can assert browser non-attachment directly, and `refresh-race.spec.ts` already has the context plumbing.
2. **Rename `auth.test.ts:42`.** Even after CRITICAL-2 is fixed, "invalid or expired" on a test that only covers "invalid" is how the gap stayed invisible. One name per branch.
3. **Make the drift check mechanical.** Three cycles have now blocked on prose contradicting code. A cheap guard: a test asserting `accessCookieOptions(true).maxAge === REMEMBER_MAX_AGE` already exists — pair it with a docs check that greps the spec set for `access.*cookie.*(TTL|expiration)` and fails on a match outside the explaining paragraph.

---

### Verdict

**FAIL**

Two blockers. CRITICAL-1: `api-jwt-auth/spec.md:106` still mandates the superseded access-cookie lifetime, contradicting the implementation, its tests, `session-cookie-security/spec.md:16`, and the amended prose nine lines above it — the same contract-drift failure that blocked the previous two verifies, this time surviving inside the file the fix edited. CRITICAL-2: the safety property the amendment newly wrote down, and on which the whole justification for a long-lived `m3d_auth` cookie rests, has no covering test; the e2e suite delegates it to a backend unit test that was never written.

Both remedies are small — a two-line spec amendment and a five-line test. No code defect was found: the implementation is coherent, the design is followed, all 52 tasks are genuinely implemented, and 1248 tests, type-check, lint, architecture, OpenAPI and audit are all green. What is not yet true is that the written contract and the runtime evidence agree with the code.
