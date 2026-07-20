# Category API Specification

## Purpose

Exposes CRUD JSON API for Category catalog reference data (`idCategory`, `nameCategory`), the FK target of every Product. Reads are open; writes reuse the Bearer-JWT + role-guard mechanics already specified in `admin-route-guard` and `api-jwt-auth` (401 unauthenticated, 403 wrong role) — this spec states only the role assignment and entity-specific rules, not the guard mechanism itself.

## Requirements

### Requirement: Category List and Get Are Open Reads

`GET /categories` and `GET /categories/:id` MUST be reachable without an `Authorization` header and MUST return `CategoryDTO` objects (`idCategory`, `nameCategory`).

#### Scenario: List all categories
- GIVEN categories exist in the database
- WHEN `GET /categories` is called with no auth header
- THEN the response MUST be HTTP 200 with an array of `CategoryDTO`

#### Scenario: Get category by id
- GIVEN a category with a known `idCategory` exists
- WHEN `GET /categories/:id` is called with that id
- THEN the response MUST be HTTP 200 with the matching `CategoryDTO`

#### Scenario: Get category by id not found
- GIVEN no category exists with the given `:id`
- WHEN `GET /categories/:id` is called
- THEN the response MUST be HTTP 404

#### Scenario: Get category with non-numeric id
- GIVEN `:id` is not a valid numeric identifier
- WHEN `GET /categories/:id` is called
- THEN the response MUST be HTTP 400

### Requirement: Category Name Validation

`nameCategory` MUST be a required, non-empty, trimmed string on create and update. `nameCategory` MUST be unique across all Category records.

#### Scenario: Missing name rejected on create
- GIVEN a create request with an empty or missing `nameCategory`
- WHEN `POST /categories` is called
- THEN the response MUST be HTTP 400 with a validation error body

#### Scenario: Whitespace-only name rejected
- GIVEN a create or update request where `nameCategory` is only whitespace
- WHEN the request is submitted
- THEN the response MUST be HTTP 400 with a validation error body

### Requirement: Category Duplicate Name Conflict

Create and update operations MUST reject duplicate `nameCategory` values deterministically with HTTP 409 Conflict.

#### Scenario: Duplicate create returns 409
- GIVEN an existing Category already has the submitted `nameCategory`
- WHEN `POST /categories` is called with that name
- THEN the response MUST be HTTP 409 Conflict
- AND the Category collection MUST remain unchanged

#### Scenario: Duplicate update returns 409
- GIVEN an existing Category is updated to a `nameCategory` already used by another Category
- WHEN `PUT /categories/:id` is called
- THEN the response MUST be HTTP 409 Conflict
- AND the target Category MUST remain unchanged

#### Scenario: Unique create or update succeeds
- GIVEN no other Category uses the submitted `nameCategory`
- WHEN `POST /categories` or `PUT /categories/:id` is called with that name
- THEN the response MUST follow the normal success status for the operation
- AND the saved Category MUST expose the submitted `nameCategory`

### Requirement: Category Create and Update Require ADMIN or STAFF

`POST /categories` and `PUT /categories/:id` MUST require a valid Bearer JWT whose role is `Role.ADMIN` or `Role.STAFF`, per the `admin-route-guard` Capability-Aware Role Guard.

#### Scenario: Valid create returns 201
- GIVEN an authenticated ADMIN or STAFF request with a valid `nameCategory`
- WHEN `POST /categories` is called
- THEN the response MUST be HTTP 201 with the created `CategoryDTO`

#### Scenario: Valid update returns 200
- GIVEN an existing category and an authenticated ADMIN or STAFF request with a valid `nameCategory`
- WHEN `PUT /categories/:id` is called
- THEN the response MUST be HTTP 200 with the updated `CategoryDTO`

#### Scenario: Update on nonexistent category returns 404
- GIVEN no category exists with the given `:id`
- WHEN `PUT /categories/:id` is called by an authenticated ADMIN or STAFF
- THEN the response MUST be HTTP 404

#### Scenario: Unauthenticated write rejected
- GIVEN no `Authorization` header is present
- WHEN `POST /categories` or `PUT /categories/:id` is called
- THEN the response MUST be HTTP 401

### Requirement: Category Delete Requires ADMIN Only

`DELETE /categories/:id` MUST be restricted to `Role.ADMIN` via `adminGuard` — STAFF and unauthenticated requests MUST be rejected per `admin-route-guard`.

#### Scenario: Successful delete returns 204
- GIVEN an existing category with no associated products and an authenticated ADMIN request
- WHEN `DELETE /categories/:id` is called
- THEN the response MUST be HTTP 204 with no body

#### Scenario: STAFF delete rejected
- GIVEN an authenticated STAFF request
- WHEN `DELETE /categories/:id` is called
- THEN the response MUST be HTTP 403

#### Scenario: Delete on nonexistent category returns 404
- GIVEN no category exists with the given `:id`
- WHEN an authenticated ADMIN calls `DELETE /categories/:id`
- THEN the response MUST be HTTP 404

### Requirement: Category Delete Blocked by Referential Integrity

Deleting a Category still referenced by one or more Products MUST fail with `409 Conflict` instead of surfacing a raw database FK error, and MUST NOT cascade or soft-delete.

#### Scenario: Delete category referenced by products returns 409
- GIVEN a category referenced by at least one existing Product
- WHEN an authenticated ADMIN calls `DELETE /categories/:id` for that category
- THEN the response MUST be HTTP 409 Conflict
- AND the category record MUST remain in the database unchanged

### Requirement: Category Conflict Response Semantics

Duplicate create/update failures MUST use HTTP 409 Conflict with a stable error response shape from the existing API error contract. This spec does not lock exact public Spanish wording; if wording changes, the 409 semantics and duplicate-detection tests MUST remain deterministic.

#### Scenario: Conflict response is stable
- GIVEN a duplicate Category create or update is rejected
- WHEN the API responds
- THEN the status code MUST be 409 Conflict
- AND the error body shape MUST match the API error contract
- AND the behavior MUST be testable without relying on locale-specific prose
