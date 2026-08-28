# Delta for Product Inventory

## ADDED Requirements

### Requirement: Transaction-Composable Stock Adjustment

The repository-level `adjustStock` operation MUST accept an optional
transaction parameter, allowing it to participate in a caller-supplied DB
transaction using the same conditional `UPDATE ... WHERE stock + delta >= 0`
semantics. When no transaction is supplied, behavior MUST be identical to
the existing standalone contract, and `PATCH /api/products/:id/stock`'s
request/response contract MUST NOT change.

#### Scenario: adjustStock composes into a caller transaction

- GIVEN a caller-supplied open DB transaction
- WHEN `adjustStock` is invoked with that transaction and the transaction is
  later rolled back
- THEN the stock change made by `adjustStock` MUST also roll back

#### Scenario: Standalone contract is unchanged

- GIVEN a call to `adjustStock` with no transaction argument
- WHEN it runs via `PATCH /api/products/:id/stock`
- THEN its request/response behavior MUST match the existing Stock
  Adjustment requirement exactly, including the HTTP 409 rejection when the
  resulting stock would go negative
