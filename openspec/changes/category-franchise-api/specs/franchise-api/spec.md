# Franchise API Specification

## Purpose

Exposes CRUD JSON API for Franchise catalog reference data (`idFranchise`, `nameFranchise`), the FK target of every Product. Mirrors `category-api` 1:1 with the entity substituted (`nameFranchise` / `/franchises`); the guard mechanism (401/403 semantics) is defined in `admin-route-guard` and `api-jwt-auth` and is not restated here.

## Requirements

### Requirement: Franchise List and Get Are Open Reads

`GET /franchises` and `GET /franchises/:id` MUST be reachable without an `Authorization` header and MUST return `FranchiseDTO` objects (`idFranchise`, `nameFranchise`).

#### Scenario: List all franchises
- GIVEN franchises exist in the database
- WHEN `GET /franchises` is called with no auth header
- THEN the response MUST be HTTP 200 with an array of `FranchiseDTO`

#### Scenario: Get franchise by id
- GIVEN a franchise with a known `idFranchise` exists
- WHEN `GET /franchises/:id` is called with that id
- THEN the response MUST be HTTP 200 with the matching `FranchiseDTO`

#### Scenario: Get franchise by id not found
- GIVEN no franchise exists with the given `:id`
- WHEN `GET /franchises/:id` is called
- THEN the response MUST be HTTP 404

#### Scenario: Get franchise with non-numeric id
- GIVEN `:id` is not a valid numeric identifier
- WHEN `GET /franchises/:id` is called
- THEN the response MUST be HTTP 400

### Requirement: Franchise Name Validation

`nameFranchise` MUST be a required, non-empty, trimmed string on create and update. No uniqueness constraint is enforced.

#### Scenario: Missing name rejected on create
- GIVEN a create request with an empty or missing `nameFranchise`
- WHEN `POST /franchises` is called
- THEN the response MUST be HTTP 400 with a validation error body

#### Scenario: Whitespace-only name rejected
- GIVEN a create or update request where `nameFranchise` is only whitespace
- WHEN the request is submitted
- THEN the response MUST be HTTP 400 with a validation error body

### Requirement: Franchise Create and Update Require ADMIN or STAFF

`POST /franchises` and `PUT /franchises/:id` MUST require a valid Bearer JWT whose role is `Role.ADMIN` or `Role.STAFF`, per the `admin-route-guard` Capability-Aware Role Guard.

#### Scenario: Valid create returns 201
- GIVEN an authenticated ADMIN or STAFF request with a valid `nameFranchise`
- WHEN `POST /franchises` is called
- THEN the response MUST be HTTP 201 with the created `FranchiseDTO`

#### Scenario: Valid update returns 200
- GIVEN an existing franchise and an authenticated ADMIN or STAFF request with a valid `nameFranchise`
- WHEN `PUT /franchises/:id` is called
- THEN the response MUST be HTTP 200 with the updated `FranchiseDTO`

#### Scenario: Update on nonexistent franchise returns 404
- GIVEN no franchise exists with the given `:id`
- WHEN `PUT /franchises/:id` is called by an authenticated ADMIN or STAFF
- THEN the response MUST be HTTP 404

#### Scenario: Unauthenticated write rejected
- GIVEN no `Authorization` header is present
- WHEN `POST /franchises` or `PUT /franchises/:id` is called
- THEN the response MUST be HTTP 401

### Requirement: Franchise Delete Requires ADMIN Only

`DELETE /franchises/:id` MUST be restricted to `Role.ADMIN` via `adminGuard` — STAFF and unauthenticated requests MUST be rejected per `admin-route-guard`.

#### Scenario: Successful delete returns 204
- GIVEN an existing franchise with no associated products and an authenticated ADMIN request
- WHEN `DELETE /franchises/:id` is called
- THEN the response MUST be HTTP 204 with no body

#### Scenario: STAFF delete rejected
- GIVEN an authenticated STAFF request
- WHEN `DELETE /franchises/:id` is called
- THEN the response MUST be HTTP 403

#### Scenario: Delete on nonexistent franchise returns 404
- GIVEN no franchise exists with the given `:id`
- WHEN an authenticated ADMIN calls `DELETE /franchises/:id`
- THEN the response MUST be HTTP 404

### Requirement: Franchise Delete Blocked by Referential Integrity

Deleting a Franchise still referenced by one or more Products MUST fail with `409 Conflict` instead of surfacing a raw database FK error, and MUST NOT cascade or soft-delete.

#### Scenario: Delete franchise referenced by products returns 409
- GIVEN a franchise referenced by at least one existing Product
- WHEN an authenticated ADMIN calls `DELETE /franchises/:id` for that franchise
- THEN the response MUST be HTTP 409 Conflict
- AND the franchise record MUST remain in the database unchanged
