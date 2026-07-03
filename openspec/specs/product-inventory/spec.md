# Product Inventory Specification

## Purpose

Defines product catalog mutation (create/update/delete) and stock-tracking behavior for the JSON API, exposed to authenticated `ADMIN`/`STAFF` principals per the admin-route-guard capability's Route Capability Matrix.

## Requirements

### Requirement: Product Entity Stock Invariant

The `Product` entity constructor MUST validate `stock` the same way it validates `height`/`width`/`depth`: when provided, `stock` MUST be a non-negative integer, and the constructor MUST throw when this invariant is violated.

#### Scenario: Negative stock rejected at construction

- GIVEN a `Product` is constructed with `stock: -1`
- WHEN the constructor runs
- THEN it MUST throw an error

#### Scenario: Non-integer stock rejected at construction

- GIVEN a `Product` is constructed with `stock: 2.5`
- WHEN the constructor runs
- THEN it MUST throw an error

### Requirement: Product Create

`POST /api/products` MUST validate required product fields and accept the product image as a multipart file upload. `stock` MUST default to `0` when omitted from the request.

#### Scenario: Valid create request returns 201

- GIVEN an authenticated `ADMIN` or `STAFF` request with all required fields and a valid image file, `stock` omitted
- WHEN `POST /api/products` is called
- THEN the response MUST be HTTP 201 with a `ProductDTO` body
- AND the returned `stock` MUST be `0`

#### Scenario: Missing required field rejected

- GIVEN an authenticated request missing a required product field
- WHEN `POST /api/products` is called
- THEN the response MUST be HTTP 400 with a validation error body

### Requirement: Product Update

`PUT /api/products/:id` MUST update catalog fields and MUST NOT accept or modify `stock` in the same request — stock changes are exclusively performed via the stock adjustment endpoint.

#### Scenario: Valid update returns 200 unchanged stock

- GIVEN an existing product and an authenticated `ADMIN` or `STAFF` update request that includes a `stock` value in the body
- WHEN `PUT /api/products/:id` is called
- THEN the response MUST be HTTP 200 with the updated `ProductDTO`
- AND the product's persisted `stock` MUST be unchanged by this request, regardless of any `stock` value present in the body

#### Scenario: Update on nonexistent product returns 404

- GIVEN no product exists with the given `:id`
- WHEN `PUT /api/products/:id` is called
- THEN the response MUST be HTTP 404

### Requirement: Product Delete

`DELETE /api/products/:id` MUST remove the product and is restricted to `ADMIN` per the admin-route-guard Route Capability Matrix (STAFF receives 403, see that capability's spec).

#### Scenario: Successful delete returns 204

- GIVEN an existing product and an authenticated `ADMIN` request
- WHEN `DELETE /api/products/:id` is called
- THEN the response MUST be HTTP 204 with no body

#### Scenario: Delete on nonexistent product returns 404

- GIVEN no product exists with the given `:id`
- WHEN an authenticated `ADMIN` calls `DELETE /api/products/:id`
- THEN the response MUST be HTTP 404

### Requirement: Stock Adjustment

`PATCH /api/products/:id/stock` MUST accept a JSON body `{ delta: number }` where `delta` is a non-zero integer, and MUST recompute `stock` as `current stock + delta`.

#### Scenario: Valid positive delta increases stock

- GIVEN an existing product with `stock: 5` and an authenticated `ADMIN` or `STAFF` request with body `{ delta: 3 }`
- WHEN `PATCH /api/products/:id/stock` is called
- THEN the response MUST be HTTP 200 with the updated `ProductDTO`
- AND the returned `stock` MUST be `8`

#### Scenario: Valid negative delta decreases stock

- GIVEN an existing product with `stock: 5` and an authenticated request with body `{ delta: -2 }`
- WHEN `PATCH /api/products/:id/stock` is called
- THEN the response MUST be HTTP 200 with the updated `ProductDTO`
- AND the returned `stock` MUST be `3`

#### Scenario: Delta that would make stock negative rejected

- GIVEN an existing product with `stock: 2` and an authenticated request with body `{ delta: -5 }`
- WHEN `PATCH /api/products/:id/stock` is called
- THEN the response MUST be HTTP 409
- AND the product's persisted `stock` MUST remain `2`

#### Scenario: Zero or non-integer delta rejected

- GIVEN an existing product and an authenticated request with body `{ delta: 0 }` or a non-integer `delta` (e.g. `1.5`)
- WHEN `PATCH /api/products/:id/stock` is called
- THEN the response MUST be HTTP 400 with a validation error body
- AND the product's persisted `stock` MUST be unchanged
