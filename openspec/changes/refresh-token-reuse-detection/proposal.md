# Proposal: Refresh Token Reuse Detection

> Hybrid artifact store: this FILE is authoritative. Engram mirror at topic key
> `sdd/refresh-token-reuse-detection/proposal`. Baseline: `main` @ `645e313`.
> Inputs: `exploration.md`, `research.md`. Decisions confirmed by the maintainer
> before this phase — they are binding on `sdd-spec`, `sdd-design`, `sdd-tasks`
> and `sdd-apply`.

## Intent

`auth-refresh-tokens` shipped rotation and family columns but deferred the detection logic
(`archive/2026-09-02-auth-refresh-tokens/archive-report.md:82`). Today a refresh token replayed
past its grace window returns a flat 401 and **nothing else** — the family survives, the thief keeps
rotating, and no operator ever learns a token leaked. `RefreshSessionUseCase.ts:121-122` is the
empty branch. RFC 9700 §4.14.2 makes reuse detection a **MUST** for public clients; we currently
satisfy the rotation half and not the detection half.

The blocker is self-inflicted: every successful rotation calls
`reapFamily(familyId, GRACE_SECONDS, tx)` (`RotateRefreshTokenUseCase.ts:52`), deleting the exact
rows detection needs. Retention and grace are welded to one 30-second constant. **That coupling is
the defect.**

## Decisions (confirmed, not re-openable)

| # | Decision | Rationale | Accepted cost |
|---|---|---|---|
| 1 | **Split the reap cutoff from the grace window.** Grace stays 30s and keeps governing row 5 vs. row 6. A NEW constant governs `reapFamily`'s cutoff, set to **24 hours** | Research maps this onto how Okta and Cognito actually parameterise their systems: a short overlap window for races, a separate retention horizon for evidence [11][14]. It is the only option no evidence argues against | Steady-state family size grows from ~2 rows to ~48 |
| 2 | **Revoke the whole family on detection**, via the existing `revokeFamily(familyId)` (`RememberTokenRepositoryPort.ts:27`) | Deliberately exceeds RFC 9700's floor, which says only "it will revoke the active refresh token" (singular). Auth0, Okta, Salesforce, Keycloak and the OWASP cheat sheet all go family/grant-wide | A false positive logs the user out everywhere — see Residual Risk |
| 3 | **Grace window unchanged at 30s** | Okta's documented default (research Lane 4) and our own proven value. Widening to 60s was considered and **rejected**: nobody publishes a false-positive rate, so a wider window would be an unmeasured hedge that also widens the attacker's free-replay window | The false-positive exposure at 30s is accepted as-is, not reduced |
| 4 | **Response indistinguishable from an ordinary 401.** Reuse is logged server-side through the existing `LoggerPort` / `PinoLogger` | **Stated honestly: research Lane 7 found NO public evidence either way.** Microsoft Entra ID does the opposite with granular AADSTS codes. This is our judgment call — do not leak "you got caught" to a probing attacker — not an industry requirement | No UI can ever explain *why* the session ended. Zero frontend work: `refreshSingleFlight.ts:22-47` only checks `res.ok` |

## Correction to the exploration — decision 1 is stronger than it was described

`exploration.md:112` claims option (d) "does not close the hole, only raises the bar; a sufficiently
fast scripted attacker still outruns it." **That is wrong, and this proposal supersedes it.**

`reapFamily`'s predicate is `superseded_at <= NOW() - INTERVAL <cutoff> SECOND` — purely temporal.
It deletes rows **past the cutoff**, not "all predecessors". A row superseded at time `T` therefore
survives until `T + cutoff` **regardless of how many times an attacker rotates**. Rotating faster
does not erase anything the cutoff has not already released.

Option (d) is not a bigger race. It converts an attacker-vs-user race into a **fixed, guaranteed
detection window of 24 hours**. Carry this forward; do not repeat the exploration's claim.

## Capabilities

### New
- None.

### Modified
- `refresh-token-rotation`: "Retention on Rotation" is **contradicted** by its own wording and must be
  rewritten around the new cutoff; "Rotation on Every Use With a Grace Window" must be **extended**
  with the revoke-on-reuse side effect for the past-grace branch.

## Affected surface

| Area | Impact | What changes |
|---|---|---|
| `backend/src/domain/entities/RefreshTokenGrace.ts` | Modified | New `REFRESH_TOKEN_REAP_SECONDS = 86400`, decoupled from the 30s grace |
| `backend/src/application/use-cases/RotateRefreshTokenUseCase.ts:52` | Modified | Pass the new constant to `reapFamily` instead of `GRACE_SECONDS` |
| `backend/src/application/use-cases/RefreshSessionUseCase.ts:110-127` | Modified | Row-6 branch calls `revokeFamily`; new `RefreshSessionResult` variant; `LoggerPort` injected |
| `backend/src/infrastructure/controllers/UserApiController.ts:143-146` | Modified | Map the new outcome to the same 401 body |
| `backend/src/infrastructure/routes/api/users.ts:40` | Modified | DI wiring for the logger |
| `openspec/specs/refresh-token-rotation/spec.md:47-100` | Modified | Both requirements above |
| Tests | Modified/New | `RefreshSessionUseCase.test.ts` (flip), `RotateRefreshTokenUseCase.test.ts`, `UserApiController.test.ts`, `SequelizeRememberTokenRepository.integration.test.ts` |

**No migration. No schema change. No new table.**

**Correction to `exploration.md:244` — `reapFamily`'s SQL does NOT change.** Verified: the cutoff is
already a parameter (`SequelizeRememberTokenRepository.ts:126`), coerced via
`Math.max(0, Math.trunc(...))` and interpolated into the interval. Only the *argument* changes. This
materially lowers the raw-SQL regression risk the exploration flagged — the predicate that produced
two historical defects is untouched. Integration coverage is still required, to prove a 24h cutoff
actually preserves rows a 30s cutoff deleted.

**`UserApiController.ts` is at 247 of the 250-line cap.** Adding any branch breaches AGENTS.md. The
predecessor hit this exact wall and extracted `sessionCookies.ts`; `sdd-design` must plan an
extraction, not assume headroom.

## Scope

### In scope
- The retention-constant split and its call-site change.
- The row-6 detection hook calling `revokeFamily`, plus the new `RefreshSessionResult` variant and
  the controller mapping it requires.
- Reuse-event logging via the existing `LoggerPort` DI pattern.
- The two `refresh-token-rotation` spec amendments.
- Tests for all of it: unit **and** the real-DB `*.integration.test.*` tier.

### Out of scope (explicit)
- **The missing sweep for abandoned families.** `reapFamily` only ever runs *during a rotation*, so a
  family that stops rotating — an abandoned session, or an attacker who never rotates again — retains
  rows indefinitely. This is real, pre-existing, discovered during this exploration
  (`exploration.md:48-55`), and **untouched by this change**, which only moves the cutoff. Registered
  as a named follow-up; do not absorb it.
- Options (a), (b) and (c) from the exploration — rejected in favour of decision 1.
- Any change to the 30s grace window, the response shape, or the frontend.
- No HTTP-level test for `/api/users/refresh` exists (pre-existing gap, Engram #7158); this change
  does not create that tier.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **False positive revokes a legitimate user's family** — a slow replay past 30s (suspended device, cross-device cookie-sync lag, delayed retry) is indistinguishable from theft | Med | **None available. Accepted and documented** — see below |
| Row-6 behaviour is pinned by an existing test asserting the opposite | High (certain) | `RefreshSessionUseCase.test.ts:133-142` asserts `expect(mockRepo.revokeFamily).not.toHaveBeenCalled()`. That assertion **must flip**. Today's behaviour is pinned, not merely absent |
| 24h cutoff behaves differently against real MySQL than against mocks | Med | Real-DB integration test from the start, per the archived change's own hard lesson |
| `UserApiController.ts` breaches the 250-line cap | High | Extract before adding the branch |
| Storage growth surprises an operator | Low | ~48 rows/family in steady state, vs ~1440 under option (a). Bounded and stated |

## Residual risk — read this before assuming reuse detection is complete

**We are bounding the hole, not eliminating it.** Reuse of a token whose row has already passed the
24-hour cutoff is still undetectable: the row is gone, the lookup falls to row 1 ("absent"), and the
response is the same 401 it is today. An attacker who sits on a stolen token for more than 24 hours
before replaying it is not caught.

**The dial is the new constant.** Raising it extends the guaranteed detection window linearly and
costs ~2 rows per family per hour at the current 30-minute rotation cadence. Lowering it does the
reverse. Nothing else needs to change to move it.

**The false-positive risk is accepted, not solved.** The grace window forgives *fast* races by
design. A *slow* legitimate replay past 30 seconds will now revoke the family and log the user out
of every device. Both exploration and research land on the same place: this is real, every major
vendor ships a grace window precisely because of it, and **no vendor or study publishes a
false-positive rate**. We are choosing a 30-second boundary on Okta's precedent, not on measurement.

## Delivery — one PR

Backend touches five files with small, local edits; specs touch one file; tests carry most of the
weight. Estimated **250–350 changed lines**.

**Decision needed before apply: No** · **Chained PRs recommended: No** · **400-line budget risk: Low**

The one thing that could push it over is the `UserApiController` extraction. If `sdd-design` finds
the extraction is larger than a move, re-forecast at `sdd-tasks` rather than splitting speculatively.

## Rollback plan

- **Revert the branch.** There is no migration, no schema change, and no data to unwind — a revert
  restores the 30s cutoff and the passive 401 exactly.
- **Incident lever without a deploy:** the reap cutoff should be env-tunable. Setting it back to 30
  restores today's behaviour (evidence reaped immediately, detection effectively off) while leaving
  the code deployed. This is the mitigation if false positives prove worse than expected.
- Rows retained under a 24h cutoff before a revert are harmless: they are reaped by the next rotation
  once the constant is back to 30s.

## Success criteria

- [ ] A refresh token replayed more than 30 seconds after being superseded, and less than 24 hours
      after, returns 401 **and** revokes its entire family.
- [ ] Every other member of that family, including the current one, is rejected on the next refresh.
- [ ] The response body and status are byte-identical to an ordinary rejected refresh.
- [ ] A reuse event is logged server-side with the family id.
- [ ] Row 5 (grace) still mutates nothing — the existing purity test passes unchanged.
- [ ] A real-DB integration test proves rows superseded under 24 hours ago survive a rotation's reap.
- [ ] `RefreshSessionUseCase.test.ts:133-142` asserts revocation **does** happen.
- [ ] `openspec/specs/refresh-token-rotation/spec.md` no longer contradicts the implementation.
