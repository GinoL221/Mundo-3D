# Design: Buyer Order History

## Technical Approach

Purely additive vertical slice through the existing hexagonal layers, alongside the ADMIN listing rather than through it. A new port method returns `{ orders, total }`; a new `ListMyOrdersUseCase` scopes by `idUser` and converts page/pageSize into limit/offset; a new `OrderSummaryDTO` is the scalar subset that `OrderDTO` already extends; `GET /api/orders/mine` is registered before `/orders/:id`. The frontend adds one service function, one presenter function, one component, one page, and one nav `<li>` inside the existing `.user-only` block.

**Constraint discovered while reading the code**: `Order` (`backend/src/domain/entities/Order.ts:26`) throws when `items.length === 0`, and `totalAmount` (`:31`) reduces over `items`. The repository must therefore still eager-load `items` even though the response omits them. This is not optional.

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|---|
| 1 | Port signature | `findByUserId(idUser, { limit, offset }): Promise<{ orders: Order[]; total: number }>` | `findByUserIdPaginated(userId, page, pageSize)` | The port is persistence vocabulary; `page`/`pageSize` is an HTTP concept. Name matches the existing `findById`/`findByIdempotencyKey` verb-noun style (`OrderRepositoryPort.ts:16-18`); the options object is the differentiator. `total` rides along free from `findAndCountAll`. |
| 2 | Count strategy | `findAndCountAll` with `distinct: true` | `findAll` + separate `count` | One round trip. `distinct: true` is **required**: the `items` hasMany include otherwise counts joined rows, not orders. |
| 3 | DTO reuse | `OrderDTO extends OrderSummaryDTO`; `mapToOrderDTO` spreads `mapToOrderSummaryDTO` | Duplicate field extraction; `Omit<OrderDTO,'items'>` | Zero duplication, and `OrderDTO`'s public field set is byte-identical, so the ADMIN route stays untouched. |
| 4 | 400 shape | Plain express-validator chain + terminal middleware emitting `{ error, code: 'INVALID_PAGINATION' }` | New exception class; `handleValidationErrors`' `{ errors: [...] }`; `handleDomainError` | **No new exception class.** Pagination bounds are a transport concern with no `Order` invariant behind them, unlike `CartValidationException` (`cartValidators.ts:27`). `handleDomainError` (`OrderApiController.ts:109`) is private and only maps the three domain exceptions — it never sees this. The `{error, code}` shape follows `orderCreateValidation` (`orderValidators.ts:23-26`), which is the whole orders-API client contract. |
| 5 | Bound constants | `DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 50` exported from `ListMyOrdersUseCase.ts` | Domain entity; validator file; reusing `MAX_LISTED` | Mirrors `cartValidators.ts:4` importing `MAX_CART_ITEM_QUANTITY` from where the rule lives (infrastructure → application is inward, legal). `MAX_LISTED = 100` stays a private static in the repository, untouched. |
| 6 | Clamping | Use case trusts validated inputs; no defensive clamp | `Math.min(pageSize, MAX_PAGE_SIZE)` inside the use case | A silent clamp would contradict the reject-with-400 contract. Matches `GetOrderByIdUseCase` trusting an already-parsed id. |
| 7 | Nav integration | One `<li>` inside `Header.astro`'s existing `.user-only` dropdown | New `.user-only` element elsewhere; touching `sessionUI.ts` | `sessionUI.ts:59` already toggles `.user-only`; nesting inherits auth-conditional rendering with zero new JS. |

## Data Flow

    orders.astro ──→ OrderList.astro ──→ fetchMyOrders(page,size) ──→ GET /api/orders/mine?page&pageSize
                            │                                                    │
                            │                                    listMyOrdersValidation ──400──→ {error,code}
                            │                                                    ↓
                            │                              OrderApiController.listMine (req.user!.userId)
                            │                                                    ↓
                            │                              ListMyOrdersUseCase (page→limit/offset)
                            │                                                    ↓
                            │                              findByUserId ──→ findAndCountAll(distinct)
                            ↓                                                    ↓
                    presentMyOrdersPage  ←── {orders,page,pageSize,total,totalPages}
                            ↓
                    rows → /order?id=N (existing detail view)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/domain/ports/OrderRepositoryPort.ts` | Modify | Add `findByUserId` after `findAll` (line 18) |
| `backend/src/infrastructure/repositories/SequelizeOrderRepository.ts` | Modify | Implement `findByUserId` after `findAll` (line 113) |
| `backend/src/application/use-cases/ListMyOrdersUseCase.ts` | Create | Buyer-scoped paginated listing + page-size constants |
| `backend/src/application/dtos/OrderDTO.ts` | Modify | Add `OrderSummaryDTO` + `mapToOrderSummaryDTO`; `OrderDTO` extends it |
| `backend/src/infrastructure/middlewares/validators/orderValidators.ts` | Modify | Append `listMyOrdersValidation` (note: existing folder is `middlewares/validators/`, not the proposal's `infrastructure/validators/`) |
| `backend/src/infrastructure/controllers/OrderApiController.ts` | Modify | 6th constructor param (appended) + `listMine` |
| `backend/src/infrastructure/routes/api/orders.ts` | Modify | Wire use case; insert route at line 168, **before** `/orders/:id`; OpenAPI block |
| `frontend/src/domains/orders/services/order.service.ts` | Modify | `fetchMyOrders` + view models (file is 57 lines; stays well under the 250 cap) |
| `frontend/src/domains/orders/services/orderPresenter.ts` | Modify | `presentMyOrdersPage`, reusing `formatCurrency` |
| `frontend/src/domains/orders/components/OrderList.astro` | Create | Loading/error/empty/content + row `<template>` |
| `frontend/src/domains/orders/index.ts` | Modify | Export `OrderList` |
| `frontend/src/pages/orders.astro` | Create | Mirrors `pages/order.astro` |
| `frontend/src/components/Header.astro` | Modify | One `<li>` at line 60, inside `.user-only` |

## Interfaces / Contracts

```ts
// domain/ports/OrderRepositoryPort.ts
export interface PaginationOptions { limit: number; offset: number; }
export interface PagedOrders { orders: Order[]; total: number; }
findByUserId(idUser: number, options: PaginationOptions): Promise<PagedOrders>;
```

```ts
// infrastructure/repositories/SequelizeOrderRepository.ts
// `items` MUST stay included: Order's constructor rejects an empty item list and
// totalAmount reduces over it. `distinct: true` counts orders, not joined rows.
async findByUserId(idUser: number, { limit, offset }: PaginationOptions): Promise<PagedOrders> {
  const { rows, count } = await db.Order.findAndCountAll({
    where: { idUser },
    include: [{ model: db.OrderItem, as: 'items' }],
    order: [['idOrder', 'DESC']],
    limit, offset, distinct: true,
  });
  return { orders: rows.map((instance) => this.toEntity(instance)), total: count };
}
```

```ts
// application/dtos/OrderDTO.ts
export interface OrderSummaryDTO {
  idOrder: number; idUser: number; status: string;
  totalAmount: number; createdAt: string; paymentReference: string | null;
}
export interface OrderDTO extends OrderSummaryDTO { items: OrderItemDTO[]; }

export function mapToOrderSummaryDTO(order: Order): OrderSummaryDTO;
export function mapToOrderDTO(order: Order): OrderDTO;   // { ...mapToOrderSummaryDTO(order), items }
```

```ts
// application/use-cases/ListMyOrdersUseCase.ts
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;   // deliberately independent of SequelizeOrderRepository.MAX_LISTED

export interface MyOrdersPageDTO {
  orders: OrderSummaryDTO[]; page: number; pageSize: number; total: number; totalPages: number;
}

export class ListMyOrdersUseCase {
  constructor(private readonly orderRepo: OrderRepositoryPort) {}
  async execute(idUser: number, page: number, pageSize: number): Promise<MyOrdersPageDTO>;
  // offset = (page - 1) * pageSize; totalPages = Math.ceil(total / pageSize) → 0 when empty
}
```

```ts
// infrastructure/middlewares/validators/orderValidators.ts (appended)
export const listMyOrdersValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({
        error: 'Parámetros de paginación inválidos', code: 'INVALID_PAGINATION',
      });
    }
    next();
  },
];
```

```ts
// infrastructure/controllers/OrderApiController.ts
listMine = async (req, res, next): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : DEFAULT_PAGE_SIZE;
    res.json(await this.listMyOrdersUseCase.execute(req.user!.userId, page, pageSize));
  } catch (error) { next(error); }   // no handleDomainError: a read raises no domain exception (cf. index)
};
```

```ts
// infrastructure/routes/api/orders.ts — ORDER-SENSITIVE
router.get('/orders/mine', apiAuthMiddleware, listMyOrdersValidation, controller.listMine); // line 168
router.get('/orders/:id',  apiAuthMiddleware, controller.show);                             // was 168
```

Response envelope (200):

```json
{ "orders": [ { "idOrder": 12, "idUser": 3, "status": "PAID",
                "totalAmount": 1499.5, "createdAt": "2026-08-20T10:00:00.000Z",
                "paymentReference": "MP-123" } ],
  "page": 1, "pageSize": 20, "total": 37, "totalPages": 2 }
```

Empty / past-last-page: `{ "orders": [], "page": 9, "pageSize": 20, "total": 0, "totalPages": 0 }` — still 200.

```ts
// frontend/src/domains/orders/services/order.service.ts
export type FetchMyOrdersErrorCode = 'UNAUTHENTICATED' | 'INVALID_PAGINATION' | 'NETWORK' | 'UNKNOWN';
export type FetchMyOrdersResult =
  | { ok: true; page: MyOrdersPageViewModel }
  | { ok: false; code: FetchMyOrdersErrorCode; message: string };
export async function fetchMyOrders(page?: number, pageSize?: number): Promise<FetchMyOrdersResult>;
// Same discriminated-union shape as fetchOrder (order.service.ts:29): try/catch → NETWORK,
// 401 → UNAUTHENTICATED, 400 → INVALID_PAGINATION, !res.ok → UNKNOWN.
```

`OrderList.astro` follows `OrderDetail.astro` exactly: `#my-orders-loading` / `#my-orders-error` (+ `#my-orders-error-message`) / `#my-orders-empty` ("Todavía no tenés órdenes." + link to `/products`) / `#my-orders-content`, a `<template>` row, `showError(message)`, and a `void loadMyOrders()` kickoff. It reads `?page=` from `window.location.search` itself so `orders.astro` only wires the component in. Rows link to `/order?id=N`; prev/next link to `/orders?page=N`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — use case | Scoping, offset math, `totalPages`, empty → `total: 0` | Fake `OrderRepositoryPort`, mirroring `ListOrdersUseCase.test.ts` |
| Unit — DTO | `mapToOrderSummaryDTO` omits `items`; `mapToOrderDTO` output unchanged | Direct mapper assertions |
| Unit — presenter | `presentMyOrdersPage` labels, `detailHref`, empty flag | Pure, per `orderPresenter.test.ts` |
| Unit — service | 200/400/401/network branches | `fetch` stub, per `order.service.test.ts` |
| Integration — controller | `listMine` reads `req.user!.userId`; defaults 1/20 | `OrderApiController.test.ts` (append 6th ctor arg) |
| Integration — route | **RED first**: `GET /orders/mine` returns the envelope, not `show`'s 400 "Id de orden inválido" | Supertest against the router |
| Integration — validation | `page=0`, `page=abc`, `pageSize=51`, `pageSize=0` → 400 `INVALID_PAGINATION` | Supertest, one case each |
| Integration — isolation | Another user's orders absent; ADMIN `GET /api/orders` unchanged | Supertest |
| Repository | `distinct: true` count with multi-item orders (naive count inflates) | Seeded orders with 2+ items each |

## Threat Matrix

All five rows are `N/A`. This change adds no shell command, subprocess, git/PR automation, executable-file classification, or process integration — the only "routing" is an in-process Express route table. The route-ordering hazard it does create is carried as an explicit RED test above rather than as a matrix row.

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: no file classification or execution |
| Git repository selection | N/A: no VCS invocation |
| Commit state | N/A: no VCS invocation |
| Push state | N/A: no VCS invocation |
| PR commands | N/A: no PR automation |

## Migration / Rollout

No migration required. No schema change, no backfill, no feature flag. Every backend edit is additive except two lines in the route table and one `<li>` in the header; reverting the commits restores prior behavior exactly.

**400-line budget risk: High.** Natural seam: PR1 = backend (port, repo, use case, DTO, validator, controller, route, tests); PR2 = frontend (service, presenter, component, page, nav). PR1 ships a usable API on its own; PR2 depends on it. Final chaining decision belongs to `tasks.md`.

## Open Questions

- [ ] None blocking. Two low-risk items to confirm during apply: (a) JSON key order in `OrderDTO` shifts (`items` moves last) — semantically irrelevant, but confirm no test asserts serialized string order; (b) Sequelize applies `limit` via subquery when a hasMany include is present, so `limit` bounds parent orders, not joined rows — the repository test pins this.
