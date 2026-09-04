# Tasks: Refresh Token Reuse Detection

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300-350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

**Apply-time actual (post-implementation)**: ~497 changed lines (419 insertions + 74
deletions across 9 tracked files, + 4 for the new `refreshTokenRetention.ts`), above
both the ~300–350 forecast and the 400-line budget. The overage is concentrated in two
files the forecast underestimated: `SequelizeRememberTokenRepository.integration.test.ts`
(+203, driven by 5 mandated real-DB scenarios, one of them — storage bound — an
orchestrator-directed addition tasks.md itself omitted) and
`RefreshSessionUseCase.test.ts` (+68, driven by strict-TDD's mandatory negative
assertions on rows 1/2/3 + the `!familyId` guard, plus the log-shape and
revocation-failure tests design.md's own Testing Strategy table requires). Every added
line maps to an explicit design.md/tasks.md requirement or an orchestrator-directed
deviation; one redundant test was already removed as a de-duplication pass. No further
honest reduction is available without cutting required coverage, comments, or tests —
recommend `size:exception` for this single PR. See apply-progress for the full
per-file breakdown.

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Extract session helpers to `sessionCookies.ts` | commit 1 | `pnpm test -- UserApiController` | N/A (pure move) | revert commit 1 |
| 2 | Decouple retention from grace (D1) | commit 2 | `pnpm test -- RotateRefreshTokenUseCase` | `pnpm test:integration -- RememberTokenRepository` | revert commit 2 |
| 3 | Reuse detection (D2/D3/D6) | commit 3 | `pnpm test -- RefreshSessionUseCase UserApiController` | same integration file | revert commit 3 |
| 4 | Integration coverage (D5/D7) | commit 4 | N/A (test-only) | `pnpm test:integration -- RememberTokenRepository` | revert commit 4 |

## Phase 1: Extraction (commit 1, land first)

- [x] 1.1 Move `UserAuthDto` (`UserApiController.ts:22-30`) + `establishSession` (`:43-75`) verbatim into `sessionCookies.ts`, exported; `establishSession` takes `CreateRememberTokenUseCase` as 2nd arg.
- [x] 1.2 `UserApiController.ts`: import both from `sessionCookies.ts`; update `login`/`register` call sites to `establishSession(res, this.createRememberTokenUseCase, userDto, remember)`; delete the moved code.
- [x] 1.3 Verify: `UserApiController.test.ts` login/register/logout suites pass unchanged (proves the move is behavior-preserving, design D4). Confirmed: 21/21 pass unchanged.

## Phase 2: Decouple retention from grace (D1)

- [x] 2.1 RED: `RotateRefreshTokenUseCase.test.ts` — add 4th ctor arg `reapSeconds`; assert `reapFamily` called with it, not `30`. Confirmed RED before GREEN (see apply-progress).
- [x] 2.2 GREEN: create `backend/src/infrastructure/security/refreshTokenRetention.ts` — `REFRESH_TOKEN_REAP_SECONDS`, env-tunable, default `86400`; `RotateRefreshTokenUseCase.ts` takes it as a required 4th ctor arg (line 52).
- [x] 2.3 Delete dead code in `RotateRefreshTokenUseCase.ts`: `GRACE_SECONDS` (`:14`) + its import (`:6`); keep the `RefreshTokenRotationLostRaceError` re-export; fix the stale "imports both" comment.
- [x] 2.4 Wire `routes/api/users.ts`: pass `REFRESH_TOKEN_REAP_SECONDS` as `RotateRefreshTokenUseCase`'s 4th arg.
- [x] 2.5 `backend/.env.example` (read-only) gains `REFRESH_TOKEN_REAP_SECONDS=86400`. Added by the maintainer by hand: this environment denies every read and write of `.env*` paths, so no agent in this cycle could touch the file. Verified only as far as that permission allows — `git status` reports it modified; its contents were never readable here. Documentation only, since `refreshTokenRetention.ts:4` falls back to `86400` when the variable is absent.

## Phase 3: Reuse detection (D2/D3/D6) — land together, new outcome fails the build until the controller handles it

- [x] 3.1 RED: flip `RefreshSessionUseCase.test.ts:133-142` — `revokeFamily`/`logger.warn` called once, outcome `'reuse-detected'`; add negative `revokeFamily` assertions to rows 1/2/3 + the `!familyId` guard; add a log-shape test (`familyId`,`userId`,`ageSeconds`,`revokedRows` present, `tokenHash`/`successorHash` absent); add a revocation-failure test (repo mock rejects → `execute()` rejects, not `'rejected'`). Row 6's original negative assertion was AMENDED in place (not duplicated).
- [x] 3.2 GREEN: `RefreshSessionUseCase.ts` — add `'reuse-detected'` (empty payload) to `RefreshSessionResult`; `LoggerPort` as 5th ctor arg; row 6 calls `revokeFamily(row.familyId)`, then `logger.warn(...)`, returns `'reuse-detected'`; no try/catch — a failure propagates as a 500.
- [x] 3.3 Verify: row 5 test (`:105-131`) still passes byte-identical — regression gate for the false-positive boundary. Confirmed untouched, still passing.
- [x] 3.4 RED: `UserApiController.test.ts` — assert `'reuse-detected'` maps to 401 `{ error: 'Sesión expirada' }`, no `Set-Cookie`, identical to `'rejected'`.
- [x] 3.5 GREEN: `UserApiController.ts:143` — `if (result.outcome === 'rejected' || result.outcome === 'reuse-detected')`.
- [x] 3.6 Wire `routes/api/users.ts`: instantiate `new PinoLogger()` as `RefreshSessionUseCase`'s 5th arg; extend the `//` comment above `router.post('/users/refresh', ...)` (`:196-200`).

## Phase 4: Integration tests — all in `SequelizeRememberTokenRepository.integration.test.ts` (`pnpm test:integration`)

- [x] 4.1 A row superseded at T survives at T+1h (compare vs DB `NOW()`, not Node clock) — proves cutoff ≠ 30s.
- [x] 4.2 Rows superseded more than the injected cutoff ago ARE deleted on a rotation in that family.
- [x] 4.3 Detection round trip: `revokeFamily` on a family → `findByHash` on every member returns revoked.
- [x] 4.4 Lock-contention: `revokeFamily` concurrent with a same-family rotation resolves without partial state; model on `claimRotation` tests at `:87-153`.
- [x] 4.5 (Deviation, orchestrator-directed) Storage bound: under the wider cutoff a family retains more than the ~2 rows the old 30s cutoff left — N rotations inside the cutoff leave N+1 rows, not reaped.

## Phase 5: Cleanup / final gate

- [x] 5.1 Confirm `rg GRACE_SECONDS backend/src` returns no results (for the dead module-level constant; the unrelated, still-legitimate `REFRESH_TOKEN_GRACE_SECONDS` domain constant is a substring match and was verified separately to remain — see apply-progress).
- [x] 5.2 Run the full local gate before declaring done: `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm type-check`, `pnpm --filter backend architecture:check`. All green except one PRE-EXISTING, unrelated integration failure (`deploy-migrate-and-start.integration.test.js`, root/no-password credential mismatch in this environment) — see apply-progress for full evidence.
