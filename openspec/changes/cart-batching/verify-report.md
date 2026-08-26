```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:6a0c1868339d49337388abc6cbd602bf4140a1df1e48441caa4cd8ad4afab75e
verdict: fail
blockers: 1
critical_findings: 1
requirements: 0/1
scenarios: 8/9
test_command: cd frontend && npx vitest run CartService
test_exit_code: 0
test_output_hash: sha256:b0dd809b934b213f59ffa9762f5102224300fe045a99421aa6836e16ce374534
build_command: pnpm --filter frontend check
build_exit_code: 0
build_output_hash: sha256:63ae6654ddc1c8632f8438298e04beb9105389ec1487b2ae059031c647915543
```

## Verification Report

**Change**: cart-batching
**Version**: delta spec `nano-stores-cart` (1 MODIFIED requirement, 9 scenarios)
**Mode**: Strict TDD
**Scope verified**: Work Units A + B combined (`main...HEAD`, branch `feat/cart-batching-2-debounce-scheduler`)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 33 (A1.1–A4.4 = 8, B5.1–B11.6 = 25) |
| Tasks complete | 33 |
| Tasks incomplete | 0 |

All 33 checkboxes in `openspec/changes/cart-batching/tasks.md` are `[x]`. Each was independently
corroborated against code or command output rather than accepted from the checklist.

### Build & Tests Execution

**Build**: PASSED — `pnpm --filter frontend check` (`astro check`), exit 0

```text
Result (49 files):
- 0 errors
- 0 warnings
- 0 hints
```

**Tests**: PASSED — `cd frontend && npx vitest run CartService`, exit 0

```text
Test Files  1 passed (1)
     Tests  36 passed (36)
  Duration  309ms
```

**Full workspace** (`pnpm test` = `pnpm --filter "!e2e" test`), exit 0:

```text
frontend: Test Files  8 passed (8) | Tests  112 passed (112)
backend:  Test Suites: 90 passed, 90 total | Tests: 665 passed, 665 total
```

**Architecture**: `cd backend && npm run architecture:check`, exit 0, zero violations.
The `frontend.domain.locality` rule (`backend/tools/architecture/engine.js:56`) constrains
`frontend/src/domains/*` imports to their own domain plus `frontend/src/config.ts`. All three
cart modules import only from `./cartState`, `./cartSync`, and `../../../config`, so the rule is
genuinely exercised and satisfied — not vacuously green.

**Coverage**: Not available — no coverage tool configured for the frontend vitest project.

### Spec Compliance Matrix

| # | Scenario | Covering test | Result |
|---|----------|---------------|--------|
| 1 | Rapid mutations coalesce into a single PUT | `CartService.test.ts` > `coalesces rapid mutations into a single PUT carrying the last state of the burst` (L458) | COMPLIANT |
| 2 | Sustained mutations still flush via the max-wait cap | `flushes via the max-wait cap when mutations never leave a quiet window` (L503) | PARTIAL |
| 3 | `checkout()` forces an immediate flush before returning | `dispatches the sync flush synchronously, before checkout() returns` (L615) | COMPLIANT |
| 4 | Page hide forces an immediate flush | `flushes immediately when pagehide fires, bypassing the remaining debounce window` (L531) | COMPLIANT |
| 5 | Tab becoming hidden forces an immediate flush | `flushes when the tab becomes hidden, but not while it stays visible` (L547) | COMPLIANT |
| 6 | A failed flush rolls back to the state before the burst's FIRST mutation | (none found) | UNTESTED |
| 7 | Every flush preserves keepalive and no-rollback-on-thrown-fetch | `sends the cart sync request...` (L279, `keepalive === true`), `coalesces rapid mutations...` (L481), `does NOT roll back local cart state when fetch itself throws` (L315) | COMPLIANT |
| 8 | A stale flush failure does not roll back a newer confirmed flush | `does not let a late-arriving failed sync roll back state that a newer sync already confirmed` (L379) and `...a DIFFERENT newer mutation` (L422) | COMPLIANT |
| 9 | `cart-updated` still fires once per mutation, not once per flush | `dispatches cart-updated once per mutation, independent of the coalesced network flush` (L484) | COMPLIANT |

**Compliance summary**: 8/9 scenarios compliant (1 of those PARTIAL), 1 UNTESTED.

#### Scenario 6 — mutation-probe evidence

The implementation at `cartSync.ts:108-113` is correct: `burstPreviousItems` is assigned only
inside `if (burstPreviousItems === null)`, so the burst's first baseline is captured once and
never overwritten. But no test distinguishes that from the violating alternative.

An isolated mutant was applied that left the `null` sentinel and the max-wait arming untouched and
only appended `burstPreviousItems = previousItems;` at the end of `scheduleSync` — precisely the
behavior the scenario's second THEN clause forbids ("MUST NOT roll back to the state before only
the burst's last mutation"). The full suite still reported **36 passed (36)**. The working tree was
restored immediately (`git status --porcelain` clean).

Root cause: every rollback-asserting test uses a burst of exactly ONE mutation
(`rolls back local cart state...` L302, `rolls back to the pre-checkout cart...` L639), where
S0 and "state before the last mutation" are identical, so neither can detect the difference.

Missing test shape: two or more mutations inside one debounce window (state S0 -> S1 -> S2), one
failing flush, asserting `cartItems.get()` equals S0 and not S1.

#### Scenario 2 — PARTIAL rationale

The primary THEN ("a PUT MUST be sent immediately at the cap, without a quiet period") is fully
proven: 5 mutations at 200 ms spacing, `not.toHaveBeenCalled()` at t=800, one call at t=1000
carrying all 5 items. The trailing AND ("the debounce/cap cycle MUST restart for any further
mutations that follow") is not directly asserted after a cap-triggered flush. It is indirectly
supported: `flushCartSync` calls `discardPendingSync()` before issuing, and the two ordering tests
demonstrate a genuinely new burst after a prior flush — but via the debounce path, not the cap path.

### Correctness (Static Evidence)

| Claim | Status | Evidence |
|-------|--------|----------|
| Debounce 300 ms / cap 1000 ms as module constants | Implemented | `cartSync.ts:91-92` |
| 3 mutation call sites rewired to `scheduleSync` | Implemented | `CartService.ts:53, 61, 68` |
| `checkout()` = `scheduleSync([], current)` then `flushCartSync()`, still `(): boolean` | Implemented | `CartService.ts:90-92`, signature L75 |
| `loadCartFromStorage()` discards an open burst on every branch | Implemented | `finally { discardPendingSync(); }`, `CartService.ts:21-25` |
| `pagehide` on `win`, `visibilitychange` on `doc` filtered to `hidden` | Implemented | `cartSync.ts:157-163` |
| `beforeunload` deliberately NOT bound | Confirmed | no occurrence in `cartSync.ts` |
| Self-registration behind `typeof window`/`typeof document` guard | Implemented | `cartSync.ts:180-182` |
| `syncToBackend` unchanged (keepalive, syncSeq guard, no-rollback catch) | Confirmed verbatim | diff vs `dd14a13^` shows only the added `export` keyword |
| 250-line file cap respected | Confirmed | `cartSync.ts` 182, `CartService.ts` 94, `cartState.ts` 34; test file 660 (exempt per AGENTS.md) |
| No `console.log` introduced | Confirmed | none in the three modules |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Max-wait cap as an independent ceiling timer, armed once per burst | Yes | `cartSync.ts:112`, inside the sentinel branch, never re-armed |
| `burstPreviousItems === null` is the burst sentinel (never `.length`, never `debounceTimer !== null`) | Yes | `cartSync.ts:108`; comment at L97-101 records the rationale |
| `checkout()` flushes synchronously and is not awaited | Yes | Proven at runtime by L615 test: `fetch` called with zero timer advance |
| Listeners self-register at import behind a `typeof window` guard | Yes | `cartSync.ts:180-182`; no-op under vitest `node` env, so listener tests pass explicit stubs |
| Three-module split keeps `frontend.domain.locality` passing | Yes | `architecture:check` exit 0; rule verified as genuinely applicable |
| No change to `CartList.astro`, `product.astro`, `cartBadge.ts`, `sessionUI.ts`, `domains/cart/index.ts` | Yes | `git diff --name-only main...HEAD` lists only the 4 cart-service files + 4 openspec docs |

**Resolved Risks table**: all five claims independently confirmed. The "rollback targets the wrong
baseline" row is true *in the code* but is not backed by a test — see Finding C1.

### Out-of-Scope Confirmation

Verified by inspecting `git diff --name-only main...HEAD`, not by trusting the proposal:

| Out-of-scope item | Touched? |
|---|---|
| Server-side commit-order race (`SequelizeShoppingCartRepository.syncCart`) | No — zero backend files in the diff |
| "syncing..." UI affordance | No — zero `.astro`/component/style files in the diff |
| Backend contract, payload shape, delta sync, reconciling GET | No |
| Guest carts | No — `scheduleSync` early-returns on `!getSessionUser()` exactly as `syncToBackend` did |

Complete changed-file set: `CartService.test.ts`, `CartService.ts`, `cartState.ts`, `cartSync.ts`,
plus `openspec/changes/cart-batching/{proposal,design,tasks}.md` and the delta spec.

### Proposal Success Criteria

| # | Criterion | Verdict |
|---|---|---|
| 1 | N rapid mutations inside one window produce exactly 1 PUT | MET — L458 test, `toHaveBeenCalledTimes(1)` with all 3 items |
| 2 | Sustained mutations past the cap still sync | MET — L503 test flushes at t=1000 with all 5 items |
| 3 | `checkout()`, `pagehide`, hidden-tab each force an immediate flush | MET — L615, L531, L547 |
| 4 | `keepalive: true` on every flush; throw path still does not roll back | MET — single `fetch` call site with `keepalive: true`; asserted at L299 and L481; throw path at L315 |
| 5 | Both stale-response ordering guarantees still hold | MET — L379 and L422, both still consuming two distinct `mockImplementationOnce` handlers |
| 6 | `cart-updated` still fires once per mutation | MET — L484 asserts exactly 3 `cart-updated` dispatches for 3 mutations against 1 flush |
| 7 | `pnpm frontend:check` and `pnpm test` green; no Tier 0 coverage drop | MET — both exit 0; CartService suite grew 30 -> 36 tests, net +6 |

All 7 success criteria are met. The failing gate is the spec delta's Scenario 6, which the
proposal's criteria list does not enumerate.

### Commit Verification

| Commit | Branch | Claim | Verified |
|---|---|---|---|
| `dd14a13` | `feat/cart-batching-1-file-split` | Verbatim split into `cartState.ts` / `cartSync.ts` | Yes — 4 files, +241/-115. Line-by-line comparison against `dd14a13^:CartService.ts` shows the ONLY textual deltas are three added `export` keywords (`persistCart`, `syncToBackend`) and the import lines the split requires. Zero logic change. |
| `5b70c90` | `feat/cart-batching-1-file-split` | SDD planning artifacts | Yes — 3 files, +323/-0, docs only |
| `d1e094f` | `feat/cart-batching-2-debounce-scheduler` | Debounce scheduler + forced-flush triggers | Yes — 4 files, +372/-79 (`CartService.test.ts` +266, `cartSync.ts` +99, `CartService.ts` 22 changed, `tasks.md` 64) |

Note: `dd14a13` also carries `tasks.md` (+119) and `d1e094f` carries the `tasks.md` checkbox
updates (64 changed). Both are expected SDD bookkeeping, not scope creep.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | NO | `openspec/changes/cart-batching/apply-progress.md` does not exist and Engram is unreachable this session |
| All tasks have tests | YES | Every behavioral task B5–B9 maps to at least one test in `CartService.test.ts` |
| RED confirmed (tests exist) | YES | All 5 planned new tests (B9.1–B9.5) exist at L458, L484, L503, L531, L547 |
| GREEN confirmed (tests pass) | YES | 36/36 pass at runtime |
| Triangulation adequate | PARTIAL | 9 spec scenarios vs 8 covering tests; Scenario 6 has no case |
| Safety Net for modified files | YES | Unit A ran the pre-existing suite unmodified (commit message and verbatim diff both corroborate) |

**TDD Compliance**: 4.5/6 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 36 | 1 (`CartService.test.ts`) | vitest 4.1.9 + fake timers |
| Integration | 0 | 0 | not applicable (no DOM env configured) |
| E2E | 0 | 0 | Playwright present but not exercised by this change |
| **Total** | **36** | **1** | |

All cart-batching behavior is unit-tested with stubbed `window`/`document`/`fetch`. The
`pagehide` / `visibilitychange` triggers are proven only against hand-built stubs, never against a
real browser event loop — acceptable for the chosen layer, noted as a residual gap.

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected in the frontend vitest configuration.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `CartService.test.ts` | 339 | `expect(errorEventCall).toBeDefined()` | Type-only; the `find()` predicate on `type === 'cart-sync-error'` carries the behavior, but no value is asserted (unlike L353) | SUGGESTION |
| `CartService.test.ts` | 570 | `expect(fetchMock).toHaveBeenCalledTimes(1)` | Asserts "still 1" carried over from the hidden branch instead of clearing the mock; would also pass if the visible-tab listener were never registered | SUGGESTION |

No tautologies, no ghost loops, no orphan empty-collection assertions, no `vi.mock()` usage, and no
CSS/implementation-detail coupling. **Assertion quality**: 0 CRITICAL, 0 WARNING, 2 SUGGESTION.

### Quality Metrics

**Type Checker**: `astro check` — 0 errors, 0 warnings, 0 hints across 49 files.
**Linter**: not run as a separate gate; `astro check` covers the changed TypeScript.
**Architecture linter**: `npm run architecture:check` — 0 violations.

### Issues Found

**CRITICAL**

- **C1 — Scenario 6 is UNTESTED.** "A failed flush rolls back to the state before the burst's first
  mutation" has no covering test. Proven by mutation: an isolated mutant that overwrites
  `burstPreviousItems` on every mutation (violating the scenario's explicit "MUST NOT roll back to
  the state before only the burst's last mutation") passes all 36 tests. The production code is
  correct today, but the guarantee is unprotected against regression — and this is the exact risk
  the design's "Resolved Risks" table claims to have resolved. Fix: one test with a >=2-mutation
  burst, a failing flush, and an assertion that the store returns to S0.

**WARNING**

- **W1 — No `apply-progress` artifact.** `openspec/changes/cart-batching/apply-progress.md` does not
  exist, and Engram MCP was unavailable for the whole session, so the Strict-TDD "TDD Cycle
  Evidence" table could not be validated. Every other change in `openspec/changes/archive/` has a
  file mirror. It is not possible to distinguish "apply never produced it" (which the Strict-TDD
  module would score CRITICAL) from "produced in Engram only, now unreachable". TDD outcomes were
  therefore re-derived directly from the test file and git history instead.
- **W2 — Scenario 2's cycle-restart clause is only indirectly covered.** No test mutates the cart
  again after a cap-triggered flush to prove the debounce/cap cycle re-arms from the cap path.
- **W3 — Forced-flush triggers are proven only against hand-built stubs.** `registerCartFlushListeners`
  is never exercised against a real `window`/`document`, and the module-scope self-registration at
  `cartSync.ts:180-182` is a no-op under vitest's `node` environment, so the production wiring path
  itself has zero automated coverage.

**SUGGESTION**

- **S1** — `CartService.test.ts:339`: add a message assertion to match the sibling test at L353.
- **S2** — `CartService.test.ts:570`: call `fetchMock.mockClear()` before the visible-tab half so the
  assertion proves "no new flush" rather than "count unchanged".
- **S3** — `loadCartFromStorage()` unconditionally discards a pending burst (by design, task B7.3).
  Both production callers (`cartBadge.ts:16`, `CartList.astro:117`) are page-init paths behind
  once-per-document latches, so no mutation can currently be lost. If Astro view transitions or a
  client-side router are ever adopted, a soft navigation would silently drop an unsynced burst.
- **S4** — `registerCartFlushListeners` latches globally via `teardownFlushListeners`. A listener test
  that throws before its cleanup would silently no-op every later registration in the file. A
  `try/finally` or an `afterEach` teardown would make the harness robust.

### Verdict

**FAIL** — 1 of 9 spec scenarios has no covering test, proven by a mutation probe that survives the
entire suite; everything else (36/36 tests, type check, full workspace suite, architecture rule, all
7 proposal success criteria, all 5 design "Resolved Risks", both out-of-scope boundaries, all 3
commits) verifies clean.
