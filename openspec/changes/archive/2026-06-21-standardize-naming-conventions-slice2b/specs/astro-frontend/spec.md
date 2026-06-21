# Astro Frontend Specification (Slice 2B Delta)

This delta specification defines the corrected client-side fetch handling for the Astro frontend to parse the products array from the backend API's response envelope.

## Requirements

### Requirement: Corrected Fetch Handling and camelCase Property Mapping
The Astro pages fetching products from `/api/products` MUST correctly extract the products array from the response envelope (`resData.products`) and consume camelCase product properties.

#### Scenario: Products Catalog and Home fetching
- GIVEN the Astro client-side script running on `/` or `/products`
- WHEN it performs a fetch to `http://localhost:3000/api/products`
- THEN it MUST parse the JSON response as an object envelope (e.g., `resData`)
- AND it MUST extract the products list from `resData.products`
- AND it MUST render each product using camelCase properties:
  - `product.idProduct` (instead of `product.IDProduct`)
  - `product.nameProduct` (instead of `product.NameProduct`)
  - `product.price` (instead of `product.Price`)
  - `product.Category` (as a flat string representation of the category name, e.g. mapping `product.Category || 'Otras'`)
