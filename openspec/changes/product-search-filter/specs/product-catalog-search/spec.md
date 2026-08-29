# Product Catalog Search Specification

## Purpose

Defines a public, paginated product search-and-filter capability via
`GET /api/products/search`, combinable by substring text, category, and
franchise, independent of and non-overlapping with the existing unpaginated
`GET /api/products` listing used by admin.

## Requirements

### Requirement: Combined Search and Filter Query

`GET /api/products/search` MUST accept optional `search`, `idCategory`,
`idFranchise` query parameters plus `page`/`pageSize`, and MUST combine all
supplied parameters with AND semantics in a single request.

#### Scenario: Search term alone

- GIVEN products exist matching and not matching a term
- WHEN `GET /api/products/search?search=term` is called
- THEN the response MUST contain only matching products

#### Scenario: Category filter alone

- GIVEN products across multiple categories
- WHEN `GET /api/products/search?idCategory=3` is called
- THEN the response MUST contain only products in category 3

#### Scenario: Franchise filter alone

- GIVEN products across multiple franchises
- WHEN `GET /api/products/search?idFranchise=5` is called
- THEN the response MUST contain only products of franchise 5

#### Scenario: Search, category, and franchise combined

- GIVEN products with varying names, categories, and franchises
- WHEN `GET /api/products/search?search=term&idCategory=3&idFranchise=5` is called
- THEN the response MUST contain only products satisfying all three filters

### Requirement: Case-Insensitive Substring Match Across Name and Description

The `search` term MUST match case-insensitively as a substring against
`name_product` OR `description_product` (OR'd across both columns).

#### Scenario: Match via name only

- GIVEN a product whose name contains the term but whose description does not
- WHEN searching for that term in any letter case
- THEN the product MUST be returned

#### Scenario: Match via description only

- GIVEN a product whose description contains the term but whose name does not
- WHEN searching for that term
- THEN the product MUST be returned

### Requirement: Literal Escaping of Search Term

The system MUST trim the `search` term and treat a blank/whitespace-only
term as absent. Before building the `LIKE` pattern, it MUST escape literal
`%` and `_` characters in the term so they match literally, not as SQL
wildcards.

#### Scenario: Literal percent sign in stored data is matched correctly

- GIVEN a product whose name or description contains a literal `%` character
- WHEN the user searches for a term that includes that literal `%`
- THEN the product MUST be returned and unrelated products MUST NOT be
  returned as false positives

#### Scenario: Search term with wildcard characters does not widen the match

- GIVEN products that do not contain the exact substring `50%` or `a_b`
- WHEN the user searches for `50%` or `a_b`
- THEN products MUST NOT be returned merely because `%`/`_` acted as SQL
  wildcards

### Requirement: Pagination Defaults and Limits

The endpoint MUST accept `page` (default 1, integer >= 1) and `pageSize`
(default 20, integer between 1 and 50 inclusive) using constants owned
exclusively by this capability, independent of any other endpoint's
pagination constants.

#### Scenario: Defaults applied when omitted

- WHEN `GET /api/products/search` is called with no `page`/`pageSize`
- THEN the response MUST use `page=1` and `pageSize=20`

#### Scenario: pageSize above the maximum is rejected, not clamped

- WHEN `GET /api/products/search?pageSize=51` is called
- THEN the response MUST be HTTP 400, not silently clamped to 50

### Requirement: Pagination and Filter Input Validation

Invalid `page`/`pageSize` (non-integer, zero, negative, or `pageSize` > 50)
MUST return HTTP 400 with `{ error, code: 'INVALID_PAGINATION' }`. A
non-integer `idCategory` or `idFranchise` MUST return HTTP 400 with
`{ error, code: 'INVALID_FILTER' }`.

#### Scenario: Invalid pagination value

- WHEN `GET /api/products/search?page=0` or a non-numeric `page`/`pageSize`
  is called
- THEN the response MUST be HTTP 400 with `code: 'INVALID_PAGINATION'`

#### Scenario: Invalid filter id

- WHEN `GET /api/products/search?idCategory=abc` is called
- THEN the response MUST be HTTP 400 with `code: 'INVALID_FILTER'`

### Requirement: Response Envelope and Empty Results

A successful response MUST be HTTP 200 with body
`{ products, page, pageSize, total, totalPages }`. An empty search term, no
matches, or a well-formed filter id matching nothing MUST return HTTP 200
with `products: []`, `total: 0`, `totalPages: 0` — never HTTP 404.

#### Scenario: No matches

- GIVEN a well-formed query matching no product
- WHEN `GET /api/products/search` is called
- THEN the response MUST be HTTP 200 with `products: []` and `total: 0`

### Requirement: Deterministic Ordering

Results MUST be ordered by `idProduct ASC`, ensuring stable, non-duplicated,
non-skipped pagination across requests for the same query.

#### Scenario: Stable pages under repeated queries

- GIVEN a query matching more products than one page holds
- WHEN page 1 and page 2 are requested for the same query
- THEN no product MUST appear on both pages and none MUST be skipped

### Requirement: Existing Product Listing Non-Regression

`GET /api/products`, `ListProductsUseCase`, `ProductRepositoryPort.findAll()`,
`countByCategory`, and both admin product pages MUST remain unaffected by
this capability: same route, same behavior, same passing tests.

#### Scenario: Admin listing behaves as before

- GIVEN the existing product-listing test suite
- WHEN it is run after this capability is added
- THEN `GET /api/products` MUST return unpaginated results exactly as
  before with no code changes required to that route or its tests

### Requirement: Frontend Query-String-Driven Search UI

The storefront `/products` page MUST provide a search input, a category
dropdown, a franchise dropdown, and pagination controls, all of which MUST
read from and write to the page's URL query string. Loading the page
directly with query parameters present MUST pre-apply that search/filter/page
state without further user interaction.

#### Scenario: Interacting with controls updates the URL

- GIVEN a buyer on the `/products` page
- WHEN the buyer types a search term, picks a category/franchise, or changes
  the page
- THEN the URL query string MUST reflect the current search, filter, and
  page state

#### Scenario: Direct navigation with query params pre-applies state

- GIVEN a URL such as `/products?search=term&idCategory=3&page=2`
- WHEN a buyer loads that URL directly
- THEN the page MUST render results for that exact search, filter, and page
