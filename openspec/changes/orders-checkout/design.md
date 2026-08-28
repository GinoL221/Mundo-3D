# Design: Orders & Checkout

## Technical Approach

One DB transaction owns checkout. Because `backend/tools/architecture/engine.js:74` forbids
`sequelize` imports from `domain/` and `application/`, the transaction cannot be a Sequelize
`Transaction` in the use case. A new `UnitOfWorkPort` exposes an **opaque** `TransactionContext`
that domain/application pass through untyped; only infrastructure adapters cast it back.

`CreateOrderUseCase` composes six ports: `UnitOfWorkPort`, `OrderRepositoryPort`,
`ShoppingCartRepositoryPort`, `ProductRepositoryPort`, `PaymentGatewayPort`, `LoggerPort`.
Stock movement reuses the conditional-UPDATE guard from
`SequelizeProductRepository.adjustStock` (`SequelizeProductRepository.ts:184-205`); order status
transitions reuse the same affected-row-count guard style.

Layering matches the existing hexagon. All new entities/ports/exceptions live under
`backend/src/domain/{entities,ports,exceptions}/` (the only targets `backend.domain.inward` and
`backend.application.contracts` allow). `backend/src/domain/Role.ts` is **not** a domain contract
under that rule, so `Role` stays confined to routes/controllers, exactly as
`routes/api/products.ts:15` does today.

## Architecture Decisions

### Decision: Opaque `TransactionContext` behind `UnitOfWorkPort`

| Option | Tradeoff | Decision |
|---|---|---|
| Import `Transaction` from `sequelize` into the port | `externalRule()` (`engine.js:72-76`) fails `architecture:check` with `backend.domain.inward` | Rejected |
| Put `withTransaction` on `OrderRepositoryPort` | One repository would own a cross-aggregate (order + product + cart) transaction | Rejected |
| Dedicated `UnitOfWorkPort` + branded opaque handle | One extra port + one `as unknown as Transaction` cast confined to adapters | **Chosen** |

**Rationale**: the use case must span three repositories in one transaction while staying
framework-free. The cast is the single, auditable seam.

### Decision: `OrderItem → Product` FK is `ON DELETE SET NULL` + `product_name` snapshot

| Option | Tradeoff | Decision |
|---|---|---|
| `ON DELETE CASCADE` (like `fk_cart_product`, baseline:115) | Deleting a product silently erases line items from committed orders and corrupts `totalAmount` | Rejected |
| `ON DELETE NO ACTION/RESTRICT` (like `fk_product_category`, baseline:100) | **Regresses `DELETE /api/products/:id`**: `SequelizeProductRepository.delete` (`:169-174`) calls `db.Product.destroy`, and `ProductApiController.destroy` (`:167-183`) maps only `false→404`/`true→204`; a `SequelizeForeignKeyConstraintError` falls through to `next(error)` → **HTTP 500** for any ever-ordered product | Rejected |
| `id_product` nullable + `ON DELETE SET NULL` + `product_name NOT NULL` snapshot | `CancelOrderUseCase` must skip null-product rows when restocking | **Chosen** |

**Rationale**: it is the only option that keeps the product-delete endpoint's contract
byte-identical while preserving the order's money and item name. Explicitly answers the
regression question: with `SET NULL`, `DELETE /api/products/:id` still returns 204.

### Decision: gateway called after commit, never inside the transaction

`initiate()` runs post-commit; its `reference` lands via `attachPaymentReference` (separate
UPDATE). No network I/O ever holds InnoDB row locks. A gateway failure is logged and swallowed —
the order is already committed and must not be lost. Matches `payment-gateway-port` spec.

### Decision: shortages are collected, not fail-fast

A failed conditional UPDATE does not abort an InnoDB transaction, so the loop keeps going and
collects **every** failing line item before throwing. The proposal requires naming the failing
product(**s**), plural — fail-fast could only ever name one.

### Decision: lock cart rows without a JOIN

`findActiveForUpdate` issues `findAll({ where: { idUser, cartStatus: 'ACTIVE' }, transaction,
lock: Transaction.LOCK.UPDATE })` with **no `include`**. Sequelize's `lock` + `include` emits
`SELECT ... FOR UPDATE` over the join, locking `Product` rows as a side effect. Product names and
stock come from a second, non-locking `db.Product.findAll({ where: { idProduct: ids }, transaction })`.

### Decision: `findById` stays single-arg on the port

`adjustStock`'s follow-up read must run on the transaction's connection or it reads pre-decrement
state under REPEATABLE READ. Handled by a **private** `findByIdInternal(id, transaction?)` inside
`SequelizeProductRepository`; the public port surface is unchanged (no spec requires widening it).

## Data Flow

```
POST /api/orders  (Idempotency-Key: <uuid>)
  apiAuthMiddleware → csrfGuard → OrderApiController.create
        │
        ▼
CreateOrderUseCase.execute(userId, key)
  1. orderRepo.findByIdempotencyKey(userId,key) ─── hit ──▶ replay OrderDTO (200)
  2. uow.runInTransaction(tx => {
       a. cartRepo.findActiveForUpdate(userId, tx)        ← SELECT ... FOR UPDATE
          rows.length === 0 → EmptyCartException
       b. for each row: productRepo.adjustStock(id, -qty, tx)
          collect shortages ─── any ──▶ InsufficientStockException  ⇒ ROLLBACK
       c. orderRepo.createWithItems({...}, tx)
          UNIQUE(id_user,idempotency_key) violation ──▶ DuplicateIdempotencyKeyException ⇒ ROLLBACK
       d. cartRepo.markOrdered(userId, cartIds, tx)  ← UPDATE, never destroy+create
          affected !== rows.length ⇒ ROLLBACK
     })                                                   ─── COMMIT ───▶ AWAITING_PAYMENT
  3. (post-commit, outside tx)
     paymentGateway.initiate({orderId, amount, currency})
     orderRepo.attachPaymentReference(idOrder, reference)   [failure → logger.warn only]
  4. → 201 OrderDTO
```

`DuplicateIdempotencyKeyException` is caught **outside** `runInTransaction` and replayed via
`findByIdempotencyKey`, so a concurrent retry converges on the single committed order.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/domain/entities/Order.ts` | Create | `Order`, `OrderStatus`, transition table |
| `backend/src/domain/entities/OrderItem.ts` | Create | Line item + invariants |
| `backend/src/domain/ports/UnitOfWorkPort.ts` | Create | `TransactionContext`, `runInTransaction` |
| `backend/src/domain/ports/OrderRepositoryPort.ts` | Create | Order persistence contract |
| `backend/src/domain/ports/PaymentGatewayPort.ts` | Create | `PaymentIntent`, initiate/confirm/cancel |
| `backend/src/domain/ports/index.ts` | Modify | Add 3 barrel exports (alphabetical) |
| `backend/src/domain/ports/ProductRepositoryPort.ts` | Modify | `adjustStock(id, delta, tx?)` |
| `backend/src/domain/ports/ShoppingCartRepositoryPort.ts` | Modify | `findActiveForUpdate`, `markOrdered` |
| `backend/src/domain/exceptions/OrderValidationException.ts` | Create | Entity invariant failures |
| `backend/src/domain/exceptions/InsufficientStockException.ts` | Create | Carries `shortages[]` |
| `backend/src/domain/exceptions/EmptyCartException.ts` | Create | Empty ACTIVE cart at checkout |
| `backend/src/domain/exceptions/IllegalOrderTransitionException.ts` | Create | Double confirm/cancel |
| `backend/src/domain/exceptions/DuplicateIdempotencyKeyException.ts` | Create | Adapter-mapped unique violation |
| `backend/src/application/dtos/OrderDTO.ts` | Create | `OrderDTO`, `OrderItemDTO`, `mapToOrderDTO` |
| `backend/src/application/use-cases/CreateOrderUseCase.ts` | Create | Checkout transaction flow |
| `backend/src/application/use-cases/GetOrderByIdUseCase.ts` | Create | Buyer/ADMIN detail read |
| `backend/src/application/use-cases/ListOrdersUseCase.ts` | Create | ADMIN listing |
| `backend/src/application/use-cases/ConfirmOrderPaymentUseCase.ts` | Create | `AWAITING_PAYMENT → PAID` |
| `backend/src/application/use-cases/CancelOrderUseCase.ts` | Create | `→ CANCELLED` + restock |
| `backend/src/infrastructure/repositories/SequelizeOrderRepository.ts` | Create | Order/OrderItem adapter |
| `backend/src/infrastructure/repositories/SequelizeProductRepository.ts` | Modify | tx-aware `adjustStock` + `findByIdInternal` |
| `backend/src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` | Modify | `findActiveForUpdate`, `markOrdered` |
| `backend/src/infrastructure/persistence/SequelizeUnitOfWork.ts` | Create | `db.sequelize.transaction()` wrapper |
| `backend/src/infrastructure/payments/ManualPaymentGateway.ts` | Create | Offline adapter, no network I/O |
| `backend/src/infrastructure/controllers/OrderApiController.ts` | Create | 5 handlers + error mapping |
| `backend/src/infrastructure/middlewares/validators/orderValidators.ts` | Create | `Idempotency-Key` header validator |
| `backend/src/infrastructure/routes/api/orders.ts` | Create | `/api/orders` composition root |
| `backend/src/infrastructure/routes/api/index.ts` | Modify | Mount `ordersApiRouter` |
| `backend/tools/architecture/config.js` | Modify | **Add `'orders'` to line 21's allowlist array** |
| `backend/src/database/migrations/20260828000000-orders.js` | Create | `Order` + `OrderItem` DDL |
| `backend/src/database/models/Order.js` | Create | Sequelize model, `timestamps: false` |
| `backend/src/database/models/OrderItem.js` | Create | Sequelize model, `timestamps: false` |
| `backend/src/database/models/index.js` | Modify | Register both + 4 associations |
| `backend/src/database/models/db.d.ts` | Modify | Attributes/Instance/`ModelCtor` declarations |
| `frontend/src/domains/cart/services/checkout.ts` | Create | `CheckoutResult`, key cache, POST call |
| `frontend/src/domains/cart/services/CartService.ts` | Modify | `checkout()` → `Promise<CheckoutResult>` |
| `frontend/src/domains/cart/components/CartList.astro` | Modify | Async handler, loading/error UI |
| `frontend/src/domains/orders/{index.ts,services/order.service.ts,components/OrderDetail.astro}` | Create | Order-detail domain |
| `frontend/src/pages/order.astro` | Create | Confirmation page |

## Interfaces / Contracts

### Domain ports

```ts
// backend/src/domain/ports/UnitOfWorkPort.ts
// Opaque handle. Infrastructure knows it is a Sequelize Transaction; domain and
// application only pass it through. Typing it as `Transaction` would trip
// engine.js's `backend.domain.inward` external-import rule.
export interface TransactionContext { readonly __transactionBrand: unique symbol }

export interface UnitOfWorkPort {
  runInTransaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
```

```ts
// backend/src/domain/ports/OrderRepositoryPort.ts
export interface NewOrderItemInput {
  idProduct: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderRepositoryPort {
  createWithItems(
    input: { idUser: number; idempotencyKey: string; items: NewOrderItemInput[] },
    tx: TransactionContext
  ): Promise<Order>;                                    // throws DuplicateIdempotencyKeyException
  findByIdempotencyKey(idUser: number, idempotencyKey: string): Promise<Order | null>;
  findById(idOrder: number): Promise<Order | null>;
  findAll(): Promise<Order[]>;
  transitionStatus(
    idOrder: number, from: OrderStatus, to: OrderStatus, tx?: TransactionContext
  ): Promise<boolean>;                                  // true iff exactly 1 row changed
  attachPaymentReference(idOrder: number, reference: string): Promise<void>;
}
```

```ts
// backend/src/domain/ports/PaymentGatewayPort.ts  (proposal's already-resolved shape)
export type PaymentIntentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export interface PaymentIntent {
  reference: string;
  status: PaymentIntentStatus;
  redirectUrl?: string | null;                          // nullable: hosted checkout, no signature change
}
export interface InitiatePaymentInput { orderId: number; amount: number; currency: string }

export interface PaymentGatewayPort {
  initiate(input: InitiatePaymentInput): Promise<PaymentIntent>;
  confirm(reference: string): Promise<PaymentIntent>;
  cancel(reference: string): Promise<PaymentIntent>;
}
```

```ts
// ProductRepositoryPort.ts:13 — optional third parameter, standalone contract unchanged
adjustStock(id: number, delta: number, tx?: TransactionContext): Promise<Product | null>;

// ShoppingCartRepositoryPort.ts — additive; syncCart's destroy+recreate is NOT reused
findActiveForUpdate(userId: number, tx: TransactionContext): Promise<ShoppingCart[]>;
markOrdered(userId: number, cartIds: number[], tx: TransactionContext): Promise<number>;
```

`markOrdered` is a pure UPDATE and returns the affected-row count:

```sql
UPDATE `ShoppingCart` SET `cart_status` = 'ORDERED'
 WHERE `id_cart` IN (:cartIds) AND `id_user` = :userId AND `cart_status` = 'ACTIVE'
```

`ORDERED` rows disappear from `GET /api/cart` for free — `GetCartByUserIdUseCase.ts:12` already
filters to `CartStatus.ACTIVE`.

### Entities

```ts
// backend/src/domain/entities/Order.ts
export enum OrderStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

const LEGAL_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [],
  [OrderStatus.CANCELLED]: [],
};

export class Order {
  constructor(
    public readonly idOrder: number,
    public readonly idUser: number,
    public readonly idempotencyKey: string,
    public readonly status: OrderStatus,
    public readonly items: OrderItem[],
    public readonly createdAt: Date,
    public readonly paymentReference: string | null = null,
  ) {
    if (items.length === 0) {
      throw new OrderValidationException('An order must contain at least one item');
    }
  }
  get totalAmount(): number {
    return this.items.reduce((sum, i) => sum + i.subtotal, 0);
  }
  static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return LEGAL_TRANSITIONS[from].includes(to);
  }
  canTransitionTo(next: OrderStatus): boolean { return Order.canTransition(this.status, next); }
}
```

```ts
// backend/src/domain/entities/OrderItem.ts
export class OrderItem {
  constructor(
    public readonly idOrderItem: number,
    public readonly idOrder: number,
    public readonly idProduct: number | null,   // null once the product row is deleted (FK SET NULL)
    public readonly productName: string,        // snapshot, survives product deletion
    public readonly quantity: number,
    public readonly unitPrice: number,          // frozen from ShoppingCart.unit_price
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new OrderValidationException('Quantity must be an integer greater than 0');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new OrderValidationException('Unit price must be a non-negative number');
    }
  }
  get subtotal(): number { return this.quantity * this.unitPrice; }
}
```

No shipping/contact/notes property exists on either entity (`order-domain` spec).

### Migration DDL — `backend/src/database/migrations/20260828000000-orders.js`

Same shape as the baseline: a `TABLES_IN_ORDER` array, `queryInterface.sequelize.query(createSql,
{ transaction })` in FK-dependency order, `down()` dropping in reverse, and the baseline's
attributed try/catch error message (MySQL DDL auto-commits per statement). `Order` is a MySQL
reserved word — **every** reference is backtick-quoted, in the DDL and in raw repository SQL.

```sql
CREATE TABLE `Order` (
  `id_order` int(11) NOT NULL AUTO_INCREMENT,
  `id_user` int(11) NOT NULL,
  `idempotency_key` varchar(64) NOT NULL,
  `order_status` varchar(50) NOT NULL DEFAULT 'AWAITING_PAYMENT',
  `payment_reference` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id_order`),
  UNIQUE KEY `uq_order_user_idempotency` (`id_user`,`idempotency_key`),
  KEY `id_user` (`id_user`),
  CONSTRAINT `fk_order_user` FOREIGN KEY (`id_user`) REFERENCES `User` (`id_user`)
    ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `OrderItem` (
  `id_order_item` int(11) NOT NULL AUTO_INCREMENT,
  `id_order` int(11) NOT NULL,
  `id_product` int(11) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_order_item`),
  KEY `id_order` (`id_order`),
  KEY `id_product` (`id_product`),
  CONSTRAINT `fk_order_item_order` FOREIGN KEY (`id_order`) REFERENCES `Order` (`id_order`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_item_product` FOREIGN KEY (`id_product`) REFERENCES `Product` (`id_product`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Conventions matched against `20260724000000-baseline.js`: snake_case columns, explicit
`fk_<table>_<referenced-table>` names (globally unique — MySQL 8 `ERROR 1826`), `utf8mb4` /
`utf8mb4_unicode_ci`, `InnoDB`, `decimal(10,2)` money (baseline:110), explicit `created_at
datetime NOT NULL` with `timestamps: false` in the model (baseline `RememberToken`, :126).
`fk_order_user` uses baseline's non-destructive `NO ACTION` form (`fk_product_category`,
baseline:100) rather than `CASCADE`: orders are the sales record, and `routes/api/users.ts` has
no DELETE route, so nothing regresses today.

### Model registration

`backend/src/database/models/{Order,OrderItem}.js` follow `ShoppingCart.js` exactly
(`sequelize.define`, explicit `field:` snake_case mappings, `tableName`, `timestamps: false`).
Registered in `initializeModels()` (`models/index.js:13-38`) alongside the existing models, with:

```js
UserModel.hasMany(OrderModel, { foreignKey: 'idUser' });
OrderModel.belongsTo(UserModel, { foreignKey: 'idUser' });
OrderModel.hasMany(OrderItemModel, { foreignKey: 'idOrder', as: 'items' });
OrderItemModel.belongsTo(OrderModel, { foreignKey: 'idOrder' });
ProductModel.hasMany(OrderItemModel, { foreignKey: 'idProduct', as: 'OrderItems' });
OrderItemModel.belongsTo(ProductModel, { foreignKey: 'idProduct', as: 'product' });
```

`db.d.ts` gains `OrderAttributes`/`OrderItemAttributes`, `OrderInstance`/`OrderItemInstance`, and
`export const Order: ModelCtor<OrderInstance>;` / `export const OrderItem: ModelCtor<OrderItemInstance>;`.

### Routes and the ADMIN guard

`backend/src/infrastructure/routes/api/orders.ts` — **must** be added to `compositionRoots` in
`backend/tools/architecture/config.js:21` (`['index','products','users','cart','categories',
'franchises','orders']`), otherwise `engine.js:57` fails every import with `composition.allowlist`.

The ADMIN guard is **`adminGuard`**, imported from `../../middlewares/auth` — the exact existing
export at `middlewares/auth.ts:70` (`export const adminGuard = requireRoles(Role.ADMIN)`), the
same one `routes/api/products.ts:71` uses for `DELETE /api/products/:id`. It is reused verbatim,
never re-derived inline as `requireRoles(Role.ADMIN)`. `requireRoles` returns 401 with no
principal and 403 for a wrong role (`auth.ts:59-66`), satisfying "non-ADMIN receives 403".

```ts
router.post('/orders',                 apiAuthMiddleware, csrfGuard, orderCreateValidation,
                                       handleValidationErrors, controller.create);
router.get('/orders/:id',              apiAuthMiddleware,                    controller.show);
router.get('/orders',                  apiAuthMiddleware, adminGuard,        controller.index);
router.post('/orders/:id/confirm-payment', apiAuthMiddleware, csrfGuard, adminGuard, controller.confirmPayment);
router.post('/orders/:id/cancel',          apiAuthMiddleware, csrfGuard, adminGuard, controller.cancel);
```

`GET /orders/:id` deliberately carries no `adminGuard`: `OrderApiController.show` compares
`req.user.userId` against `order.idUser` and returns **404** for a non-owner (avoids order-id
enumeration; the spec permits 403 or 404), with an ADMIN bypass via `req.user.idRole === Role.ADMIN`.
`Role` is imported in the controller/route (infrastructure), never in domain or application.

### Buyer order-detail response DTO

`GET /api/orders/:id` → 200, body is `OrderDTO` verbatim (identical to the 201 body of
`POST /api/orders`, so the frontend has one parser):

```jsonc
{
  "idOrder": 41,
  "idUser": 7,
  "status": "AWAITING_PAYMENT",
  "items": [
    { "idOrderItem": 88, "idProduct": 12, "productName": "Maceta Groot",
      "quantity": 2, "unitPrice": 1500.00, "subtotal": 3000.00 }
  ],
  "totalAmount": 3000.00,
  "createdAt": "2026-08-28T14:03:11.000Z",
  "paymentReference": "MANUAL-41-9f2c1a"
}
```

`idempotencyKey` is deliberately **absent**: it is a client-supplied dedup token, not buyer-facing
data. `idProduct` is `number | null` (null after the product row is deleted); `productName` is
always present. ADMIN `GET /api/orders` returns `OrderDTO[]` — the same shape, so `createdAt`
surfaces `AWAITING_PAYMENT` age with no extra field.

### All-or-nothing stock-rejection response

`POST /api/orders` → **409**, mapped by `OrderApiController` from `InsufficientStockException`:

```jsonc
{
  "error": "Stock insuficiente para uno o más productos",
  "code": "INSUFFICIENT_STOCK",
  "shortages": [
    { "idProduct": 12, "productName": "Maceta Groot", "requested": 3, "available": 1 },
    { "idProduct": 19, "productName": "Casco Mando",  "requested": 1, "available": 0 }
  ]
}
```

`shortages` is the complete list (all failing items, not just the first), which is what lets the
frontend name every failing product. A line item whose product vanished mid-flight
(`adjustStock` → `null`) is reported with `available: 0`. 409 matches the existing
`'Insufficient stock'` → 409 mapping on `PATCH /api/products/:id/stock`.

Full controller error map (Spanish message like every existing controller, English `code` for
programmatic use):

| Exception | HTTP | `code` |
|---|---|---|
| missing/blank `Idempotency-Key` | 400 | `IDEMPOTENCY_KEY_REQUIRED` |
| `EmptyCartException` | 409 | `EMPTY_CART` |
| `InsufficientStockException` | 409 | `INSUFFICIENT_STOCK` |
| `IllegalOrderTransitionException` | 409 | `ILLEGAL_ORDER_TRANSITION` |
| order not found / not owned | 404 | `ORDER_NOT_FOUND` |
| non-ADMIN on management route | 403 | (from `adminGuard`) |

### Admin transitions

Both `ConfirmOrderPaymentUseCase` and `CancelOrderUseCase` call
`orderRepo.transitionStatus(id, AWAITING_PAYMENT, target, tx)`, whose raw SQL mirrors
`adjustStock`'s guard:

```sql
UPDATE `Order` SET `order_status` = :to WHERE `id_order` = :id AND `order_status` = :from
```

`affectedRows === 0` → `IllegalOrderTransitionException`. This affected-row check — not a
read-then-write — is what makes double-confirm and double-restock impossible.
`CancelOrderUseCase` runs inside `uow.runInTransaction`: transition first, then
`adjustStock(idProduct, +quantity, tx)` per item, **skipping items whose `idProduct` is null**
(product deleted; nothing to restock). Because the transition guard is inside the same
transaction, a second cancel restores no stock.

## Frontend

### `CartService.checkout()` becomes genuinely async

Current `checkout()` (`CartService.ts:83-101`) is fake: it clears the local cart, fires a
best-effort `PUT /api/cart` with `[]`, and returns `true` unconditionally. New contract, with
logic in a new same-domain `frontend/src/domains/cart/services/checkout.ts`:

```ts
export type CheckoutErrorCode =
  | 'UNAUTHENTICATED' | 'EMPTY_CART' | 'INSUFFICIENT_STOCK' | 'NETWORK' | 'UNKNOWN';

export interface StockShortage {
  idProduct: number; productName: string; requested: number; available: number;
}
export type CheckoutResult =
  | { ok: true; idOrder: number; totalAmount: number }
  | { ok: false; code: CheckoutErrorCode; message: string; shortages?: StockShortage[] };

static async checkout(): Promise<CheckoutResult>
```

Steps:

1. No session → `{ ok: false, code: 'UNAUTHENTICATED' }`.
2. **`await flushCartSync()`** — `cartSync.ts:146` already returns a Promise. Awaiting it is the
   real correctness fix: today's checkout never waits, so the server's `ACTIVE` cart can lag what
   the user sees and the order would be built from stale rows.
3. `idempotencyKey`: `crypto.randomUUID()`, cached in a module-level `pendingCheckoutKey` so a
   retry after a `NETWORK` failure reuses the **same** key (that is the entire point of the
   header). Cleared on success and on any definitive 4xx.
4. `fetch(`${API_URL}/api/orders`, withCredentials({ method: 'POST', headers: { 'Content-Type':
   'application/json', 'Idempotency-Key': key }, body: '{}' }))`. `withCredentials`
   (`frontend/src/config.ts:39`) supplies `credentials: 'include'` + `X-CSRF-Token`. No
   `keepalive` — this request must be awaited, not survive a navigation.
5. **Success**: `cartItems.set([]); persistCart([]); discardPendingSync();` — clear locally
   *without* scheduling a sync. The server already flipped the rows to `ORDERED`; a redundant
   `PUT /api/cart []` would race the just-committed transaction. (`discardPendingSync` is already
   exported at `cartSync.ts:124`.)
6. **Failure**: the local cart is **not** cleared. Today's code clears optimistically before
   knowing the outcome — for an all-or-nothing stock rejection that silently destroys the buyer's
   cart while the server's cart is untouched.

### `CartList.astro` loading/error UI

New markup next to the summary block:

```html
<div class="alert" id="checkout-error" role="alert" aria-live="polite" style="display:none;"></div>
```

The click handler (`CartList.astro:161-173`) becomes async and drops both `alert()` calls:

```ts
checkoutBtn.addEventListener('click', async () => {
  if (!CartService.hasToken()) { window.location.href = '/login'; return; }
  setCheckoutBusy(true);           // btn.disabled = true; btn.textContent = 'Procesando…'
  clearCheckoutError();
  try {
    const result = await CartService.checkout();
    if (result.ok) { window.location.href = `/order?id=${result.idOrder}`; return; }
    renderCheckoutError(result);
  } finally {
    setCheckoutBusy(false);        // restores 'Finalizar compra'
  }
});
```

`renderCheckoutError` uses `document.createElement` + `textContent` per line (never `innerHTML` —
same discipline as `renderPriceDrift`, `CartList.astro:63-68`). For `INSUFFICIENT_STOCK` it emits
one line per shortage:

> `Sin stock suficiente de "Maceta Groot": pediste 3, quedan 1.`

`btn.disabled` during the await is the double-submit guard; the cached idempotency key is the
server-side backstop.

### Order-detail view and `frontend.domain.locality`

`engine.js:56` restricts a `frontend/src/domains/<d>/` file to its own domain plus
`frontend/src/config.ts`. So the checkout POST **must** live in the cart domain (it does — no
cross-domain import, just a `fetch`), and the order-detail view gets its own self-contained
domain: `frontend/src/domains/orders/{index.ts, services/order.service.ts,
components/OrderDetail.astro}`, importing only from itself and `../../../config`. They are wired
together by `frontend/src/pages/order.astro` — pages are outside `frontend/src/domains/`, so
`layer()` returns null and the rule does not apply.

Accepted cost: `StockShortage` (cart domain) and the order view-model (orders domain) are declared
twice. Sharing them would require a cross-domain import the linter rejects; the proposal already
defers shared DTOs to a follow-up. Note for accuracy: `isCompositionRoot` is consulted **only** for
`backend/src/infrastructure/routes/` (`engine.js:57`), so adding the new frontend files to
`config.js`'s allowlist is optional consistency, not an enforcement requirement — unlike
`routes/api/orders.ts`, which is mandatory.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (Jest) | `Order`/`OrderItem` invariants, `LEGAL_TRANSITIONS` incl. terminal states, `totalAmount`, `mapToOrderDTO` | Pure instantiation |
| Unit (Jest) | `CreateOrderUseCase` happy path, empty cart, shortage collection, replay, post-commit gateway ordering | Fakes for all 6 ports; fake `UnitOfWork` records commit/rollback and asserts `initiate` ran **after** the callback resolved |
| Unit (Jest) | `ManualPaymentGateway` reference round-trip, zero network calls | Direct |
| Integration (real DB, `*.integration.test.ts`, `pnpm test:integration`) | Rollback leaves stock+cart untouched; `FOR UPDATE` serializes concurrent checkouts to one order; unique-violation replay; `markOrdered` updates (row ids preserved, never reinserted); cancel restock exactness; second cancel is a no-op | Two connections against MySQL 8 |
| Integration | **`DELETE /api/products/:id` still returns 204 for an ordered product**, and the `OrderItem` survives with `id_product NULL` + intact `product_name` | Regression guard for the FK decision |
| Route (supertest) | 400 missing key; 409 shapes incl. `shortages[]`; 403 for STAFF/buyer on all 3 admin routes; 404 non-owner detail; ADMIN bypass on detail | Full router |
| Regression (Jest) | Existing `products.test.ts` + `PATCH /products/:id/stock` unchanged by the optional `tx` parameter | Existing suites must stay green |
| Frontend (Vitest) | `checkout()` awaits `flushCartSync`, reuses the key on network retry, does **not** clear the cart on failure, clears without scheduling a sync on success | Mocked `fetch` |
| Architecture | `pnpm architecture:check` green after adding `'orders'` to the allowlist | CI |

## Threat Matrix

The change adds HTTP routes only — no shell, subprocess, VCS, or PR automation — so every
`references/threat-matrix.md` row is explicitly N/A:

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification or execution of repository content |
| Git repository selection | N/A — no `git` invocation |
| Commit state | N/A — no index/worktree interaction |
| Push state | N/A — no remote operation |
| PR commands | N/A — no PR automation |

The HTTP-routing risks that *do* apply (ADMIN authorization, CSRF, IDOR on `GET /orders/:id`,
idempotency replay) are covered by the route-layer tests above, not by this matrix.

## Migration / Rollout

`20260828000000-orders.js` is additive: two new tables, no existing table altered. `down()` drops
`OrderItem` then `Order` (FK order), matching the baseline's reverse-order loop and attributed
error message. `adjustStock`'s third parameter and the two `ShoppingCartRepositoryPort` methods are
additive, so reverting the order layer alone leaves cart and inventory functional. No cart row can
reach `ORDERED` without a committed order, so a revert cannot strand a buyer's cart. No feature
flag or data backfill.

## Open Questions

- [ ] Currency code for `PaymentGatewayPort.initiate` — design assumes a hard-coded `'ARS'`
      constant in `CreateOrderUseCase`; there is no currency column or config anywhere today.
- [ ] Whether ADMIN `GET /api/orders` should cap its result set. No pagination exists in this
      change's scope, so it returns all orders — fine at current data volume, revisit later.
