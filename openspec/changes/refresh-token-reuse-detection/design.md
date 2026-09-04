# Design: Refresh Token Reuse Detection

> Hybrid artifact store: this FILE is authoritative. Engram mirror at topic key
> `sdd/refresh-token-reuse-detection/design`. Baseline: `main` @ `645e313`, verified against live
> code. **Inputs**: `proposal.md` (its four confirmed decisions are binding and not reopened here),
> `exploration.md`, `research.md`, and the archived predecessor's `design.md` — this document
> extends its **D1**/**D2** and **amends its D7**.

## Corrections to the inputs (verified against live code)

| Claim | Live code says | Effect |
|---|---|---|
| `RotateRefreshTokenUseCase.ts:14`'s comment: "PR1's own test file imports both from this module" | `rg GRACE_SECONDS backend/` returns **six hits, all inside `backend/src`**. Nothing imports `GRACE_SECONDS`, not even `RotateRefreshTokenUseCase.test.ts` | Once line 52 stops using it, both `GRACE_SECONDS` (line 14) and its `REFRESH_TOKEN_GRACE_SECONDS` import (line 6) are **dead code** and MUST be deleted (AGENTS.md). The `RefreshTokenRotationLostRaceError` re-export on line 13 stays — it is genuinely imported |
| `exploration.md:224-228` frames the unlocked `findByHash` read as a TOCTOU risk **this change carries** | The reap can only delete rows past the cutoff. Raising it 30s → 86400s shrinks the reapable-row population by **2880×** | The change *reduces* the existing TOCTOU exposure rather than adding one. See D5 |
| `proposal.md:59` places the new constant beside `REFRESH_TOKEN_GRACE_SECONDS` in `domain/` | `rg 'process\.env' backend/src/domain` returns **zero matches**. Domain is environment-free today | An env-tunable constant cannot go there without making domain environment-aware for the first time. See D1 |
| `proposal.md:142` — setting the lever to 30 "restores today's behaviour (evidence reaped immediately, **detection effectively off**)" | It restores today's *retention*. A family that has not rotated since the replay still holds its row, so row 6 still fires and still revokes | The lever narrows detection to near-zero; it is **not** a kill switch. Stated precisely in D7 |
| `proposal.md:62` implies the controller edit is the reason for the extraction | The branch is **4 lines** (`\|\| result.outcome === 'reuse-detected'` plus a why-comment) | The extraction is forced by the 250-line cap standing at 247, not by the size of the branch. See D4 |

**Unverified**: `.env.example` could not be read (permission denied), and `ACCESS_TOKEN_TTL_SECONDS`
does not appear in any grep-visible file outside `backend/src` + tests. `sdd-tasks` must confirm the
file's format before adding the new variable. No env-preflight allowlist references
`ACCESS_TOKEN_TTL_SECONDS`, so an optional variable needs no registration.

## Technical Approach

Three surgical edits, no new abstraction:

1. **Decouple retention from grace.** `reapFamily`'s SQL is untouched — its cutoff is already the
   `graceSeconds` parameter (`SequelizeRememberTokenRepository.ts:126-137`). Only the *argument* at
   `RotateRefreshTokenUseCase.ts:52` changes, from a module constant to an injected value.
2. **Fill row 6.** `RefreshSessionUseCase.resolveGraceOrReject`'s past-grace branch
   (`RefreshSessionUseCase.ts:121-122`) calls the repository port's existing `revokeFamily`, logs
   through the existing `LoggerPort`, and returns a new outcome the controller collapses back into
   the same 401.
3. **Make room first.** `UserApiController.ts` is at 247/250, so `establishSession` moves to
   `sessionCookies.ts` before the branch is added.

The archived **D1** (rotation transaction) and **D2** (six-row lookup table) are preserved
verbatim. Only D2's row-6 *response* gains a side effect, and only **D7**'s cutoff moves.

## Architecture Decisions

### D1 — The retention constant lives in infrastructure and is injected, not imported

**Choice.** `backend/src/infrastructure/security/refreshTokenRetention.ts`:

```ts
// The reap cutoff, decoupled from the 30s grace window (proposal decision 1).
// Env-tunable: this is the no-deploy incident lever for the accepted
// false-positive risk, mirroring ACCESS_TOKEN_TTL_SECONDS (predecessor D4).
export const REFRESH_TOKEN_REAP_SECONDS = Number(process.env.REFRESH_TOKEN_REAP_SECONDS) || 24 * 60 * 60;
```

`RotateRefreshTokenUseCase` takes it as a **required** fourth constructor argument, supplied by the
composition root (`routes/api/users.ts:39`). No default parameter: the predecessor learned that "an
omittable security-relevant lifetime will eventually be omitted" (`sessionCookies.ts:54-58`).

| Option | Tradeoff | Verdict |
|---|---|---|
| Beside `REFRESH_TOKEN_GRACE_SECONDS` in `domain/entities/RefreshTokenGrace.ts`, hardcoded | Symmetric with grace and zero wiring, but forfeits the env lever the proposal's rollback plan asks for | Rejected |
| Same file, reading `process.env` | `engine.js` inspects imports only, so it would pass `architecture:check` — but it makes the domain environment-aware for the first time in this codebase, silently, to dodge one constructor argument | Rejected |
| **Infrastructure module, injected** | +1 constructor argument and one composition line; the value becomes visible at the composition root and assertable in `RotateRefreshTokenUseCase.test.ts` without importing a module constant | **Chosen** |

**Why the asymmetry with grace is correct, not sloppy.** The grace window is a *protocol* constant —
it decides an observable outcome (row 5 vs. row 6) and is written into the `refresh-token-rotation`
spec. The reap cutoff is an *operational retention* knob: it bounds detection reach and storage, and
changes no protocol decision. `RefreshTokenGrace.ts`'s own header explains it sits in `domain/` for a
mechanical reason (`backend.application.contracts` bans application→application imports) — that
reason does not apply to a value with exactly one consumer reachable from the composition root.

### D2 — New outcome `'reuse-detected'`, empty payload; rows 1–3 keep returning `'rejected'`

**Choice.** `RefreshSessionResult` gains `| { outcome: 'reuse-detected' }` — no payload.

The variant is not ceremony. `UserApiController.refresh` destructures
`const { user, familyId, familyExpiresAt } = result` immediately after the `'rejected'` guard, so
**adding a payload-free variant makes TypeScript fail the build until the controller handles it**.
Returning `'rejected'` from row 6 instead would have compiled, shipped, and left the revocation
untested at the edge.

An **empty payload is deliberate**: nothing at the HTTP boundary acts on a reuse event, and giving
the controller `familyId` would make it structurally possible for a later edit to leak family
identity into the 401 body, breaking proposal decision 4.

**Which rejections are *not* reuse.** Only `resolveGraceOrReject`'s grace-deadline branch changes.
Every other `'rejected'` return is untouched, and each for a stated reason:

| Return site | Row | Stays `'rejected'` because |
|---|---|---|
| `:68` | 1 — absent | A hash we never issued, or one already past the cutoff. No family to revoke, no signal |
| `:74` | 2 — revoked | Logout beats grace. The family is already terminal |
| `:78` | 3 — expired | Time, not theft |
| `:117` | guard | `!row.familyId` means we cannot name a family to revoke; `!row.supersededAt` means it was never rotated away |
| `:126`, `:131` | 5-adjacent | Still *inside* grace — a broken successor chain, not a replay |
| **`:121-122`** | **6** | **Changes: revoke + log + `'reuse-detected'`** |

**Naming.** `'reuse-detected'` over `'revoked'` (collides with row 2's meaning) and `'reuse'`
(ambiguous between the act and the verdict).

### D3 — `RefreshSessionUseCase` calls `revokeFamily` on the repository port it already holds

**Choice.** `await this.rememberTokenRepo.revokeFamily(row.familyId)` inside row 6.

| Option | Layering verdict (`backend/tools/architecture/engine.js:54`) | Verdict |
|---|---|---|
| Inject `RevokeRefreshTokenUseCase` | **Illegal.** `backend.application.contracts` allows an application file to import only `domain/{entities,ports,exceptions}/` and `application/dtos/`. Application→application is banned | Rejected |
| New domain port wrapping revocation, mirroring `RefreshTokenRotatorPort` | Legal, but `RefreshTokenRotatorPort` exists because rotation is a transactional orchestration the repository cannot express alone. `RevokeRefreshTokenUseCase` is a **one-line delegation** to `rememberTokenRepo.revokeFamily` — a port to reach an identical call | Rejected |
| Controller revokes | Needs `familyId` in the result payload (breaks D2), and moves a security-critical side effect into the layer already at its line cap, where a future edit can drop it | Rejected |
| **Use case calls the port directly** | `RememberTokenRepositoryPort` is a domain port, already the first constructor argument, and already declares `revokeFamily` (`RememberTokenRepositoryPort.ts:27`). Zero new wiring | **Chosen** |

**On failure, the error propagates.** No try/catch. A DB failure surfaces as a 500 rather than a
401 — a narrow, deliberate exception to decision 4's indistinguishability, on the predecessor's own
precedent (`UserApiController.ts:110-113`: "a genuine revocation failure must NOT be swallowed").
Silently returning 401 while a known-compromised family survives is strictly worse than an inference
an attacker can only draw while the database is already failing every other request too.

### D4 — Extraction: `establishSession` + `UserAuthDto` move to `sessionCookies.ts`

**Choice.** Move `UserApiController.ts:22-30` (`UserAuthDto`) and `:43-75` (`establishSession`)
verbatim into `backend/src/infrastructure/controllers/sessionCookies.ts`, converting the private
method into an exported function that takes the use case as its second argument and carries its own
`not injected` guard.

| File | Before | After |
|---|---|---|
| `UserApiController.ts` | 247 | **~208** (−43 moved/unused imports, +4 for the branch) |
| `sessionCookies.ts` | 121 | **~164** |

**Why this block.** `establishSession` is "create the RememberToken row, then issue the four session
cookies" — the exact concern `sessionCookies.ts` already owns. It already consumes three of that
module's exports (`generateRefreshToken`, `setSessionCookies`, `authMaxAge`) and touches `res` only
to set cookies; it writes no status and no body, so it is not controller work. Callers change by
zero lines: `await establishSession(res, this.createRememberTokenUseCase, userDto, remember)`.
`generateRefreshToken`, `AUTH_COOKIE` and `REFRESH_COOKIE` stay imported — `refresh` and `logout`
still use them.

**Boundary check**: `sessionCookies.ts` gains an import of `CreateRememberTokenUseCase`
(application). `engine.js:57` restricts only `backend/src/infrastructure/routes/**` to the
composition allowlist; `infrastructure/controllers/**` → application is unconstrained. ✔

**Alternatives rejected**: extracting the whole `refresh` handler (a route handler needs the
injected use case, so it would drag the constructor's shape out with it); extracting `logout`
(smaller, and it would split the two cookie-clearing paths across two files).

### D5 — TOCTOU: the detection read versus a concurrent reap

`resolveGraceOrReject` reads `findByHash` unlocked and outside any transaction
(`RefreshSessionUseCase.ts:114`, or reuses `execute`'s line-65 read), while `reapFamily` deletes
inside `RotateRefreshTokenUseCase`'s transaction. Both outcomes are safe:

| Interleaving | Result |
|---|---|
| Read sees row R → reap deletes R → `revokeFamily(familyId)` runs | **Correct.** `revokeFamily` is keyed on `family_id`, not on R. The family still dies; the deleted row was going to be deleted anyway |
| Reap deletes R → read misses → row 1 "absent" | **A missed detection**, identical to the residual gap the proposal already documents (`proposal.md:113-116`). Not a new defect |

The window can only cost a detection; it can never produce a **spurious** revocation, because
`superseded_at` is written once by `claimRotation` and never cleared — a stale read cannot turn a
current row into a superseded one.

**Practically unreachable.** For the two to race, the presented token must have been superseded
within milliseconds of the 24-hour boundary *and* another family member must rotate in that same
instant: a round-trip-latency window inside an 86,400-second span. Under today's 30-second cutoff
the reapable population is *every* past-grace row; the new cutoff shrinks it ~2880×. This change
makes the exploration's TOCTOU concern smaller, not larger.

**The genuine new concurrency risk is lock contention, not TOCTOU.** `revokeFamily` runs
un-transacted (`SequelizeRememberTokenRepository.ts:92-100`) as `UPDATE ... WHERE family_id = X AND
revoked_at IS NULL`, while a concurrent rotation holds a row lock on its claimed row and then scans
the same `family_id` index range to reap — including when the DELETE matches zero rows, since InnoDB
still locks the scanned range. Opposite lock ordering can deadlock, and detection-concurrent-with-
rotation is exactly the theft scenario. Accepted: MySQL's detector rolls one side back in
milliseconds, each side is individually atomic so no partial state is possible, and `revokeFamily`'s
`revoked_at IS NULL` predicate makes a retry idempotent. **This needs a real-DB integration test** —
it is the same class of bug that produced two invisible-to-mocks defects in this exact file.

### D6 — Logging: `logger.warn`, family-scoped, no token material

**Choice.** `LoggerPort` (`domain/ports/LoggerPort.ts`) becomes `RefreshSessionUseCase`'s fifth
constructor argument, wired to `new PinoLogger()` at the composition root — the
`AdjustProductStockUseCase` pattern verbatim, including the `(structuredObject, humanMessage)`
call shape and `warn` for a security event that is expected, actionable, and can be a false positive.

| Field | Included? | Reason |
|---|---|---|
| `event: 'refresh_token_reuse_detected'` | ✔ | Greppable, one stable class name (Okta's `detect_reuse` precedent, research Lane 4) |
| `familyId` | ✔ | The **only** actionable key: it is what an operator revokes, correlates and audits by. Required by the proposal's success criteria. Not a credential — it already travels in the access JWT's `familyId` claim, and nothing authenticates by family |
| `userId` | ✔ | Lets an operator notify the affected account. Not a credential |
| `supersededAt` (ISO) + `ageSeconds` | ✔ | The single number that separates a 31-second false positive from a 6-hour theft |
| `revokedRows` | ✔ | Confirms the action fired and states the blast radius |
| `timestamp` | ✔ | Matches `AdjustProductStockUseCase` |
| `tokenHash` / `successorHash` | ✘ | **Excluded.** Not brute-forceable, but it is the primary key of `findByHash` — a session identifier that must not leave the database into logs, which have a broader audience and a longer retention than the DB. Excluding it costs nothing: `familyId` is the actionable key |
| Refresh-token plaintext | ✘ | Never stored anywhere; would be directly impersonating material |
| `email` | ✘ | PII, and `userId` already identifies the account for anyone who can act on it |
| Source IP / user-agent | ✘ | Unavailable at this layer, and dragging `req` into the application layer to get it would break the hexagonal boundary. **Named limitation**: forensics start from `familyId`, not from a network origin. If wanted later, log it at the controller |

Revoke first, then log, so `revokedRows` is real rather than assumed. A revocation failure therefore
produces no reuse log line — but it does produce a 500 that `errorHandler` logs with a request id,
so the event is never silent (D3).

### D7 — Deploy day: nothing dies, and the lever is narrower than the proposal claims

**No migration, no schema change, no new column.** `checkPendingMigrations.js`'s `REQUIRED_SCHEMA`
and `REQUIRED_COLUMN_DEFINITIONS` are **untouched**, so **`pnpm db:migrate` is not a gate for this
deploy** — confirmed, and the direct opposite of the predecessor's PR1.

**No forced logout.** Cookies, JWT claims, token format and row shape are all unchanged. A user
holding a live `m3d_refresh` at deploy keeps hitting row 4 and rotating normally. The predecessor
killed every live session on deploy; this change kills none.

**Detection ramps in.** Rows already deleted before deploy are gone, so detection reach grows from
0 to 24 hours over the first 24 hours of uptime. An operator should not read a quiet first day as
proof the feature is inert.

**Storage.** Family size goes from ~2 rows to ≤~48 in steady state (30-minute reactive refresh
cadence × 24h), bounded and stated. The abandoned-family case — a family that stops rotating retains
its rows indefinitely because `reapFamily` only ever runs *during* a rotation — is **pre-existing**
(`exploration.md:48-55`), unchanged by this design, and registered as a named follow-up. Not
designed here.

**The env lever, precisely.** `REFRESH_TOKEN_REAP_SECONDS=30` restores the predecessor's *retention*
exactly: evidence is reaped on the next rotation, so a replay almost always lands on row 1 and gets
today's passive 401. It does **not** disable detection — a family that has not rotated since the
replay still holds its row, still hits row 6, and is still revoked. If a true kill switch is ever
needed, that is a separate flag and a separate change; do not sell this one as one.

**Rollback.** Revert the branch; there is nothing to unwind. Rows retained under the wider cutoff
are harmless and are reaped by each family's next rotation once the cutoff is back to 30s.

## Data Flow

```
POST /api/users/refresh (m3d_refresh)
        │
        ▼  findByHash  ──────────────────────────────────────────────┐
  RefreshSessionUseCase                                              │
        ├─ row 1/2/3  ─────────────────────────────▶ 'rejected'      │
        ├─ row 4  ──▶ RotateRefreshTokenUseCase                      │  same
        │              [tx: claim ─▶ insertSuccessor ─▶ reapFamily]  │  401 body
        │                                    ▲ REAP_SECONDS (86400)  │  byte-for-
        │                                      injected, was 30      │  byte
        └─ rows 5/6 ──▶ resolveGraceOrReject                         │
                   ├─ within 30s ──────────▶ 'grace'  (mutates nothing)
                   └─ past 30s   ──▶ revokeFamily(familyId)  ──▶ logger.warn
                                          (whole family)     ──▶ 'reuse-detected' ─┘
```

Family-wide `revoked_at` means every later refresh from any member — including the attacker's — hits
row 2 and is rejected.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/infrastructure/security/refreshTokenRetention.ts` | Create | `REFRESH_TOKEN_REAP_SECONDS`, env-tunable, default 86400 (D1) |
| `backend/src/application/use-cases/RotateRefreshTokenUseCase.ts` | Modify | Required 4th ctor arg `reapSeconds`; line 52 passes it; **delete** the dead `GRACE_SECONDS` export (line 14) and its now-unused import (line 6) |
| `backend/src/application/use-cases/RefreshSessionUseCase.ts` | Modify | `'reuse-detected'` in the union; 5th ctor arg `LoggerPort`; row 6 revokes + logs (D2, D3, D6) |
| `backend/src/infrastructure/controllers/sessionCookies.ts` | Modify | Receives `UserAuthDto` + `establishSession` verbatim (D4) |
| `backend/src/infrastructure/controllers/UserApiController.ts` | Modify | Extraction out; `'reuse-detected'` folded into the existing 401 branch |
| `backend/src/infrastructure/routes/api/users.ts` | Modify | `new PinoLogger()`, `REFRESH_TOKEN_REAP_SECONDS`, two constructor arguments; extend the existing `//` comment above the refresh route |
| `.env.example` | Modify | `REFRESH_TOKEN_REAP_SECONDS=86400` placeholder (verify the file's format first — unreadable from this phase) |
| `openspec/specs/refresh-token-rotation/spec.md` | Modify | Owned by `sdd-spec`, not this phase |
| 4 test files | Modify/Create | See Testing Strategy |

**Deliberately unchanged**: `SequelizeRememberTokenRepository.ts` (the reap SQL and `revokeFamily`
are both already correct), `RememberTokenRepositoryPort.ts`, `checkPendingMigrations.js`, every
migration, the OpenAPI JSDoc, and the entire frontend.

**The OpenAPI JSDoc stays untouched on purpose.** The HTTP contract is byte-identical by decision 4,
so editing the description would force an artifact regeneration and a `pnpm check:openapi` failure
risk for zero contract change. The server-side behaviour note goes in the plain `//` comment above
`router.post('/users/refresh', ...)` instead, which feeds no artifact.

## Interfaces / Contracts

```ts
// application/use-cases/RefreshSessionUseCase.ts
export type RefreshSessionResult =
  | { outcome: 'rejected' }
  // Row 6. Payload-free on purpose: the HTTP response is byte-identical to
  // 'rejected' (proposal decision 4), and withholding familyId makes leaking
  // it into the 401 body structurally impossible.
  | { outcome: 'reuse-detected' }
  | { outcome: 'grace'; user: UserDTO; familyId: string; familyExpiresAt: Date }
  | { outcome: 'rotated'; /* unchanged */ };

constructor(
  private readonly rememberTokenRepo: RememberTokenRepositoryPort,
  private readonly userRepo: UserRepositoryPort,
  private readonly tokenHasher: TokenHasherPort,
  private readonly rotateRefreshTokenUseCase: RefreshTokenRotatorPort,
  private readonly logger: LoggerPort            // NEW
) {}

// application/use-cases/RotateRefreshTokenUseCase.ts
constructor(
  private readonly uow: UnitOfWorkPort,
  private readonly rememberTokenRepo: RememberTokenRepositoryPort,
  private readonly tokenHasher: TokenHasherPort,
  private readonly reapSeconds: number           // NEW — required, no default
) {}
```

`RememberTokenRepositoryPort` is **unchanged**: `revokeFamily(familyId)` and
`reapFamily(familyId, graceSeconds, tx)` already have the signatures this design needs.

## Testing Strategy

Strict TDD: every row below is RED first.

| Layer | What to test | Approach |
|---|---|---|
| Unit | **Row 6 flip** — `RefreshSessionUseCase.test.ts:133-142`'s `expect(mockRepo.revokeFamily).not.toHaveBeenCalled()` inverts: outcome is `'reuse-detected'`, `revokeFamily` called once with `'fam-1'`, `logger.warn` called once | Jest, mocked ports |
| Unit | **Log shape** — the logged object contains `familyId`, `userId`, `ageSeconds`, `revokedRows`; and asserts it does **not** contain `tokenHash` or `successorHash` (a negative assertion, so a future field addition cannot quietly leak one) | Jest, mock `LoggerPort` |
| Unit | **Row 5 purity, unchanged** — `RefreshSessionUseCase.test.ts:105-131` must keep passing **byte-identical**. It is the regression net for the false-positive boundary | Existing test, not edited |
| Unit | **Rows 1/2/3 and the `!familyId` guard never revoke** — explicit `revokeFamily` negative assertions per row | Jest |
| Unit | **A `revokeFamily` rejection propagates** — no swallow, no `'rejected'` downgrade (D3) | Jest, repo mock rejects |
| Unit | `RotateRefreshTokenUseCase` calls `reapFamily` with the **injected** seconds, not 30 | Jest, assert on the mock's arguments |
| Unit | `UserApiController` maps `'reuse-detected'` to 401 `{ error: 'Sesión expirada' }` with **no `Set-Cookie` of either cookie**, asserted equal to the `'rejected'` case | Existing controller test suite |
| Unit | Login/register controller tests pass **unchanged** after the D4 extraction — that is the proof the move was behaviour-preserving | Existing tests, not edited |
| Integration | **The cutoff actually retains.** A row superseded 60s ago survives a rotation reap at 86400; the same row is deleted at cutoff 0. **`superseded_at` must be written with DB time (`NOW() - INTERVAL n SECOND`), never a Node `Date`** — the `NOW()`-vs-Node-clock bug hit this exact function twice and was invisible to mocks | `SequelizeRememberTokenRepository.integration.test.ts`, existing `testDb.ts` harness |
| Integration | **Round trip** — a family with a past-grace row → `revokeFamily` → every family row has `revoked_at` set → `findByHash` on any member returns a revoked row (which row 2 rejects). Mirrors the logout coverage at `:245-265` |  |
| Integration | **Contention (D5)** — `revokeFamily` concurrent with a rotation transaction on the same family resolves without partial state; a deadlock, if MySQL raises one, surfaces as an error rather than a half-revoked family. Mirrors the `claimRotation` concurrency tests at `:87-153` |  |
| Integration | **Storage bound** — after N rotations inside the cutoff the family holds N+1 rows, not 2. Pins the accepted growth so a future cutoff change is visible. Mirrors the `finalCount` assertions at `:200-211` |  |
| E2E | **None.** `refreshSingleFlight.ts:22-47` only reads `res.ok`, so the user-visible path (logout + redirect) is unchanged and already covered | — |

**Known inherited gap**: no HTTP-level test exists for `/api/users/refresh` (Engram #7158). This
change does not create that tier, so the round trip is proven at the repository and use-case layers
only.

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification or execution |
| Git repository selection | N/A — no VCS invocation |
| Commit state | N/A — no index/worktree operation |
| Push state | N/A — no ref resolution |
| PR commands | N/A — no PR automation |
| Shell / subprocess | N/A — none introduced |

The real adversarial surface is HTTP and it is first-class design above: replay past grace (D2),
response indistinguishability and its one honest exception (D3), token material in logs (D6),
detection-versus-reap concurrency (D5). Each has a mapped RED test.

## Migration / Rollout

**No migration required.** See D7 for deploy-day behaviour, the detection ramp-in, the storage
delta, the env lever's true reach, and the rollback path.

**Delivery.** One PR, per the proposal. Estimate revised **250–350 → ~310 changed lines**
(additions + deletions), still inside the 400-line budget. ~87 of those are the D4 extraction, which
is a **pure move** — land it as the first commit in the PR so a reviewer can confirm it with a
rename-aware diff and spend their attention on the ~40 lines that actually change behaviour.
`sdd-tasks` owns the guard-line forecast.

## Open Questions

None blocking. Three calls made here that `sdd-tasks` must carry forward verbatim:

- The reap constant is **injected from infrastructure**, not imported from `domain/` (D1) — this
  deviates from `proposal.md:59`'s placement, with the reason stated.
- `GRACE_SECONDS` and its import in `RotateRefreshTokenUseCase.ts` are **deleted**, not left behind
  (dead code, AGENTS.md).
- A `revokeFamily` failure **propagates as a 500**; it is never swallowed into a 401 (D3).

Named follow-up, not designed here: the sweep for abandoned families that stop rotating.
