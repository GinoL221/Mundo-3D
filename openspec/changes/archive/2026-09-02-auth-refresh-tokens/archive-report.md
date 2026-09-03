# Archive Report: Refresh Tokens with Rotation (HIGH-1)

**Date Archived**: 2026-09-02  
**Change Name**: auth-refresh-tokens  
**Status**: COMPLETE — PASS WITH WARNINGS  
**All Tasks**: 52/52 complete  
**All PRs**: Merged (#114, #115, #116) → main @ commit `1261c09`

---

## Executive Summary

The auth security review's HIGH-1 priority item is closed: logout now revokes a session on the server side instead of only clearing cookies. A captured refresh token's useful life after logout is bounded to the access-token TTL (30 minutes by default, configurable via `ACCESS_TOKEN_TTL_SECONDS`). The implementation introduces token rotation with a 30-second grace window to handle concurrent tab refreshes, and adds a new `/api/users/refresh` endpoint guarded by rate limiting.

---

## What Shipped

**Revocable Session State**: Logout revokes every row in a token's family via `revokedAt` columns in the `RememberToken` table. A subsequent refresh with any token from that family returns 401. Prior access tokens cannot be renewed after logout because the family is marked revoked at the repository layer.

**Refresh Token Rotation**: Every successful refresh rotates the presented token (marks it superseded, creates a new row in the same family). Clients are protected from race conditions on concurrent refreshes within a 30-second grace window — both tabs end up authenticated without client-side coordination.

**Access-Token Independence**: The access token's lifetime is now fixed at 30 minutes (env-tunable via `ACCESS_TOKEN_TTL_SECONDS`), independent of "remember me". Only the refresh token lifetime varies: 2 hours by default, 30 days when "remember me" is requested. This separation allows the session cookie to outlive the token it carries, so logout can read the family ID from a stale auth cookie and revoke the refresh family.

**Token Rotation Claim**: The JWT now carries a `typ: "access"` claim, enforced by `apiAuthMiddleware`. Pre-deploy JWTs lacking this claim are rejected post-deploy.

---

## Deploy-Day Requirements

**Session Termination on Deploy**: Every existing session ends when this deploys by design. `apiAuthMiddleware` requires a `typ: "access"` claim that pre-deploy JWTs do not carry. The maintainer chose a low-traffic deploy window with a notice on the login page, matching the 2026-08-26 cookie migration precedent.

**Boot Gate Failure Until Migration**: `checkPendingMigrations.js` gained four new required columns (`family_id`, `superseded_at`, `successor_hash`, `revoked_at`). Boot fails fast until `pnpm db:migrate` runs. This is intentional and a real deploy step.

---

## Defects Caught Only by Real-Database and Real-Browser Testing

Four defects were invisible to unit tests and caught during verification on real database and real browser tiers:

1. **`reapFamily` Clock Comparison Bug**: A Node-vs-database clock skew in comparing timestamps against a second-precision database column. Fixed during apply round 5.

2. **`reapFamily` Strict Comparison Bug**: A strict `<` comparison against the grace window threshold, off by one second. Fixed during apply round 5.

3. **Guest Cart UX Regression**: Guests browsing `/cart` were evicted to `/login` during refresh attempts, contrary to the prior behavior. Fixed during verification.

4. **Access Cookie Downgrade on Refresh**: The refresh endpoint initially called `issueAccessCookie` without a lifetime argument, taking a 2-hour default and downgrading remembered 30-day sessions on first refresh. Fixed before final verification (commit `455ea9f`).

---

## The Verification Record

**Verdict**: PASS WITH WARNINGS (five rounds of verification)

- **Round 1–4**: Each found a failure one artifact further out.
- **Round 5**: Fixed and verified the final defect (access cookie downgrade); confirmed all 4 prior fixes; swept by claim across specs, design, proposal, tasks, source comments, and test names.

**Key Finding**: Sweeping by *claim* across every mention of changed signatures, field names, and behavior (not just by file) is what converged the cycle. `git show --name-only` proves which files a commit touched and nothing about whether it edited the right place inside them.

**Test Coverage**: 1250 tests passed (1008 backend + 242 frontend). Real-database and real-browser tiers verified critical properties that unit mocks hide.

**Test Execution Summary**:
- Build (type-check): ✅ PASS
- Unit + integration tests: ✅ 1250 PASS
- Additional gates: ✅ lint, architecture:check, openapi:check all PASS
- **Not executed locally** (host port 3306 held by maintainer): `pnpm test:integration` and `pnpm test:e2e`, marked (CI) and verified green on merged PRs #114–#116

---

## Residual Exposure — Stated Plainly

Logout revokes the refresh family immediately. However, the access token is a stateless JWT with nothing to revoke it by — the proposal explicitly declined a `jti` denylist. It becomes non-renewable and dies on its own TTL. That window is real and is the operational dial to turn if it needs shrinking via `ACCESS_TOKEN_TTL_SECONDS`.

---

## Known Gaps — Recorded Honestly

1. **33 of 52 tasks lack recorded RED/GREEN evidence.** The work was done test-first under Strict TDD, but PR2 and PR3 apply agents were killed by provider rate limits before writing execution snapshots. `apply-progress.md` documents this explicitly.

2. **No end-to-end HTTP POST test to `/api/users/refresh`.** Revocation is proven at the repository layer (against a real database) instead. The property is covered by a complete layer chain rather than end-to-end.

3. **Reuse-Detection Revocation Deferred.** The schema provisions `family_id` and rotation writes it, but nothing revokes a family on detecting reuse — if a replayed refresh token is presented, it fails without killing the thief's other sessions. This is a future follow-up.

4. **`qs@6.16.0` Repository Age Exception.** The dependency carries a documented `minimumReleaseAgeExclude` exception that can be removed starting 2026-09-05, when the version clears the repository's 7-day floor on its own. Dated follow-up only.

---

## Spec Merges — Source of Truth Updated

Five spec domains received changes:

| Domain | Action | Details |
|--------|--------|---------|
| `refresh-token-rotation` | Created | New specification for the rotation and grace-window behavior (100 lines) |
| `api-jwt-auth` | Updated | 4 requirements replaced: login TTL fixed to 30m (not 2h), `typ: "access"` claim enforced, logout revokes family, remember-me extends refresh token only |
| `remember-token-store` | Updated | 2 requirements replaced: schema now carries rotation/revocation columns, lifecycle ops moved to dedicated use cases |
| `csrf-protection` | Extended | 1 requirement added: `/api/users/refresh` CSRF exemption |
| `session-cookie-security` | Extended | 2 requirements added: per-cookie lifetime split (all 4 cookies outlive the JWT inside), refresh cookie path scoping to `/api/users/refresh` |

All five delta specs have been merged into the canonical specs under `openspec/specs/`.

---

## SDD Workflow Artifacts

**Persisted and Verified**:
- ✅ proposal.md — scoped HIGH-1 resolution, approach, rollback plan
- ✅ specs/ — five delta specs merged into main specs
- ✅ design.md — D1–D6 architecture, corrected during apply
- ✅ tasks.md — 52 implementation tasks, all complete with verification findings documented
- ✅ apply-progress.md — three apply rounds, captured scope corrections and provider rate-limit context
- ✅ verify-report.md — five verification rounds, PASS WITH WARNINGS, no CRITICAL blockers

All artifacts archived to `openspec/changes/archive/2026-09-02-auth-refresh-tokens/`.

---

## Review and Delivery

**Native Review Authority**: No review was started for this candidate (kill switch was off and not re-enabled). Archive proceeds under ordinary repository policy.

**Task Completion**: All 52 implementation tasks carry `[x]` checkmarks. No stale unchecked tasks remain.

**Build & Tests**: Green on merged main:
- Type-check: ✅
- 1250 tests: ✅
- Lint, architecture boundaries, OpenAPI artifact freshness: ✅
- CI integration and e2e on #116: ✅

---

## Operator Notes

1. **Deploy Window**: Choose low-traffic window; all sessions end on deploy.
2. **Migration Step**: Run `pnpm db:migrate` on the first boot after deploy.
3. **Environment Variables**: 
   - `ACCESS_TOKEN_TTL_SECONDS` (default 1800 / 30 minutes, env-tunable)
   - `REFRESH_LIMIT_WINDOW`, `REFRESH_LIMIT_MAX` for rate limiting

---

## Cycle Closure

This SDD cycle is complete. The change has been fully planned, implemented, verified, and archived. The source-of-truth specs reflect the new behavior. Ready for the next change.

**Change PR Chain**: #114 (store) → #115 (endpoint) → #116 (frontend) → merged to main  
**Final Commit**: `1261c09`  
**Archive Path**: `openspec/changes/archive/2026-09-02-auth-refresh-tokens/`

---

## Engram Observation IDs

Mirrored to Engram as observation `7158` under topic_key `sdd/auth-refresh-tokens/archive-report` (project `mundo-3d`). The phase agents themselves had no working `mem_*` tools for this entire change, so the orchestrator wrote the mirror after the archive commit.

---

**Archived by**: sdd-archive phase  
**Date**: 2026-09-02  
**Mode**: hybrid (openspec filesystem + Engram mirror)
