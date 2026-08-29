```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:861a7128ba78f42a1f484cfa7646f2cce419fa7f8b767f48f614937103c08ea4
verdict: fail
blockers: 1
critical_findings: 1
requirements: 6/7
scenarios: 12/14
test_command: cd backend && npx jest
test_exit_code: 0
test_output_hash: sha256:e24ef7c01791ba1585d7cfb14d40b39f176bf7d53f97c7c6fd3e5eaa471c10a7
build_command: PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build
build_exit_code: 0
build_output_hash: sha256:22d40e1f2a0259456607416febec8aa6bf206fb368733c0195f04706a77fa358
```

## Verification Report

**Change**: order-history
**Version**: openspec/changes/order-history (file-authoritative, hybrid mode)
**Mode**: Strict TDD
**HEAD verified**: b78532d (PRs #89, #90, #91 all merged to main)

### Counting correction (authoritative)

The verification brief stated "8 requirements, 16 scenarios" and "26 tasks". The
authoritative artifacts say otherwise, and counts were taken from the files, not
the brief:

| Item | Brief | Authoritative (counted) | Source |
|---|---|---|---|
| Requirements | 8 | **7** | `rg -c '^### Requirement:' specs/order-history/spec.md` |
| Scenarios | 16 | **14** | `rg -c '^#### Scenario:' specs/order-history/spec.md` |
| Tasks | 26 | **28** | `rg -c '^- \[x\]' tasks.md` |

`tasks.md`'s own Result Contract still says "25 checkbox tasks" — stale since task
1.4 was added during apply. Documentation-only drift.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 28 |
| Tasks complete | 28 |
| Tasks incomplete | 0 |

All 28 checkboxes verified against real files, not trusted from the checkbox.
One task is overstated — see WARNING-1 (task 8.5).

### Build & Tests Execution

**Build**: PASSED
```text
PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build → exit 0
17 pages built, including /orders/index.html
```

**Tests**: PASSED
```text
cd backend && npx jest                     → exit 0 — 106 suites, 849/849 tests
backend real-DB integration (MySQL 8.0.46) → exit 0 — 9 suites, 30/30 tests
pnpm run frontend:test                     → exit 0 — 12 files, 166/166 tests
pnpm --filter backend type-check           → exit 0
pnpm --filter backend architecture:check   → exit 0 (zero boundary violations)
pnpm --filter backend lint                 → exit 0
pnpm run frontend:check (astro check)      → exit 0 — 63 files, 0 errors/warnings/hints
pnpm run frontend:quality-check            → exit 0
```

Real-DB integration was run against a disposable, unmapped `mysql:8.0` container
addressed by its bridge IP (172.17.0.2), since `database/config/config.js` has no
`port` field and the host's system MariaDB holds 3306. **Container removed after
the run** (`docker rm -f m3d-verify-db`, absence confirmed).

Note: `jest.config.js` `testPathIgnorePatterns` excludes `*.integration.test.*`,
so the 849-test default run does **not** include the `distinct: true` real-DB
proof. It was run separately via `jest.integration.config.js`.

### Independent Mutation Verification (the two load-bearing claims)

Both claims were tested by mutation, not accepted from the apply agents' reports.

**(a) `distinct: true` is genuinely load-bearing — PROVEN**

`SequelizeOrderRepository.findByUserId` (line 128) really does carry
`distinct: true` with eager-loaded `items`. Mutation: flipped to `distinct: false`,
re-ran the real-DB suite.

```text
● counts orders, not joined item rows, for a buyer with a genuinely multi-item order
  Expected: 2
  Received: 4
● windows parent orders via limit/offset, while total stays the full order count
  Expected: 2
  Received: 4
Tests: 2 failed, 3 passed, 5 total
```

4 is exactly the joined item-row count (fixture seeds orders with 1 and 3 items:
1+3=4) against 2 real orders. The test is **not tautological** — it fails for the
precise reason the design predicted. Mutation reverted; `git status` clean; suite
restored to 5/5 green.

**(b) Route ordering is genuinely load-bearing — PROVEN**

Confirmed by reading `backend/src/infrastructure/routes/api/orders.ts` directly,
not from a prior claim:

```text
212:router.get('/orders/mine', apiAuthMiddleware, listMyOrdersValidation, controller.listMine);
213:router.get('/orders/:id',  apiAuthMiddleware, controller.show);
```

The test harness is genuine, not a mocked router: `orders.test.ts` builds a real
`express()` app and mounts the real router (`require('../orders').default`) via
supertest; only the use cases are mocked. Mutation: swapped lines 212/213.

```text
Tests: 14 failed, 23 passed, 37 total
```

Exactly the 14 failures the apply phase claimed, with the predicted symptom
(`parseInt('mine') → NaN` → `show`'s 400 "Id de orden inválido"). Reverted;
37/37 green; tree clean.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Buyer-Scoped Order Listing | Authenticated buyer lists own orders | `orders.test.ts > returns the paginated envelope, not the 400 from GET /orders/:id`; `SequelizeOrderRepository.integration.test.ts > scopes strictly to the requesting user` | COMPLIANT |
| Buyer-Scoped Order Listing | Cross-user isolation via page manipulation | `orders.test.ts > scopes the call to the authenticated buyer, ignoring any page/pageSize`; `> scopes a different buyer to their own userId`; real-DB scoping test | COMPLIANT |
| Buyer-Scoped Order Listing | Unauthenticated request is rejected | `orders.test.ts > returns 401 without an auth cookie` | COMPLIANT |
| Pagination Parameter Validation | Defaults applied when omitted | `orders.test.ts > defaults to page=1/pageSize=20 when omitted`; `OrderApiController.test.ts` | COMPLIANT |
| Pagination Parameter Validation | Valid custom pagination | `orders.test.ts > accepts custom page=2&pageSize=10` | COMPLIANT |
| Pagination Parameter Validation | Invalid page is rejected | `orderValidators.test.ts > rejects an invalid page=%s` (0, -1, abc); `orders.test.ts > rejects invalid page` | COMPLIANT |
| Pagination Parameter Validation | Invalid pageSize is rejected | `orderValidators.test.ts > rejects an invalid pageSize=%s` (0, -1, 51, abc); `orders.test.ts` | COMPLIANT |
| Response Envelope Shape | Empty order history | `orders.test.ts > returns 200 with an empty history`; `ListMyOrdersUseCase.test.ts > returns totalPages: 0 when the caller has zero orders` | COMPLIANT |
| Response Envelope Shape | Page beyond the last page | `orders.test.ts > returns 200 with an empty page past the last page, same total` | COMPLIANT |
| Order Summary Representation | Summary excludes line items | `OrderDTO.test.ts > returns only scalar fields, with no items key at all`; `orders.test.ts > summary entries carry no items key` | COMPLIANT |
| Newest-First Ordering | Most recent order appears first | `SequelizeOrderRepository.integration.test.ts > orders newest-first (idOrder DESC)` (real DB, passed); mocked repo test pins `order: [['idOrder','DESC']]` | COMPLIANT |
| Admin Listing Non-Regression | Admin listing behaves as before | `orders.test.ts > GET /api/orders` block; `ListOrdersUseCase.test.ts`; production diff empty | COMPLIANT |
| Frontend Order History Access | Nav link visible when authenticated | `header-modules.test.ts` covers the generic `.user-only` toggle; the `<li><a href="/orders">Mis pedidos</a></li>` placement inside `.user-only` is verified statically only | PARTIAL |
| Frontend Order History Access | Order list page renders summaries + links to detail | `orderPresenter.test.ts` (6 tests: rows, detailHref `/order?id=N`, empty flag, prev/next) and `order.service.test.ts` (6 tests: 200/401/400/NETWORK/UNKNOWN) fully cover the logic; `OrderList.astro`'s DOM wiring has no runtime test | PARTIAL |

**Compliance summary**: 12/14 scenarios fully compliant, 2 PARTIAL, 0 failing, 0 untested.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Buyer-Scoped Order Listing | Implemented | `listMine` reads `req.user!.userId`; no client-supplied user id path exists |
| Pagination Parameter Validation | Implemented | `listMyOrdersValidation` rejects with `{error, code:'INVALID_PAGINATION'}`; no clamping anywhere |
| Response Envelope Shape | Implemented | `MyOrdersPageDTO` = `{orders,page,pageSize,total,totalPages}`; `totalPages: 0` when `total === 0` |
| Order Summary Representation | Implemented | `OrderSummaryDTO` has no `items`; `OrderDTO extends OrderSummaryDTO` |
| Newest-First Ordering | Implemented | `order: [['idOrder','DESC']]` in `findByUserId` |
| Admin Listing Non-Regression | Implemented | See non-regression section below |
| Frontend Order History Access | Implemented | Nav `<li>` at Header.astro:61 inside `.user-only` (opened line 55); `/orders` page builds |

### ADMIN Non-Regression (explicitly checked, not assumed)

- `git diff 3b44826..HEAD -- src/application/use-cases/ListOrdersUseCase.ts` → **empty**. Production code byte-identical.
- `router.get('/orders', apiAuthMiddleware, adminGuard, controller.index)` (line 214) — unchanged; diff filter for that line returned nothing.
- `OrderApiController.index` unchanged; still `listOrdersUseCase.execute()` → `mapToOrderDTO`.
- `ListOrdersUseCase.test.ts` changed by exactly **+1 line**: `findByUserId: jest.fn(),` added to the fake repository so it satisfies the widened `OrderRepositoryPort`. Type conformance only, zero behavior change.
- `mapToOrderDTO`'s output object is unchanged in content (now composed via spread of `mapToOrderSummaryDTO`); `OrderDTO.test.ts > produces the exact buyer-facing response shape` passes unchanged.
- `orders.test.ts > GET /api/orders` describe block green.

Non-regression **confirmed**.

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| 1. Port signature `findByUserId(idUser, {limit, offset})` | Yes | `OrderRepositoryPort.ts:29` with `PaginationOptions`/`PagedOrders` |
| 2. `findAndCountAll` + `distinct: true` | Yes | Verified by mutation |
| 3. `OrderDTO extends OrderSummaryDTO`, mapper spreads | Yes | `OrderDTO.ts:25,44` |
| 4. Plain validator chain + `{error, code:'INVALID_PAGINATION'}`, no new exception class | Yes | `orderValidators.ts:42-54` |
| 5. `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` from use case; `MAX_LISTED` untouched | Yes | `MAX_LISTED = 100` still a private static |
| 6. No defensive clamping in the use case | Yes | Pinned by `ListMyOrdersUseCase.test.ts > trusts an already-validated pageSize` |
| 7. One `<li>` inside the existing `.user-only` block | Yes | Header.astro:61, zero new JS |
| Route registered before `/orders/:id` | Yes | Verified by mutation |
| `items` stay eager-loaded (Order ctor rejects empty items) | Yes | Real-DB test asserts a 3-item order with `totalAmount > 0` |

No design deviations found.

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | apply-progress carries per-task RED/GREEN evidence |
| All tasks have tests | Yes | Every behavioral task maps to a real, present test file |
| RED confirmed (tests exist) | Yes | All referenced test files exist on disk |
| GREEN confirmed (tests pass) | Yes | 849 + 30 + 166 all pass on fresh execution |
| RED claims independently re-proven | Yes | Both headline RED claims reproduced by mutation (14 route failures; distinct 2-vs-4) |
| Triangulation adequate | Yes | `it.each` across 3 invalid `page` and 4 invalid `pageSize` values; 5 service branches; 2 pagination-window cases |
| Safety Net for modified files | Yes | Task 3.3 (OrderDTO refactor) and 5.3 (6-arg ctor, 22/22) re-ran existing suites; both green now |

**TDD Compliance**: 7/7 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (backend) | ListMyOrdersUseCase 5, OrderDTO summary 1, orderValidators 9 | 3 | jest |
| Integration — route/controller (backend) | orders.test.ts 37 (14 for `/orders/mine`), OrderApiController 22 | 2 | jest + supertest |
| Integration — real DB | 5 (`SequelizeOrderRepository.integration.test.ts`) | 1 | jest + MySQL 8.0.46 |
| Unit (frontend) | order.service 6 for `fetchMyOrders`, orderPresenter 3 for `presentMyOrdersPage` | 2 | vitest |
| E2E / browser | 0 | 0 | not installed |

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `orders.test.ts` | 336-353 | `trusts the use case for newest-first ordering` | Passthrough: the use case is mocked to return `[55, 41]` and the test asserts `[55, 41]` comes back. Proves serialization, not ordering. | SUGGESTION |
| `SequelizeOrderRepository.integration.test.ts` | 77 | `expect(ids).toEqual([...ids].sort((a,b) => b-a))` | Self-referential shape (asserts the array is sorted rather than a fixed expected order); still meaningful with 2 known ids | SUGGESTION |

No tautologies, no orphan empty-collection assertions, no ghost loops, no
assertion-free tests, no smoke-test-only tests, no CSS/implementation-detail
coupling, no mock-heavy imbalance. The two items above are weak-but-honest tests
whose underlying requirement (newest-first) **is** properly proven at the
repository layer by the real-DB test.

**Assertion quality**: 0 CRITICAL, 0 WARNING, 2 SUGGESTION.

### Quality Metrics

**Linter**: clean (`eslint src/`, exit 0)
**Type Checker**: clean (`tsc --noEmit`, exit 0)
**Architecture**: clean, zero boundary violations
**File-size cap (250 lines)**: all changed files pass — `orders.ts` 218, `SequelizeOrderRepository.ts` 152, `OrderApiController.ts` 149, `OrderList.astro` 141, `order.service.ts` 121, `orderPresenter.ts` 80, `OrderDTO.ts` 54, `ListMyOrdersUseCase.ts` 41, `orders.astro` 11
**console.log in production paths**: none
**CSP**: `OrderList.astro` uses a bundled `<script>` (not `is:inline`) — compliant with AGENTS.md

### Issues Found

**CRITICAL**:

1. **Two spec scenarios have no runtime evidence, and the manual verification that
   was supposed to supply it was never performed.** Task 8.5 is checked `[x]` and
   reads "Manual/E2E smoke: authenticated buyer opens `/orders` ... clicks through
   to `/order?id=N`", but the apply agent's own note admits the browser
   click-through was never executed. That manual pass was the *designated* evidence
   for the two "Frontend Order History Access" scenarios, so both remain PARTIAL:
   the presenter/service logic is fully runtime-tested, but nothing — no test and
   no human — has ever confirmed that `/orders` actually renders rows or that the
   nav link appears. This verification attempted to close the gap directly and
   could not: the repo has no headless browser (playwright/puppeteer/cypress) and
   no DOM harness (jsdom/happy-dom), so runtime DOM evidence cannot be produced
   without adding tooling, which is outside a verification phase's remit.

   Scope note: this is confined to the frontend surface. The backend is fully
   verified, including both load-bearing claims re-proven by mutation.

   To clear: perform the 8.5 click-through against a live stack (one human pass is
   enough) and record the result, or add a DOM-level test for `OrderList.astro`.

**WARNING**:

1. **Task 8.5's checkbox overstates completion.** The checkbox reads
   "Manual/E2E smoke: authenticated buyer opens `/orders` ... clicks through to
   `/order?id=N`". The apply agent's own note admits the browser click-through was
   never executed, and no E2E harness exists in the repo. Marking it `[x]` overstates
   completion. This is the direct cause of both PARTIAL scenarios below. Recommend a
   single human click-through before archive, or rewording the task to what was
   actually done (code inspection against proven precedent).

2. **The untested-DOM boundary is pre-existing, not introduced here.** `OrderList.astro`
   follows the repo's documented convention of extracting logic to pure, tested
   functions because no Astro component-render harness exists (`orderPresenter.ts`'s
   own comment records this, and `OrderDetail.astro` shipped the same way in the
   archived orders-checkout change). The CRITICAL above is about the *missing manual
   pass that was planned to compensate*, not about this convention itself.

3. **All three PRs exceeded the 400-line review budget the split existed to respect.**
   PR #89 447 changed lines, PR #90 468, PR #91 410 (excluding `openspec/`). The
   3-way split was chosen specifically to keep each slice under 400 and every slice
   still missed. Historical now (all merged), but the estimation model in
   `tasks.md` under-forecast by ~50% consistently across all three units — worth
   recalibrating for the next change.

4. **`tasks.md` Result Contract is stale.** It states "25 checkbox tasks"; the file
   actually contains 28. Task 1.4 was added during apply without updating the
   summary. Documentation-only.

**SUGGESTION**:

1. The route-level newest-first test (`orders.test.ts:336`) is a passthrough over a
   mocked use case. Its name is honest ("trusts the use case"), and real ordering is
   proven in the real-DB test, so this is redundancy rather than a gap — but it could
   mislead a future reader into thinking route-level ordering is covered.
2. `SequelizeOrderRepository.integration.test.ts:77` asserts sortedness against a
   re-sort of its own result. Asserting the concrete expected id sequence would be
   stronger.
3. Integration tests are excluded from the default `npx jest` run. The `distinct: true`
   proof — the single most valuable test in this change — therefore does not run in
   the normal developer/CI loop unless `test:integration` is invoked explicitly.
   Worth confirming CI runs it.

### Verdict

**FAIL** — not because anything is broken, but because the evidence is incomplete:
2 of 14 scenarios (both frontend) have never been exercised at runtime, and the
manual smoke designated to cover them (task 8.5) is marked done without having been
performed. Everything that was actually executed is green: all 7 requirements are
implemented, 12/14 scenarios are fully compliant, every test/build/lint/type/
architecture gate passes, both load-bearing claims were independently re-proven by
mutation, and ADMIN non-regression is explicitly confirmed. The remaining gap is a
single human click-through (or one DOM-level test) away from PASS.
