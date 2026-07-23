# Nano Stores Cart Specification

This specification defines the client-side cart state management using Nano Stores and its asynchronous, non-blocking synchronization with the Express backend API.

## Requirements

### Requirement: Client-side Cart State with Nano Stores

The frontend MUST manage cart state locally using Nano Stores to allow immediate, reactive UI updates.

#### Scenario: Cart item addition updates local state instantly

- GIVEN a user clicks "Add to Cart" on a product
- WHEN the local Nano Store cart action executes
- THEN the cart count and items list in the UI MUST update immediately
- AND the store state MUST reflect the added product without waiting for server confirmation

### Requirement: Asynchronous, Non-blocking API Synchronization

Local cart changes MUST trigger background asynchronous fetch requests to `/api/cart` to persist changes on the server. The UI must remain responsive and not block the user during synchronization.

#### Scenario: Background sync of cart item to backend

- GIVEN the local Nano Store state has updated
- WHEN the sync effect triggers in the background
- THEN a non-blocking asynchronous POST/PUT request MUST be dispatched to `/api/cart`
- AND the user MUST be able to continue interacting with the page during the network exchange

#### Scenario: Backend sync failure handles errors gracefully

- GIVEN the background fetch request to `/api/cart` fails (e.g., due to network loss or server error)
- WHEN the synchronization attempt fails
- THEN the system MUST revert the local Nano Store to its previous valid state
- AND display a non-blocking UI alert indicating the synchronization failure

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
    "unitPrice": 150.0,
    "status": "ACTIVE"
  }
]
```

#### Scenario: API sync with camelCase payload

- GIVEN a local cart store update
- WHEN sending a non-blocking asynchronous PUT/POST request to `/api/cart`
- THEN the payload sent by the frontend MUST use camelCase fields (`idProduct`, `quantity`)
- AND the server response MUST return camelCase attributes (`idCart`, `idUser`, `idProduct`, `quantity`, `unitPrice`, `status`)

### Requirement: Reactive Header Cart Badge

The Header badge MUST react to Nano Store state, show distinct products rather than summed quantities, and hide at zero.

#### Scenario: Badge shows distinct products

- GIVEN the cart contains products with any quantities
- WHEN Header loads or cart changes
- THEN the badge MUST immediately show the distinct-product count

#### Scenario: Badge hides for an empty cart

- GIVEN the cart contains no products
- WHEN Header loads or becomes empty
- THEN the badge MUST be hidden, not display zero
