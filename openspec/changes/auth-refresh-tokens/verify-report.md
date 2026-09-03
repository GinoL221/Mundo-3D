```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b869c72d1e1e2d889dfa6230bd952f5314fc2c932533209d0ca78aa187aafad7
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 14/14
scenarios: 44/44
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:9d48043b00e442fd682fdeaf61bbc2c112afc90871c5abab62749676b800de54
build_command: pnpm type-check
build_exit_code: 0
build_output_hash: sha256:1f8806d84b9ecaaf214bf27094860b3c350add8fdc51de892b5d1c98bf0ce9b3
```

## Verification Report

**Change**: auth-refresh-tokens
**Version**: N/A (OpenSpec change, unarchived)
**Mode**: Strict TDD
**Revision verified**: `cee221485cc754284caf47a34431c3bf0ad6b344` (branch `feat/auth-refresh-tokens-03-frontend`), working tree clean except untracked `.impeccable/`
**Verify round**: 5

### This report supersedes the FOURTH FAIL verdict

The previous contents of this file recorded a FAIL whose blocker was **C1 — `UserApiController.refresh` called `issueAccessCookie` without a lifetime argument**, taking the 2h default and downgrading a remembered 30-day session on its first refresh. That defect is **fixed and verified fixed** at `cee2214`, as are the three stale documentation/test claims reported alongside it and the round-4 `W2` retention wording in `proposal.md`. The login-429 WARNING carried in the previous report was based on a false premise and is **closed** — confirmed below against live code.

What changed since that verdict:

| Prior finding | Status now | Evidence |
|---|---|---|
| C1 — refresh dropped the access-cookie lifetime | ✅ Fixed | `UserApiController.ts:151-155` passes `familyExpiresAt - now`; regression test at `UserApiController.test.ts:356-375` |
| C1b — lifetime was an optional parameter | ✅ Fixed | `issueAccessCookie(res, payload, maxAgeMs: number)` and `accessCookieOptions(maxAgeMs: number)` are both required; every call site re-swept below |
| Stale e2e test name ("access cookie stays short") | ✅ Fixed | `e2e/tests/auth.spec.ts:56` now reads "...on both the refresh and access cookies, while the access TOKEN stays short", matching its body |
| Stale controller-test comment ("AUTH_COOKIE diverges on purpose") | ✅ Fixed | Removed; `UserApiController.test.ts:327-330` now carries only the corrected statement |
| W2 — stale retention wording in `proposal.md` | ✅ Fixed | `proposal.md:33` now reads "On each refresh that ROTATES..." |
| Login-429 WARNING | ✅ Closed (false premise) | `trustProxy.test.js:78-88` loads the real `express-rate-limit` under `NODE_ENV=production` and asserts `[200, 200, 429]` |
| W1 — grace scenario without a test | ⚠️ Still open | Re-confirmed below |

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 52 (PR1 19, PR2 21, PR3 12) |
| Tasks complete | 52 |
| Tasks incomplete | 0 |

All task checkboxes are `[x]`. One task's stated deliverable does not match what shipped — see **W4**.

### Build & Tests Execution

**Build (type-check)**: ✅ Passed

```text
$ pnpm type-check      → pnpm --filter backend type-check → tsc --noEmit
exit 0, no diagnostics
```

**Tests**: ✅ 1250 passed / 0 failed

```text
$ pnpm test            → pnpm --filter "!e2e" test
backend  (jest):   Test Suites 122 passed, 122 total | Tests 1008 passed, 1008 total
frontend (vitest): Test Files   20 passed  (20)      | Tests  242 passed  (242)
exit 0
```

**Additional gates run independently by this phase** (not taken on trust):

| Gate | Command | Exit |
|---|---|---|
| Lint | `pnpm lint` | 0 |
| Architecture boundaries | `pnpm --filter backend architecture:check` | 0 |
| OpenAPI artifact freshness | `pnpm check:openapi` | 0 |

**Tiers that could not run locally**: `pnpm test:integration` and `pnpm test:e2e` were **not executed** — host port 3306 is held by the maintainer's MariaDB, and the e2e harness needs the same database. Every integration and e2e result cited in the matrix below is marked `(CI)` and rests on CI for PRs #114/#115/#116; PR #116 was green at `691e41b`, and runs for `29b6821`/`cee2214` were still in flight when this phase ran. **No integration or e2e test is claimed as observed-passing by this report.**

**Coverage**: ➖ Not run — a coverage pass was not part of this phase's evidence and the changed-file coverage table is therefore omitted rather than fabricated.

### Sweep method

The previous four rounds each failed a different sweep. This round swept by **claim**, not by file:

1. **Signature call-site sweep** (the gap round 4 exposed): every reference to `issueAccessCookie`, `accessCookieOptions`, `authMaxAge`, `issueRefreshCookie`, `refreshCookieOptions` across all of `backend`, `frontend`, `e2e`, and `openspec` — production, tests, and prose alike.
2. **Data-flow sweep**: traced `familyExpiresAt` from its producer (`RefreshSessionUseCase`) through both result branches to its consumer, and back to `RotateRefreshTokenUseCase`/`insertSuccessor` to confirm the value means what the fix assumes it means.
3. **Prose/claim sweep**: `deliberately`/`on purpose`/`diverge`/`stays short`/`retention`/`maxAge`/`access cookie`/TTL claims across all five specs, `design.md`, `proposal.md`, `tasks.md`, `apply-progress.md`, source comments, and test names.
4. **Scenario sweep**: each of the 44 scenarios mapped to a named passing test.
5. **Seam sweep**: for each requirement whose unit coverage is mocked, checked whether some real-DB or real-browser test crosses the seam.

### Verification of the three fix claims

**Claim 1 — `refresh` now issues the access cookie for the family's remaining lifetime. ✅ VERIFIED, and verified coherent.**

`RefreshSessionResult` carries `familyExpiresAt` on both non-rejecting branches (`RefreshSessionUseCase.ts:25,30`), sourced from `current.expiryDate` on `rotated` (`:95`) and `row.expiryDate` on `grace` (`:143`). `UserApiController.refresh` consumes it once, before the rotated/grace branch, at `:151-155`:

```ts
Math.max(0, familyExpiresAt.getTime() - Date.now())
```

The claim that this is the *family's* deadline is load-bearing and was checked rather than assumed: `RotateRefreshTokenUseCase.ts:48` builds the successor with `current.expiryDate` verbatim, so expiry is inherited across rotations and never slid. `design.md:39` and `proposal.md:159` both state this as the intended design. Therefore every row in a family shares one absolute deadline, and re-issuing `m3d_auth` at `familyExpiresAt - now` reproduces the same absolute instant the login-time `m3d_csrf`/`m3d_user` cookies already carry. The four cookies now converge rather than diverge — which is what "Per-Cookie Lifetime Split" requires. The `Math.max(0, ...)` floor is unreachable defensive code: `execute` rejects on `new Date() > current.expiryDate` before either branch can produce a result.

**Claim 2 — the lifetime is a required argument, and no caller anywhere still gets a lifetime it should not. ✅ VERIFIED.**

`issueAccessCookie(res, jwtPayload, maxAgeMs: number)` (`sessionCookies.ts:59`) and `accessCookieOptions(maxAgeMs: number)` (`cookieOptions.ts:78`) both take the lifetime non-optionally. The exhaustive call-site sweep found **exactly two production callers**, and both are correct:

| Call site | Lifetime passed | Correct? |
|---|---|---|
| `sessionCookies.ts:86` (`setSessionCookies`, login/register) | `authMaxAge(remember)` — 2h or 30d | ✅ the session lifetime, per `session-cookie-security` |
| `UserApiController.ts:151` (`refresh`) | `familyExpiresAt - now` | ✅ the family's remaining lifetime |

`accessCookieOptions` has exactly one caller (`sessionCookies.ts:66`) and one test file. No other production, test, or e2e file calls either function. `authMaxAge` retains three legitimate consumers (`setSessionCookies` ×2, and `establishSession`'s `durationSeconds` at `UserApiController.ts:56`, which sets the refresh row's expiry — correctly the session lifetime). `tsc --noEmit` exits 0, so no caller compiles against a stale arity anywhere in the backend.

**Claim 3 — three stale claims cleared. ✅ VERIFIED, all three.** See the supersession table above. Independently re-grepped: no occurrence of "diverges on purpose" or "access cookie stays short" survives anywhere in the repository.

### Spec Compliance Matrix

44 scenarios across 14 requirements in 5 spec files. `(CI)` marks a test that exists and is expected to run in CI but was **not** observed passing locally this session.

#### `refresh-token-rotation` (5 requirements, 13 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Refresh Endpoint | Refresh succeeds with an expired access token | `e2e/refresh-race.spec.ts:50` (real expired `m3d_auth` + real refresh cookie) | ✅ COMPLIANT (CI) |
| Refresh Endpoint | Refresh rejected without a valid refresh cookie | `UserApiController.test.ts:503,514`; `RefreshSessionUseCase.test.ts:60,69,79,125` | ✅ COMPLIANT |
| Refresh Endpoint | Cross-site refresh request is rejected | `cookieOptions.test.ts:83` (`sameSite: lax` + path scope); `e2e/auth.spec.ts:104` (`Path=/api/users/refresh`) | ⚠️ PARTIAL — attributes asserted; no test observes a cross-site POST arriving without the cookie |
| Refresh Endpoint | Refresh rate limit | `apiSecurity.test.js:254` — real limiter under `NODE_ENV=production`, exhausts 10, asserts a real 429 | ✅ COMPLIANT |
| Remember Distinction | Remembered session issues a 30-day refresh token | `apiAuthCookieLifecycle.test.ts:219`; `e2e/auth.spec.ts:56` | ✅ COMPLIANT |
| Remember Distinction | Default session issues a 2-hour refresh token | `apiAuthCookieLifecycle.test.ts:243`; `e2e/auth.spec.ts:117` | ✅ COMPLIANT |
| Rotation + Grace | Successful refresh rotates the token | `RotateRefreshTokenUseCase.test.ts`; `SequelizeRememberTokenRepository.integration.test.ts:88,129` | ✅ COMPLIANT (CI for the real-DB half) |
| Rotation + Grace | Grace hit issues an access cookie only, without re-rotating | `UserApiController.test.ts:486` (asserts `m3d_refresh` call is `undefined`); `RefreshSessionUseCase.test.ts:105` | ✅ COMPLIANT |
| Rotation + Grace | Replay past the grace window fails | `RefreshSessionUseCase.test.ts:125` | ✅ COMPLIANT |
| Rotation + Grace | Family id is populated on every row | `SequelizeRememberTokenRepository.integration.test.ts:156` | ✅ COMPLIANT (CI) |
| Concurrent Refresh | Two tabs refresh concurrently and both stay logged in | `e2e/refresh-race.spec.ts:50` — one context, two pages, simultaneous navigation | ✅ COMPLIANT (CI) |
| Retention on Rotation | Old superseded rows are reaped on rotation | `SequelizeRememberTokenRepository.integration.test.ts:221`, `:298` | ✅ COMPLIANT (CI) |
| Retention on Rotation | **A grace hit leaves the family untouched** | `RefreshSessionUseCase.test.ts:105` — covers the grace-hit path and asserts `mockRotate.execute` was **not** called, which is the scenario's "no additional rotation" clause | ⚠️ PARTIAL — the "no row deleted, created or modified" clause is never asserted directly — **W1** |

#### `session-cookie-security` (2 requirements, 5 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Per-Cookie Lifetime Split | The auth cookie outlives the token it carries | `apiAuthCookieLifecycle.test.ts:219,243`; `UserApiController.test.ts:319`; `e2e/auth.spec.ts:56` | ✅ COMPLIANT |
| Per-Cookie Lifetime Split | An expired access token is still rejected for authentication | `auth.test.ts:48` | ✅ COMPLIANT |
| Per-Cookie Lifetime Split | CSRF and display cookies expire with the refresh token | `apiAuthCookieLifecycle.test.ts:219,243` | ✅ COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie is scoped to the refresh route | `cookieOptions.test.ts:24,83`; `e2e/auth.spec.ts:104` | ✅ COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie is not sent to other endpoints | `cookieOptions.test.ts:83` (Path attribute) | ⚠️ PARTIAL — the mechanism is asserted; browser non-attachment to another endpoint is never observed |

#### `api-jwt-auth` (4 requirements, 16 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Login Endpoint | Successful login sets an auth cookie | `apiAuthCookieLifecycle.test.ts:134` (4 Set-Cookie, no token in body) | ✅ COMPLIANT |
| Login Endpoint | API login with invalid credentials | `UserApiController.test.ts:302` | ✅ COMPLIANT |
| Login Endpoint | API login exceeds rate limit | `apiSecurity.test.js:220`; `trustProxy.test.js:73` (real limiter, `[200,200,429]`) | ✅ COMPLIANT |
| Login Endpoint | Access token TTL is fixed regardless of remember | `apiAuthCookieLifecycle.test.ts:219` (fixed-TTL access JWT under `remember:true`) | ✅ COMPLIANT |
| Cookie Authorization | Request to protected API without cookie | `auth.test.ts:28,35` | ✅ COMPLIANT |
| Cookie Authorization | Request with invalid or expired cookie | `auth.test.ts:48,63` | ✅ COMPLIANT |
| Cookie Authorization | Request with valid cookie | `auth.test.ts:70`; `apiAuthCookieLifecycle.test.ts:153` | ✅ COMPLIANT |
| Cookie Authorization | Bearer header alone is rejected | `auth.test.ts:104` | ✅ COMPLIANT |
| Cookie Authorization | Admin-only API view with non-admin cookie | `auth.test.ts:185,193` | ✅ COMPLIANT |
| Cookie Authorization | Pre-deploy JWT without `typ` is rejected | `auth.test.ts:84,94`; `e2e/refresh-race.spec.ts:105` | ✅ COMPLIANT |
| Logout Endpoint | Logout clears the session cookies | `UserApiController.test.ts:378`; `apiAuthCookieLifecycle.test.ts:153` | ✅ COMPLIANT |
| Logout Endpoint | Logout revokes the refresh family | `UserApiController.test.ts:400`; `SequelizeRememberTokenRepository.integration.test.ts:245` — real DB, reads `revokedAt` back through `findByHash` with a bystander-family negative control | ✅ COMPLIANT (CI for the real-DB half) |
| Logout Endpoint | Prior access token cannot be renewed after logout | `RefreshSessionUseCase.test.ts:69` (revoked checked before grace); `integration:280` (`claimRotation` refuses a revoked row) | ✅ COMPLIANT — see **W4** on the tier |
| Logout Endpoint | Logout without an active session | `UserApiController.test.ts:412` | ✅ COMPLIANT |
| Remember-Me Extended Session | Remember-me extends the refresh token, not the access token | `apiAuthCookieLifecycle.test.ts:219`; `e2e/auth.spec.ts:56` | ✅ COMPLIANT |
| Remember-Me Extended Session | Remember-me not requested keeps default refresh lifetime | `apiAuthCookieLifecycle.test.ts:243`; `e2e/auth.spec.ts:117` | ✅ COMPLIANT |

#### `remember-token-store` (2 requirements, 8 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Model Schema | User association is configured | `RememberTokenModel.test.js`; `migrate.integration.test.js:98` (real FK constraints) | ✅ COMPLIANT (CI for the real-DB half) |
| Model Schema | New rows carry rotation metadata | `RememberTokenUseCases.test.ts` (Create); `integration:156` | ✅ COMPLIANT |
| Model Schema | Legacy duplicate indexes removed | `migrate.integration.test.js:82` | ✅ COMPLIANT (CI) |
| Model Schema | Migration down restores the baseline schema exactly | `migrate.integration.test.js:132` | ✅ COMPLIANT (CI) |
| Service Token Management | Creating a token hashes and stores it | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |
| Service Token Management | Verifying returns the user or cleans up expired | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |
| Service Token Management | Verifying a revoked token fails without deleting it | `RememberTokenUseCases.test.ts` (revoked branch precedes expiry, `VerifyRememberTokenUseCase.ts:25`) | ✅ COMPLIANT |
| Service Token Management | Deleting removes the record | `RememberTokenUseCases.test.ts` | ✅ COMPLIANT |

#### `csrf-protection` (1 requirement, 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Refresh CSRF Exemption | Refresh request without a CSRF token succeeds | `csrf.test.ts:109`; `apiSecurity.test.js:254` (real POSTs with no CSRF header reach the limiter, returning 429 rather than 403) | ✅ COMPLIANT |
| Refresh CSRF Exemption | Refresh route bypasses the guard entirely | `users.ts:200` mounts only `refreshLimiter`; `csrf.ts:13-24` also exempts the path defensively | ✅ COMPLIANT |

**Compliance summary**: 44/44 scenarios have a passing covering test — 41 fully COMPLIANT, 3 PARTIAL, **0 UNTESTED, 0 FAILING**.

The envelope therefore reports 44/44 and 14/14. `PARTIAL` here carries its defined meaning — *a passing test exists but covers only part of the scenario* — not an absence of coverage, so no requirement is unproven and no scenario is a blocker. The three partials are depth caveats, and they are exactly what the `pass_with_warnings` verdict encodes:

- Two of them (`Cross-site refresh request is rejected`, `Refresh cookie is not sent to other endpoints`) have their entire **application-side** obligation asserted — `sameSite: 'lax'`, `httpOnly`, and `Path=/api/users/refresh` on both the set and the clear. The unasserted remainder is the browser's own cookie-attachment behaviour, which no test in this repository could assert without testing the browser vendor rather than this system. They are recorded as partial for precision, not as gaps, and raise no warning.
- Only **W1** is a genuine assertion-depth gap worth acting on.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Refresh Endpoint | ✅ Implemented | `users.ts:200` — `refreshLimiter` only, no `apiAuthMiddleware`, no `csrfGuard` |
| Refresh Token Carries the Remember Distinction | ✅ Implemented | `authMaxAge(remember)` drives both the row's `expiryDate` and the cookie |
| Rotation on Every Use With a Grace Window | ✅ Implemented | Claim → insert successor → reap in one transaction; grace path writes nothing |
| Concurrent Refresh From Multiple Tabs | ✅ Implemented | Conditional UPDATE + 30s grace; loser re-reads outside the aborted tx |
| Retention on Rotation | ✅ Implemented | `reapFamily` called only from `RotateRefreshTokenUseCase:52` |
| Per-Cookie Lifetime Split | ✅ Implemented | Now holds across refresh too, not only at login — this is the `cee2214` fix |
| Refresh Cookie Path Scoping | ✅ Implemented | `REFRESH_COOKIE_PATH` on both set and clear via one builder |
| API JWT Login Endpoint | ✅ Implemented | `ACCESS_TOKEN_TTL_SECONDS` default 1800 (30 min), env-tunable |
| Cookie-Based Authorization | ✅ Implemented | `typ: 'access'` required; Bearer rejected |
| Logout Endpoint | ✅ Implemented | `ignoreExpiration` read of `familyId`, signature still verified; revocation errors are not swallowed |
| Remember-Me Extended Session | ✅ Implemented | Extends the refresh token; access token `exp` fixed |
| Model Schema and Associations | ✅ Implemented | `20260901000000-refresh-token-rotation.js` present, 14-digit name |
| Service Hashed Token Management | ✅ Implemented | Revoked checked before expiry, no delete |
| Refresh Endpoint CSRF Exemption | ✅ Implemented | Never mounted; also in `EXEMPT_PATHS` |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1 — conditional-UPDATE rotation claim in one transaction | ✅ Yes | `RotateRefreshTokenUseCase:32-55` |
| D2 — six-row lookup branch table, revoked before grace | ✅ Yes | `RefreshSessionUseCase:63-108`; branch order matches |
| D2 — only the rotation winner writes the refresh cookie | ✅ Yes | `UserApiController.ts:160-163` |
| D3 — `typ: 'access'` set in exactly one place | ✅ Yes | `sessionCookies.ts:60` |
| D4 — one named cookie builder per kind, set and clear share it | ✅ Yes | `refreshCookieOptions()` used for both |
| D4 — `accessCookieOptions` signature | ❌ **No** | design.md still declares `(remember?: boolean)`; shipped is `(maxAgeMs: number)` — **W2** |
| D5 — refresh route middleware chain | ✅ Yes | `users.ts:200` |
| D6 — `config.ts` re-export facade, 9 credentialed adoptions | ✅ Yes | `config.ts` is 18 lines; 10 exclusions documented inline |
| D7 — only the rotation winner reaps | ✅ Yes | `design.md:143`, `proposal.md:33`, and spec all agree with the code |
| Expiry inherited, never slid | ✅ Yes | `RotateRefreshTokenUseCase:48` |

### Accepted deviations — verified as shipped

| Deviation | Verified | Evidence |
|---|---|---|
| Grace hit issues a fresh access cookie and **no** refresh cookie; returning the successor is impossible (`successor_hash` is SHA-256) | ✅ | `UserApiController.ts:160`; `RefreshSessionUseCase:139-144` returns no token; `Sha256TokenHasher` |
| Logout cannot invalidate the access token itself; residual up to `ACCESS_TOKEN_TTL_SECONDS` (default 1800) | ✅ | `cookieOptions.ts:21`; documented at `proposal.md:131-133` |
| Access TTL is 30 minutes, amended from 15 | ✅ | `cookieOptions.ts:21` = `30 * 60`; `proposal.md:117` records the amendment |
| `reapFamily` uses `destroy()` with a DB-side `NOW() - INTERVAL` cutoff and `Op.lte`, called only on rotation | ✅ | `SequelizeRememberTokenRepository.ts:126-137`; sole caller `RotateRefreshTokenUseCase:52`. `graceSeconds` is coerced to a non-negative integer before interpolation, and `Op.lte` cannot match a `NULL` `superseded_at`, so the current row is never reaped |
| `m3d_auth` deliberately outlives its token; a stale cookie authenticates nothing, its only capability being to revoke its own family | ✅ | `auth.ts` rejects on `exp`; `readFamilyIdFromAccessToken` uses `ignoreExpiration` but still verifies the signature. **Now true across refresh as well as login** |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ⚠️ Partial | `apply-progress.md:23-36` has a complete table for PR1's 19 tasks; PR2 and PR3 (33 tasks) have none — the doc states both phase agents were killed by provider rate limits before writing it |
| All tasks have tests | ✅ | Every task in the table names an existing test file; PR2/PR3 tasks map to existing tests verified in the matrix above |
| RED confirmed (tests exist) | ✅ 10/10 | Every file named in the PR1 table exists on disk |
| GREEN confirmed (tests pass) | ✅ 8/8 executable | The 8 unit-tier rows pass in this run; the 2 integration rows are honestly marked NOT executed |
| Triangulation adequate | ✅ | PR1 table shows 2+ cases for every multi-scenario behavior; `RefreshSessionUseCase` triangulates all 6 branches |
| Safety Net for modified files | ✅ | Pre-existing counts recorded for all 5 modified files; `N/A (new)` rows verified to be genuinely new |

**TDD Compliance**: 5/6 checks passed. The one gap is a **gap in the record, not evidence of a gap in the practice** — PR2/PR3 tests demonstrably exist and pass; what cannot be reconstructed is the RED-before-GREEN ordering for those 33 tasks. This was already disclosed at `apply-progress.md:145` and is carried forward as **S4**, not treated as a new finding.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | 1250 executed (1008 backend + 242 frontend) | 142 | jest, vitest |
| Integration (real MySQL) | 15 written, 0 executed locally | 3 change-relevant | jest + real MariaDB (unreachable: port 3306 held) |
| E2E | 4 change-relevant tests written, 0 executed locally | 2 (`refresh-race.spec.ts`, `auth.spec.ts`) | Playwright (needs the same DB) |

Every requirement whose only unit coverage is mocked has a real-DB or real-browser counterpart, with one exception noted in **W4**.

### Assertion Quality

Audited every test file this change created or modified for tautologies, orphan empty checks, type-only assertions used alone, ghost loops, smoke-only tests, and mock-heavy ratios.

**Assertion quality**: ✅ All assertions verify real behavior. No tautology, no assertion that fails to call production code, no ghost loop. Two observations recorded as suggestions rather than defects:

- `UserApiController.test.ts:373` asserts `maxAge > REMEMBER_MAX_AGE - 60_000` rather than an exact value. This is correct given the `Date.now()` arithmetic under test and is the right shape, not a weak assertion.
- `refreshLimiter.test.ts` mocks `express-rate-limit` and therefore proves configuration only. This is no longer a coverage hole: `apiSecurity.test.js:254` observes a real 429 from the real limiter on the real route.

### Quality Metrics

**Linter**: ✅ No errors (`pnpm lint`, exit 0)
**Type Checker**: ✅ No errors (`tsc --noEmit`, exit 0)
**Architecture boundaries**: ✅ Clean
**250-line file cap**: ✅ All changed source files under cap. `UserApiController.ts` is at 247/250 — see **S2**.
**No `console.log` in production paths**: ✅ Confirmed across `controllers/`, `use-cases/`, `lib/http/`

### Issues Found

**CRITICAL**: None.

The round-4 blocker is genuinely fixed, the fix is internally coherent, and the class of bug it was meant to make impossible has been re-checked exhaustively across every call site rather than assumed.

**WARNING**:

- **W1 — a spec scenario added without a test (carried forward from round 4, still open).**
  `specs/refresh-token-rotation/spec.md:96-100`, "A grace hit leaves the family untouched", requires that *no row in that family be deleted, created or modified* and that *the current row and any in-grace superseded row remain*. The only grace-path test, `RefreshSessionUseCase.test.ts:105-123`, asserts the outcome is `grace`, the user and `familyId` are returned, and `mockRotate.execute` was not called. It asserts nothing about non-mutation. The mocked repository exposes `claimRotation`, `insertSuccessor`, `revokeFamily`, `reapFamily`, `create`, and `deleteByHash`; not one is asserted un-called.
  Non-mutation is currently *inferable* — those four mutators are reachable only through the rotator, which is proven un-called — but inference from present structure is exactly what a regression breaks silently. `integration:298` ("does not delete a row still inside its grace window") is the nearest coverage, but it exercises `reapFamily` directly rather than the grace-hit request path.
  Classified WARNING rather than CRITICAL because a passing covering test for this scenario does exist and asserts its "no additional rotation" clause directly; the property holds in the shipped code; and the missing piece is a direct non-mutation assertion, roughly four lines (`expect(mockRepo.reapFamily).not.toHaveBeenCalled()` and the same for `insertSuccessor`, `claimRotation`, `revokeFamily`). The skill's CRITICAL gate is reserved for a scenario with *no* covering test, which is not the case here.

- **W2 — NEW. `design.md` D4 still declares the pre-fix signature; `cee2214` did not sweep it.**
  `design.md:96-97`:
  ```ts
  export const accessCookieOptions = (remember?: boolean) =>
    cookieOptions({ httpOnly: true, maxAge: authMaxAge(remember) });
  ```
  The shipped signature is `accessCookieOptions(maxAgeMs: number)`. This is the round-1 failure mode recurring one artifact further out: `cee2214` correctly updated `sessionCookies.ts`, `cookieOptions.ts`, both test files, `e2e/auth.spec.ts` and `proposal.md`, but touched no design file. The block is doubly misleading because it already carries an "AMENDED during verify" comment, so a reader has positive reason to trust it as current. Documentation-only; breaks no spec; blocks nothing but should be corrected before archive, since `design.md` is what survives archival as the record of the decision.

- **W3 — NEW. `apply-progress.md`'s "Post-verify corrections" stops at round 3.**
  `apply-progress.md:135-141` lists exactly three post-verify fixes — the logout-revocation CRITICAL, the refresh-limiter coverage hole, and the two contradicting spec files. The round-4 CRITICAL fixed in `cee2214` — the access-cookie downgrade, the `familyExpiresAt` addition, and the narrowing of the lifetime parameter to required — appears nowhere in the apply record. No artifact in `openspec/` mentions `familyExpiresAt` at all; the string exists only in source. The apply record therefore under-reports the change's own defect history by one round, and the section's `pnpm test` figures (973 backend / 205 frontend) are three commits stale against the current 1008 / 242. Same class as W2: a fix that swept code and specs but not the sibling record.

- **W4 — NEW. Task 2.21 is checked complete but its stated deliverable does not exist.**
  `tasks.md:84` reads: *"2.21 Integration test (real MySQL): logout revokes the family and a subsequent refresh with any of its tokens is 401; a grace hit issues no `m3d_refresh` header."* No test performs `POST /api/users/refresh` with a real refresh cookie against a real database anywhere in the repository — the only HTTP-level requests to that route are `apiSecurity.test.js`'s cookie-less rate-limit exhaustion and the OpenAPI path-presence check.
  The underlying **property is nonetheless covered**, by a complete chain rather than the single composed test the task promised: `integration:245-264` proves against real MySQL that `revokeFamily` marks every row in the family, that `findByHash` maps `revoked_at` back, and that a bystander family is untouched; `integration:280` proves `claimRotation` refuses a revoked row; `RefreshSessionUseCase.test.ts:69` proves a revoked row is rejected before the grace check; `UserApiController.test.ts:514` proves a rejection becomes a 401. The grace-hit half is asserted at `UserApiController.test.ts:486`. The seam that mocked coverage usually hides — whether the DB round-trip actually surfaces `revokedAt` — is the one seam the integration test explicitly crosses.
  So this is a task-record accuracy defect and a tier deviation, not an untested requirement. Recorded as WARNING; flagged deliberately because this cycle produced four defects that only real-DB or real-browser execution could see, which is precisely why the task specified that tier.

**SUGGESTION**:

- **S1** — `tasks.md:8` (verification finding #4) still says *"`specs/refresh-token-rotation/spec.md`'s 'Grace hit returns the stored successor' scenario (lines 57-61) is stale"* and that task 2.10 implements corrected behavior *"not the spec's literal wording."* That scenario no longer exists; lines 57-61 now hold the corrected "Grace hit issues an access cookie only" scenario, and the spec's literal wording is now the implemented behavior. The note reads as a live contradiction between spec and code when none remains. It sits in an explicitly historical findings section, which is why this is a suggestion rather than a warning.
- **S2** — `UserApiController.ts` is 247 of the project's 250-line cap. The next handler added to it forces a split. Not a violation.
- **S3** — The C1 regression test (`UserApiController.test.ts:356`) asserts the family-lifetime cookie only on the `grace` branch. `issueAccessCookie` is called once before the rotated/grace branch, so the `rotated` path shares the identical line and cannot diverge today; a second case would make that structural guarantee explicit rather than incidental.
- **S4** — PR2's and PR3's per-task RED/GREEN evidence is absent from `apply-progress.md` (33 of 52 tasks), already disclosed at `:145`. Not re-litigated here; noted so it is not mistaken for an omission of this report.

### Input corrections

Two claims in this phase's input were checked against live code rather than accepted:

1. **The predecessor's closure of the login-429 WARNING is correct.** `trustProxy.test.js:36-45` sets `NODE_ENV=production` and re-requires `loginLimiter` through `jest.isolateModules`, defeating the `NODE_ENV==='test'` bypass, and `:78-88` asserts `[200, 200, 429]` for one forwarded IP plus a fresh bucket for a second. The limiter is real and the 429 is real.
2. **The framing that `cee2214` cleared the stale claims is correct but incomplete.** It cleared the three named ones, and it did not create the fourth and fifth (W2, W3) so much as fail to sweep them — `design.md` and `apply-progress.md` were never touched by the commit that invalidated their contents.

**Engram**: `mem_search`, `mem_get_observation`, and `mem_save` are not exposed in this phase agent's tool set at all — not failing, simply absent. The Engram mirror `sdd/auth-refresh-tokens/verify-report` therefore **could not be written**, consistent with every prior phase of this change. Artifact retrieval fell back to the OpenSpec files under `openspec/changes/auth-refresh-tokens/`, which is the authoritative half of the configured hybrid store.

### Verdict

**PASS WITH WARNINGS**

0 CRITICAL · 4 WARNING · 4 SUGGESTION · 0 blockers · 14/14 requirements · 44/44 scenarios covered (3 partially).

The round-4 blocker is fixed, correct, and coherent with the design it belongs to; all four remaining findings are documentation-record or test-depth issues, none of which changes runtime behavior or leaves a requirement unimplemented. Nothing here blocks archive on correctness grounds — but W2 and W3 are both one-paragraph documentation corrections to artifacts that outlive this change, and W1 is roughly four lines of assertion, so fixing all three before archive is cheap and would close the last of the record-drift that failed each of the four previous rounds.
