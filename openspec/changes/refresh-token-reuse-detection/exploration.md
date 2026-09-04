# Exploration: refresh-token-reuse-detection

> Hybrid artifact store: this FILE is authoritative. Engram mirror at topic key
> `sdd/refresh-token-reuse-detection/explore` (observation #7195). Baseline:
> `main` @ `645e313`. Addresses the fast-follow deferred by `auth-refresh-tokens`
> (`openspec/changes/archive/2026-09-02-auth-refresh-tokens/archive-report.md:82`).

## Current State

Refresh tokens rotate on every use (design.md D1/D2 of the archived `auth-refresh-tokens`
change). `RefreshSessionUseCase.execute`
(`backend/src/application/use-cases/RefreshSessionUseCase.ts:63-108`) reads the presented
token by hash and branches on a 6-row table:

1. absent → rejected (line 68)
2. revoked → rejected (line 74)
3. expired → rejected (line 78)
4. current (not superseded) → rotates via `RotateRefreshTokenUseCase` (line 86)
5. / 6. already superseded → `resolveGraceOrReject` (line 107), which computes
   `graceDeadline = supersededAt + REFRESH_TOKEN_GRACE_SECONDS(30)s` (line 120) and returns
   `'grace'` if still inside it (row 5, lines 139-144) or **`{ outcome: 'rejected' }` if past
   it (row 6, lines 121-122) — with no revocation and no signal beyond a plain 401**.

Row 6 is the exact spot the deferred fast-follow needs to fill.

`RotateRefreshTokenUseCase.execute` (`RotateRefreshTokenUseCase.ts:29-56`) runs three steps in
one transaction: `claimRotation` (conditional UPDATE gate), `insertSuccessor`, then
**`reapFamily(current.familyId, GRACE_SECONDS, tx)` at line 52 — unconditionally, on every
successful rotation**, `GRACE_SECONDS` being the same 30s constant
(`RotateRefreshTokenUseCase.ts:14`, `RefreshTokenGrace.ts:6`).

`SequelizeRememberTokenRepository.reapFamily` (`SequelizeRememberTokenRepository.ts:126-137`)
runs `DELETE ... WHERE family_id = ? AND superseded_at <= NOW() - INTERVAL <grace> SECOND`,
using the DB's own `NOW()` deliberately (the comment at lines 102-122 documents a real
regression: comparing against a Node-side clock silently reaped zero rows in CI, caught twice).

**Blocker CONFIRMED, not refuted.** Every rotation's step 3 deletes exactly the rows a later
row-6 detection would need to inspect. `revokeFamily(familyId)`
(`RememberTokenRepositoryPort.ts:27`, implemented at `SequelizeRememberTokenRepository.ts:94-100`,
used today only by `RevokeRefreshTokenUseCase` from logout) is a ready-made, already
integration-tested primitive — no new revocation code is needed, only a new call site and a
retention change to keep the target row alive long enough to reach it.

The row-6 unit test already pins today's behaviour and will need to change:
`RefreshSessionUseCase.test.ts:133-142` — `'row 6: replay past grace (superseded 30+s ago) ->
rejected, no revocation'` — explicitly asserts `expect(mockRepo.revokeFamily).not.toHaveBeenCalled()`.

Migration `20260901000000-refresh-token-rotation.js` (verified in full) adds `family_id`,
`superseded_at`, `successor_hash`, `revoked_at` and drops four duplicate `token_hash` unique
indexes. No scheduled sweep job exists anywhere in the codebase for any of these columns; the
only deletion paths are `reapFamily` (tied to a successful rotation) and
`deleteByHash` / `VerifyRememberTokenUseCase`'s lazy expired-row cleanup on a *different*
(non-rotation) lookup path. A family that stops rotating entirely — an abandoned session, or an
attacker who never rotates again — can retain past-grace rows **indefinitely** today. That is a
pre-existing property, not something any retention option below introduces.

## Detection Window, Precisely

Reap only fires as a side effect of a *successful* rotation of the family's *current* row
(row 4's winner, or a lost-race retry that goes on to win later). Row-5 grace hits and row-6
rejections never reap (confirmed: `RefreshSessionUseCase.test.ts:105-131` asserts `reapFamily`
is not called on grace; design.md: "a grace hit deliberately reaps nothing"). So the row-6
detection window for a given superseded row is:

```
[supersededAt + 30s, next successful rotation of that family by ANYONE]
```

### Direction A — thief refreshes first

The thief presents the still-current token, wins the rotation, and gets a fresh refresh cookie.
The legitimate user's browser still holds the now-superseded token. If the legitimate user's own
next refresh (driven by `ACCESS_TOKEN_TTL_SECONDS` = 30 min default, `cookieOptions.ts:21`, since
`authFetch` / `ensureRefreshed` only refresh reactively on a 401) lands **before** the thief
rotates a second time, it hits row 6 while the row still exists → detected, family revoked, the
thief's session dies too.

If the thief performs even one more successful rotation first, that rotation's own `reapFamily`
call deletes the evidence — grace has long elapsed by then, since a second rotation implies ≥30s
passed. The legitimate user's later replay then hits row 1 ("absent"), indistinguishable from
garbage: no detection, and the thief's family survives.

This is the hole. It is a race between two independently-clocked actors, not a fixed duration —
and it favours the attacker: one who deliberately rotates faster than the legitimate user's
natural ~30-minute cadence reliably erases their own evidence.

### Direction B — legitimate user refreshes first

The legitimate user's routine refresh wins; the thief's copy of the same (now-superseded) token
is what gets replayed later.

- **Within 30s** → row 5 grace: the thief also gets a live access cookie (bounded to one more
  `ACCESS_TOKEN_TTL_SECONDS`) but no refresh cookie, since only the winner gets one. This already
  bounds the thief's benefit even without detection.
- **Past 30s**, and the row has not been reaped by a third party → row 6 fires and, with detection
  added, revokes the **whole family, including the legitimate user's live session**. Correct in
  intent (kill a compromised family), but it is the direct mechanism behind the false-positive
  risk below.

**Net**: detection is reliable only when the legitimate side's natural refresh cadence beats the
illegitimate side's. A scripted attacker that rotates faster than a human's ~30-minute
idle-to-active cycle can outrun detection indefinitely by self-erasing evidence on every one of
its own rotations.

## Retention Strategies Compared

| Option | Mechanism | Storage (30d family, 30min rotation ≈ 1440 potential rows) | Detection reach | Effort | Key risk |
|---|---|---|---|---|---|
| **(a) Reap by family expiry** | Stop reaping on rotation; only clear a family once its own `expiryDate` passes | Worst case **~1440 rows/family** — exactly the number design.md D7 explicitly rejected ("replacing the proposal's ~1,440-row worst case") | Full family lifetime (permanent until expiry) | Medium | Reintroduces the exact growth the archived change eliminated; nothing today sweeps truly-expired families either, so a new cleanup path is still needed |
| **(b) Cap rows per family (keep last N)** | `reapFamily`'s DELETE becomes count-based ("keep newest N by `supersededAt`/id") instead of time-based | Bounded and predictable: **N rows/family**, independent of session length | N *rotations*, not N *seconds* — an attacker who rotates ≥N times before the legitimate user's next check-in still erases evidence (same shape of hole as today, just requiring more attacker rotations) | Low–Medium | More complex SQL (window/subquery vs. a plain DELETE) — exactly the raw-SQL, DB-semantics-dependent code class that produced two of the archived change's invisible-to-unit-tests defects |
| **(c) Compact tombstone (separate table/columns)** | On reap, instead of deleting, write `(family_id, token_hash, superseded_at)` into a small dedicated structure with its own (longer, decoupled) retention; row-1 "absent" lookups also check the tombstone | Same worst-case row *count* as (a) but a far smaller per-row footprint (3 narrow columns vs. `RememberToken`'s 9) | Full family lifetime, same as (a), decoupled from the hot `RememberToken` table | High | New migration/table, two write paths, and a new read on **every** not-found lookup including garbage/malicious probes (hot-path cost); highest implementation surface of the four |
| **(d) Widen the reap cutoff (new `REAP_AFTER_SECONDS` ≠ grace 30s)** | Decouple the existing 30s grace (still governs row 5 vs. row 6) from a separate, longer reap interval (e.g. `= ACCESS_TOKEN_TTL_SECONDS`) that only `reapFamily`'s SQL uses | Steady state unchanged (~2 rows/family) for normally-paced traffic; grows only if the attacker deliberately floods rotations inside the wider window | Bounded and attacker-observable: same fundamental race as today, just with a bigger window to win it in | Lowest — one constant/interval change, no schema change | Does not close the hole, only raises the bar; a sufficiently fast scripted attacker still outruns it, the same limitation family as (b) |

No option is picked here — this is the fork the proposal must resolve. (a) and (c) are the only
two that make detection reach match the family's actual lifetime, closing the hole rather than
raising the bar; (b) and (d) are cheaper but share today's "attacker can out-rotate the window"
ceiling, just with a larger constant.

## Live Spec Impact

All five capability specs touched by the archived change were read in full.

- **`refresh-token-rotation` — "Retention on Rotation" (spec.md:85-100): CONTRADICTED.** Its own
  wording ("delete rows... already superseded past the grace window" on every rotation) is
  literally the mechanism causing the blocker. Any of the four options requires rewriting this
  requirement's text, not just adding a scenario.
- **`refresh-token-rotation` — "Rotation on Every Use With a Grace Window" (spec.md:47-75): NOT
  contradicted, but must be EXTENDED.** The "Replay past the grace window fails... MUST be 401"
  scenario still holds literally (detection can keep returning 401 — see Detection Response
  Scope), but the requirement currently describes no side effect for that branch; a new scenario
  documenting "and the family MUST be revoked" (or equivalent) is needed.
- **`refresh-token-rotation` — "Concurrent Refresh From Multiple Tabs" (spec.md:76-84): AT RISK**,
  not contradicted by design, but only if detection stays strictly scoped to row 6 and never
  touches row 5. The code today already keeps grace hits side-effect-free (test-verified). The
  real risk is the false-positive path below pushing a *should-have-been-row-5* legitimate replay
  past the 30s boundary into row 6.
- **`api-jwt-auth`**: not contradicted. Its "Logout Endpoint" requirement is the precedent this
  change reuses (`revokeFamily`), and nothing else in this spec describes reap or retention. A NEW
  requirement (or an extension) may be the right home for "reuse detected → revoke", but that is a
  placement decision for `sdd-propose` / `sdd-spec`, not decided here.
- **`remember-token-store`**: not contradicted **unless option (c) is chosen** — a new table or
  columns would need a new "Model Schema" scenario. Options (a), (b) and (d) touch no schema, only
  `reapFamily`'s query.
- **`csrf-protection`**: not affected — the refresh route's CSRF exemption is orthogonal to reuse
  detection.
- **`session-cookie-security`**: not affected — `RefreshSessionUseCase` gets `familyId` from the DB
  row (`row.familyId`, code-confirmed non-null by the guard at `RefreshSessionUseCase.ts:116`
  before row 6 is ever reached), never from the access cookie, so the cookie's-outlive-token
  property this spec protects is irrelevant to server-side detection.

## False-Positive Risk

The grace window exists precisely so two legitimate tabs racing within ~30s look identical to
normal use, not an attack (row 5, side-effect-free, test-pinned). Reuse detection only fires on
row 6 (past 30s), so a *fast* race is safe by construction. The real risk is a *slow* one:

- **Network retry / resume-after-suspend.** An HTTP client — or a browser tab or service worker —
  that sent `POST /api/users/refresh`, had the request succeed server-side (rotating the token),
  but never received or processed the response (dropped connection, backgrounded tab, laptop
  sleep) may retry the SAME original token later. Within 30s this is exactly the grace path's
  intended forgiveness (row 5). **After** 30s — plausible for a suspended device resuming, an
  aggressive backoff, or a delayed queued request — it now looks identical to a stolen-token
  replay and would revoke the entire family, forcibly logging out the legitimate user's other
  tabs and devices too.
- **Cross-device cookie sync.** Browser profile sync can propagate cookies across a user's own
  devices with real-world latency measured in seconds to minutes, not milliseconds. A second
  device using a "stale" refresh cookie because sync has not caught up yet is legitimate traffic
  that could exceed the 30s window.

Both are single-actor, no-attacker scenarios that a fixed 30s window does not fully rule out. This
risk exists independently of which retention option is chosen — it is about the *reject-vs-grace*
boundary, not about retention — but it becomes consequential only once row 6 actually revokes
something instead of just rejecting, which is precisely what this change adds. It should be
weighed explicitly in the proposal, e.g. via a wider "detection grace" separate from the "rotation
grace", or an explicit accepted-risk note.

## Detection Response Scope

Today `UserApiController.refresh` (`UserApiController.ts:128-179`) maps every `'rejected'` outcome
to a flat `401 { error: 'Sesión expirada' }` (lines 143-146). Reuse would need a new, distinct
outcome variant — `RefreshSessionResult` currently has only `'rejected' | 'grace' | 'rotated'`
(`RefreshSessionUseCase.ts:18-32`) — for the controller and use case to branch on, since
revocation is a side effect `RefreshSessionUseCase` does not perform today (only
`RevokeRefreshTokenUseCase`, called by logout, does).

On the frontend, `refreshSingleFlight.ts:22-47`'s `ensureRefreshed()` only checks `res.ok` —
**any** non-2xx status (401 today, 403 or anything else if chosen) already resolves to the same
`false`, and `authFetch.ts:54-82` already ends the session and redirects to `/login` on a failed
refresh when a session existed. **The user-visible behaviour (logout plus redirect) therefore
requires zero frontend changes** regardless of which HTTP status is chosen. The only genuinely new
behaviour is server-side: the whole family, including any other live device, gets killed.

Whether to keep the response byte-identical to an ordinary 401 (avoiding leaking "you got caught"
to an attacker probing for a live family) or to add a distinguishable signal (so the UI could show
a specific "your session was ended for security reasons" message instead of a generic redirect) is
a product decision for the proposal, not decided here.

Logging and alerting: `backend/src/infrastructure/logging/logger.ts` (pino) and a `LoggerPort`
domain port already exist and are already injected into at least one use case
(`AdjustProductStockUseCase`), so reuse-detection logging has an established DI pattern to follow.
No new logging infrastructure would be needed.

## Testability Under Strict TDD

### Provably unit-level (mocked repo, following the existing row 5/6 test pattern)

- `RefreshSessionUseCase`'s row-6 branch logic — given a row past grace, call
  `revokeFamily(familyId)` and return the new outcome. Mirrors the existing
  `RefreshSessionUseCase.test.ts:133-142` test, whose assertion will need to be flipped.
- `UserApiController.refresh`'s mapping of the new outcome to an HTTP status and body.
- Grace-path purity regression (row 5 still calls nothing) — already covered, must keep passing
  unchanged.

### Must live in `*.integration.test.*` (real DB)

Per `jest.config.js:7`'s exclusion and the archived change's own hard lesson (archive report,
Engram #7158): a `NOW()`-vs-Node clock bug inside `reapFamily` itself was invisible to mocks and
surfaced only in CI against a real DB.

- Any change to `reapFamily`'s SQL predicate under options (a), (b) or (d). Comparing dates or
  counts against real MySQL semantics is exactly the class of bug — second-precision `datetime`,
  `NOW()` vs. Node clock, `<=` vs. `<` — that has already bitten this exact function twice.
- A real-concurrency test proving that a "replay races a real reap" scenario resolves safely.
  `resolveGraceOrReject`'s `findByHash` read (`RefreshSessionUseCase.ts:114`) is unlocked and
  outside any transaction, while the reap it might be racing against runs inside
  `RotateRefreshTokenUseCase`'s transaction (`RotateRefreshTokenUseCase.ts:32-55`) — a genuine
  TOCTOU window mocks cannot exercise, structurally identical to the `claimRotation`
  real-concurrency tests already in `SequelizeRememberTokenRepository.integration.test.ts:87-153`.
- Storage-bound verification for whichever option is chosen (e.g. "family never exceeds N rows",
  "tombstone survives past the point the main row is gone") — mirrors the existing `finalCount`
  assertions in `SequelizeRememberTokenRepository.integration.test.ts:200-211`.
- The full round trip "row 6 detected → `revokeFamily` → a subsequent refresh from any family
  member is 401" needs at least a repository-layer integration test, matching how logout's
  `revokeFamily` is proven today (`SequelizeRememberTokenRepository.integration.test.ts:245-265`)
  rather than only at the HTTP layer. No HTTP-level `/api/users/refresh` test exists today either —
  a known, already-recorded gap (Engram #7158).

## Affected Areas

- `backend/src/application/use-cases/RefreshSessionUseCase.ts` — row 6 branch;
  `RefreshSessionResult` needs a new outcome variant
- `backend/src/application/use-cases/RotateRefreshTokenUseCase.ts` — reap call site,
  `GRACE_SECONDS` usage
- `backend/src/infrastructure/repositories/SequelizeRememberTokenRepository.ts` — `reapFamily` SQL
  predicate (options a/b/d) or a new tombstone write path (option c)
- `backend/src/domain/ports/RememberTokenRepositoryPort.ts` — signature changes if `reapFamily`
  gains parameters, or new tombstone methods
- `backend/src/domain/entities/RefreshTokenGrace.ts` — a possible new constant decoupling the reap
  interval from the grace interval (option d)
- `backend/src/infrastructure/controllers/UserApiController.ts` — `refresh` handler's
  outcome-to-HTTP mapping
- `backend/src/database/migrations/` — a new migration only if option (c) or a count-cap index
  (option b) is chosen
- `openspec/specs/refresh-token-rotation/spec.md` — "Retention on Rotation" requirement rewrite
  (mandatory for any option); "Rotation on Every Use With a Grace Window" extension
- `openspec/specs/remember-token-store/spec.md` — schema requirement, only if option (c)
- Tests: `RefreshSessionUseCase.test.ts` (row 6 assertion flip), `RotateRefreshTokenUseCase.test.ts`,
  `SequelizeRememberTokenRepository.test.ts` and `.integration.test.ts`, `UserApiController.test.ts`

## Approaches

1. **(a) Reap by family expiry** — Pros: simplest mental model, permanent detection reach. Cons:
   reintroduces the exact ~1440-row growth D7 eliminated; needs a new expired-family cleanup path
   since nothing sweeps today. Effort: Medium.
2. **(b) Cap rows per family (last N)** — Pros: predictable bounded storage, no new migration.
   Cons: detection reach measured in attacker-controlled rotation count, not time; more complex
   SQL. Effort: Low–Medium.
3. **(c) Compact tombstone table/columns** — Pros: the only option matching (a)'s full-lifetime
   reach at a much smaller per-row footprint. Cons: highest complexity, new migration, dual write
   path, extra cost on every not-found lookup including garbage probes. Effort: High.
4. **(d) Widen the reap cutoff via a new constant** — Pros: lowest effort, no schema change,
   steady-state storage unchanged for normal traffic. Cons: does not close the hole, only raises
   the bar against a scripted attacker; shares (b)'s fundamental limitation. Effort: Low.

## Recommendation

No approach is picked here by design — the orchestrator and user own this product decision, because
storage cost vs. detection completeness vs. implementation risk is a tradeoff, not a technical
fact.

Decision inputs for `sdd-propose`:

- Whether closing the hole completely (a/c) is worth the storage and complexity cost, or whether
  raising the bar (b/d) is an acceptable interim step given the residual "scripted attacker
  out-rotates the window" limitation either way.
- Separately, how to handle the false-positive risk regardless of which retention option is chosen.

## Risks

- **False positives**: a legitimate slow retry or cross-device cookie-sync lag past the 30s grace
  boundary would be indistinguishable from theft and would log out a legitimate user's other live
  sessions.
- **Residual detection gap**: options (b) and (d) do not close the hole against a scripted attacker
  that rotates faster than the window; only (a) and (c) do, at higher storage and complexity cost.
- **Raw-SQL / DB-clock regression risk**: `reapFamily` has already produced two real,
  unit-test-invisible defects (`NOW()` vs. Node clock, `<` vs. `<=` on second-precision `datetime`).
  Any change to its predicate carries the same risk class and needs real-DB integration coverage
  from the start, not as an afterthought.
- **Unspecified placement**: which capability spec should own the new "reuse detected" requirement
  (`refresh-token-rotation` vs. a new addition to `api-jwt-auth`) is undecided.
- **No existing HTTP-level test for `/api/users/refresh`** (pre-existing gap, Engram #7158) — a
  reuse-detection round trip proven only at the repository or use-case layer inherits that same
  visibility gap unless explicitly addressed.

## Ready for Proposal

Yes, with one blocking decision needed first: a retention strategy must be chosen (or that choice
explicitly deferred into `sdd-propose` itself) before `sdd-spec` and `sdd-design` can write
concrete requirements, since the four options imply materially different schema and API surfaces.
