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
- L3 — CI turned the chain red for two real reasons, both in real-DB suites the unit suite cannot cover. (a) `migrate.integration.test.js` fixed its applied-migration list before the slot migration existed; it now knows `20261026000000-demo-sandbox-slots.js`, drops `DemoSandboxSlot` in teardown and reverts six times in order (`01da75a`). (b) `SequelizeShoppingCartRepository.integration.test.ts` passed a raw Sequelize transaction to a repository that now requires scoped ownership; it runs inside `withScopedTransaction` (`4b7949d`). CI disproved the first placement of (b): it was committed on S3, but S1 already fails the same test, because the ownership guard is born with the scoped repositories, not with the later hardening. The fix moved to S1 and was propagated additively to S3–S6 (`87f1557`, `503ed42`, `8280513`, `bb65d22`), so every slice is green on its own without rewriting published history. Verified on the real CI runs: Real-DB integration tests pass on #189 and #191, End-to-end passes on every PR, and Quality fails only on the dependency audit.
- L4 — The audit failure is upstream drift, not sandbox code: the `qs` override added earlier said `6.16.0` was the fix, and advisory GHSA-6pq8-jhm2-2vcw later moved the floor to `6.16.1`. PR #195 (`b43b333`) raises the override to `^6.16.1` (resolved `6.17.1`, published 2026-10-14, so it clears the release-age policy without an exclusion). Three advisories remain, reported here instead of silently accepted. `glob` (installed 7/10/11, fix only in `14.0.2`) and `minimatch` (installed 9/10, 3.x unaffected, fix only in `11.0.1`) both require major jumps inside `jest`. `deepmerge` surfaced after the `qs` fix and cannot be closed at all: the advisory asks for `>=4.3.2` and that version does not exist on the registry (latest published is `4.3.1`, from 2023). All three reach the tree only through `jest`, never through production code, so the Quality check stays red for reasons outside this chain; `pnpm audit --prod` passing is a separate question from the full-tree gate the repository deliberately built.
- L5 — Operational incident, recorded because it could have silently corrupted the chain: the `qs` bump was left uncommitted when the working tree moved to another branch, and appeared as modifications on `feat/sandbox-s6-reader-coordinator`. It was recovered with `git stash` and restored to `fix/audit-qs-advisory` before any commit, so no sandbox slice ever carried a dependency change. Lesson: commit or stash a cross-cutting change before switching branches in a stacked chain.
- L6 — Three separate CI failures turned out to be the same mistake, and the third one is worth writing down as a rule. Measured outcome first: all six child PRs now report four green checks each (`#189`–`#194`, 4/4 SUCCESS), after `main` received the two-tier audit gate. The recurring defect: a commit that *aligns tests with a guard* was written after the commit that introduced the guard, so slicing by area left it in a later slice than the code that broke. The chain showed it three times — the real-DB migration list (S1), the shopping-cart lock-leak fixture (born in S1, sat in S3), and the transaction fixtures (born in S3, sat in S5, reproduced locally as 27/32 in S3). Rule for the next chain: when a guard change and its fixture alignment exist as separate commits, they belong to the same slice, and each slice must be proven green on its own branch before the next one is built. Publishing lesson: the fix moved forward additively (`git cherry-pick` onto each affected branch, fast-forward push) instead of rewriting published history, which kept every existing review link valid.
- L7 — The audit gate was split in two tiers and landed on `main` as PR #196 (`5c646f5`, with the `qs` bump `87d76da` underneath). Blocking: `pnpm audit --prod`, the tree that ships. Reported, never blocking: the full tree, so tooling advisories stay visible. PR #195 was closed as superseded rather than merged red, because its branch could not be green while it carried the old gate and the repository cannot fix `deepmerge` at all (advisory wants `>=4.3.2`; the registry's newest release is `4.3.1`). CI numbers from the runs that proved it: the gate script's own suite 10/10, the dispatched script exiting 0 on a clean production tree while reporting the three tooling advisories, and the backend suite at 1502 tests on the final slice.
