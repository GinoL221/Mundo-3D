# Cart Hydration Specification

## Purpose

Defines how the client reconciles local (guest/localStorage) cart state with the server's authoritative cart: when hydration runs, how a guest cart merges into an account cart on login, how a pending local mutation is protected during cart-page hydration, how price drift is surfaced, and how hydration failures degrade without blocking the user.

## Requirements

### Requirement: Hydration Entry Point and Triggers

The system MUST expose `CartService.hydrateFromServer()` as the sole entry point for reconciling local cart state against `GET /api/cart`. Hydration MUST run on exactly two triggers: a successful login, and a cart-page load. Hydration MUST NOT be invoked from `loadCartFromStorage()` or any other page load, so that ordinary navigation issues no extra `GET /api/cart`.

On login, the redirect to the post-login destination MUST wait for merge-triggered hydration to settle, bounded by a hard timeout of 1500ms (`HYDRATION_REDIRECT_TIMEOUT_MS`) — the redirect MUST proceed either when hydration resolves or when the timeout elapses, whichever comes first, and MUST NOT fail or be skipped if hydration errors or times out.

#### Scenario: Login success triggers hydration and waits briefly for it

- GIVEN a user submits valid login credentials
- WHEN authentication succeeds
- THEN `hydrateFromServer({ mergeLocal: true })` MUST be invoked
- AND the redirect to the post-login destination MUST wait for it to settle, up to 1500ms
- AND the redirect MUST proceed once hydration settles or the timeout elapses, whichever is first

#### Scenario: Hydration exceeding the timeout still redirects

- GIVEN login-triggered hydration has not settled after 1500ms
- WHEN the timeout elapses
- THEN the redirect to the post-login destination MUST proceed immediately
- AND the local cart state at that moment MUST NOT be considered an error

#### Scenario: Cart-page load triggers hydration

- GIVEN a logged-in user navigates to the cart page
- WHEN the cart page's script initializes
- THEN `hydrateFromServer()` MUST be invoked

#### Scenario: Other page loads do not trigger hydration

- GIVEN a logged-in user navigates to any page other than the cart page
- WHEN that page's local cart badge or state reads from `loadCartFromStorage()`
- THEN `GET /api/cart` MUST NOT be issued

### Requirement: Guest-to-Account Cart Merge on Login

On login-triggered hydration, the system MUST union the local (guest) cart and the server cart by `productId`, summing quantities for products present in both, and MUST persist the result server-side with exactly one `PUT /api/cart` — only when the local guest cart is non-empty. A merged per-product quantity that would exceed 99 MUST be clamped to 99 before that `PUT`, silently, with no rejected request and no user-facing notice for this case.

#### Scenario: Non-empty guest cart merges and syncs once

- GIVEN a guest cart with local items and a server cart for the account being logged into
- WHEN login-triggered hydration merges both carts by `productId`, summing shared quantities
- THEN exactly one `PUT /api/cart` MUST carry the merged result
- AND the merged cart MUST be persisted server-side

#### Scenario: Empty guest cart hydrates without writing

- GIVEN the local guest cart has zero items
- WHEN login-triggered hydration runs
- THEN local state MUST be replaced with the server cart
- AND zero `PUT /api/cart` requests MUST be issued

#### Scenario: Merged quantity over 99 clamps silently

- GIVEN a product's guest-cart quantity and server-cart quantity sum to more than 99
- WHEN the merge computes that product's quantity
- THEN the quantity MUST be clamped to 99 before the `PUT`
- AND no notice or rejected request MUST result from this clamp

### Requirement: Cart-Page Hydration Ordering with Pending Mutations

When cart-page hydration runs while a debounced local mutation is still pending (an open sync burst), the system MUST flush that pending mutation to the server before hydrating, so a just-made local edit is not overwritten or lost.

#### Scenario: Pending burst flushes before hydration

- GIVEN the cart page has an unflushed, debounced local mutation
- WHEN cart-page hydration runs
- THEN the pending mutation MUST be flushed to the server first
- AND hydration MUST read server state only after that flush resolves

#### Scenario: No pending burst hydrates immediately

- GIVEN the cart page has no pending local mutation
- WHEN cart-page hydration runs
- THEN hydration MUST proceed without waiting on any flush

### Requirement: Server DTO to CartItem Mapping

Hydration MUST map each `GET /api/cart` DTO entry to a `CartItem`: the DTO's `product.price` becomes `unitPrice`, and a null/missing `product.image` falls back to an empty string.

#### Scenario: DTO maps to CartItem shape

- GIVEN a `GET /api/cart` response item with a null `product.image`
- WHEN hydration maps it to a `CartItem`
- THEN `unitPrice` MUST equal the DTO's `product.price`
- AND `image` MUST be an empty string

### Requirement: Price-Drift Notice on Hydration

When hydration would overwrite a locally-known item's `unitPrice` with a different server-side price, the system MUST render exactly one price-changed notice per affected item, reusing the existing alert component. Items with no prior local price record, or whose local and server price match, MUST NOT produce a notice.

#### Scenario: Price change renders one notice per item

- GIVEN two items are locally known with prices that differ from their current server prices
- WHEN hydration overwrites both items' `unitPrice`
- THEN exactly one price-changed notice MUST render for each of the two items

#### Scenario: Unchanged price renders no notice

- GIVEN a locally-known item's price matches the server's current price
- WHEN hydration processes that item
- THEN no price-changed notice MUST render for it

### Requirement: Non-Blocking Hydration Failure

A hydration `GET /api/cart` that errors or fails MUST NOT block the calling flow, and MUST leave existing local cart state untouched.

#### Scenario: Failing GET on login still redirects

- GIVEN `GET /api/cart` fails or errors during login-triggered hydration
- WHEN the failure occurs (before the 1500ms timeout)
- THEN the post-login redirect MUST proceed as soon as the failure is known, without waiting for the remainder of the timeout
- AND the local guest cart MUST remain unmodified

#### Scenario: Failing GET on cart-page load keeps local state

- GIVEN `GET /api/cart` fails or errors during cart-page-triggered hydration
- WHEN the failure occurs
- THEN the cart page MUST render the existing local cart state
- AND local state MUST remain unmodified
