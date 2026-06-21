# Delta Spec: Cart Computation (Slice 2C)

This delta specification updates the cart calculation inputs and scenario structures to use standard camelCase naming conventions, extending the original Cart Computation Specification.

## Naming Standardization Requirements

### Requirement: CamelCase Domain Inputs for Computation
Any utility, service, or use case performing cart computation (such as calculating the total price) MUST accept cart items formatted with camelCase properties (`unitPrice`, `quantity`).

#### Scenario: Multiple items compute correct total (Updated)
- GIVEN cart items `[{unitPrice: 10, quantity: 2}, {unitPrice: 5, quantity: 3}]`
- WHEN the cart total is calculated
- THEN the result SHALL be `35`

#### Scenario: Single item computation (Updated)
- GIVEN cart items `[{unitPrice: 15.50, quantity: 3}]`
- WHEN the cart total is calculated
- THEN the result SHALL be `46.50`
