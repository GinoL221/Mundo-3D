# Delta for Cart Domain

## ADDED Requirements

### Requirement: Non-Destructive ACTIVE → ORDERED Transition

`ShoppingCartRepositoryPort` MUST expose a method that transitions a given
set of a user's `ACTIVE` cart rows to `ORDERED` via an `UPDATE` on those
rows, never by deleting and recreating rows (unlike `syncCart`'s
destroy+recreate). This transition MUST execute within the same database
transaction as the order that causes it.

#### Scenario: Checkout marks cart rows ORDERED via update

- GIVEN a user's `ACTIVE` cart rows being purchased in a checkout transaction
- WHEN the order commits
- THEN those cart rows MUST become `ORDERED` via an in-place update
- AND no cart row MUST be deleted and reinserted as part of this transition

#### Scenario: ORDERED rows do not appear in the active cart

- GIVEN cart rows transitioned to `ORDERED` by a completed checkout
- WHEN `GET /api/cart` is called for that user
- THEN those rows MUST NOT appear in the response
