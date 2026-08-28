# Order Administration Specification

## Purpose

Defines ADMIN-only order management: listing, payment confirmation, and
cancellation with exact stock restoration.

## Requirements

### Requirement: ADMIN-Only Access to Order Management

Every order-management endpoint (list, confirm-payment, cancel) MUST
require the `ADMIN` role. `STAFF` and any other authenticated or
unauthenticated principal MUST receive HTTP 403.

#### Scenario: ADMIN is allowed

- GIVEN an authenticated `ADMIN` request
- WHEN any order-management endpoint is called
- THEN the request MUST be processed normally

#### Scenario: Non-ADMIN is rejected

- GIVEN an authenticated `STAFF` or buyer request
- WHEN any order-management endpoint is called
- THEN the response MUST be HTTP 403

### Requirement: List Orders

An `ADMIN` MUST be able to list orders.

#### Scenario: ADMIN lists orders

- GIVEN existing orders in the system
- WHEN an `ADMIN` calls the order-listing endpoint
- THEN the response MUST return the existing orders

### Requirement: Confirm Payment

An `ADMIN` confirming payment MUST transition an order from
`AWAITING_PAYMENT` to `PAID` via a conditional update guarded by the
order's current status. Confirming an order that is not currently
`AWAITING_PAYMENT` MUST be rejected or be a no-op, and MUST NOT change its
status.

#### Scenario: Confirming an awaiting order succeeds

- GIVEN an order with status `AWAITING_PAYMENT`
- WHEN an `ADMIN` confirms its payment
- THEN the order's status MUST become `PAID`

#### Scenario: Double-confirm is rejected

- GIVEN an order with status `PAID`
- WHEN an `ADMIN` attempts to confirm its payment again
- THEN the request MUST be rejected or be a no-op
- AND the order's status MUST remain `PAID`

### Requirement: Cancel Order and Stock Restoration

An `ADMIN` cancelling an `AWAITING_PAYMENT` order MUST transition it to
`CANCELLED` via a conditional update guarded by the order's current status,
and MUST restore exactly the stock quantities decremented for that order's
line items. A second cancel attempt on an order that is no longer
`AWAITING_PAYMENT` MUST be a no-op that restores no stock.

#### Scenario: Cancelling restores exact decremented stock

- GIVEN an `AWAITING_PAYMENT` order that decremented product P's stock by 3
- WHEN an `ADMIN` cancels the order
- THEN the order's status MUST become `CANCELLED`
- AND product P's stock MUST increase by exactly 3

#### Scenario: Second cancel is a no-op

- GIVEN an order already `CANCELLED`
- WHEN an `ADMIN` attempts to cancel it again
- THEN the request MUST be a no-op
- AND no product's stock MUST change as a result
