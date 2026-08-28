# Archive Report: Cart Authority

**Change**: cart-authority  
**Archived**: 2026-08-27  
**Status**: CLOSED — PASS WITH WARNINGS, all deliverables archived  
**Verification verdict**: PASS WITH WARNINGS (17/17 spec scenarios, 0 CRITICAL findings, 40/40 tasks complete)

## Deliverables

### Implementation Summary

Five chained PRs shipped the complete cart-authority change:

| PR | Title | Scope | Merged |
|---|---|---|---|
| #70 | Pure core hydration functions | `mapServerCart`, `mergeCartItems`, `detectPriceDrift`, unit tests | ✓ |
| #71 | Async orchestration & scheduler integration | `hydrateFromServer`, `flushCartSync` signature change, `hasPendingSync`, merge-mode sync flow | ✓ |
| #72 | Page wiring & e2e regression | `CartList.astro` price-drift render, `LoginForm.astro` bounded-race merge, e2e test | ✓ |
| #74 | Verify CRITICAL closure | Closed C1 (bounded race unprotected) and C2 (replace-mode scheduler bypass) via mutation probes | ✓ |
| #75 | Remaining scenario gaps & regression | Closed C3–C6 (cart-page trigger, scope discipline, price-drift render, redirect timing) via mutation probes | ✓ |

All PRs merged to main. Final tree: `9ecb205` (commit `9ecb2058...` per verify-report).

### Verification Verdict

**PASS WITH WARNINGS** — No blockers for archive.

| Metric | Result |
|---|---|
| **Requirements** | 8/8 covered (cart-hydration: 6; nano-stores-cart: 2 ADDED) |
| **Spec scenarios** | 17/17 COMPLIANT — each with a passing test |
| **Critical findings** | 0 — all six prior CRITICAL issues (C1–C6) independently re-probed by mutation from scratch and all six mutants were killed |
| **Blockers** | 0 |
| **Tasks complete** | 40/40 (all phases 1–15 closed) |
| **Test evidence** | 144/144 unit (exit 0), 44/44 e2e (exit 0, run twice), `astro check` 0/0/0, `architecture:check` exit 0 |
| **Regression gate** | HOLDS — `CartService.test.ts` blob `067772ce…` unchanged and never committed against; pre-existing test suite green |

Full verification details in `verify-report.md` (observation-id: embedded in this archive folder).

### Specifications Merged

#### New Capability: Cart Hydration

**Action**: Created `openspec/specs/cart-hydration/spec.md` (brand new living spec)

Source: `openspec/changes/cart-authority/specs/cart-hydration/spec.md` (delta spec, treated as complete standalone spec)

**Requirements added**: 6
- Hydration Entry Point and Triggers (4 scenarios)
- Guest-to-Account Cart Merge on Login (3 scenarios)
- Cart-Page Hydration Ordering with Pending Mutations (2 scenarios)
- Server DTO to CartItem Mapping (1 scenario)
- Price-Drift Notice on Hydration (2 scenarios)
- Non-Blocking Hydration Failure (2 scenarios)

#### Enhanced: Nano Stores Cart

**Action**: Merged delta spec into `openspec/specs/nano-stores-cart/spec.md` (existing living spec)

Source: `openspec/changes/cart-authority/specs/nano-stores-cart/spec.md` (delta with 2 ADDED requirements)

**Requirements added**: 2
- Hydration Writes Bypass the Debounce Scheduler (1 scenario)
- Post-Merge Sync Reuses the Existing Scheduler (2 scenarios)

**Preservation**: All 5 pre-existing requirements (Client-side Cart State, Asynchronous Non-blocking Sync, CamelCase API Payloads, Reactive Header Cart Badge) remain unchanged. Delta merged additively without modification to existing content.

## Scope Discipline

### Files Changed (Design Adherence)

All changed files match the design's File Changes table:

| File | Touched? | Status |
|---|---|---|
| `cartHydration.ts` | Yes | Created, 189 lines (under 250-line cap) |
| `cartHydration.test.ts` | Yes | Created, 560 lines (test/spec exempt) |
| `cartSync.ts` | Yes | +19/-6 (includes `flushCartSync()` signature change, see W5) |
| `CartService.ts` | Yes | +10/-1 |
| `CartList.astro` | Yes | +31 |
| `LoginForm.astro` | Yes | +21/-2 |
| `e2e/tests/cart.spec.ts` | Yes | +239 |
| `.gitignore` | Yes | +4 (incidental, see S1) |
| `e2e/test-results/.last-run.json` | Yes | -4 (incidental, see S1) |
| Backend files | No | Verified: `git diff --name-only 5a82607..HEAD \| rg '^backend/'` returns nothing |

**Out-of-scope guarantees held**:
- Checkout/order redesign — not touched
- Cross-tab / focus / session-changed re-hydration — not touched
- Anonymous/guest server-side carts (schema migration) — not touched
- Backend concurrency control — zero backend files touched
- Merge confirmation modal — merge stays silent; only drift renders a notice

## Carried-Forward Warnings

The following non-blocking warnings from the verify-report are permanently accepted and not re-litigated at archive:

### W1 — No `apply-progress` artifact

Engram MCP tool was uncallable throughout this session (tool-name mismatch: `mcp__plugin_engram_engram__*` vs `mcp__engram__*`). The Strict-TDD "TDD Cycle Evidence" table could not be validated as written. However, TDD outcomes were re-derived directly from the test files, git history, and the five PR commits. Every RED-marked task has a confirmed, passing test.

**Resolution**: Accepted — TDD evidence is present in code and test runtime, not in an intermediate artifact. Not a defect in delivered behavior.

### W3 — `.auth/user.json` fixture staleness on standalone file runs

Pre-existing, unrelated to this change. Does not occur in the full-suite run order used for this report's evidence (44/44 e2e tests).

**Resolution**: Pre-existing — cleared by prior A/B testing. Carried forward as noted.

### W4 — `auth.spec.ts` is load-sensitive

Pre-existing, unrelated, and cleared by prior A/B testing. Green in both full-suite runs performed for the verify report.

**Resolution**: Pre-existing — not caused by this change. Carried forward as noted.

### W5 — Undocumented design deviation in `cartSync.ts`

**Issue**: design.md specifies `cartSync.ts` as "Additive only: `hasPendingSync()` (3 lines). No existing line changes", but `flushCartSync()`'s signature was also changed from `void` to `Promise<void>` (lines 143–155).

**Why correct**: Spec scenario 8 requires "hydration MUST read server state only after that flush resolves", which is unimplementable against a `void` return. `cartHydration.ts:129` awaits the return value. Every pre-existing caller (pagehide/hidden-tab listeners, `checkout()`, debounce/max-wait timers) already ignored the return, which the 36 unmodified `CartService.test.ts` assertions confirm still holds.

**Resolution**: This is a documentation gap in design.md, not a behavioral defect. The change is correct and spec-required. The 36 pre-existing CartService tests green confirms zero caller breakage.

## Additional Notes

### S1 — Two incidental build-artifact files outside design

`.gitignore` gained `e2e/test-results/` (+4 lines, with rationale comment) and the previously-tracked `e2e/test-results/.last-run.json` was deleted (−4 lines). Both are build-artifact hygiene with zero runtime effect. Neither was declared in design.md's File Changes table.

**Impact**: Informational only — no defect.

### S3 — GitHub issue #73 (`.cart__item-details` CSS overlap)

Issue #73 (`.cart__item-details` CSS overlap) was filed during this cycle but is confirmed unrelated: that CSS rule was never touched by any cart-authority commit. Tracked separately as a follow-up work item, NOT part of this change's deliverables or scope.

**Status**: Separate follow-up; not blocking archive.

### S4 — Cross-navigation race (pagehide PUT vs cart-page GET)

The race between a `pagehide`-triggered PUT and the cart-page GET is documented in design.md's "Resolved" section as an accepted, client-unsolvable risk. Correctly not asserted on by any e2e test. No action required.

## Archive Contents Manifest

- ✓ `archive-report.md` (this file)
- ✓ `proposal.md` (original proposal)
- ✓ `explore.md` (exploration notes)
- ✓ `design.md` (design decisions)
- ✓ `tasks.md` (40/40 tasks complete)
- ✓ `verify-report.md` (PASS WITH WARNINGS, 17/17 scenarios, 0 CRITICAL)
- ✓ `specs/cart-hydration/spec.md` (new capability, 6 requirements)
- ✓ `specs/nano-stores-cart/spec.md` (existing spec + 2 ADDED requirements)

## Source of Truth Updated

The following living specs in `openspec/specs/` now reflect the behavior shipped by cart-authority:

- `openspec/specs/cart-hydration/spec.md` — new living spec, 6 requirements, 14 scenarios
- `openspec/specs/nano-stores-cart/spec.md` — enhanced with 2 ADDED requirements (3 new scenarios), 5 pre-existing requirements preserved

## SDD Cycle Status

**COMPLETE AND CLOSED**

- Explore: ✓ (exploration.md)
- Propose: ✓ (proposal.md)
- Spec: ✓ (specs/cart-hydration, specs/nano-stores-cart)
- Design: ✓ (design.md)
- Tasks: ✓ (tasks.md, 40/40 complete)
- Apply: ✓ (5 chained PRs, all merged)
- Verify: ✓ (PASS WITH WARNINGS, 0 CRITICAL, all findings addressed or carried as accepted)
- Archive: ✓ (this report)

Ready for the next change.
