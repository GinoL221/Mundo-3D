# Proposal: Orders & Checkout

## Intent

The cart is a dead end: `cart-authority` shipped a trustworthy cart, but a buyer cannot turn it into anything. There is no `Order` table, no order entity, no checkout endpoint, and no way for the shop to receive a sale. `CartStatus.ORDERED` exists in the enum and is never written — the seam was built and left unconnected. This change closes the purchase loop: a buyer places an order, stock moves, and an ADMIN confirms or cancels it.

## Scope

### In Scope

- `Order` + `OrderItem` domain entities with an explicit `OrderStatus` state machine.
- `OrderRepositoryPort` + `SequelizeOrderRepository`; hand-written raw-SQL migration matching `20260724000000-baseline.js` conventions (explicit `fk_<table>_<referenced-table>` names, snake_case columns, utf8mb4).
- `PaymentGatewayPort` + one `ManualPaymentGateway` adapter (offline/manual confirmation).
- `CreateOrderUseCase` (checkout), buyer order-detail read, ADMIN list/confirm/cancel use cases, controller + routes.
- Transaction-composable stock decrement reusing the `adjustStock` conditional-UPDATE pattern; all-or-nothing across line items.
- Non-destructive cart-row transition `ACTIVE → ORDERED`.
- Frontend: checkout submit + order-confirmation detail view.

### Out of Scope

- Cart redesign (shipped as `cart-authority`).
- OpenAPI / shared DTOs (follow-up on the stabilized order API).
- Order history listing, search, filter, pagination; notifications; second E2E engine.
- Any real payment provider (Stripe/MercadoPago). `STAFF` role stays unused.

## Capabilities

### New Capabilities

- `order-domain`: `Order`/`OrderItem` entities, `OrderStatus` values and legal transitions, monetary/quantity invariants.
- `order-checkout`: `POST /api/orders` — idempotency, all-or-nothing stock, cart `ORDERED` transition, buyer order detail.
- `order-administration`: ADMIN-only list / confirm-payment / cancel, including stock restoration on cancel.
- `payment-gateway-port`: port contract, manual adapter semantics, swap-in requirements for a future real gateway.

### Modified Capabilities

- `cart-domain`: adds the `ACTIVE → ORDERED` transition as real written behavior via a new non-destructive repository method (NOT `syncCart`'s destroy+recreate).
- `product-inventory`: `adjustStock` becomes transaction-composable (accepts an optional transaction) without changing its standalone contract.
- `schema-migrations`: adds the `Order`/`OrderItem` migration to the applied set.
- `concurrency-guarantees`: adds order-creation idempotency and concurrent-checkout guarantees; today it explicitly defers stock-decrement concurrency.

## Approach

One DB transaction owns checkout: lock the user's `ACTIVE` cart rows, insert the order header + items at cart `unit_price`, decrement every product's stock through the conditional `UPDATE ... WHERE stock + delta >= 0`, and flip the cart rows to `ORDERED`. Any line item failing its floor condition aborts the whole transaction; the response names the failing product(s) and the cart is untouched. Layering follows the existing hexagon: entities and ports in `backend/src/domain/`, use cases in `application/use-cases/`, Sequelize + gateway adapters in `infrastructure/`.

## Decided Architecture

Settled with the user; recorded, not re-derived:

| # | Decision |
|---|---|
| 1 | Payment is a hexagonal port with one manual adapter. The order model and state machine must not need redesign to swap in a real gateway. |
| 2 | Direct atomic decrement at order creation, no reservation table. |
| 3 | Any insufficient line item rejects the whole order; buyer is told which; cart untouched. |
| 4 | `ADMIN` only manages orders. `STAFF` unchanged. |
| 5 | Buyer can view the order just placed (detail only, not history). |
| 6 | ADMIN can cancel an `AWAITING_PAYMENT` order; cancellation restores stock. |
| 7 | Cart rows move to the existing `CartStatus.ORDERED`, which makes them vanish from `GET /api/cart` for free. |

## Resolved Technical Decisions

**Idempotency.** The client generates one UUID per checkout attempt and sends it as `Idempotency-Key`; it is persisted as `Order.idempotency_key` under a `UNIQUE (id_user, idempotency_key)` constraint. A retry hits the unique violation, aborts the transaction, and the use case replays the already-committed order instead of creating a second one. Because the decrement, the insert, and the cart transition share one transaction, a duplicate can never half-apply. Backstop for concurrent (not retried) checkouts: `SELECT ... FOR UPDATE` on the user's `ACTIVE` cart rows, so the second request finds an empty active cart. Rejected: deriving the key from cart contents server-side — it would make a legitimate repeat purchase impossible.

**`PaymentGatewayPort` shape.** Correction to the exploration framing: non-repository service ports already exist here (`PasswordHasherPort`, `TokenHasherPort`, `LoggerPort`), so this is not the first — follow their `*Port` suffix and `domain/ports/index.ts` barrel. Interface: `initiate({ orderId, amount, currency })`, `confirm(reference)`, `cancel(reference)`, each resolving a `PaymentIntent { reference, status, redirectUrl? }`. `redirectUrl` is nullable so a future hosted-checkout gateway needs no signature change. The gateway is never called inside the DB transaction (no network I/O holding row locks): the order commits as `AWAITING_PAYMENT` first, then `initiate` runs and its reference is persisted by a follow-up update. Trivially safe for the manual adapter, and it hands a real gateway the correct ordering for free.

**State machine.** `AWAITING_PAYMENT → PAID` (terminal) and `AWAITING_PAYMENT → CANCELLED` (terminal). Cancellation is a distinct state, never a row delete — orders are the sales record. Transitions execute as conditional updates (`UPDATE ... WHERE order_status = 'AWAITING_PAYMENT'`) with an affected-row check, the same guard style as `adjustStock`; that check is what makes double-confirm and double-restock impossible. No fulfilment/shipping states in this change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/database/migrations/` | New | `Order` + `OrderItem` tables, FKs, unique idempotency key |
| `backend/src/domain/entities/` | New | `Order.ts`, `OrderItem.ts`, `OrderStatus` |
| `backend/src/domain/ports/` | New/Modified | `OrderRepositoryPort`, `PaymentGatewayPort`, barrel export |
| `backend/src/domain/ports/ProductRepositoryPort.ts` | Modified | `adjustStock` accepts an optional transaction |
| `backend/src/domain/ports/ShoppingCartRepositoryPort.ts` | Modified | New non-destructive `markOrdered` method |
| `backend/src/application/use-cases/` | New | Create / get / list / confirm / cancel order |
| `backend/src/infrastructure/repositories/` | New/Modified | `SequelizeOrderRepository`; transaction-aware `adjustStock` |
| `backend/src/infrastructure/payments/` | New | `ManualPaymentGateway` |
| `backend/src/infrastructure/controllers/`, `routes/api/` | New | `OrderApiController`, `/api/orders` with ADMIN guard |
| `frontend/src/domains/` | New/Modified | Checkout submit, order-detail view, cart clearing after success |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Change size comparable to `cart-authority` (5 chained PRs) blows the 400-line review budget | High | Flagged for `sdd-tasks` under `ask-on-risk`; slicing decision belongs to tasks.md, not here |
| Transaction-composing `adjustStock` regresses the standalone `PATCH /api/products/:id/stock` path | Medium | Optional parameter, contract unchanged; existing `ProductApiController` tests must stay green |
| Cart rows flipped to `ORDERED` while the order fails to commit would silently empty a cart | Low | Same transaction as the order insert — impossible by construction; covered by an integration test |
| Idempotency key missing or reused by a buggy client | Medium | Server rejects a missing key with 400; a reused key replays the stored order rather than erroring |
| Manual payment state drifts from reality (paid offline, never confirmed) | Medium | Accepted for this slice; ADMIN list surfaces `AWAITING_PAYMENT` age |

## Rollback Plan

Revert in reverse dependency order. The migration ships a real `down` dropping `OrderItem` then `Order` (FK order), matching baseline conventions. `adjustStock`'s optional transaction parameter and `markOrdered` are additive, so reverting the order layer alone leaves cart and inventory functional. No cart rows reach `ORDERED` without a committed order, so a revert cannot strand a buyer's cart.

## Confirmed with User (2026-08-28)

- Order price is frozen at the cart's `unit_price` at order-creation time, not re-read from the product.
- No shipping address, contact details, or notes are captured at checkout — out of scope.
- `PAID` is a terminal state for this change; no fulfilment/shipping states are reserved.

## Dependencies

- `cart-authority` (archived) — supplies the trustworthy `ACTIVE` cart this reads.
- `schema-migrations` baseline (`20260724000000-baseline.js`) — the DDL conventions the new migration must match.

## Success Criteria

- [ ] A buyer with an `ACTIVE` cart can `POST /api/orders` and receive an `AWAITING_PAYMENT` order.
- [ ] Product stock decreases by exactly the ordered quantity; a retried POST with the same `Idempotency-Key` creates no second order and no second decrement.
- [ ] An order with any insufficient line item is rejected wholesale, names the failing product(s), and leaves stock and cart unchanged.
- [ ] After a successful order, `GET /api/cart` returns empty and the buyer can view the placed order's detail.
- [ ] ADMIN can list orders, confirm payment, and cancel; cancelling restores exactly the decremented stock, and a second cancel changes nothing.
- [ ] Non-ADMIN receives 403 on every order-management endpoint.
