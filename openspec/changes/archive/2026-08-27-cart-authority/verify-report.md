```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:6e493d618d7a1b05bf6e8c9bc46ec99220a567868fc77635489bea8abe29c28f
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 17/17
test_command: cd frontend && npm test
test_exit_code: 0
test_output_hash: sha256:ea6b6a999f660f1bcde715eed9f1374290a3f45f9cc8c99e0e247bb90e92cd92
build_command: cd frontend && npm run check
build_exit_code: 0
build_output_hash: sha256:0c043404e3363d7c97555c7a62e2f80f1eb2c37fb3466124b8b15f33ca32ccfc
```

## Verification Report

**Change**: cart-authority
**Version**: delta specs `cart-hydration` (6 ADDED requirements, 14 scenarios) + `nano-stores-cart` (2 ADDED requirements, 3 scenarios) = 8 requirements / 17 scenarios
**Mode**: Strict TDD
**Scope verified**: the complete change, `5a82607..HEAD` (`9ecb2058`), branch `main`
**Pass**: final (third) verification. Supersedes the first `FAIL` (C1, C2) and the re-verify `FAIL` (C3–C6). This is a fresh report, not an amendment.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 40 (Phases 1–15) |
| Tasks complete | 40 |
| Tasks incomplete | 0 |

All 40 checkboxes in `openspec/changes/cart-authority/tasks.md` are `[x]`. Each was corroborated
against code or command output rather than accepted from the checklist. Task 1.2's recorded
deviation (`HydrationResult` deferred out of PR1) is genuinely resolved — the interface exists at
`cartHydration.ts:27-33`.

### Build & Tests Execution

**Tests (unit)**: PASSED — `cd frontend && npm test`, exit 0

```text
Test Files  9 passed (9)
     Tests  144 passed (144)
```

**Build / type check**: PASSED — `cd frontend && npm run check` (`astro check`), exit 0

```text
Result (52 files):
- 0 errors
- 0 warnings
- 0 hints
```

**Architecture**: `cd backend && npm run architecture:check`, exit 0, zero violations.
`frontend.domain.locality` is genuinely exercised: `cartHydration.ts` imports only from
`./cartState`, `./cartSync`, and `../../../config`. `LoginForm.astro`'s cross-domain import from
`domains/cart/` is confirmed tool-legal in practice (`.astro` classifies as `documentation`, not
`production`), matching design.md's "LoginForm.astro may import from domains/cart/" decision — the
rule was verified as applicable, not vacuously green.

**Tests (e2e)**: PASSED — `cd e2e && npx playwright test` (full suite, natural run order,
`workers: 1`, `fullyParallel: false`), exit 0

```text
44 passed (2.0m)
```

Run twice against the final tree: once as the pre-probe baseline (44/44, 2.1m) and once after every
mutation probe was reverted (44/44, 2.0m). Both runs were the complete suite, not the cart spec
alone.

**Coverage**: Not available — no coverage tool configured in the frontend vitest project. Not a
failure; simply not installed.

### Spec Compliance Matrix

`cartHydration.test.ts` is abbreviated `H.test`; `e2e/tests/cart.spec.ts` is abbreviated `E2E`.

| # | Spec | Scenario | Covering test (passed at runtime) | Result |
|---|------|----------|-----------------------------------|--------|
| 1 | cart-hydration | Login success triggers hydration and waits briefly for it | `E2E` › `redirect still fires when GET /api/cart never resolves` (L292) — asserts `elapsedMs >= 1400`, proving the redirect genuinely *waits* on hydration; `E2E` › `Guest cart merges with an existing account cart item on login` (L227) proves `{mergeLocal:true}` is the login invocation | COMPLIANT |
| 2 | cart-hydration | Hydration exceeding the timeout still redirects | `E2E` › `redirect still fires when GET /api/cart never resolves` (L292) — GET stalled forever, `toHaveURL('/')` within 4s, `elapsedMs < 3500` | COMPLIANT |
| 3 | cart-hydration | Cart-page load triggers hydration | `E2E` › `cart-page load renders a server-only item even with a stale/empty local cart` (L359) — localStorage cleared, so only a server GET can produce the row | COMPLIANT |
| 4 | cart-hydration | Other page loads do not trigger hydration | `E2E` › `navigating to a non-cart page never issues GET /api/cart` (L378) — request sniffer over `/` and `/product?id=1`, `toHaveLength(0)` | COMPLIANT |
| 5 | cart-hydration | Non-empty guest cart merges and syncs once | `H.test` › `merges local and server carts and issues exactly one PUT carrying the merged set` (L467) — asserts merged store state, exactly 1 PUT, and the PUT body; `E2E` L227 proves it end-to-end against a real DB | COMPLIANT |
| 6 | cart-hydration | Empty guest cart hydrates without writing | `H.test` › `takes the replace path and issues zero PUT when the local cart is empty` (L453) — 1 fetch call, method GET | COMPLIANT |
| 7 | cart-hydration | Merged quantity over 99 clamps silently | `H.test` › `clamps a summed overlap exceeding 99 down to 99` (L109) + `clamps a local-only item already over 99 down to 99` (L118) | COMPLIANT |
| 8 | cart-hydration | Pending burst flushes before hydration | `H.test` › `flushes a pending burst before issuing the GET (PUT-before-GET ordering)` (L381) — index-based `fetchMock.mock.calls` ordering, PUT at [0], GET at [1] | COMPLIANT |
| 9 | cart-hydration | No pending burst hydrates immediately | `H.test` › `proceeds without waiting on any flush when there is no pending burst` (L399) — exactly 1 call, and it is the GET | COMPLIANT |
| 10 | cart-hydration | DTO maps to CartItem shape | `H.test` › `maps a null product.image to an empty string` (L61) + `takes unitPrice from product.price, not the row-level unitPrice` (L69) + `maps productId, name, and quantity straight through` (L77) | COMPLIANT |
| 11 | cart-hydration | Price change renders one notice per item | `E2E` › `a price change since adding the item renders one notice per drifted item` (L396) — asserts `#cart-price-drift .alert__text` count is 2 for 2 drifted items, i.e. the rendered DOM, not just the returned array; `H.test` › `produces one entry per drifted product when multiple products drift` (L203) covers the detection layer | COMPLIANT |
| 12 | cart-hydration | Unchanged price renders no notice | `H.test` › `produces no entry when local and server prices match` (L182), with `produces no entry for a server-only product` (L189) and `for a local-only product` (L196) triangulating the "no prior local price record" clause | COMPLIANT |
| 13 | cart-hydration | Failing GET on login still redirects | `E2E` › `redirect proceeds quickly when GET /api/cart fails fast, without waiting out the timeout` (L326) — 500 on GET, `elapsedMs < 1000`, proving the redirect fires on the failure rather than burning the 1500ms cap; `H.test` L295/L308 prove local state is unmodified on network/http failure | COMPLIANT |
| 14 | cart-hydration | Failing GET on cart-page load keeps local state | `H.test` › network-throw (L295), `!res.ok` (L308), `res.json()` throws (L321), `items` not an array (L336) — each asserts the return value **and** `cartItems.get()` unchanged **and** `localStorage.setItem` never called | COMPLIANT |
| 15 | nano-stores-cart | Hydration write opens no burst | `H.test` › `arms no debounce or max-wait timer as a side effect of the replace write` (L435) — `hasPendingSync()` is false **and** advancing 1000ms (past both `SYNC_DEBOUNCE_MS` and `SYNC_MAX_WAIT_MS`) still shows only the GET | COMPLIANT |
| 16 | nano-stores-cart | Merge PUT goes through scheduleSync and flushCartSync | `H.test` › L467 (exactly 1 PUT with the merged body) + L500 (coalescing and baseline behavior only reachable via `scheduleSync`+`flushCartSync`); source confirms `syncToBackend` is never imported by `cartHydration.ts` | COMPLIANT |
| 17 | nano-stores-cart | Merge PUT does not strand an already-pending burst | `H.test` › `does not strand an already-open burst's rollback baseline when the merge PUT is issued` (L500) — a mid-flight burst opens, the merge PUT fails, and the rollback lands on the burst's *own* baseline, proving exactly 1 coalesced PUT with the correct rollback target | COMPLIANT |

**Compliance summary**: **17/17 COMPLIANT**, 0 PARTIAL, 0 UNTESTED. All 8 requirements fully covered.

### Mutation-Probe Evidence (all six prior findings)

Every previously-open finding was re-probed independently from scratch against the current tree —
prior PR claims were not taken on trust. Protocol per probe: locate the exact code path, apply the
mutant, run the specific test that must catch it, confirm RED, revert, confirm `git status` clean.

| # | Prior finding | Mutant applied | Test that must catch it | Observed |
|---|---------------|----------------|-------------------------|----------|
| C1 | Bounded race unprotected | `LoginForm.astro`: `Promise.race([hydrate, timeout])` → bare `await CartService.hydrateFromServer({mergeLocal:true}).then(redirect, redirect)` | `E2E` L292 `redirect still fires when GET /api/cart never resolves` | **RED** — `toHaveURL('/')` timed out at 4000ms, 11× stuck on `/login` |
| C2 | Replace-mode scheduler bypass unprotected | `cartHydration.ts`: inserted `scheduleSync(server, initialLocal);` immediately before the terminal `cartItems.set(server)` | `H.test` L435 `arms no debounce or max-wait timer…` | **RED** — `expect(hasPendingSync()).toBe(false)` got `true` (1 failed / 30 passed) |
| C3 | Cart-page trigger unprotected | `CartList.astro`: deleted the `void CartService.hydrateFromServer().then(...)` call | `E2E` L359 `cart-page load renders a server-only item…` | **RED** — `.cart__item` count 0, expected 1 |
| C4 | Trigger-scope negative unprotected | `product.astro`: added a stray `void CartService.hydrateFromServer();` | `E2E` L378 `navigating to a non-cart page never issues GET /api/cart` | **RED** — received `["http://localhost:3032/api/cart"]`, expected length 0 |
| C5 | Price-drift render path unprotected | same mutant as C3 (removing the call also removes the drift render path) | `E2E` L396 `a price change… renders one notice per drifted item` | **RED**, and **independently of C3** — `#cart-price-drift .alert__text` count 0, expected 2 |
| C6 | Redirect ignores the hydration promise | `LoginForm.astro`: `Promise.race` → `void hydrate(); await new Promise(r => setTimeout(r, 1500)).then(redirect, redirect)` | `E2E` L326 `redirect proceeds quickly when GET /api/cart fails fast` | **RED** — `elapsedMs` 2713, expected `< 1000` |

C3 and C5 were each run as a separate targeted invocation under the same mutant, so C5's failure is
its own assertion (`#cart-price-drift .alert__text`), not a side effect of C3's `.cart__item` count.

After the last revert: `git status --porcelain` empty, `git diff --stat HEAD` empty,
`git rev-parse --short HEAD` = `9ecb205`. The post-revert full e2e suite re-ran green (44/44),
confirming zero mutant residue in the tree the evidence above describes.

**All six scenarios are now genuinely protected. Zero surviving mutants.**

### Regression Gate

`frontend/src/domains/cart/services/CartService.test.ts` is byte-identical to its pre-change state:

```text
git rev-parse HEAD:…/CartService.test.ts  → 067772ce3c56218fb687be98afbbccb19094dc43
git hash-object   …/CartService.test.ts   → 067772ce3c56218fb687be98afbbccb19094dc43
git log 5a82607..HEAD -- …/CartService.test.ts → (no commits)
```

The expected blob matches, the working tree matches the index, and **no commit in the entire change
ever touched the file**. Its assertions pass unmodified inside the 144-test run.

### Scope Discipline

`git diff --stat 5a82607..HEAD` — complete changed-file set for the entire change:

| File | Δ | In design's File Changes table? |
|---|---|---|
| `frontend/src/domains/cart/services/cartHydration.ts` | +189 | Yes (Create) |
| `frontend/src/domains/cart/services/cartHydration.test.ts` | +560 | Yes (Create) |
| `frontend/src/domains/cart/services/cartSync.ts` | +19/-6 | Yes (Modify) — see W5 |
| `frontend/src/domains/cart/services/CartService.ts` | +10/-1 | Yes (Modify) |
| `frontend/src/domains/cart/components/CartList.astro` | +31 | Yes (Modify) |
| `frontend/src/domains/auth/components/LoginForm.astro` | +21/-2 | Yes (Modify) |
| `e2e/tests/cart.spec.ts` | +239 | Yes (Modify) |
| `openspec/changes/cart-authority/*` (6 files) | +664 | SDD bookkeeping |
| `.gitignore` | +4 | No — see S1 |
| `e2e/test-results/.last-run.json` | -4 | No — see S1 |

**Backend files touched: zero.** `git diff --name-only 5a82607..HEAD | rg '^backend/'` returns
nothing, confirming the proposal's `backend/** — Unchanged` row and design.md's "No backend change".

| Out-of-scope item | Touched? |
|---|---|
| Checkout/order redesign | No |
| Cross-tab / focus / `session-changed` re-hydration | No |
| Anonymous/guest server-side carts (schema migration) | No |
| Any backend concurrency control | No — zero backend files |
| Merge confirmation modal | No — merge stays silent; only drift renders a notice |

`cartState.ts`, `cartBadge.ts`, `sessionUI.ts`, `product.astro`, and `domains/cart/index.ts` are all
absent from the diff, exactly as design.md predicted.

### Proposal Success Criteria

| # | Criterion | Verdict |
|---|---|---|
| 1 | Guest + account carts union with summed quantities, persisted server-side | MET — `H.test` L467 (unit) and `E2E` L227 (real DB, `.cart__item` count 2) |
| 2 | Empty guest cart on login ⇒ zero `PUT` | MET — `H.test` L453 |
| 3 | Merge past 99 clamps silently before the `PUT` | MET — `H.test` L109/L118; no notice path exists for the clamp |
| 4 | `/cart` as a logged-in user renders server state despite empty/stale localStorage | MET — `E2E` L359 |
| 5 | Pending debounced mutation flushes before hydrating | MET — `H.test` L381 (PUT-before-GET ordering) |
| 6 | Price change renders one notice per affected item | MET — `E2E` L396 asserts the rendered DOM count |
| 7 | Failing/500 `GET` on login still redirects, local cart intact | MET — `E2E` L326 + `H.test` L295/L308 |
| 8 | Every existing `CartService.test.ts` assertion passes unmodified | MET — blob identical, never committed against |
| 9 | Exactly one `PUT` from a login merge | MET — `H.test` L467 (`putCalls` length 1) and L500 (coalesced with a mid-flight burst) |
| 10 | `pnpm test` green | MET — 144/144, exit 0. Coverage threshold not measurable (no tool) |

All 10 success criteria met.

### Coherence (Design)

| Decision | Followed? | Evidence |
|---|---|---|
| Hydration stays out of `loadCartFromStorage()`; cart page calls both | Yes | `CartList.astro:148-154` order is `load → render → subscribe → hydrate`; `E2E` L378 proves no GET on other pages |
| Mode is an explicit flag, never inferred from the store | Yes | `cartHydration.ts:151` `options?.mergeLocal === true && initialLocal.length > 0`; `CartList.astro` calls with no options |
| Local snapshot read at call time, before any await | Yes | `cartHydration.ts:117` `const initialLocal = cartItems.get();` above the `try` |
| Merge is server-first, summed, clamped, deterministic | Yes | `cartHydration.ts:59-80`; all 8 merge rules covered by tests L89–L169 |
| `dto.hasPriceDrift` ignored; drift computed client-side over both-present products | Yes | `cartHydration.ts:88-104`; the DTO field is never read |
| One `.alert` block, one `.alert__text` per drifted item, `textContent` only | Yes | `CartList.astro:5` block, `:51-70` builds `<p>` via `createElement`+`textContent`; zero `innerHTML` |
| A burst opened during the GET aborts a replace-mode hydration | Yes | `cartHydration.ts:157-165`; `H.test` L353 |
| Merge PUT's rollback baseline is the **server** snapshot | Yes | `cartHydration.ts:180` `scheduleSync(merged, server)`; `H.test` L500 confirms an already-open burst keeps its own older baseline |
| `LoginForm.astro` may import from `domains/cart/` | Yes | `architecture:check` exit 0 |
| Single terminal `set` + `persistCart`; every failure returns earlier | Yes | Two write sites (`:168-169`, `:174-175`); all five failure rows return above them |
| Bounded race, `HYDRATION_REDIRECT_TIMEOUT_MS = 1500`, `.then(redirect, redirect)` | Yes | `LoginForm.astro:54,114-124`; C1 and C6 probes both prove it is enforced, not decorative |
| `cartSync.ts` "additive only, no existing line changes" | **No** | `flushCartSync()` signature changed `void → Promise<void>` — see W5 |

All six design "Resolved Risks" rows independently confirmed. The two "Resolved" cross-navigation
notes are honoured: login-time drift is discarded (`cartHydration.ts:185` returns `priceDrifts: []`
in merge mode), and no e2e test asserts on `pagehide`-PUT vs cart-page-GET ordering.

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | NO | No `apply-progress` artifact exists in either backend — see W1 |
| All tasks have tests | YES | Every RED-marked task (1.1, 2.1, 3.1, 6.1–6.4, 7.2, 8.1, 9.1–9.2, 10.1, 14.1) maps to at least one existing, passing test |
| RED confirmed (tests exist) | YES | Verified by file inspection: 31 cases in `cartHydration.test.ts`, 13 in `e2e/tests/cart.spec.ts` |
| GREEN confirmed (tests pass) | YES | 144/144 unit + 44/44 e2e at runtime, exit 0 |
| Triangulation adequate | YES | Every multi-scenario requirement has multiple distinct cases with *different* expected values (merge: 8 cases; drift: 5; failure paths: 5; trigger scope: 4) |
| Safety Net for modified files | YES | `CartService.test.ts` byte-identical and green; `cartSync.ts`'s edit is covered by that file's 36 unmodified assertions plus the full 144-test run |

**TDD Compliance**: 5/6 checks passed — the single miss is the missing artifact (W1), not a
protocol violation observable in the code.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | 31 (new) / 144 (suite) | 1 new (`cartHydration.test.ts`) / 9 total | vitest 4.1.9 + fake timers |
| Integration | 0 | 0 | not configured (no DOM env) |
| E2E | 6 (new) / 44 (suite) | 1 modified (`cart.spec.ts`) / suite-wide | Playwright, real backend + DB |
| **Total** | **188** | **10** | |

Both tools are present in the project's detected capabilities. Notably, the four DOM/browser-level
scenarios (3, 4, 11, 13) are covered at the **E2E** layer rather than by unit stubs — the correct
layer for assertions about rendered markup and per-page network behavior, and the reason the C3–C6
probes are meaningful.

### Changed File Coverage

Coverage analysis skipped — no coverage tool configured in the frontend vitest project.

### Assertion Quality

Audited `cartHydration.test.ts` (67 `expect(`) and the 239 added lines of `e2e/tests/cart.spec.ts`.

- No tautologies (`expect(true).toBe(true)` and equivalents: zero occurrences).
- No assertions that fail to call production code.
- No ghost loops — the single `for` loop (`cart.spec.ts:416`) is `page.evaluate` *setup*, not an
  assertion loop.
- No orphan empty-collection assertions — all five `toEqual([])` calls sit in describe blocks with
  companion non-empty cases (`mergeCartItems` L89–L169, `detectPriceDrift` L173–L216).
- No type-only assertions used alone: the four `.toBe(true)` calls are all paired with value
  assertions in the same test.
- No `vi.mock()` usage anywhere — mocks/assertion ratio is not a concern.
- No CSS-class or internal-state coupling. `#cart-price-drift .alert__text` is a *rendered output*
  selector required by the spec's own "reusing the existing alert component" wording, not an
  implementation-detail assertion.
- Several assertions are deliberately hardened beyond the naive form, and the audit confirms they
  hold their weight: `H.test:446` checks `hasPendingSync()` *and* advances 1000ms (documented at
  L442-445 as distinguishing "no burst armed" from "armed but not yet flushed"); `H.test:395-396`
  uses index-based `fetchMock.mock.calls` ordering rather than two spies.

**Assertion quality**: 0 CRITICAL, 0 WARNING, 0 SUGGESTION — all assertions verify real behavior.

### Quality Metrics

**Type Checker**: `astro check` — 0 errors, 0 warnings, 0 hints across 52 files.
**Architecture linter**: `npm run architecture:check` — exit 0, 0 violations.
**File-size cap (AGENTS.md, 250 lines)**: `cartHydration.ts` 189, `cartSync.ts` 195,
`CartService.ts` 102, `CartList.astro` 175, `LoginForm.astro` 135 — all under the cap.
`cartHydration.test.ts` (560) and `cart.spec.ts` (423) are spec/test files, explicitly exempt.
**`console.log` in production paths**: none in any of the five changed production files.

### Issues Found

**CRITICAL**

None. All six previously-open findings (C1–C6) are closed and re-proven by independent mutation.

**WARNING** — all carried forward as accepted; none blocks archive

- **W1 — No `apply-progress` artifact.** The Engram MCP tool surface has been uncallable for this
  entire session (tool-name mismatch), and no `openspec/changes/cart-authority/apply-progress.md`
  file mirror exists. The Strict-TDD "TDD Cycle Evidence" table therefore could not be validated as
  written. Accepted and permanently non-blocking: TDD outcomes were re-derived directly from the
  test files, git history, and the five PR commits instead, and every RED-marked task was confirmed
  to have a real, currently-passing test.
- **W3 — `.auth/user.json` fixture staleness on standalone file runs.** Pre-existing, unrelated to
  this change. Does not occur in the full-suite run order used for this report's evidence (44/44).
- **W4 — `auth.spec.ts` is load-sensitive.** Pre-existing, unrelated, and cleared by prior A/B
  testing. Green in both full-suite runs performed for this report.
- **W5 — Undocumented design deviation in `cartSync.ts` (new, non-blocking).** design.md's File
  Changes table specifies "**Additive only**: `hasPendingSync()` (3 lines). No existing line
  changes", but `flushCartSync()`'s signature was also changed from `void` to `Promise<void>`
  (`cartSync.ts:143-155`). The change is *correct and necessary* — spec scenario 8 requires that
  "hydration MUST read server state only after that flush resolves", which is unimplementable
  against a `void` return, and `cartHydration.ts:129` awaits it. Every pre-existing caller
  (pagehide/hidden-tab listeners, `checkout()`, the debounce and max-wait timers) already ignored
  the return value, which the 36 unmodified `CartService.test.ts` assertions confirm still holds.
  This is a documentation gap in design.md, not a behavioral defect, and it breaks no spec — it
  serves one.

**SUGGESTION**

- **S1 — Two incidental files outside the design's File Changes table.** `.gitignore` gained
  `e2e/test-results/` (+4 lines, with a rationale comment) and the previously-tracked
  `e2e/test-results/.last-run.json` was deleted. Both are build-artifact hygiene with zero runtime
  effect, but neither was declared in the design. Worth a one-line note at archive.
- **S2 — Merge-mode price drift is silently discarded.** `cartHydration.ts:185` returns
  `priceDrifts: []` on the merge path. This is a deliberate, documented design decision (the login
  flow redirects before a notice could render, and post-merge local state matches the server so the
  drift cannot reappear). No spec scenario requires otherwise, so this is informational only —
  but the discard is invisible at the call site and would be easy to misread as a bug later.
- **S3 — GitHub issue #73 (`.cart__item-details` CSS overlap)** remains open and is confirmed
  unrelated: that CSS rule was never touched by any cart-authority commit. Tracked separately.
- **S4 — The `pagehide`-PUT vs cart-page-`GET` cross-navigation race** is documented in design.md's
  "Resolved" section as an accepted, client-unsolvable risk. Correctly not asserted on by any e2e
  test. No action.

### Verdict

**PASS WITH WARNINGS**

- **17/17 spec scenarios COMPLIANT** across both delta specs, each with a named test that passed at
  runtime. 8/8 requirements covered.
- **0 CRITICAL findings, 0 blockers.** All six prior findings (C1–C6) independently re-probed by
  mutation from scratch against the current tree; **all six mutants were killed**. Zero survivors.
- **40/40 tasks complete** and corroborated against code, not accepted from the checklist.
- **Regression gate holds**: `CartService.test.ts` blob `067772ce…` unchanged and never committed
  against.
- **Scope discipline holds**: zero backend files touched across the entire change.
- Full evidence: 144/144 unit (exit 0), 44/44 e2e full suite in natural order (exit 0, run twice),
  `astro check` 0/0/0 (exit 0), `architecture:check` exit 0.
- The remaining warnings are W1 (missing artifact, an environment limitation), W3/W4 (pre-existing
  and unrelated), and W5 (a design-doc documentation gap behind a correct, spec-required change).
  None is a defect in the delivered behavior.

**`sdd-archive` CAN proceed.** There are no unresolved CRITICAL issues and no blockers. The four
warnings above are explicitly accepted, non-blocking, and should be carried into the archive report
as recorded residual notes rather than re-litigated.
