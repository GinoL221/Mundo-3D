```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e5ac4c0721436084a7a1789b89bcdfba2edc3f6c36a7c304c11c40590b1da827
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 21/21
scenarios: 37/37
test_command: cd backend && npx jest
test_exit_code: 0
test_output_hash: sha256:39e53dd02fdf17d427710874ff3d6c53b2fbb3e09258015cd53f8e028a263338
build_command: PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build
build_exit_code: 0
build_output_hash: sha256:8f5580632608c2e8ab8b37046e54db812915d04758b9f90a4f91b316598a1426
```

## Verification Report

**Change**: orders-checkout
**Version**: N/A (8 spec deltas under `openspec/changes/orders-checkout/specs/`)
**Mode**: Strict TDD
**Verified at**: `main` @ `d01130a` — 11 merged PRs (#78–#88)
**Pass**: RE-VERIFY (supersedes the prior `fail` report at `b2f652c`)

> This is a full re-verification from scratch, not a delta review of the fix.
> All 8 spec files, design.md and tasks.md were re-read; all 58 tasks re-counted;
> the full compliance matrix rebuilt; every suite and gate re-run fresh. The two
> prior CRITICAL findings (C1, C2) and the prior W2 were each independently
> confirmed closed by reading the shipped code and by four adversarial mutations
> run by this verifier — not by trusting the fix agent's self-report.

### Closure of Prior Findings

| Prior finding | Status | Independent evidence |
|---|---|---|
| **C1** — task 12.5 incomplete; no real-DB cancel/restock test | **CLOSED** | `backend/src/__tests__/order-cancel-restock.integration.test.ts` exists, runs against live MySQL 8 through real `SequelizeUnitOfWork`/`SequelizeOrderRepository`/`SequelizeProductRepository`, 3 cases, all green. Mutations **M2**, **M3**, **M4** below each killed exactly the intended case. tasks.md 12.5 now `[x]`. |
| **C2** — "Item Price Frozen at Creation" had no discriminating test | **CLOSED** | Two new cases genuinely diverge cart price from product price (unit: product 100 / cart 80; integration: product 10 / cart 80). Mutation **M1** killed both. |
| **W2** — design.md route snippet stale | **CLOSED** | design.md:362 now reads exactly `router.post('/orders', apiAuthMiddleware, csrfGuard, orderCreateValidation, controller.create);`, byte-matching the shipped `routes/api/orders.ts:45`, plus a new paragraph explaining why `handleValidationErrors` is deliberately not chained. |

**No production code changed in PR #88.** `git show --stat d01130a` lists only
`orderTestDb.ts` (+16/-8 helper), the new integration test, two test files, and the
two OpenSpec docs. The fix is purely additive coverage, so it cannot have altered
shipped behaviour.

### Independent Mutation Testing (run by this verifier)

Each mutation was applied to production code, the relevant suite run, then the file
restored via `git checkout --` (working tree confirmed clean, `git status --porcelain
backend/src` → 0 entries, before and after).

| # | Mutation | Target file | Expected kill | Actual result |
|---|---|---|---|---|
| **M1** | `unitPrice: row.unitPrice` → `row.product.price` | `CreateOrderUseCase.ts:87` | both new price-freeze cases | **KILLED both.** Unit: `(f) ... never re-reading the product's current price` failed at `expect(dto.items[0].unitPrice).not.toBe(productA.price)`. Integration: `Expected: 80 / Received: 10`. Exit 1. |
| **M2** | `adjustStock(..., item.quantity, tx)` → `item.quantity + 1` | `CancelOrderUseCase.ts:42` | cancel cases (a) and (b) | **KILLED both.** `Expected: 5 / Received: 6` in each. Exit 1. |
| **M3** | wrap the restock call in `try { ... } catch { /* swallowed */ }` (transaction now commits despite the injected failure) | `CancelOrderUseCase.ts:42` | atomicity case (c) only | **KILLED (c) only**, 2 passed. This is the decisive anti-tautology proof: case (c) fails the moment rollback stops happening. Exit 1. |
| **M4** | `if (!transitioned \|\| !existing)` → `if (!existing)` (transition guard removed) | `CancelOrderUseCase.ts:36` | second-cancel case (b) only | **KILLED (b) only** — `Received promise resolved instead of rejected`. Exit 1. |

The fix agent's claimed RED confirmations (off-by-one restock; swallowed restock
errors) are corroborated: M2 and M3 reproduce exactly those two mutations and both
kill the intended cases. M1 and M4 are additional mutations this verifier devised
independently; both also killed cleanly.

### Test Quality Findings — C1 file, read in full

`order-cancel-restock.integration.test.ts` (147 lines) was read line-by-line against
the four questions the re-verify brief asked:

- **Real DB?** Yes. `bootstrapTestDatabase()` in `beforeAll`; every collaborator is a
  real Sequelize adapter (lines 44–57). No `jest.mock` of any repository or the UoW.
  The only instrumentation anywhere is the single `jest.spyOn(productRepo,
  'adjustStock')` in case (c), and its first call delegates to the bound **real**
  implementation (`realAdjustStock(id, delta, tx)`, line 127).
- **Exact stock restoration?** Yes. `seedCheckoutFixture([5, 8], [2, 3])` seeds two
  products; the test first asserts checkout decremented them to 3 and 5 (a real
  sanity gate, not an assumption), then asserts 5 and 8 after cancel. Exact per-item
  values, two items, different quantities — an off-by-one or a single-item-only
  restock both fail (proven by M2).
- **Second cancel does not double-restore?** Yes. Case (b) cancels, asserts 5/8,
  then asserts the second cancel `rejects.toThrow(IllegalOrderTransitionException)`,
  then re-asserts status `CANCELLED` **and** stock still 5/8. Both halves matter: M4
  (guard removed) fails the rejection assertion.
- **Is the mid-transaction rollback case tautological?** **No.** This was the
  sharpest question and the answer is clean. `CancelOrderUseCase` orders its work as
  `transitionStatus` **first**, then N `adjustStock` calls, all on the same `tx`. So
  at the moment the injected failure fires on item 2, the transaction already holds
  (i) the `AWAITING_PAYMENT → CANCELLED` UPDATE and (ii) item 1's genuinely-applied
  `+2` restock. The assertions then require `AWAITING_PAYMENT` and stock `3`/`5` —
  i.e. **both** effects undone. Had rollback not occurred the observed values would
  be `CANCELLED` and `5`/`5`. M3 demonstrates precisely this: swallowing the error so
  the transaction commits turns case (c) red while leaving (a) and (b) green.
- **Is the injected failure realistic?** Reasonably. The test's own comment justifies
  the choice: `adjustStock`'s guarded `UPDATE ... WHERE stock + :delta >= 0` cannot
  fail naturally on a *positive* restock delta, so a dropped connection / driver
  fault is the realistic remaining fault class and is what is simulated. This is a
  fault-injection test, not a spontaneous-failure test, and it is labelled as such.
  Noted as **S5** below, not as a defect.

`seedCheckoutFixture` backward compatibility: **confirmed**. The new third parameter
`cartPriceOverrides: (number | undefined)[] = []` defaults to empty, and
`cartPriceOverrides[i] ?? productPrice` reproduces the old `unitPrice = 10 + i`
behaviour exactly for every index. The old local `unitPrice` was split into
`productPrice` (still `10 + i`, still what the Product row gets) and `cartUnitPrice`.
All 7 pre-existing call sites pass 1–2 arguments and are byte-for-byte unaffected;
the whole pre-existing integration suite still passes unchanged (7 of the 8 suites,
21 of the 25 tests, are the pre-existing ones).

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 58 |
| Tasks complete | 58 |
| Tasks incomplete | **0** |
| Work units | 7 (16 phases), delivered as 11 PRs (#78–#88) |

Counted directly from `tasks.md` checkbox lines: 58 total, 58 `[x]`, **zero `[ ]`**.
Task IDs are contiguous 1.1 … 16.5 with no gaps. Task **12.5** — the sole unchecked
box in the prior report — is now checked and carries a substantive closure note
naming the file, all 3 cases, and the RED-confirmation method.

> Bookkeeping note: the prior report stated "Tasks total 60" and the re-verify brief
> referenced 61. The authoritative on-disk count is **58**. This is a counting
> discrepancy in the earlier prose only, not a missing task — the ID sequence is
> contiguous and complete, and nothing is unchecked. Recorded as **S6**.

### Build & Tests Execution

**Backend fast suite**: PASS — `cd backend && npx jest` → exit 0
```text
Test Suites: 103 passed, 103 total
Tests:       776 passed, 776 total
Time:        7.698 s
```
776 vs. the prior 775: exactly `+1`, the new `CreateOrderUseCase.test.ts (f)` case.

**Real-DB integration**: PASS — exit 0. Disposable, unmapped `mysql:8.0` container
addressed by bridge IP (`172.17.0.2`, MySQL 8.0.46), since the host's system MariaDB
holds 3306 and `database/config/config.js` exposes no `port` field.
`DB_HOST=172.17.0.2 DB_USER=root DB_PASS=verifyroot npx jest --config
jest.integration.config.js --detectOpenHandles`. Container removed after the run.
```text
Test Suites: 8 passed, 8 total
Tests:       25 passed, 25 total
Time:        22.995 s
```
8 vs. the prior 7 suites and 25 vs. 21 tests: exactly `+1` suite (cancel-restock) and
`+4` tests (3 cancel-restock + 1 checkout price-freeze). This final run was executed
**after** all four mutations were reverted, with the working tree verified clean.

**Frontend unit**: PASS — `pnpm run frontend:test` → exit 0 — 12 files, 157 tests.
Unchanged from the prior run, as expected (PR #88 touched no frontend file).

**Quality gates** — all exit 0:

| Command | Result |
|---|---|
| `pnpm --filter backend type-check` (`tsc --noEmit`) | PASS — 0 errors |
| `pnpm --filter backend architecture:check` | PASS |
| `pnpm --filter backend lint` (`eslint src/`) | PASS — 0 errors |
| `pnpm run frontend:check` (`astro check`) | PASS — 61 files, 0 errors / 0 warnings / 0 hints |
| `pnpm run frontend:quality-check` | PASS — exit 0 |
| `PUBLIC_API_URL=https://api.example.invalid pnpm run frontend:build` | PASS — build complete, `/order/index.html` emitted |

**E2E (Playwright)**: NOT RE-ATTEMPTED. The prior report established, over two runs,
that the local failure is a Vite `504 (Outdated Optimize Dep)` hydration artifact at
`cart.spec.ts:182` — the *add-to-cart* `PUT /api/cart`, before the checkout button is
ever clicked. PR #88 changed no frontend, no route, and no E2E file, so nothing about
that environment artifact could have changed. CI evidence stands: `#86` and `#87`
both green on the Playwright job. Carried forward as **W3**.

**Coverage**: Not collected — no coverage threshold is configured in
`backend/jest.config.js`; the strict-TDD module treats coverage as informational,
never blocking.

### Spec Compliance Matrix

37 scenarios across 21 requirements in 8 capability specs (counted from the specs on
disk: cart-domain 1/2, concurrency-guarantees 1/2, order-administration 4/7,
order-checkout 5/9, order-domain 4/9, payment-gateway-port 4/4, product-inventory
1/2, schema-migrations 1/2).

#### `order-domain` (4 requirements / 9 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Order/OrderItem Entity Structure | Valid order entity is constructed | `Order.test.ts > is constructed with status AWAITING_PAYMENT and a derived totalAmount` | COMPLIANT |
| Order/OrderItem Entity Structure | No shipping/contact/notes fields exist | `Order.test.ts > exposes no shipping, contact, or notes property` | COMPLIANT |
| **Item Price Frozen at Creation** | **Price is copied from the cart, not the product** | `CreateOrderUseCase.test.ts > (f) freezes the order line item price at the cart row's own unit_price...` (product 100 / cart 80); `order-checkout.integration.test.ts > commits the order line item at the cart's frozen unit_price (80), never the product's current price (10)` | **COMPLIANT** (was UNTESTED) |
| **Item Price Frozen at Creation** | **Later product price changes do not affect the order** | `order-checkout.integration.test.ts > commits the order line item at the cart's frozen unit_price (80)...` — see note below | **COMPLIANT** (was UNTESTED) |
| OrderStatus State Machine | AWAITING_PAYMENT to PAID | `Order.test.ts > allows AWAITING_PAYMENT -> PAID` | COMPLIANT |
| OrderStatus State Machine | AWAITING_PAYMENT to CANCELLED | `Order.test.ts > allows AWAITING_PAYMENT -> CANCELLED` | COMPLIANT |
| OrderStatus State Machine | Transition out of a terminal state is illegal | `Order.test.ts > rejects any transition out of PAID (terminal)` + `> ...out of CANCELLED (terminal)` | COMPLIANT |
| Monetary/Quantity Invariants | Invalid quantity is rejected | `OrderItem.test.ts > rejects a zero quantity` / `negative` / `non-integer` | COMPLIANT |
| Monetary/Quantity Invariants | Total amount is computed from line items | `Order.test.ts > computes totalAmount as the sum of item subtotals` | COMPLIANT |

**Note on "Later product price changes do not affect the order".** The integration
test's `dto` is not an in-memory echo: `SequelizeOrderRepository.createWithItems`
ends with `findByIdInternal(idOrder, transaction)`, a real `SELECT` with `include:
[{ model: db.OrderItem }]` passed through the shared `toEntity` mapper — the *exact*
read path public `findById` uses. So the asserted `unitPrice: 80` is a value read
back out of the `OrderItem` table while the `Product` row concurrently reads `10`
(also asserted, line 169). Any regression that made the order's price depend on the
product — a `Product` join added to the include, or `toEntity` reading a product
price — is caught, which is the entire mechanism this scenario protects. What is not
literally exercised is the temporal ordering (mutate the product price *after*
commit, then re-read). Because the read path is proven at runtime to ignore
`Product.price` entirely, the ordering is immaterial and the scenario is rated
COMPLIANT. A literal post-commit-mutation assertion would still be a one-line
improvement — recorded as **S7**, not as a gap.

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
| **Cancel + Stock Restoration** | **Cancelling restores exact decremented stock** | `CancelOrderUseCase.test.ts` (unit) **+ `order-cancel-restock.integration.test.ts > restores exactly the previously-decremented stock for every line item, atomically, and transitions the order to CANCELLED`** (real MySQL) | **COMPLIANT** (was PARTIAL) |
| **Cancel + Stock Restoration** | **Second cancel is a no-op** | `CancelOrderUseCase.test.ts`; `orders.test.ts > returns 409 ILLEGAL_ORDER_TRANSITION on a second cancel` **+ `order-cancel-restock.integration.test.ts > is a no-op on a second cancel of an already-cancelled order: rejects, and does not restore stock a second time`** (real MySQL) | **COMPLIANT** (was PARTIAL) |

Both scenarios now have real-database evidence, closing prior **W1**. The suite adds
a third case beyond spec minimum (atomic mid-transaction rollback) which proves the
guarded status UPDATE and the N restocks genuinely share one transaction — the exact
property the prior report said a mocked `UnitOfWork` could never establish.

#### `payment-gateway-port` (4 requirements / 4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Port Contract | Initiate returns a PaymentIntent | `ManualPaymentGateway.test.ts > resolves synchronously with a generated PENDING reference and makes zero network calls` | COMPLIANT |
| Manual Adapter Semantics | Manual adapter round-trips a reference | `ManualPaymentGateway.test.ts > confirm round-trips the same reference with CONFIRMED status` + `> cancel round-trips...CANCELLED` | COMPLIANT |
| Gateway Never Called Inside Transaction | Order commits before initiate runs | `CreateOrderUseCase.test.ts > (e) calls the payment gateway strictly after the transaction commits, never inside the transactional callback` | COMPLIANT |
| Swap-In Compatibility | Use case accepts any conforming adapter | `CreateOrderUseCase.test.ts` injects a hand-written fake `PaymentGatewayPort` across all 7 cases (was 6; case (f) also uses it) | COMPLIANT |

#### `cart-domain` (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Non-Destructive ACTIVE to ORDERED | Checkout marks cart rows ORDERED via update | `order-checkout.integration.test.ts` — asserts `{ idCart: cartRowIdBefore, cartStatus: 'ORDERED' }`, proving the row id survived; `SequelizeShoppingCartRepository.test.ts > issues a pure UPDATE (never DELETE/INSERT)...` | COMPLIANT |
| Non-Destructive ACTIVE to ORDERED | ORDERED rows do not appear in the active cart | `order-checkout.integration.test.ts` — `readActiveCartCount(userId) === 0` after commit | COMPLIANT |

#### `product-inventory` (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Transaction-Composable adjustStock | adjustStock composes into a caller transaction (rollback undoes it) | `order-checkout.integration.test.ts > leaves stock and the ACTIVE cart completely untouched and creates no order`; **newly reinforced by `order-cancel-restock.integration.test.ts` case (c)**, which proves a *positive* delta also rolls back with its caller's transaction — the previously untested direction | COMPLIANT |
| Transaction-Composable adjustStock | Standalone contract is unchanged (incl. 409) | Existing `products.test.ts` + `SequelizeProductRepository.integration.test.ts` (2 concurrency cases), all green, unchanged | COMPLIANT |

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

**Compliance summary**: **37/37 scenarios compliant. 21/21 requirements complete.**
Zero UNTESTED, zero PARTIAL, zero FAILING.

### Correctness (Static Evidence)

Re-checked from source, not carried over. All prior findings re-confirmed; the two
rows that changed status are bolded.

| Requirement area | Status | Notes |
|---|---|---|
| Migration DDL | Implemented | `20260828000000-orders.js` matches design's SQL: snake_case, `utf8mb4`/`utf8mb4_unicode_ci`, InnoDB, `decimal(10,2)`, `UNIQUE KEY uq_order_user_idempotency (id_user, idempotency_key)`, `fk_order_user` `NO ACTION`, `fk_order_item_order` `CASCADE`, `fk_order_item_product` `SET NULL`. `down()` reverses table order. |
| Entities | Implemented | `Order`/`OrderItem` match design's class shape. All fields `readonly`. No shipping/contact/notes property. `LEGAL_TRANSITIONS` empty for both terminal states. |
| Ports | Implemented | `UnitOfWorkPort` (opaque branded `TransactionContext`), `OrderRepositoryPort` (6 methods), `PaymentGatewayPort`. `adjustStock(id, delta, tx?)` optional 3rd param. |
| `CreateOrderUseCase` | Implemented | Zero infrastructure imports (`architecture:check` green). Shortages collected, not fail-fast. Gateway strictly post-commit. `unitPrice: row.unitPrice` at line 87 — the single line the price-freeze requirement rests on, now mutation-covered. |
| `CancelOrderUseCase` | Implemented | Read-before-transaction is justified in-file (item rows immutable post-creation). `transitionStatus` runs **first** inside the tx, so a failed guard throws before any `adjustStock`. Null-`idProduct` items skipped. Confirmed against `order-administration`'s spec language. |
| `SequelizeOrderRepository` | Implemented | Reserved word backtick-quoted. `UniqueConstraintError` → `DuplicateIdempotencyKeyException`. `transitionStatus` is the guarded `UPDATE ... WHERE order_status = :from` returning `affectedRows === 1`. `toEntity`'s include is `OrderItem` only — never joins `Product` (the structural basis of price freeze). |
| ADMIN list cap (deviation #3) | Verified correct | `findAll()` has `order: [['idOrder','DESC']]` and `limit: MAX_LISTED` with `private static readonly MAX_LISTED = 100`. design.md's open question reads `[x] Resolved (2026-08-28)`. |
| `SequelizeShoppingCartRepository` | Implemented | `findActiveForUpdate` is genuinely two queries: a locking `findAll({lock: LOCK.UPDATE})` with no `include`, then a separate non-locking `Product.findAll`. `markOrdered` a pure scoped raw `UPDATE`. |
| `SequelizeUnitOfWork` | Implemented | Managed `db.sequelize.transaction(cb)`; single auditable `as unknown as TransactionContext` cast. Its rollback behaviour is now proven at runtime by cancel-restock case (c). |
| `ManualPaymentGateway` | Implemented | `randomBytes`-based `MANUAL-<orderId>-<hex>`, `status: 'PENDING'`, `redirectUrl: null`, zero network I/O. |
| Controller + routes | Implemented | 5 handlers, full error map. `adminGuard` imported verbatim. `GET /orders/:id` carries no `adminGuard`; owner check + ADMIN bypass in the controller. |
| **Validator wiring (deviation #6)** | **Code correct AND doc correct** | `routes/api/orders.ts:45` = `router.post('/orders', apiAuthMiddleware, csrfGuard, orderCreateValidation, controller.create);`. design.md:362 now shows the identical line. **W2 closed.** |
| Architecture allowlist | Implemented | `config.js:21` — `['index','products','users','cart','categories','franchises','orders']`. |
| Arch-test fixture (deviation #7) | Coherent | `architecture-boundaries.test.js:123` uses `routes/api/reports.ts` as a genuinely non-allowlisted negative control. |
| Seed stock fix (deviation #4) | Present | `seed.js:95` — `stock: p.Stock !== undefined ? p.Stock : (p.stock ?? 50)`. |
| E2E assertion (deviation #5) | Matches | `cart.spec.ts` asserts `toHaveURL(/\/order\?id=\d+/)` and empty `localStorage.cart`. |
| Frontend `checkout.ts` | Implemented | `await flushCartSync()` before the POST; module-level `pendingCheckoutKey` reused on `NETWORK` failure. |
| Frontend UI + orders domain | Implemented | `CartList.astro` async handler, `#checkout-error` live region, `/order?id=` redirect, `domains/orders/` self-contained. |
| **Test helper (new in #88)** | **Backward-compatible** | `seedCheckoutFixture`'s third parameter defaults to `[]`; `cartPriceOverrides[i] ?? productPrice` reproduces the old behaviour byte-for-byte at every existing call site. All 7 pre-existing call sites verified unaffected; 21 pre-existing integration tests still green. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Opaque `TransactionContext` behind `UnitOfWorkPort` | Yes | Single cast confined to adapters; `architecture:check` green. |
| `OrderItem` to `Product` FK `ON DELETE SET NULL` + `product_name` snapshot | Yes | Proven by `order-checkout.integration.test.ts`'s delete-regression case. |
| Gateway called after commit, never inside the transaction | Yes | Asserted by `CreateOrderUseCase.test.ts (e)`. |
| Shortages collected, not fail-fast | Yes | Case (c) asserts multiple shortages. |
| Lock cart rows without a JOIN | Yes | Two-query, `include`-free lock. |
| `findById` single-arg; private `findByIdInternal(id, tx?)` | Yes | In both product and order repositories. |
| ADMIN guard reused verbatim | Yes | Imported from `middlewares/auth`. |
| `GET /orders/:id` 404 for non-owner, ADMIN bypass | Yes | Controller + `orders.test.ts`. |
| `idempotencyKey` absent from `OrderDTO` | Yes | Deliberate omission. |
| ADMIN list capped at 100 | Yes | Resolved in design.md and tasks.md; code + test match. |
| **Route snippet matches shipped wiring** | **Yes — corrected in #88** | design.md:362 now matches `orders.ts:45` exactly, plus an explanatory paragraph on why `handleValidationErrors` is not chained (its `{errors:[...]}` body cannot produce the `{error, code}` shape the error-map table two sections later requires). Prior **W2** closed. |
| Cancel composes transition + restock in one transaction | Yes | Now proven at the database layer, not merely at the mock layer. |
| `adjustStock` returning `null` reported with `available: 0` | Partial | design.md:417 vs. `CreateOrderUseCase.checkout()`'s catch-only shortage construction. Unreachable in practice — carried forward as **S1**. |
| Work Unit 4 split into 3 PRs; Work Unit 7 into 2 | Yes | Reflected in tasks.md Key Learning 8. |
| Open question: currency code | Still open | `CHECKOUT_CURRENCY = 'ARS'` hard-coded as design assumed. Acceptable. |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | tasks.md carries explicit RED/GREEN labels on every test-bearing task; 12.5's closure note additionally documents its RED confirmation method |
| All tasks have tests | Yes | Every RED task's named test file exists on disk (17/17, +1 vs. prior) |
| RED confirmed (tests exist) | Yes | 17/17 test files verified present |
| GREEN confirmed (tests pass) | Yes | All 17 pass in the fresh runs above |
| RED confirmed adversarially | Yes | **Independently re-established by this verifier** via 4 mutations (M1–M4), each killing exactly its intended case and nothing else |
| Triangulation adequate | Yes | `CreateOrderUseCase.test.ts` now 7 cases; `order-cancel-restock.integration.test.ts` 3 cases (restore / no-double-restore / atomic rollback) for a 2-scenario requirement; `OrderItem.test.ts` 7 cases for 2 invariants; `orders.test.ts` 22 |
| Safety Net for modified files | Yes | 14.5 records the 103-suite regression; the #88 helper change was re-validated by the full 21-test pre-existing integration suite still passing |

**TDD Compliance**: 7/7 checks passed.

### Test Layer Distribution (this change)

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | 56 | 11 | Jest (backend) |
| Integration (real MySQL 8) | 10 | 2 | Jest + `jest.integration.config.js` |
| Route (supertest, full router) | 22 | 1 | Jest + supertest |
| Frontend unit | 15 | 3 | Vitest |
| E2E | 1 | 1 (`e2e/tests/cart.spec.ts`) | Playwright |
| **Total** | **104** | **18** | |

The change's real-DB layer grew from 1 file / 6 tests to 2 files / 10 tests. The
admin-cancel path moved from unit-only to unit + route + real-DB.

### Assertion Quality

Re-audited all 18 test files created or modified by this change, with the two files
touched by #88 read in full.

- Tautologies (`expect(true).toBe(true)`, `expect(1).toBe(1)`): **0**.
- Assertions with no production-code call: **0**.
- Ghost loops over possibly-empty collections: **0**.
- Orphan empty-collection assertions: **0**.
- Type-only assertions used alone: **0**.
- Smoke-test-only: **0**.
- Mock-heavy files (mocks > 2x assertions): **0**. `order-cancel-restock.integration.test.ts`
  contains exactly one `jest.spyOn` against ~13 `expect` calls, and that spy's first
  invocation delegates to the real implementation.
- Self-referential / circular assertions in the new files: **0**. Every expected
  value in the new tests is a literal (3, 5, 8, 10, 80, 160), never a value re-derived
  from the code under test. This is what makes M1–M4 able to kill them.

**Assertion quality**: All assertions verify real behavior. 0 CRITICAL, 0 WARNING.

### Quality Metrics

**Linter**: PASS — `eslint src/`, 0 errors.
**Type Checker**: PASS — `tsc --noEmit` 0 errors; `astro check` 0 errors / 0 warnings / 0 hints across 61 files.
**Architecture**: PASS — `architecture:check` green (`composition.allowlist`, `backend.domain.inward`, `frontend.domain.locality`).
**File-size standard** (AGENTS.md, 250-line cap): `order-cancel-restock.integration.test.ts` is 147 lines and is a spec file, which the standard exempts regardless. `orderTestDb.ts` is 107 lines. No violation.

### No New Gaps Introduced

Explicitly checked, since the whole risk of a fix-then-reverify cycle is collateral damage:

1. **No production code touched.** PR #88's stat lists only tests, one test helper, and two OpenSpec docs.
2. **No regression in existing counts.** Backend 775 → 776 (+1 intended). Integration 21 → 25 (+4 intended). Frontend 157 → 157 (unchanged). No suite lost tests.
3. **Helper change is additive-only.** Verified by reading both sides of the diff; the refactor of `unitPrice` into `productPrice` + `cartUnitPrice` preserves the old value at every existing call site.
4. **All 6 quality gates still exit 0**, including `architecture:check` and `tsc --noEmit`.
5. **Working tree is clean** after this verifier's four mutations — each reverted via `git checkout --`, confirmed by `git status --porcelain backend/src` returning zero entries, and the final integration suite was re-run post-revert and passed 25/25.
6. **The fix agent's mutation claims are plausible and, where reproducible, reproduced.** Its two claimed mutations map onto M2 and M3, both of which this verifier applied independently with the predicted kills. Nothing in the test files contradicts the report's description of them.
7. **Disposable container removed** after the run; no port mapping was ever created, so the host's system MariaDB on 3306 was never touched.

### Issues Found

**CRITICAL**: None. Both prior CRITICAL findings are independently confirmed closed.

**WARNING**

- **W3 (carried forward, unchanged) — E2E not reproducible in this sandbox.** The
  prior report established over two attempts that the failure is a Vite `504
  (Outdated Optimize Dep)` hydration artifact at `cart.spec.ts:182`, on the
  *add-to-cart* request, before the checkout button is clicked. PR #88 touched no
  frontend, route, or E2E file, so this cannot have changed and was not re-attempted.
  CI proves the authenticated checkout case green on both #86 (1m48s) and #87 (2m6s).
  Not a defect in shipped behaviour; noted so the gap is never silent.

*(Prior W1 and W2 are closed — see the Closure table.)*

**SUGGESTION**

- **S1 (carried forward)** — `adjustStock` returning `null` is not reported as a shortage. design.md:417 says a line item whose product vanished mid-flight is reported with `available: 0`; `CreateOrderUseCase.checkout()` only pushes a shortage from its `catch`, and `adjustStock` returns `null` rather than throwing when the row is gone. Practically unreachable (`fk_cart_product` is `ON DELETE CASCADE`, and `findActiveForUpdate` holds `FOR UPDATE` locks for the whole transaction). Worth one defensive `if (result === null)` branch, or an amendment to design.md's text.
- **S2 (carried forward)** — Shortage `available` values are read outside the transaction, so under `REPEATABLE READ` they report committed pre-checkout stock. Harmless for a transaction about to roll back; deserves a comment.
- **S3 (carried forward)** — No E2E assertion on the order-detail page's rendered content, and no explicit `INSUFFICIENT_STOCK` E2E case. Already noted in tasks.md 16.5.
- **S4 (carried forward)** — `orderPresenter.ts` has no Astro-component-render harness. Project-wide decision, not this change's debt.
- **S5 (new)** — The cancel atomicity case injects its mid-transaction fault through `jest.spyOn` rather than provoking a natural database error. This is a deliberate and well-justified choice (the guarded `stock + :delta >= 0` floor cannot fire on a positive restock delta), and the test is honest about it in a comment. Recorded only so the distinction between fault-injection and spontaneous-failure coverage stays visible. A natural alternative — killing the connection mid-transaction — would be flakier and prove less.
- **S6 (new)** — Task-count bookkeeping drift: the prior verify report said 60 tasks and the re-verify brief said 61; tasks.md actually contains 58 checkbox items with contiguous IDs 1.1–16.5. No task is missing or unchecked; only the earlier prose counts were off. Worth correcting if any downstream artifact quotes a total.
- **S7 (new)** — The price-freeze scenario "Later product price changes do not affect the order" is covered by mechanism rather than literally: the test proves the persisted `OrderItem.unitPrice` is read back independent of `Product.price`, but never mutates the product price *after* commit and re-reads via `GetOrderByIdUseCase`. Given `toEntity` provably never joins `Product`, the temporal variant adds little, but it would be a two-line addition to the existing integration `describe`.

### Verdict

**PASS WITH WARNINGS** — 37/37 scenarios have passing runtime coverage, 21/21
requirements are complete, all 58 tasks are checked, and every declared command
exits 0. Both prior CRITICAL findings are closed and were independently
re-established as closed by four adversarial mutations run by this verifier, not by
trusting the fix agent's report. The single remaining WARNING (W3) is a local
sandbox E2E environment artifact with green CI evidence standing in its place, and
carries no evidence of any defect in shipped behaviour. Ready to archive.

Recommended next phase: **sdd-archive**.
