# Order Domain Specification

## Purpose

Defines the `Order` and `OrderItem` domain entities, the `OrderStatus` state
machine and its legal transitions, and the monetary/quantity invariants that
apply at order creation.

## Requirements

### Requirement: Order and OrderItem Entity Structure

The `Order` entity MUST expose: `idOrder`, `idUser`, `idempotencyKey`,
`status` (`OrderStatus`), `items` (`OrderItem[]`), `totalAmount` (derived),
and `createdAt`. The `OrderItem` entity MUST expose: `idOrderItem`,
`idOrder`, `idProduct`, `quantity`, and `unitPrice`. Neither entity MUST
define or persist a shipping address, contact detail, or notes field.

#### Scenario: Valid order entity is constructed

- GIVEN an order with one item, quantity 2, unitPrice 150
- WHEN the entity is instantiated
- THEN it SHALL be created with status `AWAITING_PAYMENT` and `totalAmount` 300

#### Scenario: No shipping/contact/notes fields exist

- GIVEN the `Order` and `OrderItem` entity definitions
- WHEN their properties are inspected
- THEN no shipping address, contact detail, or notes property SHALL exist

### Requirement: Item Price Frozen at Creation

`OrderItem.unitPrice` MUST be set once, at order-creation time, from the
source cart row's `unit_price`. It MUST NOT be re-read from the `Product`
at creation or at any later point, and MUST be immutable after creation.

#### Scenario: Price is copied from the cart, not the product

- GIVEN a cart row with `unit_price` 100 for a product whose current price is 120
- WHEN the order is created from that cart row
- THEN the resulting `OrderItem.unitPrice` SHALL be 100

#### Scenario: Later product price changes do not affect the order

- GIVEN a committed order with an `OrderItem.unitPrice` of 100
- WHEN the underlying product's price changes afterward
- THEN the order's `OrderItem.unitPrice` SHALL remain 100

### Requirement: OrderStatus State Machine

`OrderStatus` MUST be `AWAITING_PAYMENT`, `PAID`, or `CANCELLED`. The only
legal transitions are `AWAITING_PAYMENT → PAID` and
`AWAITING_PAYMENT → CANCELLED`. Both `PAID` and `CANCELLED` MUST be
terminal — no transition MUST be legal out of either state.

#### Scenario: AWAITING_PAYMENT transitions to PAID

- GIVEN an order with status `AWAITING_PAYMENT`
- WHEN it is confirmed
- THEN its status SHALL become `PAID`

#### Scenario: AWAITING_PAYMENT transitions to CANCELLED

- GIVEN an order with status `AWAITING_PAYMENT`
- WHEN it is cancelled
- THEN its status SHALL become `CANCELLED`

#### Scenario: Transition out of a terminal state is illegal

- GIVEN an order with status `PAID` or `CANCELLED`
- WHEN any transition is attempted on it
- THEN the transition SHALL be rejected and the status SHALL remain unchanged

### Requirement: Monetary and Quantity Invariants

`OrderItem.quantity` MUST be an integer greater than 0. `OrderItem.unitPrice`
MUST be a non-negative number. `Order.totalAmount` MUST equal the sum, over
all items, of `quantity * unitPrice`.

#### Scenario: Invalid quantity is rejected

- GIVEN an item with `quantity: 0`
- WHEN the order entity is instantiated
- THEN construction SHALL throw a validation error

#### Scenario: Total amount is computed from line items

- GIVEN two items: (quantity 2, unitPrice 50) and (quantity 1, unitPrice 30)
- WHEN the order entity is instantiated
- THEN `totalAmount` SHALL equal 130
