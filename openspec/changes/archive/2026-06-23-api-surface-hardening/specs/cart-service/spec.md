# Delta for Cart Service

## ADDED Requirements

### Requirement: Cart Sync Payload Validation

All cart sync requests MUST validate the `items` array using `express-validator`. Each item MUST include a valid product identifier and a `quantity` field bounded to a minimum of 1 and a maximum of 99. Requests with invalid payloads MUST throw a `CartValidationException` and return HTTP 400.

#### Scenario: Valid cart sync payload is accepted

- GIVEN a cart sync request with `items` containing `{ productId: 10, quantity: 3 }`
- WHEN the validation middleware processes the request
- THEN the request MUST pass validation
- AND proceed to the sync use case

#### Scenario: Cart sync rejects out-of-range quantity

- GIVEN a cart sync request with `items` containing `{ productId: 10, quantity: 0 }`
- WHEN the validation middleware processes the request
- THEN a `CartValidationException` MUST be thrown
- AND the response status MUST be 400 Bad Request

#### Scenario: Cart sync rejects missing product identifier

- GIVEN a cart sync request with `items` containing `{ quantity: 5 }` (no product ID)
- WHEN the validation middleware processes the request
- THEN a `CartValidationException` MUST be thrown
- AND the response status MUST be 400 Bad Request
