# Demo sandbox Stage 1 — bounded pool and leases
Repository worktree: `Mundo-3D-worktrees/demo-sandbox-stage1`; branch `feat/demo-sandbox-stage1`; base `9cf7195`.
Status: local implementation authorized; no deployment, remote changes, or live database access is authorized.

## Specs

### S1 — Safe demo exploration
> “Safe exploration: use fictitious data, backend-enforced permissions and usage limits, isolation between visitors, and a recoverable demo state. Shared credentials that let visitors interfere with one another are not an acceptable shortcut.”

Stage 1 implements only the bounded pool and lease lifecycle foundation. It must not claim that business data is isolated before the later per-slot connection and authorization stages are implemented and verified.

Approved Stage 1 crash-recovery policy, following the user’s confirmation “bien, hacemos eso entonces”: recovery is operator-mediated, not automatic. It requires explicit confirmation that the previous reset worker terminated, establishes a new durable reset-attempt fencing token, reruns reset and verification, and releases the slot only if the current attempt still owns the fence and verification succeeds; failure keeps the slot quarantined. This remains an internal use case, not a public endpoint.

### S2 — Delivery order
> “Buyer interaction is the first delivery priority; public STAFF interaction follows only when its isolation and backend restrictions are verified.”

### S3 — User-selected stage boundary
> “Separar por etapas”
>
> Accepted option description: “Etapa 1: pool acotado y ciclo de leases sobre espacios preconfigurados; dejar creación de esquemas/cuentas y conexión por espacio para la Etapa 2.”

### S4 — No implied deployment or database authorization
> “These criteria do not authorize deployment or database changes.”

This task authorizes local source and test changes only. It does not authorize connecting to, migrating, or mutating any existing database. Any MySQL test requires a separately confirmed exact disposable host and schema.

## Tasks

- [x] T1 — S1, S3: Implement the bounded slot/lease lifecycle policy and deterministic tests using fake time and fake ports; route: inline; commit: not authorized unless explicitly requested.
- [x] T2 — S1, S3: Add durable, concurrency-safe control-plane persistence and migration for configured slots/leases, without provisioning sandbox schemas/accounts or routing business requests; route: inline; commit: not authorized unless explicitly requested.
- [x] T3 — S1–S4: Run final DB-independent checks, obtain independent high-risk verification of the recovery fix, and report what remains unverified; route: parent + `gentle-ai-verify`; commit: not authorized unless explicitly requested.
- [x] T4 — S1, S3: Add internal operator-mediated recovery for interrupted resets with durable attempt fencing, confirmation that the previous worker stopped, reset/verification before release, and deterministic tests; route: inline; commit: not authorized unless explicitly requested.

## Log

- L1 — User request, verbatim: “ahora si podemos retomar con el plan”.
- L2 — User authorization, verbatim: “si autorizo”. It followed the explicit request to begin local Stage 1 implementation and tests without deployment, publication, or modification of existing databases; MySQL tests require prior confirmation of the exact disposable host and schema.
- L3 — User-selected boundary: “Separar por etapas”; Stage 1 is the bounded pool and lease lifecycle over preconfigured slots; schema/account provisioning and per-slot database connections are deferred to Stage 2.
- L4 — Exploration evidence: the current backend initializes one environment-selected Sequelize instance (`backend/src/database/models/index.js:4-11, 87-90`); existing refresh-family revocation does not itself revoke already-issued access JWTs (`backend/src/infrastructure/controllers/UserApiController.ts:62-123`). A lease record alone is not proof of visitor-data isolation.
- L5 — Test and safety boundary: migration-shape tests can stub Sequelize's query interface, and lifecycle tests can use fake ports/time. These do not prove MySQL transaction behavior, database grants, reset, or isolation. No `.env`, database, service, deployment, or remote state was inspected or changed.
- L6 — Workspace decision: primary worktree `/home/ginopc/Desarrollo/Mundo-3D` has 46 changed/untracked paths and remains untouched by this feature. Implementation worktree is `/home/ginopc/Desarrollo/Mundo-3D-worktrees/demo-sandbox-stage1`, based on `9cf7195`.
- L7 — T1 verification: wrote five deterministic tests and observed RED because the entity did not exist. The first implementation run exposed an invalid test timeline (activity was attempted after the 20-minute idle deadline); corrected the fixture to exercise activity at minutes 15, 34, and 53. The focused suite then passed: 5 tests, 1 suite. No database was used.
- L8 — T2 verification: added control-plane migration/model, configured-slot filtering, transactional `FOR UPDATE` lease claims and expiry transitions, and reset/quarantine use cases. All four new suites passed: 20 tests. Backend TypeScript `tsc --noEmit` and targeted ESLint passed. `pnpm exec` was attempted once but aborted before tests with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` while trying to auto-install; no install/removal occurred. Reused existing dependencies through direct Node/Jest and compiler commands. No MySQL, schema provisioning, per-slot business routing, or deployment was performed.
- L9 — Architecture check found four new boundary violations: three application use cases imported runtime ports from `application/ports`, and the database model imported domain types. It also reported seven commission-route `composition.allowlist` violations in unchanged files. T2 was reopened to correct the four new violations.
- L10 — Corrected the boundaries by moving runtime contracts to `domain/ports` and making the database record attributes independent of domain types. Post-fix, the architecture check reports only the same seven commission-route violations in an unchanged path and still exits 1. Post-fix focused tests pass 20/20; backend `tsc --noEmit` and targeted ESLint pass. Full DB-independent backend Jest suite passed 1193/1193 before the import-only boundary correction. T2 is complete; T3 remains open for independent verification and honest reporting of the baseline architecture failure and unrun MySQL proof.
- L11 — Started T3 after T2’s post-fix focused tests, type-check, and lint completed. Independent high-risk verification is pending; no MySQL test is authorized.
- L12 — Independent verifier `mvoti6f5-2k-o1d6` read the complete task and all 15 candidate files. S2–S4 pass for the scoped Stage 1 boundary; S1 is partial due to a P2 lifecycle liveness/recovery gap: a crash after `beginReset` leaves the row `resetting`; the reset use case cannot retry it and expiry scans only `leased`. The slot remains fail-closed, so this is not a visitor-isolation failure. The verifier did not execute tests/build/lint because its exact test-command authorization request timed out; it made no DB/service/.env or remote access. MySQL contention/rollback and production ID generation remain unverified.
- L13 — User clarification, verbatim: “Review clarification: durable recovery hole is specifically supplied orchestration: once a process dies after `beginReset`, re-executing ResetDemoSandboxSlotUseCase returns `not_resettable`; expiry never returns resetting or previously-draining rows. Lower-level `completeReset`/`quarantine` can still act if an external operator already knows the lease. Will distinguish lifecycle liveness/recovery gap from isolation/safety (slot stays fail-closed). Awaiting explicit exact focused-Jest command authorization; no test/build/lint run yet.”
- L14 — T3 was blocked pending the user’s recovery-policy decision.
- L15 — User decision, verbatim: “bien, hacemos eso entonces”. The user accepted the immediately preceding recommendation: operator-mediated recovery with fencing, no automatic retries, and no public endpoint.
- L16 — Added T4 for the approved recovery implementation. T3 is pending until T4 is implemented and checked; no database, deployment, or delivery authorization changed.
- L17 — T4 adds a persisted UUID `reset_attempt_id`, a unique index, compare-and-swap recovery from `resetting` using the expected old attempt id, and a new attempt token. The use case requires explicit operator confirmation that the previous worker stopped; reset, verify, completion, and quarantine are fenced by the current token. RED was observed before implementation. Latest focused checks pass: 6 suites/24 tests, `tsc --noEmit`, targeted ESLint, and Prettier check. The full DB-independent backend suite passed 159 suites/1197 tests before formatting-only changes. Architecture check still exits 1 on eight unchanged commission-route findings; LSP reported hints/warnings only, no errors. No DB/service/.env or remote access.
- L18 — T4 is complete; T3 is now in progress for independent high-risk verification and final limits reporting. MySQL contention/rollback remains unverified and unauthorized. No commit was made or authorized.
- L19 — Native RDD assess returned risk `unassessable` because the candidate consists of intended untracked files. Inspect requires a provider-issued intended-untracked path selection before START; no paths were selected and no review START occurred. Independent verification proceeds separately.
- L20 — Independent verifier `mvougux8-2l-xwdg` read the full task and ran the authorized focused suite: 6 suites/24 tests passed. It approved the operator-recovery contract at source/mock-test level (S1 partial only for deferred visitor isolation; S2–S4 pass) and found no recovery safety defect. It identified two candidate source files violating `AGENTS.md:6`’s 250-line maximum: `DemoSandboxSlot.ts` (281 lines) and `SequelizeDemoSandboxSlotRepository.ts` (251 lines). Real MySQL behavior and external reset-adapter fencing remain unverified.
- L21 — Temporarily reopened T4 based on the verifier’s reported line-limit finding; no source refactor was made pending confirmation against the current project rules.
- L22 — User corrected that the 250-line limit had already been removed. Confirmed the current primary checkout’s modified `AGENTS.md` has no line-count limit, while the Stage 1 worktree at older base `9cf7195` still contains a stale copy of that rule. The verifier’s two line-count findings are therefore not applicable; no refactor is needed. T4 remains complete.
- L23 — Final DB-independent focused tests and independent source/mock-test review are complete: 6 suites/24 tests passed; the recovery contract passed with no safety defect. The full backend suite previously passed 159 suites/1197 tests; type-check, targeted ESLint, and Prettier passed. The architecture checker still exits 1 for eight unchanged commission-route findings. Real MySQL behavior and external reset-adapter fencing remain unverified and unauthorized. Native review inspect still requires human selection of intended untracked paths; no START or review capture occurred.
- L24 — With the user's authorization, synchronized the Stage 1 worktree's `AGENTS.md` to the current primary checkout version. This removes the stale 250-line rule and updates the worktree's project guidance. The primary checkout was not modified by this sync.
- L25 — After the user selected all 17 intended untracked paths, native review covered those plus `AGENTS.md` (18 changed paths), medium tier, one reliability lens. The final reviewer approved; its only surfaced advisory was informational warning R3-001 at `backend/src/domain/entities/DemoSandboxSlot.ts:177–181`, with no correction route. The exact acknowledgement completed successfully and burned review authority. Delivery remains governed by ordinary repository policy; no commit or push was made.
