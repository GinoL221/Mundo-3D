# Tasks: Orders & Checkout

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~2,300 total across all units (see per-unit table below) |
| 400-line budget risk | High — confirmed, not just design's flag |
| Chained PRs recommended | Yes (7 sequential PRs, stacked) |
| Suggested split | Migration+models → Domain+ports → CreateOrderUseCase → Checkout infra+integration tests → Admin use-cases → Controller+routes+allowlist → Frontend |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Per-file estimate** (production + test lines, `additions + deletions`): `Order.ts` ~55, `OrderItem.ts` ~25, 5 exception files ~40, `OrderDTO.ts` ~40, entity tests ~100 → Unit 2 ≈340. `UnitOfWorkPort.ts` ~10, `OrderRepositoryPort.ts` ~25, `PaymentGatewayPort.ts` ~20, port-file diffs ~6, barrel +3 → folded into Unit 2, ≈340 total. `CreateOrderUseCase.ts` ~100 + its fakes-based test (happy path, empty cart, shortage collection, replay, post-commit gateway ordering) ~150 → Unit 3 ≈250. `SequelizeOrderRepository.ts` ~100, `SequelizeUnitOfWork.ts` ~20, `ManualPaymentGateway.ts` ~30 + its unit test ~30, tx-aware `SequelizeProductRepository` diff ~30, `SequelizeShoppingCartRepository` diff ~30, integration tests (rollback, `FOR UPDATE` lock, unique-violation replay, `markOrdered` in-place, `DELETE /api/products/:id` 204 regression) ~200 → Unit 4 ≈440. Admin use-cases (`GetOrderByIdUseCase` ~25, `ListOrdersUseCase` ~15, `ConfirmOrderPaymentUseCase` ~25, `CancelOrderUseCase` ~40) + unit tests ~140 + cancel/restock integration test ~60 → Unit 5 ≈305. `OrderApiController.ts` ~120, `orderValidators.ts` ~20, `routes/api/orders.ts` ~20, `routes/api/index.ts` +2, `architecture/config.js` +1 + route-level supertest tests ~180 → Unit 6 ≈345. Frontend `checkout.ts` ~60, `CartService.ts` diff ~15, `CartList.astro` diff ~40, `orders` domain (`index.ts`+`order.service.ts`+`OrderDetail.astro`) ~105, `order.astro` ~30 + Vitest tests ~180 → Unit 7 ≈430. Migration (`20260828000000-orders.js` ~90) + `Order.js`/`OrderItem.js` models ~70 + `models/index.js` diff ~10 + `db.d.ts` diff ~20 → Unit 1 ≈190. **Total ≈2,300 lines** — far above the 400-line single-PR budget even before counting the deploy-topology precedent's lesson that test-file line counts are consistently undercounted. Design's own 5-way cut ("migration+models → domain+ports → use-cases+repos → controller/routes → frontend") is directionally right but its middle slice ("use-cases+repos") alone is ~995 lines; split further into 3 units (checkout use-case / checkout infra+integration / admin use-cases) so every unit lands near or under budget.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | `Order`/`OrderItem` migration + Sequelize models, registered in `models/index.js`/`db.d.ts` | PR 1 | N/A (no app code yet) — verify via `pnpm --filter backend db:migrate` then `db:migrate:undo` | Local/dev MySQL 8, apply then roll back the migration twice | Revert migration file, both model files, and the `models/index.js`/`db.d.ts` diffs; no other file references them yet |
| 2 | `Order`/`OrderItem` entities, all new/modified ports, exceptions, `OrderDTO` | PR 2 (bases on PR 1) | `cd backend && npx jest Order.test.ts OrderItem.test.ts OrderDTO.test.ts` | N/A — pure unit tests, no DB, no wiring | Revert `domain/entities/`, `domain/ports/`, `domain/exceptions/`, `application/dtos/OrderDTO.ts`; nothing consumes them yet |
| 3 | `CreateOrderUseCase` checkout logic, tested against fakes for all 6 ports | PR 3 (bases on PR 2) | `cd backend && npx jest CreateOrderUseCase.test.ts` | N/A — fakes only, no real adapters wired yet | Revert `CreateOrderUseCase.ts` + its test; not yet reachable from any route |
| 4 | Real adapters for checkout (`SequelizeOrderRepository`, `SequelizeUnitOfWork`, tx-aware `adjustStock`/`findByIdInternal`, `findActiveForUpdate`/`markOrdered`, `ManualPaymentGateway`) + integration tests | PR 4 (bases on PR 3) | `cd backend && npm run test:integration -- order` | Real MySQL 8 container/test DB | Revert the 5 adapter files + integration test files; `ProductRepositoryPort`/`ShoppingCartRepositoryPort` contracts stay additive-compatible |
| 5 | Admin use-cases: `GetOrderByIdUseCase`, `ListOrdersUseCase`, `ConfirmOrderPaymentUseCase`, `CancelOrderUseCase` | PR 5 (bases on PR 4) | `cd backend && npx jest GetOrderByIdUseCase ListOrdersUseCase ConfirmOrderPaymentUseCase CancelOrderUseCase` then `npm run test:integration -- cancel-restock` | Real MySQL 8 (cancel-restock case only) | Revert the 4 use-case files + tests; `CreateOrderUseCase` (PR 3/4) unaffected |
| 6 | `OrderApiController`, `orderValidators`, `/api/orders` routes, `backend/tools/architecture/config.js` allowlist edit | PR 6 (bases on PR 5) | `cd backend && npx jest orders.route.test.ts` then `pnpm architecture:check` | `pnpm --filter backend dev` + `curl -X POST localhost:3031/api/orders` manual smoke | Revert controller/validator/route files, `routes/api/index.ts` mount line, and the `config.js` allowlist entry; use-case layer (PR 3-5) stays functional headless |
| 7 | Frontend: fix `checkout()`'s two pre-existing bugs (unawaited `flushCartSync`, premature cart clear), order-detail view, `CartList.astro` loading/error UI | PR 7 (bases on PR 6) | `cd frontend && npx vitest run checkout order.service` | `pnpm --filter frontend dev`, manual checkout click-through against PR 6's live API | Revert `checkout.ts`, `CartService.ts` diff, `CartList.astro` diff, `orders/` domain, `order.astro`; backend fully functional standalone via curl |

## Work Unit 1: Migration + Sequelize Models

### Phase 1: `Order`/`OrderItem` migration

- [x] 1.1 Create `backend/src/database/migrations/20260828000000-orders.js` following `20260724000000-baseline.js`'s exact shape (raw-SQL `up`/`down`, `TABLES_IN_ORDER`, attributed try/catch). `Order` table: `id_order`, `id_user`, `idempotency_key varchar(64)`, `order_status varchar(50) DEFAULT 'AWAITING_PAYMENT'`, `payment_reference varchar(255) NULL`, `created_at datetime NOT NULL`, `UNIQUE (id_user, idempotency_key)`, `fk_order_user` → `User` `ON DELETE NO ACTION`.
- [x] 1.2 Same migration, `OrderItem` table: `id_order_item`, `id_order`, **`id_product int NULL`**, **`product_name varchar(255) NOT NULL`** (snapshot, survives product deletion), `quantity`, `unit_price decimal(10,2)`, `fk_order_item_order` → `Order` `ON DELETE CASCADE`, **`fk_order_item_product` → `Product` `ON DELETE SET NULL`** (not `CASCADE`/`RESTRICT` — see design's rejected-options table; this is the load-bearing FK decision that keeps `DELETE /api/products/:id` returning 204).
- [x] 1.3 `down()` drops `OrderItem` before `Order` (FK order), matching baseline's reverse-loop pattern.
- [x] 1.4 Run `pnpm --filter backend db:migrate` against local/dev MySQL; verify both tables, the unique constraint, and both FKs (`SHOW CREATE TABLE`); run `pnpm --filter backend db:migrate:undo` twice to confirm clean `down`.

### Phase 2: Sequelize models + registration

- [x] 2.1 Create `backend/src/database/models/Order.js` and `OrderItem.js` following `ShoppingCart.js` exactly: `sequelize.define`, explicit `field:` snake_case mappings, `tableName`, `timestamps: false`.
- [x] 2.2 Modify `backend/src/database/models/index.js` — register both models in `initializeModels()` and add the 4 associations from design (`User.hasMany(Order)`, `Order.belongsTo(User)`, `Order.hasMany(OrderItem, {as:'items'})`, `OrderItem.belongsTo(Order)`, `Product.hasMany(OrderItem)`, `OrderItem.belongsTo(Product, {as:'product'})`).
- [x] 2.3 Modify `backend/src/database/models/db.d.ts` — add `OrderAttributes`/`OrderItemAttributes`, `OrderInstance`/`OrderItemInstance`, `ModelCtor` exports for both.
- [x] 2.4 `pnpm --filter backend build` (TypeScript compile) green with no other code referencing the new models yet.

## Work Unit 2: Domain Entities + Ports + Exceptions + DTO

### Phase 3: `Order`/`OrderItem` entities

- [x] 3.1 RED: create `backend/src/domain/entities/Order.test.ts` covering `order-domain` spec scenarios — valid construction (status `AWAITING_PAYMENT`, `totalAmount` derived), no shipping/contact/notes property, all 3 `LEGAL_TRANSITIONS` scenarios (`AWAITING_PAYMENT→PAID`, `→CANCELLED`, terminal-state rejection for both `PAID` and `CANCELLED`), zero-quantity rejection, `totalAmount` sum across 2 items = 130.
- [x] 3.2 RED: create `OrderItem.test.ts` covering quantity-must-be-positive-integer and unitPrice-must-be-non-negative invariants, plus `subtotal` computation.
- [x] 3.3 GREEN: create `backend/src/domain/entities/Order.ts` and `OrderItem.ts` per design's exact class shape (`LEGAL_TRANSITIONS` table, `canTransition`/`canTransitionTo`, `totalAmount` getter, `subtotal` getter). Run 3.1-3.2 to GREEN.

### Phase 4: Ports

- [x] 4.1 Create `backend/src/domain/ports/UnitOfWorkPort.ts` — opaque `TransactionContext` brand + `runInTransaction<T>()`.
- [x] 4.2 Create `backend/src/domain/ports/OrderRepositoryPort.ts` — `NewOrderItemInput`, `createWithItems`, `findByIdempotencyKey`, `findById`, `findAll`, `transitionStatus`, `attachPaymentReference`, per design's exact signatures.
- [x] 4.3 Create `backend/src/domain/ports/PaymentGatewayPort.ts` — `PaymentIntentStatus`, `PaymentIntent` (nullable `redirectUrl`), `InitiatePaymentInput`, `initiate`/`confirm`/`cancel`.
- [x] 4.4 Modify `backend/src/domain/ports/ProductRepositoryPort.ts` — `adjustStock(id, delta, tx?)` optional third parameter; modify `backend/src/domain/ports/ShoppingCartRepositoryPort.ts` — add `findActiveForUpdate(userId, tx)` and `markOrdered(userId, cartIds, tx)`.
- [x] 4.5 Modify `backend/src/domain/ports/index.ts` — add the 3 new barrel exports alphabetically.

### Phase 5: Exceptions + `OrderDTO`

- [x] 5.1 Create `OrderValidationException.ts`, `InsufficientStockException.ts` (carries `shortages: {idProduct,productName,requested,available}[]`), `EmptyCartException.ts`, `IllegalOrderTransitionException.ts`, `DuplicateIdempotencyKeyException.ts` under `backend/src/domain/exceptions/`.
- [x] 5.2 RED: create `backend/src/application/dtos/OrderDTO.test.ts` — `mapToOrderDTO` produces the exact response shape from design (idempotencyKey deliberately absent, `idProduct: number|null`, `subtotal` per item, `totalAmount`).
- [x] 5.3 GREEN: create `backend/src/application/dtos/OrderDTO.ts` — `OrderDTO`, `OrderItemDTO`, `mapToOrderDTO`. Run 5.2 to GREEN.

## Work Unit 3: `CreateOrderUseCase` (Checkout Logic)

### Phase 6: Checkout use case, tested against fakes only

- [x] 6.1 RED: create `backend/src/application/__tests__/CreateOrderUseCase.test.ts` (co-located with the rest of the use-case test suite per existing convention — see deviation note below) with hand-written fakes for all 6 ports (`UnitOfWorkPort`, `OrderRepositoryPort`, `ShoppingCartRepositoryPort`, `ProductRepositoryPort`, `PaymentGatewayPort`, `LoggerPort`). Cases: (a) happy path — sufficient stock, order created `AWAITING_PAYMENT`, cart `markOrdered` called with the locked row ids; (b) empty `ACTIVE` cart → `EmptyCartException`, no transaction side effects; (c) one insufficient line item among several → `InsufficientStockException` with **every** failing item collected (not fail-fast — assert 2+ shortages when 2+ items fail), stock unchanged, cart untouched; (d) idempotency replay — fake `orderRepo.findByIdempotencyKey` returns a hit before `runInTransaction` is ever called; (e) post-commit gateway ordering — fake `UnitOfWork` records commit timestamp, assert `paymentGateway.initiate` is called strictly after commit, never inside the transaction callback. Also added a 6th case (gateway failure is logged and swallowed, never rethrown).
- [x] 6.2 GREEN: create `backend/src/application/use-cases/CreateOrderUseCase.ts` implementing the exact data flow from design (`findByIdempotencyKey` → `runInTransaction` → `findActiveForUpdate` → per-item `adjustStock` with shortage collection → `createWithItems` → `markOrdered` → post-commit `initiate` + `attachPaymentReference`, gateway failure caught and `logger.warn`-only, never rethrown). Hardcode the `'ARS'` currency constant for `initiate({..., currency: 'ARS'})` — already resolved as an implementation detail per proposal, not an open question. Run 6.1 to GREEN.
- [x] 6.3 Confirm `CreateOrderUseCase.ts` has zero imports from `sequelize` or any infrastructure module (architecture boundary check by inspection — full `architecture:check` run happens in Work Unit 6 once routes exist). Confirmed via `rg` — zero matches. `pnpm --filter backend architecture:check` also run now (green) as an extra confirmation, though the full allowlist wiring only matters once routes exist in Work Unit 6.

## Work Unit 4: Checkout Infra Adapters + Integration Tests

### Phase 7: Tx-aware `SequelizeProductRepository`

- [x] 7.1 RED: extend `SequelizeProductRepository.test.ts` (or equivalent) — calling `adjustStock(id, delta, tx)` participates in the caller's transaction (rollback undoes the stock change); calling with no `tx` argument is behaviorally identical to today (existing `PATCH /api/products/:id/stock` tests must stay green, unchanged).
- [x] 7.2 GREEN: modify `SequelizeProductRepository.ts` — `adjustStock` accepts optional `tx`, passes it to the conditional `UPDATE`. **Explicit task, not assumed**: add a **private** `findByIdInternal(id, transaction?)` and route `adjustStock`'s follow-up read through it using the **same transaction connection** — a read on a separate connection would observe pre-decrement state under `REPEATABLE READ`. The public `findById` on the port stays single-arg; only the internal follow-up read gets the transaction. Add a dedicated unit/integration test proving the follow-up read reflects the decrement *within* the same open transaction (read-uncommitted-to-self, not a second connection).
- [x] 7.3 Run 7.1 + regression suite for `products.test.ts` / stock PATCH — all green, no behavior change on the standalone path.

### Phase 8: `SequelizeShoppingCartRepository` — lock + non-destructive transition

**Note (added during Work Unit 2 apply)**: `findActiveForUpdate`/`markOrdered` already exist on `SequelizeShoppingCartRepository.ts` as throwing stubs (`Error('... is not implemented yet')`), added only to keep `ShoppingCartRepositoryPort`'s new required methods from breaking `tsc`/`implements` for the existing class between stacked PRs. Phase 8 replaces those stub bodies with the real implementation — it does not need to add new method signatures to the class.

- [x] 8.1 RED: extend `SequelizeShoppingCartRepository.test.ts` — `findActiveForUpdate(userId, tx)` locks only `ShoppingCart` rows; assert (via a real-DB integration case, not a mock) that a concurrent transaction attempting to read/lock the same user's `Product` rows is **not** blocked by this call, proving no `include`-triggered join lock leaked onto `Product`.
- [x] 8.2 GREEN: implement `findActiveForUpdate` as **two separate queries**, per design's explicit rejection of `include`: (1) `db.ShoppingCart.findAll({ where: {idUser, cartStatus:'ACTIVE'}, transaction, lock: Transaction.LOCK.UPDATE })` — **no `include`**; (2) a second, **non-locking** `db.Product.findAll({ where: { idProduct: ids }, transaction })` to source product names, merged into the returned `ShoppingCart[]` in application code. Do not collapse these into one Sequelize call.
- [x] 8.3 RED: `markOrdered(userId, cartIds, tx)` — assert it is a pure `UPDATE ... WHERE id_cart IN (:ids) AND id_user=:userId AND cart_status='ACTIVE'` (row ids preserved), returns the affected-row count, and never issues a `DELETE`/`INSERT` (spec: "never by deleting and recreating rows").
- [x] 8.4 GREEN: implement `markOrdered` per 8.3. Run 8.1-8.3 to GREEN.

### Phase 9: `SequelizeOrderRepository`, `SequelizeUnitOfWork`, `ManualPaymentGateway`

- [x] 9.1 RED+GREEN: create `SequelizeUnitOfWork.ts` implementing `UnitOfWorkPort.runInTransaction` via `db.sequelize.transaction()`, with a unit test asserting commit-on-resolve / rollback-on-throw.
- [x] 9.2 RED+GREEN: create `SequelizeOrderRepository.ts` implementing all 6 `OrderRepositoryPort` methods against the `Order`/`OrderItem` reserved-word-quoted tables (`Order` is a MySQL reserved word — every raw SQL reference backtick-quoted). `createWithItems` maps a `UNIQUE(id_user,idempotency_key)` violation to `DuplicateIdempotencyKeyException`. `transitionStatus` issues the guarded `UPDATE ... WHERE order_status=:from` and returns `affectedRows===1`.
- [x] 9.3 RED+GREEN: create `ManualPaymentGateway.ts` — `initiate` resolves synchronously with a reference and zero network calls; `confirm`/`cancel` round-trip against that same reference. Unit test asserts no `fetch`/`http` call is ever made.

### Phase 10: Real-DB integration tests

- [x] 10.1 Create `backend/src/__tests__/order-checkout.integration.test.ts` (`*.integration.test.ts`, `pnpm test:integration`, real MySQL 8). Cases: rollback on shortage leaves stock+cart untouched; two concurrent checkouts from the same user with the `FOR UPDATE` lock yield exactly one order (spec: "Two concurrent checkouts from the same user yield one order"); unique-violation retry replays the original committed order without a second decrement; `markOrdered` updates existing row ids in place (never reinserts — assert `id_cart` values unchanged before/after).
- [x] 10.2 **Explicit regression task** (do not leave to memory): create/extend an integration test proving `DELETE /api/products/:id` still returns 204 for a product that has been ordered — the entire reason for `ON DELETE SET NULL` over `CASCADE`/`RESTRICT`. Assert the surviving `OrderItem` row has `id_product = NULL` and its `product_name` snapshot intact after the delete.
- [x] 10.3 Run `cd backend && npm run test:integration -- order` — all new integration cases green; confirm no regression in existing integration suites.

## Work Unit 5: Admin Use-Cases

### Phase 11: `GetOrderByIdUseCase` + `ListOrdersUseCase`

- [x] 11.1 RED+GREEN: `GetOrderByIdUseCase.ts` — returns the order for its owner or an ADMIN; test covers owner success and non-owner denial (403/404 decided at controller layer in Work Unit 6 — use case just signals "not authorized to view").
- [x] 11.2 RED+GREEN: `ListOrdersUseCase.ts` — returns `orderRepo.findAll()`. **Correction (2026-08-28)**: design.md left the result-set cap as an open question and tasks.md's original wording ("no pagination or cap") contradicted the proposal's actual resolution (a fixed cap as endpoint hygiene, not the deferred pagination feature). Fixed post-apply: `SequelizeOrderRepository.findAll` now orders most-recent-first and caps at `MAX_LISTED = 100`, with no caller-controlled parameter.

### Phase 12: `ConfirmOrderPaymentUseCase` + `CancelOrderUseCase`

- [x] 12.1 RED: `ConfirmOrderPaymentUseCase.test.ts` — `AWAITING_PAYMENT→PAID` succeeds; confirming a `PAID` order is rejected/no-op via the `transitionStatus` affected-row guard (spec: "Double-confirm is rejected").
- [x] 12.2 GREEN: `ConfirmOrderPaymentUseCase.ts` calling `orderRepo.transitionStatus(id, AWAITING_PAYMENT, PAID)`, throwing `IllegalOrderTransitionException` on `affectedRows===0`.
- [x] 12.3 RED: `CancelOrderUseCase.test.ts` — cancel restores exactly the decremented stock per line item; a line item with `idProduct===null` (product deleted) is **skipped** during restock, not errored; second cancel on an already-`CANCELLED` order is a no-op restoring no stock (transition guard runs first, inside the same transaction).
- [x] 12.4 GREEN: `CancelOrderUseCase.ts` — `uow.runInTransaction(tx => transitionStatus(...) then per-item adjustStock(+quantity, tx) skipping null-product items)`. Run 12.3 to GREEN.
- [x] 12.5 Integration test: real cancel-then-restock against MySQL, plus a second cancel proving no double-restock (`cd backend && npm run test:integration -- cancel-restock`). Closed post-verify (2026-08-28): `backend/src/__tests__/order-cancel-restock.integration.test.ts` — real `SequelizeUnitOfWork`/`SequelizeOrderRepository`/`SequelizeProductRepository`, 3 cases: (a) cancel restores exactly the decremented stock per line item and transitions to `CANCELLED`; (b) a second cancel on an already-`CANCELLED` order rejects with `IllegalOrderTransitionException` and does not double-restore; (c) a mid-transaction failure on the second item's restock (injected via `jest.spyOn`, first call runs the real implementation) rolls back atomically — order stays `AWAITING_PAYMENT` AND both products' stock stays at the post-checkout decremented level, including the already-applied first-item restock. All 3 RED-confirmed via temporary production mutations (off-by-one restock quantity; swallowed restock errors), then reverted — no production code changed.

## Work Unit 6: Controller + Routes + Architecture Allowlist

### Phase 13: Controller + validators + allowlist

- [x] 13.1 **Explicit, easy-to-forget task**: modify `backend/tools/architecture/config.js` — add `'orders'` to the `compositionRoots` allowlist array (line ~21, becomes `['index','products','users','cart','categories','franchises','orders']`). Do this *before* wiring routes, not after — otherwise `architecture:check`'s `composition.allowlist` rule fails every import in the new routes file.
- [x] 13.2 Create `backend/src/infrastructure/middlewares/validators/orderValidators.ts` — `Idempotency-Key` header presence/non-blank validator, mapped to 400 `IDEMPOTENCY_KEY_REQUIRED` on failure. **Deviation (see report)**: implemented as a standalone Express middleware, not an express-validator chain + `handleValidationErrors`, because the required response shape (`{ error, code: 'IDEMPOTENCY_KEY_REQUIRED' }`) needs a `code` field that generic `handleValidationErrors` (`{ errors: [...] }`) cannot produce — design.md's own error-map table implies every row in it needs `code`, but its routes snippet literally chains `handleValidationErrors` after `orderCreateValidation`. Flagged, not silently resolved.
- [x] 13.3 RED: `OrderApiController.test.ts` (unit, mocked use cases) — 5 handlers (`create`, `show`, `index`, `confirmPayment`, `cancel`) map each exception per design's error table (`EmptyCartException`→409 `EMPTY_CART`, `InsufficientStockException`→409 `INSUFFICIENT_STOCK` with full `shortages[]`, `IllegalOrderTransitionException`→409, not-found/not-owned→404 `ORDER_NOT_FOUND`).
- [x] 13.4 GREEN: `OrderApiController.ts` implementing all 5 handlers + the error map. `show` compares `req.user.userId` to `order.idUser`, 404 for non-owner, ADMIN bypass via `req.user.idRole===Role.ADMIN` (`Role` imported here, in infrastructure — never in domain/application). Run 13.3 to GREEN.

### Phase 14: Routes + route-level tests

- [x] 14.1 Create `backend/src/infrastructure/routes/api/orders.ts` — mount the 5 routes exactly as design specifies (`POST /orders` with `csrfGuard`+`orderCreateValidation`; `GET /orders/:id` with no `adminGuard`; `GET /orders`, `POST /orders/:id/confirm-payment`, `POST /orders/:id/cancel` all with `adminGuard` imported verbatim from `middlewares/auth`, never re-derived inline).
- [x] 14.2 Modify `backend/src/infrastructure/routes/api/index.ts` — mount `ordersApiRouter`.
- [x] 14.3 RED+GREEN: `orders.test.ts` (supertest, full router; see report for the `orders.route.test.ts` naming deviation) — 400 missing key; 409 shapes incl. `shortages[]`; 403 for STAFF/buyer on all 3 admin routes; 404 non-owner detail; ADMIN bypass on detail; 201 happy path.
- [x] 14.4 Run `pnpm architecture:check` — green, confirming the Phase 13.1 allowlist edit actually took effect for the new routes file. **Found and fixed a pre-existing collateral break**: `backend/src/architecture/__tests__/architecture-boundaries.test.js` used `routes/api/orders.ts` as its hardcoded "non-allowlisted sibling" negative-control fixture; once `'orders'` was added to the real allowlist, that fixture's assumption became false. Repointed the fixture to `routes/api/reports.ts` (still non-allowlisted) — test intent unchanged.
- [x] 14.5 Run full regression: `cd backend && npx jest` — 103/103 suites, 775/775 tests green, including existing `products.test.ts` and stock-PATCH suites unchanged.

## Work Unit 7: Frontend Checkout Fix + Order Detail View

### Phase 15: `checkout()` — fix both pre-existing bugs

- [x] 15.1 RED: `frontend/src/domains/cart/services/checkout.test.ts` (Vitest, mocked `fetch`) — asserts `checkout()` **awaits `flushCartSync()` before** issuing the `POST /api/orders` call (today's bug: never awaited, so the server's cart can lag what the user sees); asserts on a failure response (e.g. `INSUFFICIENT_STOCK`) the **local cart is NOT cleared** (today's bug: clears optimistically before knowing the outcome); asserts on success the local cart is cleared **without** scheduling a background sync (`discardPendingSync`, not a redundant `PUT /api/cart []`); asserts a `NETWORK`-failure retry reuses the **same** cached `pendingCheckoutKey`. Confirmed RED (`Cannot find module './checkout'`) before any production code existed.
- [x] 15.2 GREEN: create `frontend/src/domains/cart/services/checkout.ts` — `CheckoutResult`/`CheckoutErrorCode`/`StockShortage` types, module-level `pendingCheckoutKey` cache, the exact 6-step flow from design (unauthenticated short-circuit → `await flushCartSync()` → idempotency key → `fetch` with `withCredentials` → success clears without sync / failure leaves cart untouched). Modified `CartService.ts` — `checkout()` becomes `Promise<CheckoutResult>` delegating to the new module, replacing the old fake destroy-and-return-`true` implementation entirely; also replaced `CartService.test.ts`'s old boolean-`checkout()` describe block (approval-tests-then-behavior-change, per strict-tdd's refactoring discipline — the old tests asserted a contract this unit deliberately breaks) with a thin delegation-only describe block, since full behavioral coverage now lives in `checkout.test.ts`. 15.1 GREEN: 8/8 passing; safety net `CartService.test.ts` also green (37/37 before, 6/6 in its new delegation-only block after).

### Phase 16: UI wiring + order-detail domain

- [x] 16.1 Modify `CartList.astro` — async click handler (drops both `alert()` calls), `setCheckoutBusy`/`clearCheckoutError`/`renderCheckoutError` using `document.createElement`+`textContent` (never `innerHTML`, matching `renderPriceDrift`'s discipline), one rendered line per shortage on `INSUFFICIENT_STOCK`, redirect to `/order?id=` on success. **Shipped with Phase 15 (PR7a), not 16.2-16.5 (PR7b)**: `checkout()`'s return type changed from `Promise<boolean>` to `Promise<CheckoutResult>` in 15.2, and `CartList.astro` is its only caller — the two cannot compile independently. The `/order?id=` redirect target does not exist until PR7b merges; between the two PRs a successful checkout redirects to a 404, a short-lived, accepted gap (analogous to Work Unit 4's split).
- [x] 16.2 Created the self-contained `frontend/src/domains/orders/{index.ts, services/order.service.ts, components/OrderDetail.astro}` — imports only from itself and `../../../config` (domain-locality rule, confirmed by `pnpm architecture:check` green — `frontend.domain.locality` IS enforced for `frontend/src/domains/**`, not backend-only as the apply prompt asked to verify), fetches `GET /api/orders/:id`, renders the same `OrderDTO` shape the checkout 201 response returns. **Deviation, not in design's file list**: also created `frontend/src/domains/orders/services/orderPresenter.ts` (+ its test) — a pure formatting function extracted from `OrderDetail.astro`'s script so 16.4's "smoke test... rendering the sample DTO" has a real, testable target; this repo has no Astro-component-render test harness (`@astrojs/container` or equivalent is not installed, and no existing `.astro` component in the codebase is unit-tested — `CartList.astro`/`ProductCard.astro`/`LoginForm.astro` all rely on manual/E2E coverage for their DOM wiring, only their extracted pure logic is Vitest-tested). Flagged rather than silently adding a new test-tooling dependency for one component.
- [x] 16.3 Created `frontend/src/pages/order.astro` wiring `OrderDetail.astro` to the `?id=` query param.
- [x] 16.4 RED+GREEN: Vitest tests for `order.service.ts` (fetch + error mapping: 200/404→`NOT_FOUND`/thrown-fetch→`NETWORK`/other non-ok→`UNKNOWN`) and `orderPresenter.ts` (the extracted pure render-logic smoke test, using the exact sample DTO from design.md's "Buyer order-detail response DTO" section, incl. a null-`paymentReference` and a null-`idProduct` triangulation case).
- [x] 16.5 **Superseded by real E2E, not manual QA**: `e2e/tests/cart.spec.ts`'s "Checkout Navigation Authenticated Success" now runs the genuine flow in CI against a live backend — adds to cart, clicks checkout, asserts a real redirect to `/order?id=<number>`, asserts the cart is cleared only on success. This also caught and fixed a real pre-existing gap: every seeded product had `stock: 0` (neither `products.json` nor `seed.js` ever set it), so the first genuine checkout attempt correctly 409'd with `INSUFFICIENT_STOCK` — fixed in `seed.js` (PR7a). Not yet covered by E2E: an assertion on the order-detail page's rendered *content* (only the redirect URL is checked) and an explicit `INSUFFICIENT_STOCK` E2E case — worth a small follow-up, not blocking.

## Key Learnings

1. Design's own 5-way split undercounts the middle "use-cases+repos" slice — once fakes-based unit tests and real-DB integration tests are counted, it is closer to 995 lines and needs 3 separate work units, not 1.
2. `CreateOrderUseCase` can ship and be fully unit-tested (via fakes for all 6 ports) before any real Sequelize adapter exists, which is what allows splitting "use-case logic" from "infra adapters" into independent stacked PRs.
3. The `ON DELETE SET NULL` FK decision only pays off if a regression test explicitly proves `DELETE /api/products/:id` still returns 204 for an ordered product — this must be a named task, not inferred from the migration alone.
4. `architecture/config.js`'s composition-root allowlist edit must land before routes are wired, mirroring the exact CI-failure mode design flagged (`composition.allowlist` fails every import otherwise).
5. **Work Unit 4 deviation, found by the real-DB test itself**: `database/models/Order.js` needed an explicit `indexes: [{ unique: true, fields: ['id_user','idempotency_key'] }]` model-level declaration. The migration's raw-SQL `UNIQUE KEY uq_order_user_idempotency` is invisible to `sequelize.sync({force:false})`, which the real-DB test bootstrap (`testDb.ts`) uses — so without this addition, `SequelizeOrderRepository`'s `DuplicateIdempotencyKeyException` mapping was untestable (and unreachable) against the test database. Added to `Order.js`, mirroring `Product.js`'s existing `indexes` precedent.
6. **A verbal proposal-stage decision that never made it into design.md's own text got resolved the wrong way by a later phase.** `ListOrdersUseCase`'s ADMIN result-set cap was decided during the proposal round, but design.md still listed it as an open question; `sdd-tasks` read that ambiguity and resolved it as "no cap" — the opposite of what was actually decided. Caught and fixed post-apply (Work Unit 5): a decision only really exists once it is written into the artifact a later phase will actually read, not wherever it was first said out loud.
7. **Work Unit 6 correctly flagged, rather than silently resolved, a real conflict between design.md's route-wiring snippet and its own error-map table** — the snippet chained a generic validator that cannot produce the `{error, code}` shape the table requires. The fix was verified directly against the generic validator's actual source before being accepted.
8. **Work Units 4 and 7 both landed at ~2x their tasks.md line estimate** and were both split into finer stacked PRs after the fact, along a natural conceptual seam (adapter-by-adapter for Unit 4; bug-fix vs. new-feature for Unit 7) rather than an arbitrary line count — the estimate consistently undercounts strict-TDD triangulated test coverage.
9. **The first genuine use of real inventory in this codebase's E2E suite exposed that every seeded product had `stock: 0`** (neither `products.json` nor `seed.js` ever set it) — invisible for the entire life of this project until checkout stopped being fake and started actually decrementing stock. `CreateOrderUseCase` correctly rejected the first live E2E checkout attempt with `INSUFFICIENT_STOCK`; the bug was in seed data, not the new order code.

## Result Contract

- status: done — all 7 work units (16 phases / 60 checkbox tasks) applied. Work Units 4 and 7 each split into finer stacked PRs after landing ~2x their line estimate (Unit 4: 3 PRs; Unit 7: 2 PRs) — 10 PRs total delivered the full change.
- executive_summary: Full honest-checkout loop shipped end-to-end: `Order`/`OrderItem` migration+domain+ports, `CreateOrderUseCase` (idempotent, all-or-nothing stock, transaction-scoped), real Sequelize/manual adapters verified against a live MySQL, 4 admin use-cases, a 5-route `/api/orders` HTTP surface, and a genuinely async frontend checkout + order-detail view — replacing the old fake checkout that destroyed the cart and returned success unconditionally before the network request even resolved.
- artifacts: openspec/changes/orders-checkout/tasks.md; full file list spans backend (migrations, domain, application, infrastructure) and frontend (cart + new orders domain) — see each Work Unit's own file table above.
- next_recommended: sdd-verify
- risks: (1) Work Unit 4's no-`include` lock-read split and tx-scoped `findByIdInternal` follow-up read remain the most subtle correctness points in the whole change; (2) `ListOrdersUseCase`'s cap (item 6 above) and the checkout validator's error-shape conflict (item 7) are both now resolved and verified, but are exactly the class of drift that can recur between proposal-stage verbal decisions and what later phases actually read; (3) `orderPresenter.ts` has no Astro-component-render test harness backing it — this repo has none for any `.astro` component; (4) no E2E assertion yet on the order-detail page's rendered content or an explicit `INSUFFICIENT_STOCK` case (only the redirect URL and cart-clearing are asserted) — a reasonable small follow-up, not a blocker.
- skill_resolution: paths-injected
