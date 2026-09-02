```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:a88717f596336ec3f5d312fc022c85ac4e4353e807be51b1215f9599c754b81e
verdict: fail
blockers: 1
critical_findings: 1
requirements: 8/14
scenarios: 36/42
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:8007994cf1dd50f8d85c03ea2235622fbfdf1c51d41b9e7bcdd64bcd101c2a3f
build_command: pnpm type-check
build_exit_code: 0
build_output_hash: sha256:142ca3df7a3750a463c37089b26580332e55f5eb2457dcf45594c700bb207c80
```

## Verification Report

**Change**: auth-refresh-tokens
**Version**: N/A (OpenSpec change deltas)
**Mode**: Strict TDD
**Verified against**: working tree at `feat/auth-refresh-tokens-03-frontend`, HEAD `34eeac4` (PR1+PR2 merged in `main`, PR3 branch-only)
**Date**: 2026-09-02

> **This report supersedes the previous FAIL verdict** recorded in this file on 2026-09-02 14:24.
>
> **What changed since that verdict.** All three findings it raised were re-checked independently against live code, and all three are genuinely fixed:
> 1. The refresh limiter now has real end-to-end coverage — a supertest that exhausts the window and observes an actual 429 (confirmed below, including *how* it defeats the middleware's own Jest bypass).
> 2. Logout now revokes the refresh family even when the access token has expired.
> 3. The `remember-token-store` spec no longer claims `successorHash` is "returned on a grace-window hit".
>
> **Why the verdict is still FAIL.** The fix for finding 2 changed observable behaviour that two spec files and `design.md` still forbid in `MUST` language, and those documents were never updated. This is a *different* blocker from the previous one — not a regression and not an unaddressed carry-over. The remedy is almost certainly a documentation amendment, not a code revert. See CRITICAL-1.

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 52 |
| Tasks complete | 52 |
| Tasks incomplete | 0 |

All 52 checkboxes in `tasks.md` are marked. Per instruction, the marks were treated as a claim, not evidence: each work unit was checked against live code via source inspection. No task was found marked complete without corresponding implementation. Task completion is **not** the reason for this verdict.

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
frontend  Test Files  20 passed (20)
frontend  Tests       242 passed (242)
backend   Test Suites 122 passed, 122 total
backend   Tests       1006 passed, 1006 total
EXIT=0
```

Minor correction to the evidence handed to this phase: the frontend tier reports **242** passing, not 241. Backend's 1006 matches. Jest emits a non-fatal "worker process has failed to exit gracefully" notice on the backend tier; it does not affect the exit code and is pre-existing.

**Tiers not executed locally**: `pnpm test:integration` and `pnpm test:e2e` could not be run — port 3306 is held by the maintainer's MariaDB instance, and the integration config requires a reachable MySQL/MariaDB. This report relies on CI at commit `047dec6` (reported all four checks green, including real-MySQL integration and Playwright e2e) for those tiers. Every conclusion below that depends on integration or e2e evidence is marked as such. **This is a real limit on the strength of this verification, not a formality.**

**Coverage**: Not available — no coverage tooling is configured in either workspace. Not a failure.

---

### Spec Compliance Matrix

Counting rule used throughout: a scenario is COMPLIANT only when a covering test asserting that specific behaviour passed at runtime. A requirement is counted complete only when *all* of its scenarios are COMPLIANT.

#### api-jwt-auth (4 requirements, 16 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| API JWT Login Endpoint | Successful login sets an auth cookie | `apiAuthCookieLifecycle.test.ts` > full lifecycle | COMPLIANT |
| API JWT Login Endpoint | API login with invalid credentials | `apiSecurity.test.js`, `UserApiController.test.ts` | COMPLIANT |
| API JWT Login Endpoint | API login exceeds rate limit | `loginLimiter.test.ts` (mocks `express-rate-limit`) | **PARTIAL** |
| API JWT Login Endpoint | Access token TTL is fixed regardless of remember | `apiAuthCookieLifecycle.test.ts:239,263` — `exp - iat === ACCESS_TOKEN_TTL_SECONDS` | COMPLIANT |
| Cookie-Based Authorization | Request without cookie | `auth.test.ts` | COMPLIANT |
| Cookie-Based Authorization | Invalid or expired cookie | `auth.test.ts` | COMPLIANT |
| Cookie-Based Authorization | Valid cookie with `typ: access` | `auth.test.ts:49` | COMPLIANT |
| Cookie-Based Authorization | Bearer header alone is rejected | `auth.test.ts:83` | COMPLIANT |
| Cookie-Based Authorization | Admin-only view with non-admin cookie | `apiSecurity.test.js` | COMPLIANT |
| Cookie-Based Authorization | Pre-deploy JWT without `typ` rejected | `auth.test.ts:63`, e2e `refresh-race.spec.ts:105` | COMPLIANT |
| Logout Endpoint | Logout clears the session cookies | `UserApiController.test.ts` | COMPLIANT |
| Logout Endpoint | Logout revokes the refresh family | `UserApiController.test.ts`, `RevokeRefreshTokenUseCase.test.ts`, repo integration (CI) | COMPLIANT |
| Logout Endpoint | Prior access token cannot be renewed after logout | `RefreshSessionUseCase.test.ts` (revoked -> rejected) | COMPLIANT |
| Logout Endpoint | Logout without an active session | `UserApiController.test.ts` (unsigned garbage -> 204, no revoke) | COMPLIANT |
| Remember-Me Extended Session | Remember-me extends refresh, not access | `cookieOptions.test.ts:73`, `apiAuthCookieLifecycle.test.ts` | **FAILING** |
| Remember-Me Extended Session | No remember-me keeps default refresh lifetime | `cookieOptions.test.ts:75`, e2e `auth.spec.ts:117` | COMPLIANT |

#### refresh-token-rotation (5 requirements, 12 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Refresh Endpoint | Refresh succeeds with an expired access token | `UserApiController.test.ts`, route has no `apiAuthMiddleware` (verified `users.ts:200`) | COMPLIANT |
| Refresh Endpoint | Refresh rejected without a valid refresh cookie | `UserApiController.test.ts`, `RefreshSessionUseCase.test.ts` | COMPLIANT |
| Refresh Endpoint | Cross-site refresh request is rejected | No direct test; `sameSite: 'lax'` asserted, absent-cookie -> 401 asserted | **PARTIAL** |
| Refresh Endpoint | Refresh rate limit | `apiSecurity.test.js:254` — real 429 via supertest | COMPLIANT |
| Refresh Carries Remember Distinction | Remembered session issues a 30-day refresh token | `cookieOptions.test.ts`, e2e `auth.spec.ts:56` | COMPLIANT |
| Refresh Carries Remember Distinction | Default session issues a 2-hour refresh token | `cookieOptions.test.ts`, e2e `auth.spec.ts:117` | COMPLIANT |
| Rotation With Grace Window | Successful refresh rotates the token | `RotateRefreshTokenUseCase.test.ts`, repo integration (CI) | COMPLIANT |
| Rotation With Grace Window | Grace hit issues access cookie only, no refresh cookie | `UserApiController.test.ts` (asserts no refresh `res.cookie` on `grace`), `RefreshSessionUseCase.test.ts` | COMPLIANT |
| Rotation With Grace Window | Replay past the grace window fails | `RefreshSessionUseCase.test.ts` | COMPLIANT |
| Rotation With Grace Window | Family id populated on every row | Repo integration `:156` (CI, real DB) | COMPLIANT |
| Concurrent Refresh From Multiple Tabs | Two tabs refresh concurrently, both stay logged in | Repo integration `:88` (real concurrency), e2e `refresh-race.spec.ts:50` | COMPLIANT |
| Retention on Successful Refresh | Old superseded rows reaped on refresh | Repo integration `:221`, `:298` (CI, real DB) | **PARTIAL** |

#### remember-token-store (2 requirements, 8 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Model Schema and Associations | User association is configured | `db` model tests | COMPLIANT |
| Model Schema and Associations | New rows carry rotation metadata | Repo integration `:156` (CI) | COMPLIANT |
| Model Schema and Associations | Legacy duplicate indexes removed | `migrate.integration.test.js:82` (CI) | COMPLIANT |
| Model Schema and Associations | Migration down restores baseline exactly | `migrate.integration.test.js:132` (CI) | COMPLIANT |
| Service Hashed Token Management | Creating a token hashes and stores it | `CreateRememberTokenUseCase.test.ts` | COMPLIANT |
| Service Hashed Token Management | Verifying returns user or cleans up expired | `VerifyRememberTokenUseCase.test.ts` | COMPLIANT |
| Service Hashed Token Management | Verifying a revoked token fails without deleting | `VerifyRememberTokenUseCase.test.ts` | COMPLIANT |
| Service Hashed Token Management | Deleting removes the record | `DeleteRememberTokenUseCase.test.ts` | COMPLIANT |

#### csrf-protection (1 requirement, 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Refresh Endpoint CSRF Exemption | Refresh without a CSRF token succeeds | `apiSecurity.test.js:254` (no session, no CSRF header, reaches limiter) | COMPLIANT |
| Refresh Endpoint CSRF Exemption | Refresh route bypasses the guard entirely | `csrf.test.ts:109`; `users.ts:200` mounts only `refreshLimiter` | COMPLIANT |

#### session-cookie-security (2 requirements, 4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Per-Cookie Lifetime Split | Auth cookie expires with the access token | `cookieOptions.test.ts:65` asserts the **negation** | **FAILING** |
| Per-Cookie Lifetime Split | CSRF and display cookies expire with the refresh token | `apiAuthCookieLifecycle.test.ts`, e2e `auth.spec.ts` | COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie scoped to the refresh route | `cookieOptions.test.ts:80`, e2e `auth.spec.ts:104` | COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie not sent to other endpoints | Path asserted; browser non-attachment not directly asserted | **PARTIAL** |

**Compliance summary**: 36/42 scenarios COMPLIANT, 2 FAILING, 4 PARTIAL. 8/14 requirements fully complete.

---

### Correctness (Static Evidence)

| Requirement area | Status | Notes |
|---|---|---|
| Refresh endpoint wiring | Implemented | `users.ts:200` — `router.post('/users/refresh', refreshLimiter, controller.refresh)`. No `apiAuthMiddleware`, no `csrfGuard`. Exactly as specified. |
| Rotation transaction | Implemented | `RotateRefreshTokenUseCase` — claim / insert successor / reap in one UoW transaction. Conditional `UPDATE ... WHERE superseded_at IS NULL AND revoked_at IS NULL AND expiry_date > NOW()` is the authoritative gate. |
| Grace window | Implemented | `RefreshSessionUseCase.resolveGraceOrReject` — 30s deadline from `supersededAt`; `grace` outcome sets access cookie only (`UserApiController.refresh:154` gates `issueRefreshCookie` on `outcome === 'rotated'`). Matches the accepted deviation exactly. |
| Logout revocation | Implemented | `readFamilyIdFromAccessToken` + `RevokeRefreshTokenUseCase`. Verified below. |
| `reapFamily` mechanics | Implemented | `destroy()` with `Op.lte` against DB-side `NOW() - INTERVAL {grace} SECOND`; `graceSeconds` coerced to a non-negative integer before interpolation. Matches the accepted deviation. |
| Access cookie lifetime | **Contradicts spec** | See CRITICAL-1. |
| Frontend transparent refresh | Implemented | `authFetch` retries once on 401 behind single-flight `ensureRefreshed`; never recurses into itself for the refresh call. |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1 — one transaction: claim, insert successor, reap | Yes | `RotateRefreshTokenUseCase:32-55`. |
| D2 — only the rotation winner writes the refresh cookie | Yes | `UserApiController:154`. |
| D3 — opaque refresh token; `typ: 'access'` set in one place | Yes | `generateRefreshToken` is `randomBytes(32)`; `typ` added only in `issueAccessCookie`, required only in `apiAuthMiddleware`. |
| D4 — `accessCookieOptions` uses `maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000` | **No** | `design.md:91-92` still specifies this. `cookieOptions.ts:78-79` uses `authMaxAge(remember)`. Design never updated. Part of CRITICAL-1. |
| D5 — refresh defended by httpOnly + sameSite + path scoping + rotation + rate limiting | Yes | All five verified present; rate limiting now has real runtime evidence. |
| D6 — `lib/http` avoids the `config.ts` import cycle | Yes | `authFetch` deliberately does not import `session.service.ts`; trade-off documented in-code and in `apply-progress`. |

---

### Targeted re-checks of the previous verdict's findings

**1. Refresh limiter coverage — GENUINELY FIXED.**
`apiSecurity.test.js:243-273` drives 10 real requests through `POST /api/users/refresh` via supertest and asserts the 11th returns 429 with the exact error body. Critically, I checked *how* it gets past the middleware's own escape hatch: `refreshLimiter.ts:29` bypasses throttling when `NODE_ENV === 'test' && JEST_WORKER_ID`, and the test sets `process.env.NODE_ENV = 'production'` (line 258) before issuing requests. Because that bypass is evaluated per-request rather than at module load, the real `express-rate-limit` instance is exercised. This is authentic end-to-end evidence, not configuration assertion. The test also reuses the already-built `app` rather than re-requiring it under `NODE_ENV=production`, correctly avoiding `app.js`'s unrelated `CORS_ORIGIN` guard.

**2. Logout revocation after access-token expiry — GENUINELY FIXED, and the security question answered.**
`readFamilyIdFromAccessToken` (`sessionCookies.ts:107`) uses `jwt.verify(token, getJwtSecret(), { ignoreExpiration: true })`. I traced every consumer of the relaxed path and every reader of the auth cookie:

- `readFamilyIdFromAccessToken` has exactly **one** caller in the entire repository: `UserApiController.logout:117`. It is not reachable from any authenticating path.
- `ignoreExpiration` appears in exactly one place in production source.
- The only other production reader of `AUTH_COOKIE` is `apiAuthMiddleware` (`auth.ts:16`), which uses a plain `jwt.verify` with **no** `ignoreExpiration` and additionally requires `decoded.typ === 'access'`. An expired token throws and returns 401.
- `csrfGuard` derives `userId` from `req.user`, which only `apiAuthMiddleware` sets, so a stale cookie cannot satisfy the CSRF check either.

**Conclusion: a stale access cookie authenticates nothing.** The only capability it retains is revoking its own refresh family via logout — an authority-*removing* operation. The relaxation is correctly scoped. The accepted deviation (residual window up to `ACCESS_TOKEN_TTL_SECONDS`) still holds, because `apiAuthMiddleware` continues to enforce `exp`. New coverage confirms both halves: an expired-but-signed token *does* revoke (`fam-expired` test), and unsigned garbage does *not*.

**3. Spec contradiction on the grace mechanic — GENUINELY FIXED.**
`git show 047dec6` confirms `remember-token-store/spec.md:8` was rewritten from "set on rotation, returned on a grace-window hit" to language stating `successorHash` is a SHA-256 digest that can never yield the successor token, cross-referencing `refresh-token-rotation`. I swept all five spec files for residual "returned"/successor claims; none remain. The two spec files now agree.

**4. `apply-progress.md` — REWRITTEN AND ACCURATE.**
It now covers all three PRs, contains a `TDD Cycle Evidence` table, and describes `reapFamily` correctly. It states plainly that PR2's and PR3's 33 tasks have no recorded RED/GREEN evidence because both apply agents were killed by provider rate limits. That disclosure is honest and is treated below as a WARNING, not a fabrication.

---

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | `TDD Cycle Evidence` table present at `apply-progress.md:23` |
| All tasks have tests | Partial | Every implementation task maps to at least one test file; 19/52 have per-task RED/GREEN rows |
| RED confirmed (tests exist) | Yes | Every test file referenced in the table exists on disk |
| GREEN confirmed (tests pass) | Yes | 1006 backend + 242 frontend passing, exit 0 |
| Triangulation adequate | Yes | Multi-case coverage on rotation branch table (6 rows), grace boundaries, remember/no-remember, and `authFetch` 401 paths |
| Safety Net for modified files | Partial | Not recorded for the 33 PR2/PR3 tasks |

**TDD Compliance**: 4/6 checks fully passed; 2 partial, both caused by the missing PR2/PR3 record rather than by missing tests.

---

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | ~1150 | ~135 | Jest (backend), Vitest (frontend) |
| Integration (real MySQL) | 10 named cases across the refresh work | 2 relevant of 10 | Jest, `jest.integration.config.js`, `maxWorkers: 1` |
| E2E (real browser) | 4 named cases across the refresh work | 2 relevant of 10 | Playwright (chromium) |
| **Total (locally executed)** | **1248** | **142** | |

The layering is appropriate. The behaviours that unit tests structurally cannot prove — MySQL clock semantics in `reapFamily`, real row-level rotation concurrency, migration index shape, and cross-tab browser behaviour — are all pushed to integration or e2e, which is exactly the correction this cycle's four escaped defects called for.

---

### Assertion Quality

Audited all 15 test files created or modified by this change.

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `e2e/tests/auth.spec.ts` | 56 | test title "…while the access cookie stays short" | Title asserts the opposite of the body (line 114 asserts >29 days) | WARNING |
| `backend/src/__tests__/apiAuthCookieLifecycle.test.ts` | 219, 243 | titles "…on CSRF/USER/REFRESH" | Bodies now also cover `AUTH_COOKIE`; titles are stale | WARNING |

No tautologies (`expect(true).toBe(true)`), no ghost loops, no assertions that never call production code, no smoke-test-only cases, and no mock-heavy files were found. Every `toBeDefined()` occurrence is a guard immediately followed by a value assertion in the same test (verified individually), which the audit explicitly permits. Mock-to-assertion ratios are healthy: `authFetch.test.ts` 8/19, `refreshSingleFlight.test.ts` 4/9, `credentials.test.ts` 0/21.

**Assertion quality**: 0 CRITICAL, 2 WARNING (both are misleading titles, not weak assertions).

---

### Quality Metrics

**Linter**: Reported green by the orchestrator across both workspaces.
**Type Checker**: Verified in this phase — `pnpm type-check` exit 0.
**Architecture check / OpenAPI check / deploy-script tests / frontend quality-check / frontend build**: Reported green by the orchestrator.

---

### Issues Found

**CRITICAL**

**CRITICAL-1 — The shipped access-cookie lifetime contradicts two spec files and `design.md`, in `MUST` language, and the contradiction is recorded nowhere in the contract.**

The fix for the logout defect changed `accessCookieOptions` so the `m3d_auth` cookie carries the *session* lifetime (2h, or 30d with remember-me) instead of the access-token TTL:

```ts
// backend/src/infrastructure/security/cookieOptions.ts:78-79
export const accessCookieOptions = (remember?: boolean): CookieOptions =>
  cookieOptions({ httpOnly: true, maxAge: authMaxAge(remember) });
```

Three governing documents still require the opposite, and none of them were updated:

1. `specs/session-cookie-security/spec.md:7` — "`m3d_auth` MUST use the access-token TTL (fixed, env-tunable, default 30 minutes)", with the scenario "Auth cookie expires with the access token → its `maxAge` MUST equal the access-token TTL".
2. `specs/api-jwt-auth/spec.md:97` — "The access-token cookie's expiration MUST always equal the fixed access-token TTL regardless of 'remember me'", with the scenario "…AND the access-token cookie's expiration MUST remain the fixed access-token TTL".
3. `design.md:91-92` — still specifies `accessCookieOptions = () => cookieOptions({ httpOnly: true, maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000 })`.

This is not a documentation lag that testing would catch — the test suite was updated to assert the *negation* of the spec, so the contradiction is invisible to a green run:

```ts
// backend/src/infrastructure/security/__tests__/cookieOptions.test.ts:65-76
expect(options.maxAge).toBe(SESSION_MAX_AGE);
expect(options.maxAge).not.toBe(ACCESS_TOKEN_TTL_SECONDS * 1000);
...
expect(accessCookieOptions(true).maxAge).toBe(REMEMBER_MAX_AGE);
```

**Correction to this phase's inputs.** The brief stated that "all five spec files were swept" during the fix. `git show 047dec6 --name-only` shows the commit touched exactly one spec file — `specs/remember-token-store/spec.md` — plus `tasks.md` and `verify-report.md`. `session-cookie-security/spec.md`, `api-jwt-auth/spec.md`, and `design.md` are all still at commit `b8d4528` and still describe the pre-fix behaviour. The sweep covered the grace mechanic only; the lifetime change was never propagated. The change *is* recorded in `apply-progress.md:139`, so the information exists — it simply never reached the contract.

**Assessment.** The implemented behaviour is defensible and I verified it introduces no authentication weakness (see re-check 2 above). The likely correct remedy is to **amend the two spec files and `design.md`**, and record the lifetime change as an explicit accepted deviation alongside the other four — not to revert the code. But that is a maintainer's decision, not a verifier's. It blocks archive because archiving would promote spec deltas into the baseline capability specs while the shipped code contradicts them in `MUST` language, leaving a contract that is wrong from day one, actively defended by passing tests.

**WARNING**

1. **The login rate-limit requirement is still in the mock-only position the previous verify flagged for refresh.** `api-jwt-auth` scenario "API login exceeds rate limit" requires a 429. Its only coverage is `loginLimiter.test.ts`, which mocks `express-rate-limit` wholesale and therefore proves configuration, not throttling. Real supertest 429 coverage exists for `/api/users/register` and (now) `/api/users/refresh`, but **not** for `/api/users/login` — the actual credential brute-force surface. Mitigating: the mount is statically verified (`users.ts:176`) and the identical pattern is proven end-to-end twice in the same file, so this is weaker than the original refresh gap. Closing it is roughly a ten-line addition mirroring the block at `apiSecurity.test.js:243`. **This is the requirement whose only coverage still mocks the thing being asserted.**
2. **Retention is not applied on a grace-hit refresh.** `refresh-token-rotation` states "Each successful refresh MUST delete rows from that token's family that are already superseded past the grace window". `reapFamily` is called only from `RotateRefreshTokenUseCase:52`, so a `grace` outcome — which is a successful refresh — performs no reap. Impact is low (the next rotation reaps), but the implementation is narrower than the requirement text.
3. **Stale titles and comments now contradict the code they describe.** All are artefacts of the lifetime change: `sessionCookies.ts:49-50` ("The cookie itself is fixed at `ACCESS_TOKEN_TTL_SECONDS` regardless of 'remember me'") is contradicted by lines 56-58 of the same docblock; `cookieOptions.test.ts:127-129` says the access TTL "is fixed at ACCESS_TOKEN_TTL_SECONDS — see the describe block above", where that block asserts the opposite; `e2e/tests/auth.spec.ts:56` and `:88`; `apiAuthCookieLifecycle.test.ts:219,243`. Each is individually trivial; together they are the same misinformation the specs carry, and they will mislead the next reader.
4. **TDD evidence is missing for 33 of 52 tasks.** `apply-progress.md` discloses this honestly (PR2/PR3 apply agents killed by provider rate limits). Tests demonstrably exist and pass for that work, so this is a gap in the record rather than evidence of a gap in practice — but the strict-TDD claim cannot be independently confirmed for those tasks.
5. **Integration and e2e tiers were not executed in this phase.** Port 3306 is held by the maintainer's MariaDB. Eight scenarios in the matrix above rest on CI evidence at `047dec6` rather than on execution observed here. Notably, three of this cycle's four escaped defects were caught only at those tiers.

**SUGGESTION**

1. The access cookie now persists a signed JWT containing `userId`, `email`, `idRole`, and `category` for up to 30 days instead of 30 minutes. It is `httpOnly`, `sameSite: lax`, and `secure` in production, and the token is expired and unusable for authentication — but the information-at-rest window widened by three orders of magnitude. If only `familyId` is needed after expiry, a dedicated minimal cookie would carry less.
2. `readFamilyIdFromAccessToken` does not check `typ`. Harmless today because refresh tokens are opaque random bytes and no other JWT type exists, but if a second signed token type is ever introduced it could be replayed into logout. Adding a `typ === 'access'` check costs one line and keeps the invariant local.
3. Consider a server-side assertion for "Cross-site refresh request is rejected" and "Refresh cookie is not sent to other endpoints". Both currently rest on browser behaviour that no test observes directly.

---

### Verdict

**FAIL**

The change is functionally sound, well-tested, and all three findings from the previous verify are genuinely resolved — but the shipped `m3d_auth` cookie lifetime contradicts two spec files and `design.md` in `MUST` language, with passing tests asserting the negation, and the deviation was never recorded in the contract.
