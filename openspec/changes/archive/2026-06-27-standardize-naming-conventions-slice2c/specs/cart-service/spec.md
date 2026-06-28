# Cart Service Delta Specification (Slice 2C)

This delta specification defines changes to the cart synchronization API payload requirements and frontend store integration, enforcing camelCase naming conventions and removing legacy fallback properties.

## Requirements

### Requirement: Standardized Sync API Request Payload

The Cart Sync REST API endpoint (specifically `PUT /api/cart` or the synchronization controller) MUST strictly require camelCase properties for each item in the payload. The legacy PascalCase / mixed-casing properties (such as `idProduct`) MUST be deprecated and rejected or ignored.

- The request body payload structure MUST contain an array of items where each item has:
  - `productId` (number, required) representing the product identifier.
  - `quantity` (number, required) representing the quantity.
- Fallback processing for `idProduct` in the request body is deprecated and MUST be removed.

#### Scenario: Sync request payload containing only standard camelCase properties passes validation

- GIVEN a cart sync request is received with body: `{"items": [{"productId": 12, "quantity": 2}]}`
- WHEN the cart validation middleware processes the request
- THEN the request validation SHALL succeed
- AND the request is passed to the SyncCartUseCase

#### Scenario: Sync request payload containing legacy idProduct fails validation

- GIVEN a cart sync request is received with body: `{"items": [{"idProduct": 12, "quantity": 2}]}`
- WHEN the cart validation middleware processes the request
- THEN a validation error SHALL be raised
- AND the response MUST return HTTP status 400 Bad Request

### Requirement: Astro Frontend Cart Store Standardized Sync Payload

The Astro frontend application's cart store (`frontend/src/store/cart.ts`) MUST construct the sync request payload using standard camelCase properties, specifically sending `productId` in place of the legacy `idProduct` attribute.

#### Scenario: Astro cart store dispatches sync request with standardized property names

- GIVEN the user updates the cart in the frontend Astro UI
- WHEN the `syncToBackend` function is triggered to synchronize the local state
- THEN the HTTP request dispatched to the backend API MUST include `productId` (instead of `idProduct`) in the serialized JSON body
