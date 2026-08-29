# Order History Specification

## Purpose

Defines buyer-scoped, paginated listing of the authenticated caller's own
orders via `GET /api/orders/mine`, independent of and non-overlapping with
ADMIN order listing.

## Requirements

### Requirement: Buyer-Scoped Order Listing

`GET /api/orders/mine` MUST require authentication and MUST return only
orders belonging to the authenticated caller (scoped by `req.user.userId`),
regardless of query parameters supplied.

#### Scenario: Authenticated buyer lists own orders

- GIVEN an authenticated buyer with existing orders
- WHEN the buyer calls `GET /api/orders/mine`
- THEN the response MUST contain only that buyer's orders

#### Scenario: Cross-user isolation via page manipulation

- GIVEN buyer A has orders and buyer B has different orders
- WHEN buyer A calls `GET /api/orders/mine` with any `page`/`pageSize` values
- THEN buyer B's orders MUST NOT appear in buyer A's response on any page

#### Scenario: Unauthenticated request is rejected

- GIVEN no valid authentication is provided
- WHEN `GET /api/orders/mine` is called
- THEN the response MUST be HTTP 401

### Requirement: Pagination Parameter Validation

The endpoint MUST accept `page` (default 1) and `pageSize` (default 20, max
50) query parameters. `page` MUST be an integer >= 1. `pageSize` MUST be an
integer between 1 and 50 inclusive. Any other value (0, negative,
non-numeric, or `pageSize` > 50) MUST be rejected with HTTP 400; values MUST
NOT be silently clamped.

#### Scenario: Defaults applied when omitted

- GIVEN an authenticated buyer
- WHEN `GET /api/orders/mine` is called with no `page`/`pageSize`
- THEN the response MUST use `page=1` and `pageSize=20`

#### Scenario: Valid custom pagination

- GIVEN an authenticated buyer with more than 20 orders
- WHEN the buyer calls `GET /api/orders/mine?page=2&pageSize=10`
- THEN the response MUST return the second page of 10 orders

#### Scenario: Invalid page is rejected

- GIVEN an authenticated buyer
- WHEN `GET /api/orders/mine` is called with `page=0`, a negative `page`, or
  a non-numeric `page`
- THEN the response MUST be HTTP 400

#### Scenario: Invalid pageSize is rejected

- GIVEN an authenticated buyer
- WHEN `GET /api/orders/mine` is called with `pageSize=0`, a negative
  `pageSize`, `pageSize=51`, or a non-numeric `pageSize`
- THEN the response MUST be HTTP 400

### Requirement: Response Envelope Shape

A successful response MUST be HTTP 200 with body
`{ orders: OrderSummaryDTO[], page, pageSize, total, totalPages }`, where
`total` is the caller's total order count and `totalPages` is derived from
`total` and `pageSize`.

#### Scenario: Empty order history

- GIVEN an authenticated buyer with zero orders
- WHEN the buyer calls `GET /api/orders/mine`
- THEN the response MUST be HTTP 200 with `orders: []` and `total: 0`

#### Scenario: Page beyond the last page

- GIVEN an authenticated buyer with fewer orders than fit on the requested
  page
- WHEN the buyer requests a `page` past the last available page
- THEN the response MUST be HTTP 200 with `orders: []` and the same `total`
  as page 1

### Requirement: Order Summary Representation

Each entry in `orders` MUST be an `OrderSummaryDTO` containing only scalar
fields (order id, order number, created date, status, total) and MUST NOT
include the order's line items.

#### Scenario: Summary excludes line items

- GIVEN an order with multiple line items
- WHEN it appears in a `GET /api/orders/mine` response
- THEN its entry MUST NOT contain an items array

### Requirement: Newest-First Ordering

Results MUST be ordered by order id descending (`idOrder DESC`), matching
ADMIN listing order.

#### Scenario: Most recent order appears first

- GIVEN a buyer with multiple orders placed at different times
- WHEN the buyer calls `GET /api/orders/mine`
- THEN the most recently created order MUST appear first in `orders`

### Requirement: Admin Listing Non-Regression

The ADMIN `GET /api/orders` endpoint and `ListOrdersUseCase` MUST remain
unaffected by this capability: same route, same response shape, same
behavior, same passing tests.

#### Scenario: Admin listing behaves as before

- GIVEN the existing ADMIN order-listing test suite
- WHEN it is run after this capability is added
- THEN `GET /api/orders` MUST return unscoped results exactly as before with
  no code changes required to that route

### Requirement: Frontend Order History Access

Authenticated users MUST see a "my orders" navigation link, and navigating
to it MUST render their orders as a paginated summary list, each linking to
the existing order detail view.

#### Scenario: Nav link visible when authenticated

- GIVEN an authenticated buyer viewing any page with the nav
- WHEN the page renders
- THEN a "my orders" link MUST be visible in the nav

#### Scenario: Order list page renders summaries

- GIVEN an authenticated buyer with existing orders
- WHEN the buyer opens the order history page
- THEN the page MUST render the paginated summary list from
  `GET /api/orders/mine`
- AND each entry MUST link to that order's existing detail view
