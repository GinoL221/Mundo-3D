```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:07b4bbfabec7c61d9aa82b8b93ef064487fdd7608b12cd85493c00525d987ffe
verdict: fail
blockers: 2
critical_findings: 2
requirements: 20/21
scenarios: 35/37
test_command: cd backend && npx jest
test_exit_code: 0
test_output_hash: sha256:2f94a4c7da1450b0805257f6a2c86879a045e7150183e615e44b16a85aa64d78
build_command: PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build
build_exit_code: 0
build_output_hash: sha256:04bfbc90fb78ac7c7d3d1f128afeeab99f662d214a35d02a4ff18b4d18c621da
```

## Verification Report

**Change**: orders-checkout
**Version**: N/A (8 spec deltas under `openspec/changes/orders-checkout/specs/`)
**Mode**: Strict TDD
**Verified at**: `main` @ `b2f652c` — 10 merged PRs (#78–#87)

> Every declared command exited 0. The `fail` verdict is driven entirely by two
> coverage/completeness gaps, not by any failing check. No defect was found in
> shipped behaviour.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 60 |
| Tasks complete | 59 |
| Tasks incomplete | 1 (**12.5** — real-DB cancel/restock integration test) |
| Work units | 7 (16 phases), delivered as 10 PRs |

Task **12.5** is the sole unchecked box. It is not a bookkeeping slip: no
cancel-restock integration test exists anywhere in the repo (verified by
searching every `*.integration.test.*` file for `CancelOrderUseCase` /
`cancel-restock` — zero matches). tasks.md itself states *"Pick this up before
archive or alongside Work Unit 6."* That instruction was never executed.

### Build & Tests Execution

**Backend fast suite**: PASS — `cd backend && npx jest` → exit 0
```text
Test Suites: 103 passed, 103 total
Tests:       775 passed, 775 total
Time:        13.321 s
```

**Real-DB integration**: PASS — exit 0. Disposable MySQL 8 container
(`mysql:8.0`, no port mapping, bridge IP `172.17.0.2`),
`DB_HOST=<ip> DB_USER=root DB_PASS="" npx jest --config jest.integration.config.js`.
Container removed after the run.
```text
Test Suites: 7 passed, 7 total
Tests:       21 passed, 21 total
Time:        30.849 s
```

**Frontend unit**: PASS — `pnpm run frontend:test` → exit 0 — 12 files, 157 tests.

**Quality gates** — all exit 0:

| Command | Result |
|---|---|
| `pnpm --filter backend type-check` (`tsc --noEmit`) | PASS — 0 errors |
| `pnpm --filter backend architecture:check` | PASS |
| `pnpm --filter backend lint` (`eslint src/`) | PASS — 0 errors |
| `pnpm run frontend:check` (`astro check`) | PASS — 61 files, 0 errors / 0 warnings / 0 hints |
| `pnpm run frontend:quality-check` | PASS |
| `PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build` | PASS — 16 pages, incl. `/order` |

**E2E (Playwright)**: NOT REPRODUCED LOCALLY — stated explicitly, not skipped
silently. Two attempts against a full local stack (backend :3032 + Astro dev
:4322 + the same disposable MySQL 8, seeded by the suite's own `global-setup` →
`db:test:prepare`, which completed successfully). Both failed at
**`cart.spec.ts:182`**, the `waitForResponse` for the *add-to-cart*
`PUT /api/cart` — **before the checkout button is ever clicked**, so no checkout
code executed. The first run logged repeated Vite `504 (Outdated Optimize Dep)`
resource failures, which break the product-page hydration that attaches the
`#add-to-cart-btn` listener; clearing `node_modules/.vite` and `.astro` and
retrying at a 60 s timeout reproduced the identical pre-checkout failure. The
sibling guest-flow checkout test (`Checkout Navigation Guest Redirect`) passed in
the same run. This is a local dev-server/hydration environment artifact, not
evidence about checkout.

CI evidence stands in its place, verified live via `gh pr checks`:

| PR | End-to-end (Playwright) | Real-DB integration | Quality |
|---|---|---|---|
| #86 (PR7a) | pass (1m48s) | pass | pass |
| #87 (PR7b, final) | pass (2m6s) | pass | pass |

**Coverage**: Not collected — no coverage threshold is configured in
`backend/jest.config.js`; the strict-TDD module treats coverage as
informational, never blocking.

### Spec Compliance Matrix

37 scenarios across 21 requirements in 8 capability specs.

#### `order-domain` (4 requirements / 9 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Order/OrderItem Entity Structure | Valid order entity is constructed | `Order.test.ts > is constructed with status AWAITING_PAYMENT and a derived totalAmount` | COMPLIANT |
| Order/OrderItem Entity Structure | No shipping/contact/notes fields exist | `Order.test.ts > exposes no shipping, contact, or notes property` | COMPLIANT |
| **Item Price Frozen at Creation** | **Price is copied from the cart, not the product** | **(none found)** | **UNTESTED** |
| **Item Price Frozen at Creation** | **Later product price changes do not affect the order** | **(none found)** | **UNTESTED** |
| OrderStatus State Machine | AWAITING_PAYMENT to PAID | `Order.test.ts > allows AWAITING_PAYMENT -> PAID` | COMPLIANT |
| OrderStatus State Machine | AWAITING_PAYMENT to CANCELLED | `Order.test.ts > allows AWAITING_PAYMENT -> CANCELLED` | COMPLIANT |
| OrderStatus State Machine | Transition out of a terminal state is illegal | `Order.test.ts > rejects any transition out of PAID (terminal)` + `> ...out of CANCELLED (terminal)` | COMPLIANT |
| Monetary/Quantity Invariants | Invalid quantity is rejected | `OrderItem.test.ts > rejects a zero quantity` / `negative` / `non-integer` (3 cases) | COMPLIANT |
| Monetary/Quantity Invariants | Total amount is computed from line items | `Order.test.ts > computes totalAmount as the sum of item subtotals` | COMPLIANT |

#### `order-checkout` (5 requirements / 9 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Idempotency Key on Checkout | Missing Idempotency-Key is rejected | `orders.test.ts > returns 400 IDEMPOTENCY_KEY_REQUIRED when the Idempotency-Key header is missing` | COMPLIANT |
| Idempotency Key on Checkout | First request with a key creates an order | `orders.test.ts > returns 201 and the created order on a happy path`; `CreateOrderUseCase.test.ts > (a) happy path` | COMPLIANT |
| Idempotency Key on Checkout | Retry with the same key replays the original order | `CreateOrderUseCase.test.ts > (d) idempotent replay`; `order-checkout.integration.test.ts > idempotent replay: a second call with the same key returns the original order without a second stock decrement` | COMPLIANT |
| All-or-Nothing Stock Decrement | Sufficient stock for all items succeeds | `order-checkout.integration.test.ts > decrements stock, creates an AWAITING_PAYMENT order...` | COMPLIANT |
| All-or-Nothing Stock Decrement | One insufficient item rejects the whole order | `CreateOrderUseCase.test.ts > (c) all-or-nothing: collects every short line item`; `order-checkout.integration.test.ts > leaves stock and the ACTIVE cart completely untouched and creates no order`; `orders.test.ts > returns 409 INSUFFICIENT_STOCK with the full shortages list` | COMPLIANT |
| Non-Destructive Cart Transition | Cart is empty after successful checkout | `order-checkout.integration.test.ts` — `readActiveCartCount(userId) === 0` post-commit | COMPLIANT |
| Buyer Views the Just-Placed Order | Owner retrieves their order detail | `orders.test.ts > returns 200 for the owning buyer` | COMPLIANT |
| Buyer Views the Just-Placed Order | Non-owner is denied | `orders.test.ts > returns 404 for a non-owner buyer` (spec permits 403 or 404) | COMPLIANT |
| Concurrent Checkout Backstop | Two concurrent checkouts yield one order | `order-checkout.integration.test.ts > two concurrent checkouts from the same user yield exactly one committed order; the loser sees an empty cart` (real MySQL, two connections) | COMPLIANT |

#### `order-administration` (4 requirements / 7 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| ADMIN-Only Access | ADMIN is allowed | `orders.test.ts > returns 200 and the order list for ADMIN`, `> returns 200 for ADMIN on success` (confirm + cancel) | COMPLIANT |
| ADMIN-Only Access | Non-ADMIN is rejected | `orders.test.ts` — `returns 403 for STAFF` x3 and `returns 403 for a plain buyer` x3, across all three management routes | COMPLIANT |
| List Orders | ADMIN lists orders | `ListOrdersUseCase.test.ts > returns every order mapped to DTO, not scoped to a single user`; `orders.test.ts > returns 200 and the order list for ADMIN` | COMPLIANT |
| Confirm Payment | Confirming an awaiting order succeeds | `ConfirmOrderPaymentUseCase.test.ts > transitions an AWAITING_PAYMENT order to PAID` | COMPLIANT |
| Confirm Payment | Double-confirm is rejected | `ConfirmOrderPaymentUseCase.test.ts > rejects confirming an order that is not AWAITING_PAYMENT`; `orders.test.ts > returns 409 ILLEGAL_ORDER_TRANSITION on double-confirm`; `SequelizeOrderRepository.test.ts > returns false when the guard condition matches zero rows` | COMPLIANT |
| Cancel + Stock Restoration | Cancelling restores exact decremented stock | `CancelOrderUseCase.test.ts > cancels an AWAITING_PAYMENT order and restores exactly the decremented stock per line item` (mock-level only — see W1) | PARTIAL |
| Cancel + Stock Restoration | Second cancel is a no-op | `CancelOrderUseCase.test.ts > is a no-op restoring no stock when the order is already CANCELLED`; `orders.test.ts > returns 409 ILLEGAL_ORDER_TRANSITION on a second cancel` (mock-level only — see W1) | PARTIAL |

#### `payment-gateway-port` (4 requirements / 4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Port Contract | Initiate returns a PaymentIntent | `ManualPaymentGateway.test.ts > resolves synchronously with a generated PENDING reference and makes zero network calls` | COMPLIANT |
| Manual Adapter Semantics | Manual adapter round-trips a reference | `ManualPaymentGateway.test.ts > confirm round-trips the same reference with CONFIRMED status` + `> cancel round-trips...CANCELLED` | COMPLIANT |
| Gateway Never Called Inside Transaction | Order commits before initiate runs | `CreateOrderUseCase.test.ts > (e) calls the payment gateway strictly after the transaction commits, never inside the transactional callback` | COMPLIANT |
| Swap-In Compatibility | Use case accepts any conforming adapter | `CreateOrderUseCase.test.ts` injects a hand-written fake `PaymentGatewayPort` (not `ManualPaymentGateway`) across all 6 cases | COMPLIANT |

#### `cart-domain` (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Non-Destructive ACTIVE to ORDERED | Checkout marks cart rows ORDERED via update | `order-checkout.integration.test.ts` — asserts `{ idCart: cartRowIdBefore, cartStatus: 'ORDERED' }`, proving the row id survived (no delete+reinsert); `SequelizeShoppingCartRepository.test.ts > issues a pure UPDATE (never DELETE/INSERT)...` | COMPLIANT |
| Non-Destructive ACTIVE to ORDERED | ORDERED rows do not appear in the active cart | `order-checkout.integration.test.ts` — `readActiveCartCount(userId) === 0` after commit | COMPLIANT |

#### `product-inventory` (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Transaction-Composable adjustStock | adjustStock composes into a caller transaction (rollback undoes it) | `order-checkout.integration.test.ts > leaves stock and the ACTIVE cart completely untouched and creates no order` — real rollback, real MySQL | COMPLIANT |
| Transaction-Composable adjustStock | Standalone contract is unchanged (incl. 409) | Existing `products.test.ts` + `SequelizeProductRepository.integration.test.ts` (2 concurrency cases) all green, unchanged | COMPLIANT |

#### `schema-migrations` (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Migration Matches Baseline Conventions | Migration follows baseline conventions | `migrate.integration.test.js > up applies the baseline and orders migrations, creating all 8 tables and recording both` + `> created tables enforce real FK constraints and the Product.stock default` | COMPLIANT |
| Migration Matches Baseline Conventions | Down migration drops tables in FK order | `migrate.integration.test.js > down twice reverts both migrations (orders, then baseline) and drops their tables` | COMPLIANT |

#### `concurrency-guarantees` (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Idempotency + Concurrent Checkout | Retried checkout replays instead of duplicating | `order-checkout.integration.test.ts > a second createWithItems call with the same key throws DuplicateIdempotencyKeyException against the real UNIQUE constraint` + `> idempotent replay...without a second stock decrement` | COMPLIANT |
| Idempotency + Concurrent Checkout | Concurrent same-user checkouts serialize via cart lock | `order-checkout.integration.test.ts > two concurrent checkouts from the same user yield exactly one committed order` | COMPLIANT |

**Compliance summary**: **35/37 scenarios compliant** (2 UNTESTED; 2 counted
compliant-but-PARTIAL for missing real-DB depth). **20/21 requirements complete.**

### Correctness (Static Evidence)

| Requirement area | Status | Notes |
|---|---|---|
| Migration DDL | Implemented | `20260828000000-orders.js` matches design's SQL in intent and detail: snake_case, `utf8mb4`/`utf8mb4_unicode_ci`, InnoDB, `decimal(10,2)`, `UNIQUE KEY uq_order_user_idempotency (id_user, idempotency_key)`, `fk_order_user` `NO ACTION`, `fk_order_item_order` `CASCADE`, `fk_order_item_product` **`SET NULL`**. `down()` iterates `[...TABLES_IN_ORDER].reverse()` so `OrderItem` drops before `Order`. |
| Entities | Implemented | `Order`/`OrderItem` match design's class shape exactly. All fields `readonly`. No shipping/contact/notes property. `LEGAL_TRANSITIONS` has empty arrays for both terminal states. |
| Ports | Implemented | `UnitOfWorkPort` (opaque branded `TransactionContext`), `OrderRepositoryPort` (6 methods, exact design signatures), `PaymentGatewayPort` (`redirectUrl?: string \| null`). `adjustStock(id, delta, tx?)` optional 3rd param. `findActiveForUpdate` / `markOrdered` added additively. |
| `CreateOrderUseCase` | Implemented | Exact design data flow. Zero `sequelize`/infrastructure imports (`architecture:check` green). Shortages **collected**, not fail-fast. Gateway called strictly post-commit; failure logged via `logger.warn`, never rethrown. `CHECKOUT_CURRENCY = 'ARS'`. |
| `SequelizeOrderRepository` | Implemented | Reserved word backtick-quoted throughout. `UniqueConstraintError` mapped to `DuplicateIdempotencyKeyException`. `transitionStatus` is the guarded `UPDATE ... WHERE order_status = :from` returning `affectedRows === 1`. Private tx-aware `findByIdInternal`; public `findById` stays single-arg. |
| **ADMIN list cap** (known deviation #3) | **Verified correct** | `findAll()` has **`order: [['idOrder','DESC']]`** and **`limit: SequelizeOrderRepository.MAX_LISTED`** with `private static readonly MAX_LISTED = 100`, no caller-controlled parameter. Covered by `SequelizeOrderRepository.test.ts > orders most-recent-first and caps the result set at 100`. **design.md's open question now reads `[x] Resolved (2026-08-28)` (line 586) and tasks.md Phase 11.2 carries the correction — both artifacts were fixed, not just tasks.md.** |
| `SequelizeShoppingCartRepository` | Implemented | `findActiveForUpdate` is genuinely **two queries**: a locking `ShoppingCart.findAll({lock: LOCK.UPDATE})` with **no `include`**, then a separate non-locking `Product.findAll`. `markOrdered` is a pure raw `UPDATE` scoped to `id_cart IN (...) AND id_user AND cart_status='ACTIVE'`, returning the affected count. |
| `SequelizeUnitOfWork` | Implemented | Managed `db.sequelize.transaction(cb)`; the single `as unknown as TransactionContext` cast is the auditable seam design specified. |
| `ManualPaymentGateway` | Implemented | `randomBytes`-based `MANUAL-<orderId>-<hex>` reference, `status: 'PENDING'`, `redirectUrl: null`, zero network I/O. |
| Controller + routes | Implemented | 5 handlers, full error map (`EMPTY_CART` / `INSUFFICIENT_STOCK` + `shortages` / `ILLEGAL_ORDER_TRANSITION` to 409; `ORDER_NOT_FOUND` to 404). `adminGuard` imported verbatim from `middlewares/auth`, never re-derived. `GET /orders/:id` correctly carries no `adminGuard`; owner check + `Role.ADMIN` bypass live in the controller. `Role` imported only in infrastructure. |
| **Validator wiring** (known deviation #6) | **Code correct** | `routes/api/orders.ts:45` — `router.post('/orders', apiAuthMiddleware, csrfGuard, orderCreateValidation, controller.create)`. `orderCreateValidation` is a **standalone Express middleware** that short-circuits with `{ error, code: 'IDEMPOTENCY_KEY_REQUIRED' }`; `handleValidationErrors` is **not** chained. Proven by `orders.test.ts > returns 400 IDEMPOTENCY_KEY_REQUIRED...`. **See W2 — design.md's text was never corrected.** |
| Architecture allowlist | Implemented | `config.js:21` — `['index','products','users','cart','categories','franchises','orders']`. |
| **Arch-test fixture** (known deviation #7) | **Coherent** | `architecture-boundaries.test.js:123` uses `routes/api/reports.ts` as the "non-allowlisted sibling" negative control, asserting `composition.allowlist` fires. `reports` is genuinely absent from the allowlist, so the fixture's premise holds and the test's intent (a non-allowlisted route import is rejected) is preserved. Correct fix. |
| **Seed stock fix** (known deviation #4) | **Present** | `backend/src/database/seed.js:95` — `stock: p.Stock !== undefined ? p.Stock : (p.stock ?? 50)`. Every seeded product now gets non-trivial stock, so the E2E checkout exercises a real decrement rather than instantly 409-ing. |
| **E2E assertion** (known deviation #5) | **Matches** | `e2e/tests/cart.spec.ts` "Checkout Navigation Authenticated Success" clicks `.cart__btn-checkout`, then `await expect(page).toHaveURL(/\/order\?id=\d+/)` and asserts `localStorage.cart` has length 0. No `alert()`/dialog handling and no redirect-to-home remains. |
| Frontend `checkout.ts` | Implemented | `await flushCartSync()` **before** the POST. Module-level `pendingCheckoutKey` reused on `NETWORK` failure, cleared on success and on any definitive 4xx. Success path: `cartItems.set([]); persistCart([]); discardPendingSync()` — no redundant `PUT /api/cart []`. Failure path leaves the local cart untouched. |
| Frontend UI + orders domain | Implemented | `CartList.astro` async handler, both `alert()` calls gone, `#checkout-error` live region, `document.createElement`+`textContent` per shortage line, `/order?id=` redirect. `domains/orders/` self-contained (`architecture:check` green confirms `frontend.domain.locality`). `/order` builds. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Opaque `TransactionContext` behind `UnitOfWorkPort` | Yes | Single cast confined to adapters; `architecture:check` green. |
| `OrderItem` to `Product` FK `ON DELETE SET NULL` + `product_name` snapshot | Yes | Migration matches; regression proven by `order-checkout.integration.test.ts > still returns true (the exact value ProductApiController.destroy maps to 204)... OrderItem keeps id_product NULL + its product_name snapshot`. |
| Gateway called after commit, never inside the transaction | Yes | Explicitly asserted by `CreateOrderUseCase.test.ts (e)`. |
| Shortages collected, not fail-fast | Yes | Loop collects all; case `(c)` asserts multiple shortages. |
| Lock cart rows without a JOIN | Yes | Two-query implementation, `include`-free lock. |
| `findById` stays single-arg; private `findByIdInternal(id, tx?)` | Yes | In both `SequelizeProductRepository` and `SequelizeOrderRepository`. |
| ADMIN guard is `adminGuard` reused verbatim | Yes | Imported from `middlewares/auth`, applied to the 3 management routes. |
| `GET /orders/:id` returns 404 for non-owner, ADMIN bypass | Yes | Controller + `orders.test.ts`. |
| `idempotencyKey` absent from `OrderDTO` | Yes | `OrderDTO.ts` omits it deliberately. |
| ADMIN list capped at 100 | Yes | Resolved in **both** design.md (`[x]`, line 586) and tasks.md; code + test match. |
| **Route snippet chains `handleValidationErrors`** | **No — doc is stale** | design.md:362-363 still shows `orderCreateValidation, handleValidationErrors`. The shipped code deliberately omits `handleValidationErrors`. **Doc-only gap, not a code defect** — see W2. |
| **`adjustStock` returning `null` reported with `available: 0`** | Partial | design.md:417 says a line item whose product vanished mid-flight (`adjustStock` returns `null`) is reported with `available: 0`. `CreateOrderUseCase.checkout()` only builds a shortage inside its `catch`, so a `null` return records no shortage. Unreachable in practice — see S1. |
| Work Unit 4 split into 3 PRs (#81/#82/#83) | Yes | Reflected in tasks.md Key Learning 8; PR titles confirm `PR4a/4b/4c`. |
| Work Unit 7 split into 2 PRs (#86/#87) | Yes | Reflected in tasks.md 16.1 and Key Learning 8; PR titles confirm `PR7a/7b`. |
| Open question: currency code | Still open | `CHECKOUT_CURRENCY = 'ARS'` hard-coded as design assumed. Acceptable. |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | tasks.md carries explicit RED/GREEN labels on every test-bearing task (3.1-3.3, 5.2-5.3, 6.1-6.2, 7.1-7.3, 8.1-8.4, 9.1-9.3, 11.1-11.2, 12.1-12.4, 13.3-13.4, 14.3, 15.1-15.2, 16.4) |
| All tasks have tests | Yes | Every RED task's named test file exists on disk |
| RED confirmed (tests exist) | Yes | 16/16 test files verified present |
| GREEN confirmed (tests pass) | Yes | All 16 pass in the fresh runs above |
| Triangulation adequate | Yes | `OrderItem.test.ts` 7 cases for 2 invariants; `Order.test.ts` 9; `orders.test.ts` 22; `orderPresenter.test.ts` includes null-`paymentReference` and null-`idProduct` cases |
| Safety Net for modified files | Yes | 14.5 records the full 103-suite/775-test regression; `CartService.test.ts` safety net recorded before its deliberate contract break in 15.2 |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution (this change)

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | 55 | 11 | Jest (backend), Vitest (frontend) |
| Integration (real MySQL 8) | 6 | 1 | Jest + `jest.integration.config.js` |
| Route (supertest, full router) | 22 | 1 | Jest + supertest |
| Frontend unit | 15 | 3 | Vitest |
| E2E | 1 | 1 (`e2e/tests/cart.spec.ts`) | Playwright |
| **Total** | **99** | **17** | |

### Assertion Quality

Audited all 17 test files created or modified by this change.

- Tautologies (`expect(true).toBe(true)`, `expect(1).toBe(1)`): **0**.
- Assertions with no production-code call: **0**.
- Ghost loops over possibly-empty collections: **0**.
- Orphan empty-collection assertions: **0** — `ListOrdersUseCase.test.ts`'s empty-list case has a companion non-empty case in the same file.
- Type-only assertions used alone: **0** — both `expect(dto).not.toBeNull()` occurrences in `GetOrderByIdUseCase.test.ts` (L34, L63) are immediately followed by value assertions (`dto?.idOrder`, `dto?.idUser`, `dto?.totalAmount`).
- Smoke-test-only: **0**.

**Assertion quality**: All assertions verify real behavior. 0 CRITICAL, 0 WARNING.

### Quality Metrics

**Linter**: PASS — `eslint src/`, no errors.
**Type Checker**: PASS — `tsc --noEmit` 0 errors; `astro check` 0 errors / 0 warnings / 0 hints across 61 files.
**Architecture**: PASS — `architecture:check` green (backend `composition.allowlist`, `backend.domain.inward`, and `frontend.domain.locality`).

### Issues Found

**CRITICAL**

- **C1 — Task 12.5 is incomplete: the real-DB cancel/restock integration test does not exist.**
  tasks.md leaves 12.5 unchecked and states *"Pick this up before archive or alongside Work Unit 6."* It was never picked up. Searching every `*.integration.test.*` file for `CancelOrderUseCase` or `cancel-restock` returns zero matches. The two `order-administration` cancel scenarios are therefore proven only against hand-written mocks (`CancelOrderUseCase.test.ts`) and mocked-use-case route tests — never against real MySQL. That matters here specifically because cancel is the one admin path that composes a guarded conditional `UPDATE` with N `adjustStock` calls **inside a shared transaction**; a mock `UnitOfWork` cannot prove the transition guard and the restock actually share a transaction, nor that a second cancel restores no stock at the database level. This is exactly the class of bug the Work Unit 4 integration tests caught for the checkout path (tasks.md Key Learning 5). Blocks archive.

- **C2 — The `order-domain` "Item Price Frozen at Creation" requirement has no discriminating test (2 UNTESTED scenarios).**
  Both scenarios specify a *divergence* between the cart's `unit_price` and the product's current price (the spec's own example: cart 100, product 120, so `OrderItem.unitPrice` must be 100). No test anywhere creates that divergence. In `CreateOrderUseCase.test.ts` the helper is `makeCartRow(idCart, idUser, product, quantity, unitPrice = product.price)` and **all six** call sites (L274 x2, L303-305 x3, L337, L353, L363) take the default, so cart price always equals product price (every fixture product is priced 100). Consequence: `CreateOrderUseCase.checkout()` currently maps `unitPrice: row.unitPrice`, which is correct — but a regression that read `row.product.price` instead would pass the entire suite. The requirement that makes an order a durable sales record is the one requirement with no runtime evidence behind it. The fix is small: one test asserting `OrderItem.unitPrice === 100` for a cart row of 100 against a product priced 120, and one asserting the persisted value survives a later product price change.

**WARNING**

- **W1 — `order-administration`'s two cancel scenarios are PARTIAL.** Direct consequence of C1: covered at the unit and route layer, absent at the real-DB layer. Counted compliant in the matrix (a covering test does pass at runtime) but flagged, because the spec language — *"MUST restore exactly the stock quantities decremented"* and *"MUST be a no-op that restores no stock"* — is about database state.

- **W2 — design.md's route snippet is stale relative to shipped code (doc-only, no code defect).** design.md:362-363 still reads `router.post('/orders', apiAuthMiddleware, csrfGuard, orderCreateValidation, handleValidationErrors, controller.create);`. The shipped `routes/api/orders.ts:45` correctly omits `handleValidationErrors`, because the generic handler emits `{ errors: [...] }` and cannot produce the `{ error, code: 'IDEMPOTENCY_KEY_REQUIRED' }` shape design.md's *own* error-map table (line 425) requires. Work Unit 6 flagged this conflict rather than silently resolving it (tasks.md 13.2, Key Learning 7) and got the code right — but **design.md's text was never corrected**, so the artifact still contradicts both the shipped code and its own table two sections later. This is the identical failure mode as deviation #3 (the ADMIN cap), which *was* corrected in design.md. Correct design.md:362-363 before archive so the artifact a future phase reads is not wrong.

- **W3 — E2E not reproducible in this sandbox.** Two attempts failed identically at `cart.spec.ts:182`, before the checkout click, with Vite `504 (Outdated Optimize Dep)` breaking product-page hydration. Clearing `.vite`/`.astro` and raising the timeout to 60 s did not help. No evidence of a checkout defect — the guest-flow checkout test passed in the same run, and CI proves the authenticated case green on both #86 (1m48s) and #87 (2m6s).

**SUGGESTION**

- **S1 — `adjustStock` returning `null` is silently not reported as a shortage.** design.md:417 says a line item whose product vanished mid-flight is reported with `available: 0`. `CreateOrderUseCase.checkout()` only pushes a shortage from its `catch` block; `adjustStock` returns `null` (rather than throwing) when the product row is gone, so that item would be skipped and the order would proceed with a stale `NewOrderItemInput`. Practically unreachable — `fk_cart_product` is `ON DELETE CASCADE`, so a deleted product takes the cart row with it, and `findActiveForUpdate` holds `FOR UPDATE` locks for the whole transaction. Worth one defensive `if (result === null)` branch, or an amendment to design.md's text.
- **S2 — Shortage `available` values are read outside the transaction.** `checkout()` calls `this.productRepo.findById(row.idProduct)` with no `tx` to populate `available`. Under `REPEATABLE READ` that returns committed pre-checkout stock, so if an earlier item in the same loop already decremented, the reported `available` is the pre-decrement figure. Harmless for a transaction about to roll back, and arguably the more useful number to show a buyer, but the inconsistency deserves a comment.
- **S3 — No E2E assertion on the order-detail page's rendered content**, and no explicit `INSUFFICIENT_STOCK` E2E case (only the redirect URL and cart clearing are asserted). Already noted by the apply phase in tasks.md 16.5.
- **S4 — `orderPresenter.ts` has no Astro-component-render harness.** Consistent with every other `.astro` component in this repo; adding one is a project-wide decision, not this change's debt.

### Verdict

**FAIL** — every declared command exits 0 and 35/37 scenarios have passing runtime
coverage, but one core task is genuinely incomplete (C1: no real-DB cancel/restock
test) and one requirement's two scenarios have no discriminating test (C2:
price-freeze). Both are additive test work requiring no production-code change;
the shipped implementation matches the specs and design in every respect examined.
Recommended next phase: `sdd-apply` for C1 + C2 (and the one-line design.md fix
for W2), then re-verify and archive.
