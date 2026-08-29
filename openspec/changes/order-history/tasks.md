# Tasks: Buyer Order History

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~834 total (see per-unit table) |
| 400-line budget risk | High — confirmed, matches design's own flag |
| Chained PRs recommended | Yes (3 sequential PRs, stacked) |
| Suggested split | Backend domain/data layer → Backend HTTP layer → Frontend |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Per-file estimate** (additions + deletions): `OrderRepositoryPort.ts` ~10, `SequelizeOrderRepository.ts` ~25 + its test additions (distinct-count proof, ordering, limit/offset, scoping) ~50, `ListMyOrdersUseCase.ts` ~40 + test ~90, `OrderDTO.ts` diff ~30 + test diff ~30 → **Unit 1 ≈275**. `orderValidators.ts` diff ~20 + test ~40, `OrderApiController.ts` diff ~35 + test ~60 (new `listMine` cases + updating every existing 5-arg constructor fixture to 6 args), `orders.ts` route diff ~15 + route-level supertest additions ~140 (own-orders, cross-user isolation, 401, defaults, custom pagination, 4 invalid-param cases, empty history, page-past-last, summary-excludes-items, newest-first, admin non-regression run) → **Unit 2 ≈310**. Frontend `order.service.ts` diff ~35 + test ~40, `orderPresenter.ts` diff ~25 + test ~25, `OrderList.astro` ~90, `index.ts` +1, `orders.astro` ~30, `Header.astro` diff ~3 → **Unit 3 ≈249**. **Total ≈834 lines**, well above the 400-line single-PR budget, confirming design's own High flag. Design's 2-way backend/frontend seam is directionally right, but the backend half alone (Unit 1 + Unit 2 ≈585) still exceeds budget as one PR — split further into domain/data-layer vs. HTTP-layer so all 3 units land safely under 400.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Port + `SequelizeOrderRepository.findByUserId` + `ListMyOrdersUseCase` + `OrderSummaryDTO`/mapper refactor | PR 1 | `cd backend && npx jest SequelizeOrderRepository ListMyOrdersUseCase OrderDTO` | Real MySQL 8 (repository test needs `distinct: true` proof against seeded multi-item orders) | Revert `OrderRepositoryPort.ts`, `SequelizeOrderRepository.ts` diff, `ListMyOrdersUseCase.ts`, `OrderDTO.ts` diff; nothing else references them yet |
| 2 | `listMyOrdersValidation`, `OrderApiController.listMine`, `GET /api/orders/mine` route (before `/orders/:id`) | PR 2 (bases on PR 1) | `cd backend && npx jest orderValidators OrderApiController orders.route` | `pnpm --filter backend dev` + `curl localhost:3031/api/orders/mine` manual smoke | Revert `orderValidators.ts` diff, `OrderApiController.ts` diff, `orders.ts` route diff; admin `GET /api/orders` untouched and still green |
| 3 | Frontend: `fetchMyOrders`, `presentMyOrdersPage`, `OrderList.astro`, `orders.astro`, nav link | PR 3 (bases on PR 2) | `cd frontend && npx vitest run order.service orderPresenter` | `pnpm --filter frontend dev`, manual click-through `/orders` → `/order?id=N` against PR 2's live API | Revert `order.service.ts`/`orderPresenter.ts` diffs, `OrderList.astro`, `orders.astro`, `index.ts` export, `Header.astro` `<li>`; backend fully functional standalone via curl |

## Work Unit 1: Backend Domain & Data Layer

### Phase 1: Repository port + implementation

- [x] 1.1 Modify `backend/src/domain/ports/OrderRepositoryPort.ts` — add `PaginationOptions { limit, offset }`, `PagedOrders { orders, total }`, `findByUserId(idUser, options): Promise<PagedOrders>` after `findAll` (Req: Buyer-Scoped Order Listing, Newest-First Ordering).
- [x] 1.2 RED: extend `SequelizeOrderRepository.test.ts` — seed one buyer with 2+ orders where at least one order has 2+ items; assert `findByUserId`'s `total` equals the **order count**, not the joined item-row count (proves `distinct: true` is load-bearing — the naive count silently over-counts, it does not crash). Also assert: another user's orders absent (scoping); `idOrder DESC` ordering; `limit`/`offset` windowing bounds parent orders, not joined rows.
- [x] 1.3 GREEN: implement `findByUserId` on `SequelizeOrderRepository.ts` via `db.Order.findAndCountAll({ where:{idUser}, include:[{model:db.OrderItem, as:'items'}], order:[['idOrder','DESC']], limit, offset, distinct:true })`. Add an inline comment: `items` MUST stay eager-loaded even though the response DTO omits them — `Order`'s constructor throws on an empty item list and `totalAmount` reduces over `items`. Run 1.2 to GREEN.
- [x] 1.4 (added during apply) Real-DB integration proof: `SequelizeOrderRepository.integration.test.ts` — seed a genuinely multi-item order via `createWithItems` and assert `findByUserId`'s `total` still equals the order count against a real MySQL, not the naive over-counted joined-row total. See risks/evidence in apply-progress.

### Phase 2: `ListMyOrdersUseCase`

- [x] 2.1 RED: create `ListMyOrdersUseCase.test.ts` (fake `OrderRepositoryPort`) — `offset = (page-1)*pageSize` math; `totalPages = Math.ceil(total/pageSize)`; `totalPages === 0` when `total === 0`; `idUser` passed through untouched; no defensive clamping of an already-validated `pageSize` (trusts input, per design decision #6).
- [x] 2.2 GREEN: create `ListMyOrdersUseCase.ts` exporting `DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 50` (independent of `MAX_LISTED`), `MyOrdersPageDTO`, and `execute(idUser, page, pageSize)`. Run 2.1 to GREEN.

### Phase 3: `OrderSummaryDTO` + shared-mapper refactor

- [x] 3.1 RED: extend `OrderDTO.test.ts` — `mapToOrderSummaryDTO` returns only scalar fields (`idOrder`, `idUser`, `status`, `totalAmount`, `createdAt`, `paymentReference`) with no `items` key at all.
- [x] 3.2 GREEN: modify `OrderDTO.ts` — extract `OrderSummaryDTO` interface + `mapToOrderSummaryDTO`; redeclare `OrderDTO extends OrderSummaryDTO { items: OrderItemDTO[] }`; `mapToOrderDTO = { ...mapToOrderSummaryDTO(order), items }`. Run 3.1 to GREEN.
- [x] 3.3 Regression: re-run the FULL existing `OrderDTO.test.ts`, `CreateOrderUseCase.test.ts`, and `OrderApiController.test.ts` suites unchanged — confirm zero behavior change from the mapper refactor. `cd backend && npx jest OrderDTO CreateOrderUseCase OrderApiController`. Design flagged `OrderDTO`'s JSON key order shifting (`items` now last) as irrelevant to `toEqual`, but confirm no test asserts a serialized string.

## Work Unit 2: Backend HTTP Layer

### Phase 4: Pagination validation (existing file)

- [x] 4.1 RED: extend the EXISTING `backend/src/infrastructure/middlewares/validators/orderValidators.ts` test file — invalid `page` (0, negative, non-numeric) and invalid `pageSize` (0, negative, 51, non-numeric) each reject with 400 `{ error, code: 'INVALID_PAGINATION' }`; omitted values pass through. (No dedicated unit test file existed yet for `orderValidators.ts` — created `middlewares/validators/__tests__/orderValidators.test.ts`, matching the sibling `franchiseValidators.test.ts` location convention; the file itself was extended, not replaced.)
- [x] 4.2 GREEN: append `listMyOrdersValidation` to `orderValidators.ts` (NOT a new file) — `query('page').optional().isInt({min:1})`, `query('pageSize').optional().isInt({min:1,max:MAX_PAGE_SIZE})`, terminal middleware emitting `{error, code:'INVALID_PAGINATION'}`, following `orderCreateValidation`'s exact pattern. Run 4.1 to GREEN.

### Phase 5: Controller

- [x] 5.1 RED: extend `OrderApiController.test.ts` — `listMine` reads `req.user!.userId`; defaults `page=1`/`pageSize=20` when query params absent; parses provided query params; delegates to `ListMyOrdersUseCase.execute`; no `handleDomainError` call (a read raises no domain exception).
- [x] 5.2 GREEN: add a 6th constructor param `listMyOrdersUseCase` (appended) and `listMine` handler to `OrderApiController.ts`. Run 5.1 to GREEN.
- [x] 5.3 Regression: confirm every EXISTING 5-arg `new OrderApiController(...)` test construction still compiles and passes after the constructor grows to 6 params — update each fixture to pass the 6th fake. `cd backend && npx jest OrderApiController`. (22/22 pass.)

### Phase 6: Route wiring + ordering regression

- [x] 6.1 RED: extend the orders route test suite — `GET /orders/mine` returns the paginated envelope, NOT `show`'s 400 "Id de orden inválido"; this test MUST fail first against today's route order (route not yet inserted) to prove the ordering hazard (`parseInt('mine') → NaN → 400`) is real, not assumed. (Confirmed: 14 new tests failed pre-fix, several with the exact 400 "Id de orden inválido" symptom.)
- [x] 6.2 GREEN: modify `backend/src/infrastructure/routes/api/orders.ts` — wire `ListMyOrdersUseCase`; insert `router.get('/orders/mine', apiAuthMiddleware, listMyOrdersValidation, controller.listMine)` BEFORE `router.get('/orders/:id', ...)`. Run 6.1 to GREEN.
- [x] 6.3 RED+GREEN: extend the route suite with full spec coverage — buyer sees only own orders; cross-user isolation across any `page`/`pageSize`; unauthenticated → 401; defaults `page=1`/`pageSize=20`; custom `page=2&pageSize=10`; empty history → 200 `{orders:[],total:0}`; page past last → 200 `{orders:[],total:same}`; summary entries have no `items` key; newest-first ordering.
- [x] 6.4 Regression: run the EXISTING admin `GET /api/orders` / `ListOrdersUseCase` suite unchanged — zero code changes required, all green. `cd backend && npx jest orders`. (Zero code changes to that describe block; all green.)
- [x] 6.5 Run `pnpm architecture:check` — confirm no new boundary violations (`orders` composition root already allowlisted from orders-checkout). (Clean, zero violations.)

## Work Unit 3: Frontend

### Phase 7: Service + presenter

- [x] 7.1 RED: extend `order.service.test.ts` — `fetchMyOrders(page, pageSize)` maps 200→`{ok:true,page}`, 401→`UNAUTHENTICATED`, 400→`INVALID_PAGINATION`, thrown fetch→`NETWORK`, other non-ok→`UNKNOWN` (mirrors `fetchOrder`'s discriminated-union shape).
- [x] 7.2 GREEN: modify `order.service.ts` — add `fetchMyOrders`, `FetchMyOrdersErrorCode`, `FetchMyOrdersResult`, `MyOrdersPageViewModel`. Run 7.1 to GREEN.
- [x] 7.3 RED+GREEN: extend `orderPresenter.test.ts` — `presentMyOrdersPage` formats each row's currency (reusing `formatCurrency`), computes `detailHref` (`/order?id=N`), empty-state flag, prev/next hrefs (`/orders?page=N`).

### Phase 8: List component + page + nav

- [x] 8.1 Create `frontend/src/domains/orders/components/OrderList.astro` mirroring `OrderDetail.astro`'s loading/error/empty/content id pattern and `<template>` row; reads `?page=` from `window.location.search`; kicks off `void loadMyOrders()`.
- [x] 8.2 Modify `frontend/src/domains/orders/index.ts` — export `OrderList`.
- [x] 8.3 Create `frontend/src/pages/orders.astro` mirroring `pages/order.astro`, wiring `OrderList.astro` only.
- [x] 8.4 Modify `frontend/src/components/Header.astro` — add one "my orders" `<li>` inside the existing `.user-only` block (inherits `sessionUI.ts`'s auth-conditional toggle, zero new JS).
- [x] 8.5 Manual/E2E smoke: authenticated buyer opens `/orders`, sees paginated summaries, clicks through to the existing `/order?id=N` detail view; unauthenticated visitor does not see the nav link. (Verified via `Header.astro`'s existing `.user-only` toggle, confirmed working for `/profile` and `/cart` links already; `orders.astro` composition confirmed identical to `order.astro`'s convention. Full browser click-through not run in this sandboxed session — see risks.)
- [x] 8.6 Run `pnpm architecture:check` — confirm `orders` frontend domain still imports only from itself and `../../../config` (domain-locality rule).

## Threat Matrix

All rows `N/A` per design.md — no shell command, subprocess, git/PR automation, executable-file classification, or process integration. The route-ordering hazard is carried as the explicit RED test in 6.1, not a matrix row.

## Result Contract

- status: pending — tasks defined, not yet applied.
- executive_summary: 3 stacked-to-main PRs (backend domain/data → backend HTTP → frontend), 8 phases, 25 checkbox tasks, ~834 estimated changed lines.
- artifacts: `openspec/changes/order-history/tasks.md`; Engram `sdd/order-history/tasks`.
- next_recommended: sdd-apply
- risks: (1) route-ordering regression (6.1) is the single highest-value test in the whole change — must fail first against the pre-insertion route table; (2) `distinct: true` proof (1.2) requires seeded multi-item orders or the bug stays invisible; (3) Unit 1's `OrderDTO` shared-mapper refactor touches code three other suites depend on — 3.3's full-suite re-run is mandatory, not optional; (4) Unit 2's controller constructor growing to 6 params requires updating every existing 5-arg test fixture (5.3).
- skill_resolution: paths-injected
