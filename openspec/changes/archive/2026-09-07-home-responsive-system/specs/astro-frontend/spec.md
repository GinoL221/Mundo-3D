# Delta for Astro Frontend

## MODIFIED Requirements

### Requirement: Dynamic Content Fetching

For dynamic views such as Home `/` and product details, Astro MUST continue fetching JSON data from the Express REST API. The Home responsive change MUST preserve its existing HTML structure, shell selection, client hydration boundary, loading sequence, success rendering, empty state, and error state; it MUST NOT redesign product loading.

(Previously: Required API-backed dynamic rendering without explicitly preserving Home markup, shell, hydration, or loading-state behavior during responsive changes.)

#### Scenario: Homepage renders products from API fetch

- GIVEN the Home client receives a successful `/api/products` response
- WHEN the existing hydration flow settles
- THEN Home MUST render the dynamic product components through the existing content regions
- AND the responsive layout MUST NOT require replacement Home markup or a different hydration boundary

#### Scenario: Existing loading outcomes remain intact

- GIVEN the Home product request is pending, empty, or unsuccessful
- WHEN the corresponding existing UI state renders
- THEN that state MUST remain observable with the same loading contract as before the responsive change
- AND responsive behavior MUST NOT initiate an alternative product-loading flow
