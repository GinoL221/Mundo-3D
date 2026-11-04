# Demo Sandbox Stage 2 — chained delivery tracker

Draft/no-merge tracker for the Stage 2 sandbox work. Each child PR delivers one
cohesive slice and targets the slice before it; this tracker merges to `main`
only after every slice is reviewed and integrated.

## Specs

- S1. The sandbox must keep per-slot connections, repositories and auth isolated; nothing in this chain may expose the components to visitor traffic.
- S2. Every slice must land with its own tests and docs, keep the full backend suite green, and pass TypeScript, ESLint and the architecture check.
- S3. No slice may create schemas, run migrations against a real server, or add a route: real-MySQL verification stays opt-in and disposable.
- S4. Running the release coordinator requires a coordinator principal that is still undesigned and unauthorised; no slice may assume it exists.

## Slices

| # | Scope | Commits | Size | PR |
| --- | --- | --- | --- | --- |
| S1 | Slot model, migration, scoped connections and repositories | 4 | ~6.1k | #189 |
| S2 | Refresh-token MySQL verification and per-slot auth composition | 3 | ~1.9k | #190 |
| S3 | Leases, expiry and token binding | 6 | ~0.8k | #191 |
| S4 | Fencing, reset orchestration and reset receipts | 7 | ~1.9k | #192 |
| S5 | Release seam, durable record and uncertain-release reconciliation | 16 | ~1.2k | #193 |
| S6 | Authoritative reader, session identity and release coordinator | 20 | ~1.9k | #194 |

Every slice exceeds the 400-line review budget; the split is by cohesive work
unit and dependency order, not by size. Reviewers should treat the chain as
one feature reviewed in six passes.

## Log

- L1 — User request: integrate the accumulated sandbox branch as chained PRs with a tracker, after reconciling with `origin/main` (61 upstream commits were missing and the branch duplicated already-merged commission work).
- L2 — Reconciled onto `origin/main` on a fresh branch by replaying only the sandbox range; the duplicated commission commits were dropped. One conflict (a commission repository replaced by a scoped wrapper) resolved in favour of the scoped architecture. Tracker opened as draft PR #188 and six child PRs #189–#194, each targeting the slice before it. Full backend suite 1502 green on the final slice; nothing merged and nothing routed.
