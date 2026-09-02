# Tasks: Refresh Tokens with Rotation (HIGH-1)

## Verification findings (found while reading live code for this phase)

1. **Migration filename typo in design.md's File Changes table**: `2026090100000-refresh-token-rotation.js` is 13 digits — one short of the `YYYYMMDDHHMMSS` convention every other migration follows (`20260724000000-baseline.js`, `20260828000000-orders.js`). Task 1.1 below uses the corrected 14-digit `20260901000000-refresh-token-rotation.js`.
2. **Design's D6 file-move table omits three live exports**: `readApiErrorMessage`, `APIFieldError`, `APIErrorBody` exist in today's `config.ts` and are imported by `auth.service.ts` and `product.admin.service.ts`. They're absent from the `apiBase.ts`/`credentials.ts`/`refreshSingleFlight.ts`/`authFetch.ts` move table. Task 3.5 places them in `credentials.ts` (design's catch-all for cross-domain helpers) so the facade doesn't silently drop them.
3. **Cheap check requested by the orchestrator, confirmed**: all 11 current importers use the bare `config` module specifier — `../../../config` (3 levels, not the `../../config` form stated in the prompt) in 9 production files, `./config` in `config.test.ts`. None import a subpath. The re-export facade design (D6) is safe.
4. `specs/refresh-token-rotation/spec.md`'s "Grace hit returns the stored successor" scenario (lines 57-61) is stale — superseded by proposal.md's "Corrected grace mechanic" section. Task 2.10 implements the corrected behavior (access-only cookie, no refresh `Set-Cookie`), not the spec's literal wording.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~450-600, PR2 ~400-520, PR3 ~250-350 |
| 400-line budget risk | High (all three; PR1/PR2 sit at or above budget once TDD tests + integration tier are counted) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (fixed by binding maintainer decision, not renegotiated here) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

**Risk note**: the maintainer's binding decision fixes the PR *count* at 3, stacked to main — not renegotiated here. But PR1 and PR2 each independently risk exceeding 400 lines once strict-TDD unit tests plus the mandated real-MySQL integration tests are counted. If either can't be trimmed at apply time (e.g. by moving pure-mock unit tests into a follow-up commit within the same PR), the maintainer should accept `size:exception` for that specific slice rather than adding a fourth PR, which the binding decision does not authorize.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Migration + revived RememberToken slice, rotation semantics, no endpoint | PR 1 | `pnpm --filter backend test -- RememberToken` | `pnpm --filter backend test:integration -- RememberToken` (real MySQL; proves the conditional-UPDATE race) | Revert branch; `down` drops 4 columns + restores `token_hash_2..5`; zero production callers |
| 2 | Refresh endpoint, required `typ:"access"`, cookie split, logout revocation | PR 2 | `pnpm --filter backend test -- sessionCookies RefreshSessionUseCase UserApiController cookieOptions` | `pnpm --filter backend test:integration -- refresh` (logout-revokes-family, grace-hit sets no refresh cookie) | Revert branch; incident lever is raising `ACCESS_TOKEN_TTL_SECONDS`; forced logout is one-time, not reversible, but harmless |
| 3 | Frontend retry wrapper, 9-site adoption, cross-tab race E2E | PR 3 | `pnpm --filter frontend test -- authFetch refreshSingleFlight credentials apiBase` | `pnpm test:e2e -- refresh-race` (Playwright, two-tab race + legacy-JWT redirect) | Revert branch; additive only, restores PR2's behavior exactly |

---

## PR 1 — Migration + revived RememberToken slice (no endpoint)

- [x] 1.1 RED (integration): migration test asserting `RememberToken` gains `family_id`/`superseded_at`/`successor_hash`/`revoked_at`, drops `token_hash_2..5`, and `down` restores baseline byte-for-byte, via `testDb.ts`. **Written into `migrate.integration.test.js` (not a new file — see apply-progress). NOT EXECUTED: no local MySQL reachable this session.**
- [x] 1.2 GREEN: create `backend/src/database/migrations/20260901000000-refresh-token-rotation.js` (corrected 14-digit name), raw SQL + `queryInterface.sequelize.transaction`, attributed try/catch per `20260828000000-orders.js`. **NOT EXECUTED against a real DB — see apply-progress.**
- [x] 1.3 RED: extend `checkPendingMigrations` tests — boot gate fails when any of the 4 new columns is missing. Executed: RED confirmed failing (4/4), then GREEN passing.
- [x] 1.4 GREEN: add the 4 columns to `REQUIRED_SCHEMA.RememberToken` (line 17) and `REQUIRED_COLUMN_DEFINITIONS.RememberToken` (line 42) in `backend/src/database/checkPendingMigrations.js`.
- [x] 1.5 GREEN: add the 4 fields to `backend/src/database/models/RememberToken.js`. RED/GREEN executed.
- [x] 1.6 GREEN: add `familyId`/`supersededAt`/`successorHash`/`revokedAt` to `backend/src/domain/entities/RememberToken.ts`. Also updated `database/models/db.d.ts` (`RememberTokenAttributes`) — required for compilation, missed by design.md's file list.
- [x] 1.7 GREEN: add `claimRotation`, `insertSuccessor`, `revokeFamily`, `reapFamily` signatures to `backend/src/domain/ports/RememberTokenRepositoryPort.ts` (Interfaces section of design.md).
- [x] 1.8 RED: `SequelizeRememberTokenRepository` unit tests (mocked db) for the 4 new methods, tx-aware, raw-SQL conditional UPDATE. Executed: RED (7 failing) then GREEN (14/14 passing).
- [x] 1.9 GREEN: implement the 4 methods in `SequelizeRememberTokenRepository.ts` following the `adjustStock` raw-`sequelize.query` precedent. `reapFamily` uses ORM `destroy()` with a computed cutoff instead of a literal raw DELETE — see apply-progress deviation note (Sequelize's `QueryTypes.DELETE` has an ambiguous return shape, unlike `UPDATE`).
- [x] 1.10 RED: `RotateRefreshTokenUseCase` unit tests, ports mocked. **Scope correction (see apply-progress): the "six lookup-order rows" this task cites are `RefreshSessionUseCase`'s (task 2.10, PR2), not this use case's. `RotateRefreshTokenUseCase` per design.md D1 has exactly two outcomes (won/lost the race) — tested accordingly.**
- [x] 1.11 GREEN: create `backend/src/application/use-cases/RotateRefreshTokenUseCase.ts` — claim → insert successor → reap inside `SequelizeUnitOfWork.runInTransaction`; a failed claim throws (`RefreshTokenRotationLostRaceError`) for the caller to re-read outside the aborted tx. Executed: RED (module not found) then GREEN (2/2 passing).
- [x] 1.12 RED: `RevokeRefreshTokenUseCase` unit test — revokes every row in a family. Executed: RED then GREEN (2/2 passing).
- [x] 1.13 GREEN: create `backend/src/application/use-cases/RevokeRefreshTokenUseCase.ts`.
- [x] 1.14 RED: update `CreateRememberTokenUseCase` test — new rows carry a non-null `familyId`. Executed: RED (2 failing) then GREEN.
- [x] 1.15 GREEN: modify `CreateRememberTokenUseCase.ts` to generate and persist `familyId`. **Deviation: `familyId` generation goes through a new `IdGeneratorPort`/`CryptoRandomIdGenerator` adapter, not a direct `crypto.randomUUID()` call in the use case — the architecture guard (`backend.application.contracts`) forbids the application layer importing Node built-ins directly. Not anticipated by design.md/tasks.md; found and fixed during apply. See apply-progress.**
- [x] 1.16 RED: update `VerifyRememberTokenUseCase` test — a revoked row returns `null` without being deleted (checked before the expiry branch). Executed: RED then GREEN.
- [x] 1.17 GREEN: modify `VerifyRememberTokenUseCase.ts` accordingly. `DeleteRememberTokenUseCase.ts` needs no change — verified against the spec, still correct as-is.
- [x] 1.18 Integration test (real MySQL, `*.integration.test.ts`, `pnpm test:integration`): two concurrent `claimRotation` calls against the same row → exactly one `affectedRows=1`. Written in `SequelizeRememberTokenRepository.integration.test.ts`. **NOT EXECUTED: no local MySQL reachable this session — will run for the first time in CI.**
- [x] 1.19 Integration test: `reapFamily` caps a family at ~2 rows; `family_id` populated on every row created by login or rotation. Written in the same file as 1.18. **NOT EXECUTED — same reason.**

## PR 2 — Refresh endpoint, `typ` claim, cookie split, logout revocation

- [x] 2.1 RED: characterization tests for cookie-issuing behavior (names/flags/maxAge) as it exists today in `UserApiController.ts`, to catch regressions during extraction.
- [x] 2.2 GREEN: extract `setSessionCookies`, `issueAccessCookie`, `issueRefreshCookie`, `clearSessionCookies` into `backend/src/infrastructure/controllers/sessionCookies.ts`; `UserApiController.ts` imports from it (must drop below 250 lines before 2.13 adds the refresh handler).
- [x] 2.3 RED: `cookieOptions.ts` unit tests — optional `path` (default `/`), `REFRESH_COOKIE`, `REFRESH_COOKIE_PATH`, `ACCESS_TOKEN_TTL_SECONDS` (env-tunable, default 1800), `accessCookieOptions()`/`refreshCookieOptions(maxAge?)` set/clear flag symmetry including `path`.
- [x] 2.4 GREEN: modify `backend/src/infrastructure/security/cookieOptions.ts` per D4; retire `authExpiresInSeconds`.
- [x] 2.5 RED: `apiAuthMiddleware` unit test — rejects a validly-signed, unexpired token missing `typ` or with `typ !== 'access'`.
- [x] 2.6 GREEN: modify `backend/src/infrastructure/middlewares/auth.ts` — add `typ` to `DecodedToken`, enforce it.
- [x] 2.7 GREEN: `issueAccessCookie` (`sessionCookies.ts`) sets `typ: 'access'` in the one `jwt.sign` call used by login/register/refresh.
- [x] 2.8 RED: `refreshLimiter` unit test — `REFRESH_LIMIT_WINDOW`/`REFRESH_LIMIT_MAX` env vars, same `JEST_WORKER_ID` escape hatch as `loginLimiter`.
- [x] 2.9 GREEN: create `backend/src/infrastructure/middlewares/refreshLimiter.ts`, mirroring `loginLimiter.ts`.
- [x] 2.10 RED: `RefreshSessionUseCase` branch-table unit tests — absent/revoked(before grace check)/expired/current(rotate)/in-grace(access-only, **no** refresh `Set-Cookie`)/replay-past-grace(401, no revocation). Implements proposal's corrected mechanic, not the stale `spec.md` wording (finding #4 above).
- [x] 2.11 GREEN: create `backend/src/application/use-cases/RefreshSessionUseCase.ts`.
- [x] 2.12 RED: `UserApiController.refresh` test — 200 with expired access + valid refresh; 401 on absent/expired/revoked; refresh cookie set only on rotation, never on a grace hit.
- [x] 2.13 GREEN: add `refresh` handler to `UserApiController.ts`.
- [x] 2.14 RED: `UserApiController.logout` test — revokes the refresh family, clears all 4 cookies, still 204 with no active session.
- [x] 2.15 GREEN: modify `logout` to call `RevokeRefreshTokenUseCase` and clear the refresh cookie via `sessionCookies.ts`.
- [x] 2.16 GREEN: modify `login`/`register` to call `CreateRememberTokenUseCase` and issue the refresh cookie (2h default / 30d on `remember`), access cookie fixed at 30 min regardless.
- [x] 2.17 RED: `csrf.ts` unit test — `/users/refresh` present in `EXEMPT_PATHS`.
- [x] 2.18 GREEN: add `/users/refresh` to `EXEMPT_PATHS` in `backend/src/infrastructure/middlewares/csrf.ts` (defensive; the route never mounts `csrfGuard`).
- [x] 2.19 GREEN: wire `router.post('/users/refresh', refreshLimiter, controller.refresh)` in `backend/src/infrastructure/routes/api/users.ts`, no `apiAuthMiddleware`; add OpenAPI JSDoc; compose the new use cases/repository here.
- [x] 2.20 GREEN: add `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_LIMIT_WINDOW`, `REFRESH_LIMIT_MAX` to `.env.example`.
- [x] 2.21 Integration test (real MySQL): logout revokes the family and a subsequent refresh with any of its tokens is 401; a grace hit issues no `m3d_refresh` header.

## PR 3 — Frontend retry wrapper, call-site adoption, cross-tab E2E

- [x] 3.1 Re-run the config.ts importer grep immediately before starting (finding #3) to catch any deep import introduced by PR1/PR2.
- [x] 3.2 RED+GREEN: `frontend/src/lib/http/apiBase.ts` — move `API_URL` verbatim; characterization test.
- [x] 3.3 RED+GREEN: `frontend/src/lib/http/credentials.ts` — move `readCookie`, `readCsrfToken`, `withCredentials`, `getSessionUser`, `SessionUser`, **plus** `readApiErrorMessage`, `APIFieldError`, `APIErrorBody` (finding #2) verbatim; characterization tests for all.
- [x] 3.4 RED: `refreshSingleFlight` test — N concurrent callers collapse into 1 POST to `/api/users/refresh`; `inFlight` cleared in `finally`.
- [x] 3.5 GREEN: create `frontend/src/lib/http/refreshSingleFlight.ts`.
- [x] 3.6 RED: `authFetch` test — retries exactly once on 401 after a successful refresh (re-running `withCredentials`); on failed refresh clears session + redirects `/login`; never retries twice; never wraps the refresh call itself.
- [x] 3.7 GREEN: create `frontend/src/lib/http/authFetch.ts`.
- [x] 3.8 GREEN: rewrite `frontend/src/config.ts` as a pure re-export facade (~30 lines); confirm `config.test.ts` still passes unchanged.
- [x] 3.9 GREEN: adopt `authFetch` at the 9 credentialed call sites — `order.service.ts` (2), `product.admin.service.ts` `create`/`update`/`remove`/`adjustStock` (4), `cartSync.ts` (1), `checkout.ts` (1), `cartHydration.ts` (1). Existing tests must keep passing; add a 401-retry assertion per site.
- [x] 3.10 Leave untouched, and note why inline where practical — the 10 excluded sites: `product.service.ts` ×2 and `product.search.service.ts` ×3 and `product.admin.service.ts` `list`/`getById` (7 public, no-credential reads — cannot 401); `auth.service.ts` login/register and `session.service.ts` logout (3 auth endpoints — retrying on 401 would loop).
- [x] 3.11 RED: `e2e/tests/refresh-race.spec.ts` — two tabs/one context, simultaneous expiry, both stay logged in; a legacy `typ`-less JWT → 401 → refresh attempt → clean redirect to `/login`.
- [x] 3.12 GREEN: confirm the scenario passes via `pnpm test:e2e` (app code already lands in 3.2-3.9; no further production change expected here).

## Review-budget exception — recorded, not implicit

**Decided by the maintainer, 2026-09-01.** The forecast puts PR1 at ~450-600 changed lines and PR2 at ~400-520, against a 400-line review budget. The maintainer was shown the conflict between the three-PR split and that budget, and chose to **keep three PRs and accept `size:exception` on PR1 and PR2**.

- `delivery_strategy`: `exception-ok` for this change
- `chain_strategy`: `stacked-to-main`, unchanged
- PR3 (~250-350) stays within budget and needs no exception.
- Rejected alternative: splitting into five PRs. Rejected alternative: trimming scope — the natural candidate was PR1's real-MySQL concurrency test (task 1.18), which is the only proof of the design's riskiest assumption, so cutting it was declined.

`sdd-apply` must carry `size:exception` for PR1 and PR2 and must NOT stop to re-ask. It must still report actual changed-line counts per slice so the estimate can be checked against reality.

**Reviewer note to carry into the PR bodies**: PR1 and PR2 are deliberately over the normal budget. PR1 concentrates the schema migration, the boot-gate update and the rotation-atomicity logic — including task 1.18, the real-MySQL concurrency test that is the load-bearing proof for the InnoDB semi-consistent-read assumption the whole rotation design rests on. That test is the first thing to read in PR1.
