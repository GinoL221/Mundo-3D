# Proposal: Buyer Order History

## Intent

A buyer who completes checkout can only reach an order by its direct URL. There is no way to answer "what have I bought?". Listing orders today is ADMIN-only and unscoped. Success: an authenticated buyer opens one page and sees their own orders, newest first, paginated, and clicks through to the existing detail view.

## Scope

### In Scope
- New buyer-scoped, paginated port method + `SequelizeOrderRepository` implementation.
- New `ListMyOrdersUseCase` (buyer-scoped; ADMIN `ListOrdersUseCase` untouched).
- New `OrderSummaryDTO` + mapper (no line items per row).
- New `GET /api/orders/mine` route + controller method + query validation.
- New frontend list service, list component, page, and one authenticated-only nav entry.

### Out of Scope
- Any change to `ListOrdersUseCase`, `GET /api/orders`, or its tests.
- Filter/search by status or date; cancel or re-order from the list; notifications.

## Capabilities

### New Capabilities
- `order-history`: buyer-scoped, paginated listing of the caller's own orders.

### Modified Capabilities
- None.

## Approach

Additive Approach 1 from exploration: distinct path, dedicated use case, dedicated repository method. Ownership is scoped inline from `req.user!.userId` (the `cart.ts` convention); no new middleware, no `adminGuard`.

Decisions:
1. **Route**: `GET /api/orders/mine`, `apiAuthMiddleware` only, registered **before** `/orders/:id`.
2. **Pagination**: offset/limit expressed as `?page=1&pageSize=20`. Default `pageSize` 20, max 50, `page` >= 1. Out-of-range or non-numeric values are rejected with 400 (no silent clamping), via the existing express-validator convention.
3. **Envelope**: `{ orders, page, pageSize, total, totalPages }` — `total` comes free from `findAndCountAll`.
4. **DTO**: `OrderSummaryDTO` = existing `OrderDTO` scalar fields only (order id/number, created date, status, total); no items array, no new domain fields.
5. **Ordering**: `idOrder DESC`, matching the admin list.
6. **Bounds**: new `MAX_PAGE_SIZE = 50` constant, independent of the admin-only `MAX_LISTED`.
7. **Empty/overflow**: zero orders and pages past the last both return 200 with `orders: []`.
8. **Frontend**: `frontend/src/pages/orders.astro` + `domains/orders/components/OrderList.astro` + list service, self-contained per domain locality.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/domain/ports/OrderRepositoryPort.ts` | Modified | Add `findByUserId(idUser, { limit, offset })` |
| `backend/src/infrastructure/repositories/SequelizeOrderRepository.ts` | Modified | Implement scoped paginated query |
| `backend/src/application/use-cases/ListMyOrdersUseCase.ts` | New | Buyer-scoped listing |
| `backend/src/application/dtos/OrderDTO.ts` | Modified | Add `OrderSummaryDTO` + mapper |
| `backend/src/infrastructure/controllers/OrderApiController.ts` | Modified | `listMine` method |
| `backend/src/infrastructure/routes/api/orders.ts` | Modified | Route ordering-sensitive insert |
| `backend/src/infrastructure/validators/` | New | Pagination query validation |
| `frontend/src/domains/orders/` | New | List service + component |
| `frontend/src/pages/orders.astro` + nav | New/Modified | Page and authenticated nav entry |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `/orders/mine` swallowed by `/orders/:id` | High | Register before `:id`; explicit route test |
| Cross-user leakage | Med | Scope in the use case; test another user's orders are absent |
| Reusing admin `MAX_LISTED` | Med | Separate `MAX_PAGE_SIZE` constant |
| Frontend surface larger than the API slice | Med | Flag delivery-strategy risk (see below) |

## Delivery note

Backend (port, repo, use case, DTO, validator, controller, route, tests) plus a fully new frontend surface (service, component, page, nav) is realistically above the 400-line review budget for one PR. **400-line budget risk: High.** The chaining decision belongs to `tasks.md`; the natural seam is backend-first, frontend-second.

## Rollback Plan

Every backend change is additive. Revert the commit(s): removing the route, use case, DTO, and port method restores prior behavior exactly, since no existing code path is modified except the route table and the nav.

## Dependencies

- Shipped order detail view (`GET /api/orders/:id`) as the click-through target.

## Success Criteria

- [ ] An authenticated buyer receives only their own orders from `GET /api/orders/mine`.
- [ ] Pagination returns correct `total`/`totalPages` and honours default/max page size.
- [ ] A buyer with zero orders gets 200 with an empty array.
- [ ] The admin `GET /api/orders` route, response shape, and tests are unchanged.
- [ ] The list page links into the existing order detail view.
