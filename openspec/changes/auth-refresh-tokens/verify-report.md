```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d6017916d4e3f71b83edb2002123a50f3a4139eae1f240abfd45ae8eecd4e6b2
verdict: fail
blockers: 1
critical_findings: 1
requirements: 12/14
scenarios: 40/42
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:281dcc358ae6f26e0e109abb8d2d010a42f5b2088004d4b032a4f3ea337f1d7c
build_command: pnpm type-check
build_exit_code: 0
build_output_hash: sha256:142ca3df7a3750a463c37089b26580332e55f5eb2457dcf45594c700bb207c80
```

## Verification Report

**Change**: auth-refresh-tokens
**Version**: N/A (OpenSpec change, pre-archive)
**Mode**: Strict TDD
**Verified against**: working tree on `feat/auth-refresh-tokens-03-frontend` (PR1 + PR2 merged to `main`, PR3 branch-only)

**Read the verdict precisely.** No test fails, no task is incomplete, and every one
of the 14 requirements is implemented in live code. The single blocker is one spec
scenario whose only "coverage" asserts configuration instead of the behaviour the
scenario requires, on the new unauthenticated endpoint. Nothing else about this
change is broken.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 52 |
| Tasks complete | 52 |
| Tasks incomplete | 0 |

All 52 boxes were re-checked against live code rather than trusted. Every task's
claimed artifact exists and matches its description, with the exceptions recorded
under WARNING (task 2.21 partially delivered; task 1.9 and apply-progress
deviation #4 describe an implementation that has since been superseded).

### Build & Tests Execution

**Build**: PASSED

```text
pnpm type-check  ->  pnpm --filter backend type-check  ->  tsc --noEmit
EXIT=0
```

**Tests**: PASSED — 1245 passed, 0 failed, 0 skipped

```text
pnpm test  (pnpm --filter "!e2e" test)
  backend  jest    Test Suites: 122 passed, 122 total
                   Tests:      1003 passed, 1003 total
  frontend vitest  Test Files:   20 passed (20)
                   Tests:       242 passed (242)
EXIT=0
```

Additional gates re-run in this phase, all clean:

```text
pnpm lint                                EXIT=0
pnpm --filter backend architecture:check EXIT=0
```

**Integration tier (real MySQL) and E2E tier (Playwright) were NOT run locally.**
Host port 3306 is held by the maintainer's MariaDB, so `pnpm test:integration` and
`pnpm test:e2e` cannot execute in this environment. Both tiers are relied upon from
PR #116 CI, reported green (e2e: 52 passing). Every compliance verdict below that
rests solely on those tiers is marked `(CI)` so the provenance is never ambiguous.

**Coverage**: not measured in this phase — no coverage run was executed against the
changed file set. Informational only; not a failure.

### Spec Compliance Matrix

42 scenarios across 14 requirements in 5 spec files.

#### refresh-token-rotation (5 requirements, 12 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Refresh Endpoint | Refresh succeeds with an expired access token | `UserApiController.test.ts > refresh > 200s with a fresh access cookie when the refresh use case reports a rotation`; route carries no `apiAuthMiddleware` (`routes/api/users.ts:200`); `e2e/refresh-race.spec.ts > two tabs...` exercises exactly the expired-access + live-refresh state (CI) | COMPLIANT |
| Refresh Endpoint | Refresh rejected without a valid refresh cookie | `UserApiController.test.ts > refresh > 401s when the refresh cookie is absent` + `401s when the use case rejects (expired/revoked/replayed)`; `RefreshSessionUseCase.test.ts` rows 1/2/3/6 | COMPLIANT |
| Refresh Endpoint | Cross-site refresh request is rejected | The scenario's GIVEN stipulates the browser withholds the cookie, so the server obligation is exactly "no refresh cookie -> 401", which is tested; the `sameSite: 'lax'` attribute that produces the GIVEN is asserted in `cookieOptions.test.ts:136` | COMPLIANT |
| Refresh Endpoint | Refresh rate limit -> 429 | `refreshLimiter.test.ts` mocks `express-rate-limit` entirely and asserts the *config object* (`statusCode: 429`, `max`, `windowMs`) plus that `next()` runs. No test anywhere sends enough requests to `POST /api/users/refresh` to observe a 429 | **UNTESTED** |
| Remember Distinction | Remembered session issues a 30-day refresh token | `UserApiController.test.ts:228` (refresh cookie `maxAge === REMEMBER_MAX_AGE`); `cookieOptions.test.ts > authMaxAge returns REMEMBER_MAX_AGE`; `establishSession` passes `durationSeconds: authMaxAge(remember)/1000` | COMPLIANT |
| Remember Distinction | Default session issues a 2-hour refresh token | `UserApiController.test.ts:285`; `cookieOptions.test.ts > SESSION_MAX_AGE is exactly 2 hours` + the omitted/false `authMaxAge` cases | COMPLIANT |
| Rotation + Grace | Successful refresh rotates the token | `RotateRefreshTokenUseCase.test.ts` (claim -> insert -> reap); `RefreshSessionUseCase.test.ts` row 4; `SequelizeRememberTokenRepository.integration.test.ts > lets exactly one of two concurrent claims against the same current row succeed` (CI) | COMPLIANT |
| Rotation + Grace | Grace hit issues an access cookie only, without re-rotating | `RefreshSessionUseCase.test.ts` row 5; `UserApiController.test.ts > refresh > 200s with a fresh access cookie but NO refresh cookie on a grace hit` — asserts the `m3d_refresh` `res.cookie` call is `undefined` | COMPLIANT |
| Rotation + Grace | Replay past the grace window fails | `RefreshSessionUseCase.test.ts` row 6 (superseded 45s ago -> rejected, `revokeFamily` not called) | COMPLIANT |
| Rotation + Grace | Family id is populated on every row | `SequelizeRememberTokenRepository.integration.test.ts > populates family_id on every row created by login (create) and by rotation (insertSuccessor)` (CI); `RememberTokenUseCases.test.ts:90` | COMPLIANT |
| Concurrent Refresh | Two tabs refresh concurrently and both stay logged in | `e2e/refresh-race.spec.ts > two tabs refreshing concurrently ... both stay logged in` — real browser, one shared context, real backend and DB (CI) | COMPLIANT |
| Retention | Old superseded rows are reaped on refresh | `SequelizeRememberTokenRepository.integration.test.ts > actually deletes a past-grace superseded row and reports how many it removed` + `does not delete a row still inside its grace window` (CI) | COMPLIANT |

#### api-jwt-auth (4 requirements, 16 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Login Endpoint | Successful login sets an auth cookie | `UserApiController.test.ts:210` — 4 `res.cookie` calls, no raw token in the body | COMPLIANT |
| Login Endpoint | API login with invalid credentials | `UserApiController.test.ts:300` (401, no cookies set) | COMPLIANT |
| Login Endpoint | API login exceeds rate limit | `loginLimiter.test.ts` uses the same fully-mocked `express-rate-limit` pattern; no real 429 is observed for the login route. Pre-existing convention, unchanged by this change | PARTIAL |
| Login Endpoint | Access token TTL is fixed regardless of remember | `UserApiController.test.ts:263` (`issues an access cookie fixed at ACCESS_TOKEN_TTL_SECONDS and a matching-exp JWT, remember true or false`) | COMPLIANT |
| Cookie Authorization | Request to protected API without cookie | `auth.test.ts:28` | COMPLIANT |
| Cookie Authorization | Request with invalid or expired cookie | `auth.test.ts:42` | COMPLIANT |
| Cookie Authorization | Request with valid cookie | `auth.test.ts:49` — asserts `typ: "access"` accepted and `req.user` attached | COMPLIANT |
| Cookie Authorization | Bearer header alone is rejected | `auth.test.ts:83` | COMPLIANT |
| Cookie Authorization | Admin-only API view with non-admin cookie | `auth.test.ts:117 / :164 / :172` (`requireRoles`, `adminGuard`, STAFF case) | COMPLIANT |
| Cookie Authorization | Pre-deploy JWT without typ claim is rejected | `auth.test.ts:63`; `e2e/refresh-race.spec.ts > a legacy typ-less JWT is rejected ... lands cleanly on /login` (CI) | COMPLIANT |
| Logout Endpoint | Logout clears the session cookies | `UserApiController.test.ts:348` — all 4 cleared, exactly 4 calls, flag parity with login asserted | COMPLIANT |
| Logout Endpoint | Logout revokes the refresh family | `UserApiController.test.ts:370` (`revokeFamily` called with `fam-42`); `SequelizeRememberTokenRepository.integration.test.ts > revokeFamily marks every unrevoked row in the family, and only that family` (CI). The "subsequent refresh is 401" half is proven by `RefreshSessionUseCase.test.ts` row 2 composed with the controller's 401 path, and at DB level by `claimRotation refuses a revoked row` — see WARNING 3 on the tier task 2.21 claimed | COMPLIANT |
| Logout Endpoint | Prior access token cannot be renewed after logout | `RefreshSessionUseCase.test.ts` row 2 (revoked checked before grace) + `UserApiController.test.ts > 401s when the use case rejects` | COMPLIANT |
| Logout Endpoint | Logout without an active session | `UserApiController.test.ts:381` (204, no revoke, no error) and `:391` (invalid/expired cookie) | COMPLIANT |
| Remember-Me Session | Remember-me extends the refresh token, not the access token | `UserApiController.test.ts:228 / :263 / :285` | COMPLIANT |
| Remember-Me Session | Remember-me not requested keeps default refresh lifetime | `UserApiController.test.ts:285`; `cookieOptions.test.ts > authMaxAge` omitted case | COMPLIANT |

#### remember-token-store (2 requirements, 8 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Model Schema | User association is configured | `RememberTokenModel.test.js`; `models/__tests__/index.test.js` | COMPLIANT |
| Model Schema | New rows carry rotation metadata | `SequelizeRememberTokenRepository.integration.test.ts:156` (CI) — `insertSuccessor` writes only `familyId`, leaving the other three NULL | COMPLIANT |
| Model Schema | Legacy duplicate indexes removed | `migrate.integration.test.js:82` (CI) — the 4 columns exist and `token_hash_2..5` are gone | COMPLIANT |
| Model Schema | Migration down restores the baseline schema exactly | `migrate.integration.test.js:132` (CI) — three `down`s revert all migrations and restore the pre-migration shape | COMPLIANT |
| Service Token Mgmt | Creating a token hashes and stores it | `RememberTokenUseCases.test.ts:40` + `:90` (familyId from the injected `IdGeneratorPort`) | COMPLIANT |
| Service Token Mgmt | Verifying returns the user or cleans up expired | `RememberTokenUseCases.test.ts:118 / :130 / :146 / :173` | COMPLIANT |
| Service Token Mgmt | Verifying a revoked token fails without deleting it | `RememberTokenUseCases.test.ts:191` — asserts the revoked branch precedes the expiry branch and no delete occurs | COMPLIANT |
| Service Token Mgmt | Deleting removes the record | `RememberTokenUseCases.test.ts:208` | COMPLIANT |

#### csrf-protection (1 requirement, 2 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Refresh CSRF Exemption | Refresh request without a CSRF token succeeds | `csrf.test.ts:109` (`calls next() for POST /users/refresh without requiring a token`) | COMPLIANT |
| Refresh CSRF Exemption | Refresh route bypasses the guard entirely | Verified in live wiring: `router.post('/users/refresh', refreshLimiter, controller.refresh)` — `csrfGuard` is absent from the chain; the `EXEMPT_PATHS` entry is documented defence in depth | COMPLIANT |

#### session-cookie-security (2 requirements, 4 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Per-Cookie Lifetime Split | Auth cookie expires with the access token | `cookieOptions.test.ts:60` (`maxAge === ACCESS_TOKEN_TTL_SECONDS * 1000`); `UserApiController.test.ts:317` | COMPLIANT |
| Per-Cookie Lifetime Split | CSRF and display cookies expire with the refresh token | `UserApiController.test.ts:285` (30d when remember, 2h when omitted) + `:317` (CSRF/USER share one maxAge, AUTH has its own) | COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie is scoped to the refresh route | `cookieOptions.test.ts:24` + `:69` (`path === '/api/users/refresh'`) | COMPLIANT |
| Refresh Cookie Path Scoping | Refresh cookie is not sent to other endpoints | The THEN is a browser guarantee driven by the `Path` attribute; our obligation is to set it, which is asserted. See WARNING 7 — the e2e tier could carry the negative assertion cheaply | COMPLIANT |

**Compliance summary**: 40/42 scenarios complete — 39 COMPLIANT, 1 PARTIAL, 1 UNTESTED,
0 FAILING. Fully-covered requirements: 12/14 (Refresh Endpoint and Login Endpoint each
carry one uncovered rate-limit scenario).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Refresh Endpoint | Implemented | `users.ts:200` — `refreshLimiter` only, no `apiAuthMiddleware`, no `csrfGuard`. `UserApiController.refresh` reads `m3d_refresh` and 401s when absent |
| Remember Distinction | Implemented | `establishSession` -> `durationSeconds: authMaxAge(remember)/1000`; access cookie fixed via `accessCookieOptions()` |
| Rotation + Grace | Implemented | `RefreshSessionUseCase` implements all six D2 rows in the documented order (revoked before expiry before superseded). Grace returns `outcome: 'grace'` carrying no token; the controller writes the refresh cookie only when `outcome === 'rotated'` |
| Concurrent Refresh | Implemented | `claimRotation` conditional UPDATE; the loser throws `RefreshTokenRotationLostRaceError` and re-reads outside the aborted transaction |
| Retention | Implemented | `reapFamily` deletes `supersededAt <= NOW() - INTERVAL n SECOND`, family-scoped, inside the rotation transaction |
| Login / Access TTL | Implemented | `ACCESS_TOKEN_TTL_SECONDS = Number(env) \|\| 1800` — 30 minutes, per the maintainer's amendment from the proposed 15 |
| typ claim | Implemented | Set in exactly one place (`issueAccessCookie`), required in exactly one place (`apiAuthMiddleware`, `decoded.typ !== 'access'` -> 401) |
| Logout revocation | Implemented, with a gap | Revokes via the verified JWT's `familyId` claim. See WARNING 1 — revocation silently does not happen once the access token has expired |
| Model schema / migration | Implemented | `20260901000000-refresh-token-rotation.js`: 4 columns + `family_id` index up; exact reverse order down, restoring `token_hash_2..5` |
| CSRF exemption | Implemented | Not mounted on the route (the real mechanism); the `EXEMPT_PATHS` entry is defensive |
| Cookie split / path scoping | Implemented | One named builder per cookie kind, so set and clear can never drift apart |
| Frontend wrapper + adoption | Implemented | Exactly 9 `authFetch` sites across 5 files; exactly the 10 documented exclusions remain on bare `fetch` (7 public reads + 3 auth endpoints) |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 conditional-UPDATE claim in one transaction | Yes | Steps 1-3 in `RotateRefreshTokenUseCase.execute` inside `uow.runInTransaction` |
| D1 successor inherits `expiry_date`, never slid | Yes | `new RememberToken(0, successorHash, current.idUser, current.expiryDate, ...)` |
| D2 grace = 30s, non-rotating, no refresh cookie | Yes | `REFRESH_TOKEN_GRACE_SECONDS = 30`; the controller writes the cookie only on `'rotated'` |
| D2 logout beats grace | Yes | `revokedAt` checked before expiry and before the superseded branch |
| D3 `typ` set once / required once | Yes | Verified by inspection; no other `jwt.sign` exists in the auth path |
| D4 one named builder per cookie kind | Yes | `accessCookieOptions()` / `refreshCookieOptions(maxAge?)`, both reused for clears |
| D5 middleware chain | Yes | `refreshLimiter` only |
| D6 cycle-free `lib/http` facade | Yes | `config.ts` is 18 lines of pure re-export; `authFetch` deliberately avoids `session.service.ts` to prevent the cycle D6 exists to remove |
| D7 reap inside the rotation transaction | Yes | Step 3, family-scoped, `tx`-aware |
| D8 PR slicing | Yes | 3 slices stacked to main; `size:exception` recorded for PR1 and PR2 |
| D1 reap via literal raw `DELETE ... INTERVAL` | **Deviated (accepted, and now doubly so)** | Uses Sequelize `destroy()` with a DB-side `NOW() - INTERVAL` literal and `Op.lte`. Both departures are load-bearing fixes for real bugs CI caught (two-clock comparison; second-precision `datetime`). Breaks no spec |
| `IdGeneratorPort` / `CryptoRandomIdGenerator` | **Addition (accepted)** | Absent from the design's file table; required by `backend.application.contracts`. Confirmed clean by `architecture:check` |
| `familyId` claim carried in the access JWT | **Addition (undocumented in design.md)** | The mechanism logout uses to locate the family, since the refresh cookie is path-scoped away from `/users/logout`. Sound — the claim is read only after `jwt.verify` — but it is the direct cause of WARNING 1, and design.md never records it |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | PARTIAL | `apply-progress.md` covers PR1 only — 9 evidence rows for tasks 1.1-1.19. PR2 (21 tasks) and PR3 (12 tasks) have no evidence table at all |
| All tasks have tests | YES | 52/52. Every PR2 and PR3 task's test artifact was located and confirmed by direct inspection |
| RED confirmed (tests exist) | PARTIAL | 19/52 have a recorded RED transition. For the other 33 the RED step is unverifiable after the fact — the apply agents were killed by provider rate limits before writing evidence |
| GREEN confirmed (tests pass) | YES | 52/52 — independently re-executed in this phase: 1003 backend + 242 frontend, exit 0 |
| Triangulation adequate | YES | `RefreshSessionUseCase` covers all six D2 rows plus the lost-race path; `cookieOptions` covers set/clear symmetry both ways; `reapFamily` has both the deletes and the does-not-delete cases |
| Safety Net for modified files | PARTIAL | Recorded for PR1's modified files only; same PR2/PR3 evidence gap |

**TDD Compliance**: 3/6 checks fully passed, 3 partial — every partial traces to the
same single cause (no PR2/PR3 apply-progress), not to missing or failing tests.
Outcome-level TDD (tests exist, tests pass, behaviours triangulated) is independently
verified for all 52 tasks.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 1245 executed (whole suite; ~110 attributable to this change) | 142 suites (122 backend, 20 frontend) | jest, vitest |
| Integration (real MySQL) | 16 cases in the 2 files this change touches (8 rotation + 8 migrate) | 2 | jest + `testDb.ts` — CI only, not runnable locally |
| E2E | 2 tests in `refresh-race.spec.ts` (52 passing across the whole e2e suite) | 1 | Playwright — CI only, not runnable locally |
| **Total** | **1245 unit executed here + 16 integration + 2 E2E (CI)** | **145** | |

Every requirement whose correctness depends on real database semantics — rotation
atomicity, reaping, family revocation, migration up and down — has real-MySQL
coverage, and the cross-tab requirement has real-browser coverage. That is the right
shape, and it is what caught all three defects this cycle. The one blocker below is
precisely where that shape was not applied.

### Changed File Coverage

Coverage analysis not performed in this phase — no coverage run was executed against
the changed file set. Informational only; not a failure.

### Assertion Quality

Audited every test file created or modified by this change: the backend rotation,
session, cookie and middleware suites, both integration files, the four
`frontend/src/lib/http` suites, and the e2e spec.

- Tautologies (`expect(true).toBe(true)` and equivalents): none found.
- Assertions that never call production code: none found.
- Ghost loops over possibly-empty collections: none found.
- Smoke-test-only cases: none. The e2e tests assert URL, a hidden error element, and
  a 200-status response wait — behaviour, not mere rendering.
- `toBeDefined()` appears 4 times in `UserApiController.test.ts`, each paired with a
  value assertion in the same test (e.g. `toMatchObject({ httpOnly: true, maxAge: REMEMBER_MAX_AGE })`),
  so none stands alone as a type-only assertion.
- Negative assertions are used correctly and meaningfully. The grace-hit test's
  `expect(refreshCookieCall).toBeUndefined()` asserts the exact correctness property
  the spec singles out, and has a companion positive case in the rotation test
  directly above it.

**Assertion quality**: all assertions verify real behaviour. 0 CRITICAL, 0 WARNING.

The one assertion-strength failure in this change is not a trivial-assertion pattern
but a wrong-layer one, recorded as the CRITICAL below: `refreshLimiter.test.ts`
asserts the configuration handed to a mocked library rather than the response the
scenario requires.

### Quality Metrics

**Linter**: clean — `pnpm lint` exit 0
**Type Checker**: clean — `pnpm type-check` (`tsc --noEmit`) exit 0
**Architecture guard**: clean — `pnpm --filter backend architecture:check` exit 0
**250-line file cap**: respected. The largest changed file, `UserApiController.ts`,
sits at exactly 250 — at the cap with zero headroom (SUGGESTION 3).

### Issues Found

**CRITICAL**:

1. **The refresh rate limit has no covering test — the scenario's normative claim is
   unproven on the one endpoint that most needs it.**
   `specs/refresh-token-rotation/spec.md` requires: "GIVEN a client exceeds the
   configured refresh rate limit, WHEN it sends further `POST /api/users/refresh`
   requests, THEN the response MUST be 429 Too Many Requests."
   `refreshLimiter.test.ts` mocks `express-rate-limit` in its entirety
   (`jest.mock('express-rate-limit', ...)` returning a pass-through), then asserts the
   *options object* the module handed to that mock — `windowMs`, `max`,
   `standardHeaders`, `legacyHeaders`, `statusCode: 429` — and that `next()` was
   called. It never sends a request that exceeds the limit, and never observes a
   429. The assertion is strictly weaker than the requirement: it proves the limiter
   was configured, not that the endpoint throttles.
   This matters more than the usual mock-coverage complaint. `POST /api/users/refresh`
   is deliberately unauthenticated (no `apiAuthMiddleware`) and deliberately CSRF-exempt,
   and design.md D5 names `refreshLimiter` as the *only* control standing between a
   leaked or replayed refresh token and brute-force probing. The proposal lists
   rate-limiting as CSRF defence #4. The whole exemption argument rests on a control
   whose behaviour no test observes.
   The fix is cheap and the pattern already exists in this repository:
   `backend/src/__tests__/apiSecurity.test.js:220` (`returns 429 when request limit is
   exceeded`) drives the real limiter through supertest with `NODE_ENV=production` and
   asserts `res4.status === 429` plus the message body. That pattern was applied to
   `/api/users/register` and not to the new refresh route.

**WARNING**:

1. **Logout does not revoke the family once the access token has expired — an
   undocumented residual far larger than the one the proposal does document.**
   `UserApiController.logout` obtains `familyId` from `jwt.verify(accessToken)`.
   `jwt.verify` throws on an expired token, `tryReadFamilyId` returns `undefined`, and
   revocation is skipped — cookies are cleared and 204 returned. The behaviour is
   deliberate and tested (`UserApiController.test.ts:391`), and the refresh cookie
   cannot substitute because it is path-scoped away from `/users/logout`.
   Consequence: a user who logs out at any point after their 30-minute access token
   expires clears their own browser but leaves the refresh-token family **live in the
   database for up to 30 days**. For an already-stolen refresh token that is exactly
   the failure HIGH-1 exists to close, and logout silently does not close it.
   `proposal.md`'s "Residual exposure after logout" documents only the <=30-minute
   stateless-access-token residue and never mentions this one, which is three orders
   of magnitude longer.
   Every spec scenario still passes on its literal wording ("GIVEN an *authenticated*
   client"), which is why this is not the blocker — but the requirement prose promises
   logout ends the session "server-side, not only client-side", and in this state it
   does not.
   Likely minimal fix, deliberately NOT applied (this phase is verification only):
   `jwt.verify(token, getJwtSecret(), { ignoreExpiration: true })` in `tryReadFamilyId`.
   The signature is still verified so the claim still cannot be forged; only the `exp`
   check is relaxed, and revocation is precisely the operation that should outlive
   expiry. This needs a maintainer decision, not an autonomous fix.

2. **A spec file still carries the impossible grace wording — the five specs now
   contradict one another.** `specs/remember-token-store/spec.md:8` describes
   `successorHash` as "(nullable — set on rotation, **returned on a grace-window
   hit**)". `specs/refresh-token-rotation/spec.md:51` states the opposite and explains
   why: "`successor_hash` is a SHA-256 digest and the plaintext token is never stored,
   so a grace hit **cannot** return the successor token — it must not try." The
   rotation spec was corrected during the cycle; this delta was not. The implementation
   follows the correct one.
   Because `sdd-archive` publishes these deltas into the live capability specs,
   archiving as-is would enshrine an unimplementable requirement in
   `openspec/specs/remember-token-store/spec.md`. One-line fix in a spec file —
   deliberately not made here, since this phase may not edit specs.

3. **Task 2.21 is marked complete but only half-delivered.** It claims an integration
   test proving "logout revokes the family and a subsequent refresh with any of its
   tokens is 401; a grace hit issues no `m3d_refresh` header". The DB half exists
   (`revokeFamily marks every unrevoked row...`, `claimRotation refuses a revoked row`).
   The HTTP half does not exist anywhere — there is no HTTP-level refresh integration
   test in the repository (`users/refresh` appears in no `backend/src/**/*integration*`
   file). Both behaviours are covered by unit tests instead, so nothing is untested;
   the task text overstates the tier at which it was proven.

4. **`apply-progress.md` and `tasks.md` describe a superseded `reapFamily`.**
   apply-progress deviation #4 and task 1.9 both say `reapFamily` uses "a computed
   cutoff `Date`" / "ORM `destroy()` with a computed cutoff". The live code
   (`SequelizeRememberTokenRepository.ts:126-137`) uses a **database-side**
   `literal('NOW() - INTERVAL n SECOND')` with `Op.lte`. The record was never updated
   after CI caught the two-clock bug (Node clock versus MySQL clock with no `timezone`
   configured — the reaper deleted zero rows) and the second-precision bug (`<` compares
   a `datetime` against itself within the same second). The code is right and its inline
   comment documents both fixes well; the change artifacts are stale. This matters
   because a reader trusting apply-progress would conclude a fixed bug is still live.

5. **PR2 and PR3 have no TDD evidence at all.** `apply-progress.md` is explicitly
   "Batch 1 of N", covering only tasks 1.1-1.19, because the PR2 and PR3 apply agents
   were killed by provider rate limits. 33 of 52 tasks therefore have no recorded RED
   transition and no Safety Net. Under Strict TDD this is a real process-evidence gap.
   Mitigating: outcomes were verified independently in this phase — every claimed test
   file exists, the full suite passes, and the tests are high quality. What can no
   longer be established is that RED genuinely preceded GREEN for those 33 tasks.

6. **The login rate limit shares the CRITICAL's defect.** `loginLimiter.test.ts` uses
   the identical fully-mocked pattern, so `api-jwt-auth`'s "API login exceeds rate
   limit -> 429" scenario is also proven only by configuration. It is scored WARNING
   rather than CRITICAL because it is a pre-existing convention that this change did
   not author or modify, and because the login route sits behind no CSRF exemption.
   Worth fixing with the same supertest pattern while it is fresh.

7. **Cookie-scoping rejection is asserted as an attribute, not observed as behaviour.**
   "Refresh cookie is not sent to other endpoints" and the browser half of the
   cross-site argument both reduce to `sameSite: 'lax'` and `path: '/api/users/refresh'`
   being present on the issued cookie. Those are the right attributes, correctly
   asserted, and the scenarios' GIVENs stipulate the browser behaviour — which is why
   both are scored COMPLIANT. But the e2e suite already drives a real browser holding a
   real refresh cookie and could carry the negative assertion (request another endpoint,
   assert `m3d_refresh` absent) for a few lines.

**SUGGESTION**:

1. `tasks.md`'s "Verification findings" #4 is now itself stale: it says the rotation
   spec's grace scenario is stale and that task 2.10 implements something the spec does
   not say. The spec has since been corrected, so the note describes a conflict that no
   longer exists and points at the wrong file — the stale wording moved to
   `remember-token-store` (WARNING 2).
2. `proposal.md:28` and `:78` still describe the successor as "returned on a grace hit".
   Superseded by the proposal's own "Corrected grace mechanic" section, so harmless
   under the document's stated precedence, but the migration table and the risk table
   both read as current fact and would benefit from an inline pointer.
3. `UserApiController.ts` sits at exactly 250 lines — precisely the project cap. The
   next line added to it breaks the gate. The `sessionCookies.ts` extraction bought
   exactly the room PR2 needed and no more; the deferred reuse-revocation follow-up
   will need another extraction first.
4. The `familyId` access-JWT claim is a genuine architectural decision made during
   apply — it is what makes logout revocation possible at all given path scoping — but
   it survives only in a code comment. It belongs in `design.md`, especially since it
   is the mechanism WARNING 1 turns on.

### Verdict

**FAIL** — one spec scenario has no covering test, so the evidence is incomplete.

This is a narrow, precise failure and should not be read as a broad one. All 14
requirements are implemented in live code, 40 of 42 scenarios are fully covered, all
52 tasks are genuinely complete, and every executed gate is green: 1245 unit tests,
lint, type-check and the architecture guard, plus real-MySQL integration and Playwright
e2e green in CI. The three accepted deviations were verified as actually shipped — the
grace hit issues an access cookie and no refresh cookie, logout revokes the family
rather than the access token, and the access TTL is 30 minutes. Both real-MySQL
`reapFamily` bugs and the guest-401 browser regression are fixed in the live code, and
the test suite that caught them is well built.

What blocks the pass is that the rate limiter guarding the new unauthenticated,
CSRF-exempt refresh endpoint is proven only by inspecting its own configuration. Given
that this change's other three defects were all invisible to mocks and surfaced only
against real MySQL and a real browser, accepting a mock-configured security control as
proof would repeat precisely the mistake this cycle already paid for three times. The
remedy is one supertest test copied from a pattern that already exists in this
repository.

Two further items should be settled before archive regardless of the blocker: the spec
contradiction in `remember-token-store` (WARNING 2), which archive would publish as a
live capability spec, and a maintainer decision on the expired-access-token logout gap
(WARNING 1), which is a real and undocumented security residual rather than a
documentation defect.
