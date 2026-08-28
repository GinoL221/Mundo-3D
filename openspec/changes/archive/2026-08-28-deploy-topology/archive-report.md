# Archive Report: deploy-topology

**Change**: `deploy-topology`
**Capability**: `deploy-pipeline-foundations` (new)
**Archived on**: 2026-08-28
**Archived to**: `openspec/changes/archive/2026-08-28-deploy-topology/`
**Artifact store**: hybrid (OpenSpec files authoritative, Engram topics mirrored)
**Status at close**: CLOSED — PASS WITH WARNINGS

## Review Gate

`reviewGate` is structurally absent for this candidate: receipt-driven development is off in this
project, so no review ever ran and no receipt exists to validate. Archive proceeded under ordinary
repository policy. Absence is not a defect and was not treated as one.

## What Shipped

Platform-agnostic deploy pipeline scripting — tooling only. No change to boot, shutdown, migration,
or API runtime behavior; `runtime-resilience` and `schema-migrations` boot contracts stayed locked.

| Artifact | Description |
|---|---|
| `scripts/deploy/env-preflight.js` | Fails fast before app boot when any of the 8 required production vars is unset (`JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `PUBLIC_API_URL`); `COOKIE_DOMAIN` is warn-only, matching `cookieOptions.ts` |
| `scripts/deploy/smoke-test.js` | Polls `GET /health/live` then `GET /health/ready` against a target URL, 1s interval, 60s default timeout (`SMOKE_TEST_BASE_URL` / `SMOKE_TEST_TIMEOUT_MS`), exits non-zero if readiness never latches |
| `scripts/deploy/migrate-and-start.js` | Blocking `db:migrate` via `spawnSync`, then `start`; a non-zero, signal-killed, or never-spawned migration structurally blocks `start`. Fixed argv, `shell: false`, cwd-independent, whole-process-group signal forwarding |
| `backend/src/__tests__/deploy-migrate-and-start.integration.test.js` | Real-MySQL integration test on a dedicated scratch DB (`mundo_3d_migrate_scratch`) |
| `scripts/deploy/*.test.js` (3 files) | 18 `node --test` unit tests |
| `backend/package.json` | `deploy:env-preflight`, `deploy:smoke-test`, `deploy:migrate-and-start` aliases |
| root `package.json` | `test:deploy-scripts` glob alias |
| `docs/RUNBOOKS.md` | `## Deploy Pipeline` section (line 74) documenting all three scripts plus the expand/contract migration-authoring note, explicitly disclaiming enforcement |
| `backend/src/database/checkPendingMigrations.js` | Modified — tolerates MySQL 8.0.19+ integer display-width deprecation; 2 targeted new cases added |

Delivered as two chained PRs: PR #76 (`0e28588`, env-preflight + smoke-test) and PR #77 (squash-merged
as `2cf5f64`, migrate-and-start + integration test + docs), with five follow-on CI-hardening commits on
PR #77.

## Verification Verdict

**PASS WITH WARNINGS** — 0 blockers, 0 CRITICAL, 5 WARNING, 6 SUGGESTION.
Source: `verify-report` Engram #6743, run 2026-08-28 against `main` @ `2cf5f64`, working tree clean.

- Tasks: 27/27 implementation tasks complete, each independently confirmed against the actual files
  (not merely checkbox state). The archived `tasks.md` carries 29 checked boxes and 0 unchecked; no
  stale-checkbox reconciliation was needed or performed.
- Requirements/scenarios: 4/4 requirements, 10/10 scenarios COMPLIANT, 0 UNTESTED, 0 FAILING.
- Tests executed fresh at verification: 18/18 `node --test` unit, 14/14 real-MySQL 8.0.46 integration,
  673 backend + 144 frontend root regression, lint clean, `tsc` build clean.
- Coverage for `scripts/deploy/`: 84.55% line / 90.91% branch; every uncovered range is a
  `require.main === module` CLI guard, each exercised manually at verification time.

### Open warnings at close — deferred by explicit user decision

The user explicitly deferred all five warnings to a follow-up change and does not want them
re-litigated as archive blockers. They are recorded here as known, accepted, open items — none
contradicts a spec requirement.

| ID | Warning | State at close |
|---|---|---|
| W1 | No `apply-progress` artifact for Work Unit B (only PR1's, Engram #6656) | Open — bookkeeping gap; every Unit B claim was independently re-verified by running the tests |
| W2 | No "TDD Cycle Evidence" table in either `apply-progress` artifact | Open — evidence exists in prose/`tasks.md` form and was corroborated |
| W3 | `test:deploy-scripts` is not wired into CI | Open — the 18 unit tests that are the sole runtime evidence for 7 of 10 scenarios do not run on any PR; design.md Open Question #1 was dropped rather than resolved |
| W4 | `design.md` is stale relative to shipped code (signal handling, `exitCodeFrom`, File Changes table) | Open — the archived `design.md` is preserved as written; the divergences are documented in `verify-report` instead |
| W5 | CLI guards have no automated regression test | Open — behavior confirmed manually at verification; unguarded against future regression |

Six SUGGESTION items (S1–S6: `scripts/deploy/` outside ESLint scope, loose smoke-test timeout bound,
split R2.3 coverage, one implementation-detail assertion, a `node --test` coverage tool defect, one
mock-heavy test) also remain open and deferred.

### Divergences from plan — improvements, not defects

Five commits landed on PR #77 after `tasks.md` was written, during a real CI investigation. Per
`verify-report` #6743 they make the implementation more spec-compliant than planned:

1. `250e141` — integration test moved to a dedicated scratch DB, fixing a genuine pre-existing
   collision between `testDb.ts`'s `sequelize.sync()` and the baseline migration's `CREATE TABLE`.
2. `302770b` — `--detectOpenHandles` plus a CI step timeout.
3. `b6b724c` — `exitCodeFrom(code, signal)` closed a real correctness hole: a signal-killed child
   reported `code === null`, which reset `process.exitCode` to unset and made the wrapper exit 0 for a
   torn-down deploy. Now mapped shell-style to `128 + signal`, directly strengthening R1.2.
4. `4124300` → `7d63e78` — `start` child is `detached: true` with whole-group signalling; the original
   design's forward-to-immediate-child was insufficient because that child is `pnpm`, not the server.
5. `7df4b2e` — doc note on the Jest integration config interaction.

Net effect on counts: 18 unit tests exist where `tasks.md` predicted 13; `migrate-and-start.js` is 82
lines where task 8.4 recorded 52 (still far under the 250-line cap).

## Out of Scope — platform provisioning is a separate, not-yet-started change

This SDD cycle covered **pipeline scripting only, not deployment infrastructure**. No VM, PaaS,
container host, managed database, or CD job was provisioned, configured, or wired up by this change.
The repository still has no Dockerfile, Procfile, platform config file, or deploy job in
`.github/workflows/ci.yml`.

`proposal.md`'s own "Decisions (resolved 2026-08-28 — for the platform-specific follow-up, not this
slice)" section settles the baseline for that future change without executing any of it:

1. **Deploy platform**: PaaS with a persistent-volume tier (Railway/Render/Fly.io-class) — chosen on
   paper, not provisioned.
2. **Uploads storage**: stay on local disk; requires the PaaS persistent-volume tier.
3. **MySQL hosting**: a managed MySQL service (typically the PaaS DB add-on) — not procured.
4. **Migration rollback policy**: expand/contract discipline as manual authoring guidance, documented
   in RUNBOOKS; nothing in `migrate.js` / `checkPendingMigrations.js` enforces it.

Actually choosing, provisioning, and configuring a host — and wiring a CD job that invokes these
scripts — remains a separate future SDD change that has not been started.

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| `deploy-pipeline-foundations` | Created | New capability — no prior main spec existed. 4 requirements / 10 scenarios added, 0 modified, 0 removed. Non-destructive; the `rules.archive` "warn before merging destructive deltas" guard did not trigger. |

Source of truth now at `openspec/specs/deploy-pipeline-foundations/spec.md` (81 lines, byte-identical
to the delta).

## Mechanical Copy Verification

Both operations used shell-only mechanisms with `diff -r` readback; both diffs were empty.

- Spec sync: `cp` to a temp file in the target dir, `diff -r` (empty, exit 0), then `mv` into place;
  final source-vs-target `diff -r` also empty (exit 0).
- Archive move: recursive pre-move snapshot via `cp -R`, `git mv` of the change folder, source
  confirmed gone, `diff -r` snapshot vs. archived tree empty (exit 0).

## Traceability — Engram Observation IDs

| Artifact | Topic key | Observation |
|---|---|---|
| Proposal | `sdd/deploy-topology/proposal` | #6645 |
| Platform decisions | (decision) | #6649 |
| Spec | `sdd/deploy-topology/spec` | #6651 |
| Design | `sdd/deploy-topology/design` | #6652 |
| Tasks | `sdd/deploy-topology/tasks` | #6655 |
| Apply progress (Work Unit A only) | `sdd/deploy-topology/apply-progress` | #6656 |
| Verify report | `sdd/deploy-topology/verify-report` | #6743 |
| Archive report | `sdd/deploy-topology/archive-report` | this document |

## Archive Contents

- `proposal.md`
- `explore.md`
- `design.md`
- `tasks.md` (29/29 checked, 0 unchecked)
- `specs/deploy-pipeline-foundations/spec.md`
- `verify-report.md`
- `archive-report.md` (this file, additive at archive time)

## SDD Cycle Complete

`deploy-topology` is planned, implemented, verified, and archived. The five warnings and six
suggestions above are open and deferred to a follow-up by explicit user decision; they are not
blockers and were not treated as such. Platform provisioning remains a separate, not-yet-started
future change.
