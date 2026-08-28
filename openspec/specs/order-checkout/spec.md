# Order Checkout Specification

## Purpose

Defines `POST /api/orders`: idempotent order creation, all-or-nothing stock
decrement across line items, the cart's transition out of `ACTIVE`, and the
buyer's ability to view the order just placed.

## Requirements

### Requirement: Idempotency Key on Checkout

`POST /api/orders` MUST require an `Idempotency-Key` header (a client-
generated UUID per checkout attempt) and reject a missing key with HTTP 400.
The key MUST be persisted as `Order.idempotency_key` under a
`UNIQUE (id_user, idempotency_key)` constraint. A retried request carrying
the same key for the same user MUST NOT create a second order or apply a
second stock decrement — the use case MUST return the already-committed
order instead.

#### Scenario: Missing Idempotency-Key is rejected

- GIVEN a checkout request with no `Idempotency-Key` header
- WHEN `POST /api/orders` is called
- THEN the response MUST be HTTP 400

#### Scenario: First request with a key creates an order

- GIVEN a valid checkout request with a fresh `Idempotency-Key`
- WHEN `POST /api/orders` is called
- THEN an `Order` MUST be created with status `AWAITING_PAYMENT`

#### Scenario: Retry with the same key replays the original order

- GIVEN an order was already created for `Idempotency-Key` K by user U
- WHEN user U calls `POST /api/orders` again with the same key K
- THEN no second order MUST be created and no second stock decrement MUST occur
- AND the response MUST return the original committed order

### Requirement: All-or-Nothing Stock Decrement

Order creation MUST decrement stock for every line item within one
transaction. If any line item fails its floor condition
(`stock + delta >= 0`), the entire transaction MUST abort: no product's
stock MUST change, the cart MUST remain untouched, and the response MUST
name the failing product(s).

#### Scenario: Sufficient stock for all items succeeds

- GIVEN a cart whose every line item has sufficient product stock
- WHEN `POST /api/orders` is called
- THEN every product's stock MUST decrease by its ordered quantity
- AND the order MUST be created

#### Scenario: One insufficient item rejects the whole order

- GIVEN a cart with two line items, one of which exceeds its product's stock
- WHEN `POST /api/orders` is called
- THEN the response MUST reject the order and name the failing product(s)
- AND neither product's stock MUST change
- AND the cart MUST remain unchanged

### Requirement: Non-Destructive Cart Transition on Success

A successful checkout MUST transition the buyer's ordered `ACTIVE` cart rows
to `ORDERED`, in the same transaction as the order insert and stock
decrement.

#### Scenario: Cart is empty after successful checkout

- GIVEN a successful `POST /api/orders`
- WHEN `GET /api/cart` is called afterward for the same user
- THEN the response MUST contain no items from the placed order

### Requirement: Buyer Views the Just-Placed Order

The buyer who placed an order MUST be able to retrieve that order's detail.
A request for an order not owned by the requesting buyer MUST be denied.
This capability is limited to single-order detail, not a history listing.

#### Scenario: Owner retrieves their order detail

- GIVEN a buyer who just placed order O
- WHEN that buyer requests order O's detail
- THEN the response MUST return O's full detail

#### Scenario: Non-owner is denied

- GIVEN order O belongs to buyer A
- WHEN buyer B requests order O's detail
- THEN the response MUST deny access (403 or 404)

### Requirement: Concurrent Checkout Backstop

Concurrent, non-retried checkout requests from the same user MUST be
serialized by locking (`SELECT ... FOR UPDATE`) that user's `ACTIVE` cart
rows, so a second concurrent request observes an empty active cart rather
than double-ordering the same items.

#### Scenario: Two concurrent checkouts from the same user yield one order

- GIVEN a user's `ACTIVE` cart and two concurrent `POST /api/orders` calls
  with different idempotency keys
- WHEN both requests are processed
- THEN exactly one order MUST be created from that cart's contents
