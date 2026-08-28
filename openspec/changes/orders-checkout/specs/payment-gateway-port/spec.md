# Payment Gateway Port Specification

## Purpose

Defines the `PaymentGatewayPort` contract and the `ManualPaymentGateway`
adapter's semantics, so a future real payment gateway can be swapped in
without redesigning the order model or state machine.

## Requirements

### Requirement: Port Contract

`PaymentGatewayPort` MUST define `initiate({ orderId, amount, currency })`,
`confirm(reference)`, and `cancel(reference)`, each resolving a
`PaymentIntent { reference, status, redirectUrl? }`. `redirectUrl` MUST be
optional/nullable.

#### Scenario: Initiate returns a PaymentIntent

- GIVEN a valid `{ orderId, amount, currency }` payload
- WHEN `initiate` is called on a conforming adapter
- THEN it MUST resolve a `PaymentIntent` with a `reference` and a `status`

### Requirement: Manual Adapter Semantics

`ManualPaymentGateway` MUST implement `PaymentGatewayPort` for offline/
manual confirmation, performing no external network call. `initiate` MUST
resolve synchronously with a `reference` usable by later `confirm`/`cancel`
calls on the same adapter.

#### Scenario: Manual adapter round-trips a reference

- GIVEN `initiate` returned a reference R for an order
- WHEN `confirm(R)` or `cancel(R)` is later called
- THEN it MUST resolve without error against that same reference

### Requirement: Gateway Never Called Inside the Order Transaction

The checkout DB transaction MUST commit the order as `AWAITING_PAYMENT`
before any `PaymentGatewayPort` call. `initiate` MUST run after that commit,
and its resulting reference MUST be persisted via a separate follow-up
update, not inside the original transaction.

#### Scenario: Order commits before initiate runs

- GIVEN a checkout request that will call `initiate` after order creation
- WHEN checkout is processed
- THEN the order MUST be committed as `AWAITING_PAYMENT` before `initiate` is invoked

### Requirement: Swap-In Compatibility for a Future Gateway

`CreateOrderUseCase` and the `Order` state machine MUST depend only on
`PaymentGatewayPort`, not on `ManualPaymentGateway` directly, so any
conforming adapter can replace it without changes to the order model,
state machine, or use case signature.

#### Scenario: Use case accepts any conforming adapter

- GIVEN a `PaymentGatewayPort`-conforming adapter other than `ManualPaymentGateway`
- WHEN it is injected into `CreateOrderUseCase`
- THEN checkout MUST proceed without modification to the use case or `Order` entity
