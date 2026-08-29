```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:202bc6e9c30d8a6077a2d1ee2fd8eddea304dd5b2d6130a6c91be511dc237e4a
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 14/14
test_command: cd backend && npx jest
test_exit_code: 0
test_output_hash: sha256:63572483a9ac5a1178831da8d9a0e4eaee4bedf176c7618aec3bb85c0e4b79a3
build_command: PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build
build_exit_code: 0
build_output_hash: sha256:4744d379a71266b28988169c2cf8ce102e6467e4035e6db633999036542b6f9d
```

## Verification Report (RE-VERIFY)

**Change**: order-history
**Version**: openspec/changes/order-history (file-authoritative, hybrid mode)
**Mode**: Strict TDD
**HEAD verified**: d5bab9f (PRs #89, #90, #91 + follow-up #92 all merged to main)
**Supersedes**: the prior report at b78532d, which returned FAIL (1 CRITICAL, 4 WARNING, 3 SUGGESTION)

This is an independent re-verification, not a re-read of the prior one. Every
load-bearing claim was re-executed or re-proven by mutation at current HEAD.
Nothing below is carried over on trust.

### Prior CRITICAL — closed, independently confirmed

The prior CRITICAL was: two "Frontend Order History Access" scenarios had no
runtime evidence, and task 8.5's designated manual click-through — checked `[x]`
— had never been performed.

**Verdict: closed.** Not accepted from PR #92's self-report; re-derived here.

**1. PR #92 changed no production code — verified directly, not from its description.**

```text
git diff --name-status b78532d..d5bab9f
A  e2e/tests/order-history.spec.ts
M  openspec/changes/order-history/tasks.md
A  openspec/changes/order-history/verify-report.md
```

One new test file, two documentation files. Zero production files. The 46/46
E2E result therefore measures the same production code the prior report
verified, not a changed one.

**2. `e2e/tests/order-history.spec.ts` was read in full and is genuinely non-tautological.**

The order-placement test (`:23-65`) does real work end to end:

- Places a real order through the real checkout flow — `/product?id=1`, real
  `PUT /api/cart` awaited, `/cart`, `.cart__btn-checkout` — and harvests the
  resulting id from the redirect: `placedOrderId = new URL(page.url()).searchParams.get('id')`.
- Navigates to `/orders` and asserts `#my-orders-content` is **visible**. That
  element ships `style="display:none"` (`OrderList.astro:21`) and is only revealed
  by the component's own JS after a successful `GET /api/orders/mine`. The
  assertion therefore cannot pass unless the real fetch succeeded and rendered.
- Asserts the first row's `.order-row-id` contains `placedOrderId` — a value
  produced by checkout, not by the test. This is the opposite of a tautology:
  the expected value is external to the assertion.
- Clicks `.order-row-link`, asserts URL `/order?id=${placedOrderId}` and
  `#order-id` has that exact text.

All selectors were checked against `OrderList.astro` (`#my-orders-body`,
`.order-row-id/-status/-total/-link`, `#my-orders-row-template`) — every one
exists, so no assertion is silently skipping a missing element.

**3. The suite was run locally, not trusted.**

```text
cd e2e && npx playwright test --project=chromium      → exit 0
Running 46 tests using 1 worker … 46 passed (1.9m)

✓ 38 order-history.spec.ts:18 › the nav exposes a "Mis pedidos" link … (510ms)
✓ 39 order-history.spec.ts:23 › placing a real order makes it appear in
                                 /orders, linking through to its real detail
                                 page (2.3s)
```

Playwright browsers and Docker were both available in this sandbox, so no
substitute evidence was needed. CI on PR #92 independently agrees — all four
jobs green (`gh pr checks 92`): End-to-end (Playwright), Quality, Real-DB
integration, Verification gate.

### One new finding: the nav-link assertion does not discriminate on auth

Reading the second test with fresh eyes surfaced a defect the prior report could
not have seen, because the test did not exist then.

```ts
// e2e/tests/order-history.spec.ts:18-21
const link = page.locator('a[href="/orders"]', { hasText: 'Mis pedidos' });
await expect(link).toHaveCount(1);
```

The spec scenario requires the link to be **visible** when authenticated. This
asserts only that it exists in the DOM. The `<li>` is static server-rendered
markup (`Header.astro:61`) nested in `.user-only`, which carries an inline
`style="display: none;"` (`:55`) and is revealed only by `sessionUI.ts:59`
(`setVisibility(document.querySelectorAll('.user-only'), 'block')`). The markup
is therefore present for every visitor regardless of session.

**Proven empirically, not argued.** A throwaway probe spec ran the identical
locator and identical assertion with an explicitly empty `storageState`, then
was deleted:

```text
PROBE anonymous count   = 1
PROBE anonymous visible = false
1 passed (14.5s)
```

The assertion passes for a logged-out visitor. It cannot fail on the behaviour
it claims to cover, so it does not prove the scenario. It still has real value —
it catches deletion of the link, an href change, or a label change — but not an
auth/visibility regression.

Note the probe's second line: `isVisible()` **is** `false` anonymously, so
`toBeVisible()` would discriminate correctly. The repo already has that exact
pattern one file over, on a sibling `<li>` in the same dropdown
(`header.spec.ts:43-47`: hover `.nav-item__trigger`, focus, `toBeVisible()`,
click). The fix is a few lines, reusing an established local convention.

This is a WARNING, not a CRITICAL, because the scenario is proven by
composition — every element below is a passing runtime test, not static
inspection — rather than left untested:

- `header-modules.test.ts:155-160,183-189` drives the real `initializeSessionUI`
  against a fixture DOM with a real user cookie and asserts `.user-only` →
  `display: block` authenticated, `none` anonymous. Runtime proof of the
  visibility mechanism itself.
- `header.spec.ts:43-50` proves at real-browser runtime that a link inside that
  same `.user-only` dropdown is visible and clickable for an authenticated user.
- The "Mis pedidos" `<li>` sits at `Header.astro:61`, immediately after the
  `/profile` `<li>` that test exercises, inside the same `<ul class="nav-item__dropdown">`.
- The second order-history E2E test does reach `/orders` and render it for real.

Nothing is broken, and the scenario's asserted direction (authenticated → link
visible) is genuinely covered. The gap is that no single test asserts the
conjunction, so the one regression that would slip through is the link being
moved *outside* `.user-only` — which the spec does not state as a requirement.
The gap is in what one assertion proves, not in the feature.

### Counting (authoritative, counted from files)

| Item | Value | Source |
|---|---|---|
| Requirements | 7 | `rg -c '^### Requirement:' specs/order-history/spec.md` |
| Scenarios | 14 | `rg -c '^#### Scenario:' specs/order-history/spec.md` |
| Tasks checked | 28 | `rg -c '^- \[x\]' tasks.md` |
| Tasks unchecked | 0 | `rg -c '^- \[ \]' tasks.md` |

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 28 |
| Tasks complete | 28 |
| Tasks incomplete | 0 |

All 28 checkboxes verified against real files and real runs. Task 8.5 — the
prior report's overstated checkbox — is now accurate (see WARNING disposition).

### Build & Tests Execution

Every command below was executed in this session at HEAD d5bab9f.

| Command | Exit | Result |
|---|---|---|
| `cd backend && npx jest` | 0 | 106 suites, 849/849 tests |
| `cd e2e && npx playwright test --project=chromium` | 0 | 46/46 tests, incl. both order-history cases |
| backend real-DB integration (MySQL 8.0.46) | 0 | 9 suites, 30/30 tests |
| `pnpm run frontend:test` | 0 | 12 files, 166/166 tests |
| `pnpm --filter backend type-check` | 0 | `tsc --noEmit` clean |
| `pnpm --filter backend architecture:check` | 0 | zero boundary violations |
| `pnpm --filter backend lint` | 0 | `eslint src/` clean |
| `pnpm run frontend:check` | 0 | 63 files, 0 errors/warnings/hints |
| `pnpm run frontend:quality-check` | 0 | clean |
| `PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build` | 0 | 17 pages built, incl. `/orders/index.html` |

Real-DB integration ran against a disposable, unmapped `mysql:8.0` container
addressed by its bridge IP (172.17.0.2), since `backend/src/database/config/config.js`
has no `port` field and the host's system MariaDB holds 3306. Container removed
after the run (`docker rm -f m3d-reverify-db`); absence confirmed.

`jest.config.js` excludes `*.integration.test.*`, so the 849-test default run
does not include the `distinct: true` real-DB proof; it ran separately via
`jest.integration.config.js`.

### Independent mutation verification (both load-bearing claims re-proven)

Re-executed at current HEAD, because code can shift between passes. Both
mutations were reverted and the tree confirmed clean.

**(a) `distinct: true` is load-bearing — RE-PROVEN**

`SequelizeOrderRepository.findByUserId` (`:121-131`) carries `distinct: true`
(`:128`) with eager-loaded `items`. Flipped to `distinct: false`:

```text
● counts orders, not joined item rows, for a buyer with a genuinely multi-item order
    Expected: 2   Received: 4
● windows parent orders (not joined rows) via limit/offset, while total stays the full order count
    Expected: 2   Received: 4
Tests: 2 failed, 3 passed, 5 total
```

4 is exactly the joined item-row count against 2 real orders. Fails for the
precise reason the design predicted — not tautological. Reverted; 5/5 green.

**(b) Route ordering is load-bearing — RE-PROVEN**

Read directly from `backend/src/infrastructure/routes/api/orders.ts`:

```text
212:router.get('/orders/mine', apiAuthMiddleware, listMyOrdersValidation, controller.listMine);
213:router.get('/orders/:id',  apiAuthMiddleware, controller.show);
214:router.get('/orders',      apiAuthMiddleware, adminGuard, controller.index);
```

`/orders/mine` precedes `/orders/:id`. Swapping 212/213:

```text
Tests: 14 failed, 23 passed, 37 total
```

with the predicted symptom (`parseInt('mine') → NaN` → `show`'s 400 "Id de orden
inválido"). Reverted; 37/37 green; tree clean.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Buyer-Scoped Order Listing | Authenticated buyer lists own orders | `orders.test.ts` route suite; `SequelizeOrderRepository.integration.test.ts > scopes strictly to the requesting user`; E2E `placing a real order …` | COMPLIANT |
| Buyer-Scoped Order Listing | Cross-user isolation via page manipulation | `orders.test.ts > scopes the call to the authenticated buyer, ignoring any page/pageSize`; `> scopes a different buyer to their own userId`; real-DB scoping test | COMPLIANT |
| Buyer-Scoped Order Listing | Unauthenticated request is rejected | `orders.test.ts > returns 401 without an auth cookie` | COMPLIANT |
| Pagination Parameter Validation | Defaults applied when omitted | `orders.test.ts > defaults to page=1/pageSize=20 when omitted`; `OrderApiController.test.ts` | COMPLIANT |
| Pagination Parameter Validation | Valid custom pagination | `orders.test.ts > accepts custom page=2&pageSize=10` | COMPLIANT |
| Pagination Parameter Validation | Invalid page is rejected | `orderValidators.test.ts > rejects an invalid page=%s` (0, -1, abc); `orders.test.ts` | COMPLIANT |
| Pagination Parameter Validation | Invalid pageSize is rejected | `orderValidators.test.ts > rejects an invalid pageSize=%s` (0, -1, 51, abc); `orders.test.ts` | COMPLIANT |
| Response Envelope Shape | Empty order history | `orders.test.ts > returns 200 with an empty history`; `ListMyOrdersUseCase.test.ts > returns totalPages: 0 when the caller has zero orders` | COMPLIANT |
| Response Envelope Shape | Page beyond the last page | `orders.test.ts > returns 200 with an empty page past the last page, same total` | COMPLIANT |
| Order Summary Representation | Summary excludes line items | `OrderDTO.test.ts > returns only scalar fields, with no items key at all`; `orders.test.ts > summary entries carry no items key` | COMPLIANT |
| Newest-First Ordering | Most recent order appears first | `SequelizeOrderRepository.integration.test.ts > orders newest-first (idOrder DESC)` (real DB); mocked repo test pins `order: [['idOrder','DESC']]` | COMPLIANT |
| Admin Listing Non-Regression | Admin listing behaves as before | `orders.test.ts > GET /api/orders` block; `ListOrdersUseCase.test.ts`; production diff empty | COMPLIANT |
| Frontend Order History Access | Nav link visible when authenticated | Compositional, all runtime: `header-modules.test.ts:155-160` (real `initializeSessionUI` + user cookie → `.user-only` `display: block`); `header.spec.ts:43-47` (real browser, authenticated, sibling `/profile` link in the same dropdown `toBeVisible()`); E2E `the nav exposes a "Mis pedidos" link …` (the `/orders` link is in that dropdown). See WARNING-1 — no single test asserts the conjunction | COMPLIANT (compositional) |
| Frontend Order History Access | Order list page renders summaries + links to detail | E2E `placing a real order makes it appear in /orders, linking through to its real detail page` — real order, real API, real render, real click-through | COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant, 0 PARTIAL, 0 failing,
0 untested. (Prior pass: 12/14 with 2 PARTIAL.) One scenario — "Nav link visible
when authenticated" — is compliant only by composition across three passing
runtime tests rather than by a single direct assertion; that limitation is
carried as WARNING-1, not hidden in the count.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Buyer-Scoped Order Listing | Implemented | `listMine` (`OrderApiController.ts:111-122`) reads `req.user!.userId`; no client-supplied user-id path exists |
| Pagination Parameter Validation | Implemented | `listMyOrdersValidation` rejects with `{error, code:'INVALID_PAGINATION'}`; no clamping anywhere |
| Response Envelope Shape | Implemented | `MyOrdersPageDTO` = `{orders,page,pageSize,total,totalPages}`; `totalPages: 0` when `total === 0` |
| Order Summary Representation | Implemented | `OrderSummaryDTO` has no `items`; `OrderDTO extends OrderSummaryDTO` |
| Newest-First Ordering | Implemented | `order: [['idOrder','DESC']]` in `findByUserId` (`:125`) |
| Admin Listing Non-Regression | Implemented | See below |
| Frontend Order History Access | Implemented | Nav `<li>` at `Header.astro:61` inside `.user-only`; `/orders` builds and renders live (E2E) |

### ADMIN Non-Regression (re-checked at HEAD)

- `git diff 3b44826..HEAD -- backend/src/application/use-cases/ListOrdersUseCase.ts` → **0 lines**. Production code byte-identical.
- `router.get('/orders', apiAuthMiddleware, adminGuard, controller.index)` (`orders.ts:214`) — unchanged.
- `OrderApiController.index` unchanged; controller diff contains no `index` line.
- `ListOrdersUseCase.test.ts` changed by exactly **+1/-0** (`findByUserId: jest.fn(),` added so the fake satisfies the widened port). Type conformance only.
- `orders.test.ts > GET /api/orders` describe block green (37/37 suite).

Non-regression **confirmed**.

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| 1. Port `findByUserId(idUser, {limit, offset})` | Yes | `OrderRepositoryPort` with `PaginationOptions`/`PagedOrders` |
| 2. `findAndCountAll` + `distinct: true` | Yes | Re-proven by mutation |
| 3. `OrderDTO extends OrderSummaryDTO`, mapper spreads | Yes | `OrderDTO.ts` |
| 4. Plain validator chain + `{error, code:'INVALID_PAGINATION'}`, no new exception class | Yes | `orderValidators.ts` |
| 5. `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` from use case; `MAX_LISTED` untouched | Yes | `MAX_LISTED = 100` still a private static (`SequelizeOrderRepository.ts:104`) |
| 6. No defensive clamping in the use case | Yes | Pinned by `ListMyOrdersUseCase.test.ts > trusts an already-validated pageSize` |
| 7. One `<li>` inside the existing `.user-only` block | Yes | `Header.astro:61`, zero new JS |
| Route registered before `/orders/:id` | Yes | Re-proven by mutation |
| `items` stay eager-loaded (Order ctor rejects empty items) | Yes | Comment at `SequelizeOrderRepository.ts:115-120`; real-DB test asserts a 3-item order |

No design deviations found.

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | `apply-progress` (Engram #6849) carries per-task RED/GREEN evidence |
| All tasks have tests | Yes | Every behavioral task maps to a real, present test file |
| RED confirmed (tests exist) | Yes | All referenced test files exist on disk |
| GREEN confirmed (tests pass) | Yes | 849 + 46 + 30 + 166 all pass on fresh execution this session |
| RED claims independently re-proven | Yes | Both headline claims reproduced by mutation (14 route failures; distinct 2-vs-4) |
| Triangulation adequate | Yes | `it.each` over 3 invalid `page` and 4 invalid `pageSize` values; 5 service branches; 2 pagination-window cases |
| Safety Net for modified files | Yes | Tasks 3.3 (OrderDTO refactor) and 5.3 (6-arg ctor, 22/22) re-ran existing suites; green |

**TDD Compliance**: 7/7 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (backend) | ListMyOrdersUseCase 5, OrderDTO summary 1, orderValidators 9 | 3 | jest |
| Integration — route/controller (backend) | `orders.test.ts` 37 (14 for `/orders/mine`), `OrderApiController.test.ts` 22 | 2 | jest + supertest |
| Integration — real DB | 5 (`SequelizeOrderRepository.integration.test.ts`) | 1 | jest + MySQL 8.0.46 |
| Unit (frontend) | `order.service` 6 for `fetchMyOrders`, `orderPresenter` 3 for `presentMyOrdersPage` | 2 | vitest |
| E2E / browser | 2 (`order-history.spec.ts`) of 46 suite-wide | 1 | **Playwright (newly present — was 0 in the prior pass)** |

The E2E row is the substantive change since the prior report: the change now has
real browser coverage where it previously had none.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `e2e/tests/order-history.spec.ts` | 19-20 | `expect(link).toHaveCount(1)` | Passes identically for an anonymous visitor (probe: count 1, visible false) — proves presence, not the visibility the scenario names | WARNING |
| `e2e/tests/order-history.spec.ts` | 54-55 | `.order-row-status` / `.order-row-total` `not.toBeEmpty()` | Non-emptiness rather than a concrete value; acceptable because the same row's id is asserted against an externally-produced value | SUGGESTION |
| `orders.test.ts` | 336-353 | `trusts the use case for newest-first ordering` | Passthrough over a mocked use case returning `[55, 41]` and asserting `[55, 41]`. Proves serialization, not ordering | SUGGESTION |
| `SequelizeOrderRepository.integration.test.ts` | 77 | `expect(ids).toEqual([...ids].sort((a,b) => b-a))` | Self-referential shape (asserts sortedness rather than a fixed expected order); still meaningful with 2 known ids | SUGGESTION |

No tautologies, no orphan empty-collection assertions, no ghost loops, no
assertion-free tests, no smoke-test-only tests, no CSS/implementation-detail
coupling, no mock-heavy imbalance. The order-placement E2E test is a genuine,
high-value behavioural test.

**Assertion quality**: 0 CRITICAL, 1 WARNING, 3 SUGGESTION.

### Quality Metrics

**Linter**: clean (`eslint src/`, exit 0)
**Type Checker**: clean (`tsc --noEmit`, exit 0)
**Astro check**: clean (63 files, 0 errors/warnings/hints)
**Architecture**: clean, zero boundary violations
**File-size cap (250 lines)**: all changed files pass — `orders.ts` 218,
`SequelizeOrderRepository.ts` 152, `OrderApiController.ts` 149, `OrderList.astro` 141,
`order.service.ts` 121, `orderPresenter.ts` 80, `orderValidators.ts` 54,
`OrderDTO.ts` 54, `ListMyOrdersUseCase.ts` 41, `orders.astro` 11,
`order-history.spec.ts` 66 (test file, exempt anyway)
**console.log in production paths**: none
**CSP**: `OrderList.astro` uses a bundled `<script>` (not `is:inline`) — compliant with AGENTS.md

### Disposition of the 4 carried-forward WARNINGs

| # | Prior WARNING | Status now | Evidence |
|---|---|---|---|
| a | Task 8.5's checkbox overstates completion | **CLOSED** | The rewritten 8.5 describes exactly what exists and is careful about it: it claims the second test "confirms the *Mis pedidos* nav link is **present**" — not "visible". That is precisely what the test does. The "46/46 pass" claim was re-run locally and is accurate. |
| b | Untested-DOM-render convention is pre-existing and acceptable | **CLOSED / superseded** | No longer merely acceptable-by-convention: `OrderList.astro`'s DOM wiring is now exercised at real-browser runtime (`#my-orders-content`, `#my-orders-body tr`, `.order-row-id/-status/-total/-link`). The repo-wide absence of an Astro component-render unit harness remains pre-existing and unchanged by this change. |
| c | All three PRs exceeded the 400-line budget by ~50% | **CONFIRMED ACCURATE, historical** | Recomputed from git, excluding `openspec/`: #89 = 439+8 = **447**; #90 = 434+34 = **468**; #91 = 406+4 = **410**. Matches the prior report exactly. All merged; no action. Estimation model under-forecast consistently — worth recalibrating on the next change. |
| d | `tasks.md` Result Contract is stale | **STILL OPEN** (non-blocking) | Line 94 still reads "25 checkbox tasks"; the file contains 28 checked, 0 unchecked. Line 93 additionally still reads `status: pending — tasks defined, not yet applied`, which is now doubly stale. Documentation-only; does not block archive. |

Prior SUGGESTION 3 ("worth confirming CI runs the integration tests") is also
now **resolved**: `.github/workflows/ci.yml` has a dedicated `integration` job
(`Real-DB integration tests` → `pnpm run test:integration`) and a separate
`e2e` job (`End-to-end (Playwright)`), and `gh pr checks 92` shows both green.

### Issues Found

**CRITICAL**: None.

**WARNING**:

1. **The nav-link E2E assertion does not discriminate on authentication.**
   `order-history.spec.ts:20` uses `toHaveCount(1)`, which a probe proved passes
   for an anonymous visitor (count 1, visible false). The scenario is still
   counted COMPLIANT because it is proven by composition across three passing
   runtime tests (`header-modules.test.ts` toggle + `header.spec.ts:43-47`
   sibling-link visibility in the same dropdown + this test's presence check),
   but no single test asserts the conjunction, and the test advertised for this
   scenario is the weakest link in it. Fix is small and has a local precedent:
   hover `.nav-item__trigger`, then `toBeVisible()`, mirroring
   `header.spec.ts:44-47`.

2. **`tasks.md` Result Contract is stale.** Says "25 checkbox tasks" (actual: 28)
   and `status: pending` (actual: all applied and merged). Documentation-only.

3. **`apply-progress` (Engram #6849) is stale with respect to PR #92.** It still
   records task 8.5 as "Full interactive browser click-through NOT run … noted as
   a risk". True when written, superseded by #92. Harmless for archive but
   misleading if read standalone later.

4. **Estimation model under-forecast every work unit by ~50-65%.** Historical and
   already recorded; carried forward only as calibration input for the next
   change, per the prior report.

**SUGGESTION**:

1. `orders.test.ts:336` newest-first is a passthrough over a mocked use case.
   Honest name ("trusts the use case"), and real ordering is proven in the
   real-DB test, so this is redundancy rather than a gap.
2. `SequelizeOrderRepository.integration.test.ts:77` asserts sortedness against a
   re-sort of its own result; a concrete expected id sequence would be stronger.
3. `order-history.spec.ts:54-55` asserts non-emptiness of status/total rather
   than concrete formatted values.
4. `order-history.spec.ts` depends on `.auth/user.json`, which is written by
   `auth.spec.ts:42`. Safe today only because `playwright.config.ts` sets
   `fullyParallel: false, workers: 1` and `auth` sorts before `order-history`.
   Running the file in isolation would fail. A `setup` project dependency would
   make the ordering explicit rather than incidental.

### Verdict

**PASS WITH WARNINGS**

The prior CRITICAL is genuinely closed. PR #92 is test-only (verified by diff,
not description), and its order-placement E2E test does real work: a real order
through the real checkout flow, a real `GET /api/orders/mine`, a real render, and
a real click-through to the detail page — with the expected value harvested from
checkout rather than hardcoded. The full 46-test suite was re-run locally at
exit 0, and CI on #92 agrees.

Every other load-bearing claim was re-proven from scratch at current HEAD rather
than carried over: `distinct: true` still fails 2-vs-4 when mutated, route
ordering still produces exactly 14 failures when swapped, ADMIN non-regression
still has a byte-empty production diff, and all ten test/build/lint/type/
architecture gates pass.

One new WARNING was found that the prior pass could not have seen: the nav-link
assertion proves presence, not auth-conditional visibility, and was shown by
probe to pass while logged out. Its scenario still counts as compliant because
three passing runtime tests cover it in composition, but the assertion
advertised for it is the weakest link and should be tightened. It is a weak
assertion over a working feature, not a defect in the feature.

14/14 scenarios compliant, 0 CRITICAL, 0 blockers. Ready for **sdd-archive**,
ideally after the two-line `tasks.md` Result Contract correction and, optionally,
tightening `toHaveCount(1)` to `toBeVisible()`.
