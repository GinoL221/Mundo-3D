# Delta Spec: Nano Stores Cart (Slice 2C)

This delta specification defines the camelCase payload structure for client-server API synchronization, extending the original Nano Stores Cart Specification.

## API Integration Requirements

### Requirement: CamelCase API Payloads
The asynchronous synchronization request to `/api/cart` and the response returned by the server MUST utilize camelCase properties for cart items.

The request payload (for updates or additions) MUST conform to the format:
```json
{
  "idProduct": 123,
  "quantity": 2
}
```

The response payload (for active cart items) MUST conform to the format:
```json
[
  {
    "idCart": 1,
    "idUser": 45,
    "idProduct": 123,
    "quantity": 2,
    "unitPrice": 150.00,
    "status": "ACTIVE"
  }
]
```

#### Scenario: API sync with camelCase payload
- GIVEN a local cart store update
- WHEN sending a non-blocking asynchronous PUT/POST request to `/api/cart`
- THEN the payload sent by the frontend MUST use camelCase fields (`idProduct`, `quantity`)
- AND the server response MUST return camelCase attributes (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `status`)
