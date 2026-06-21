# API Products Layer Specification

## Purpose

Defines the controller+service layering for API product endpoints, removing inline business logic from route handlers.

## Requirements

### Requirement: API Product Controller

`src/controllers/api/productApiController.js` MUST exist and export handler methods for `/api/products`, `/api/product/:id`, and `/api/products/latest`. Each handler SHALL call the appropriate service method and delegate response shaping.

#### Scenario: List endpoint delegates to controller

- GIVEN a GET request to `/api/products`
- WHEN the route handler receives it
- THEN it SHALL call `productApiController.index(req, res, next)`
- AND the controller SHALL call `ProductService.findAll()` for data

#### Scenario: List products endpoint response structure
- GIVEN a GET request to `/api/products`
- WHEN the route handler delegates to `productApiController.index`
- THEN the controller SHALL return a JSON object envelope containing `{ count, countByCategory, products }`
- AND the `products` array elements SHALL have properties: `{ idProduct, nameProduct, price, descriptionProduct, image, Category }`

### Requirement: Product DTO Casing
The API endpoint payloads and `ProductDTO` interface MUST use camelCase property names.

### Requirement: Category Count Transformation in Service

`ProductService` (or its application layer equivalents) MUST expose `transformWithCategoryCount(products)` that performs the `countByCategory` accumulation and product mapping. The method SHALL return `{ count, countByCategory, products: mappedProducts }` using camelCase property names when mapping output list elements.

#### Scenario: Service produces countByCategory from raw products
- GIVEN an array of products with Category associations
- WHEN `ProductService.transformWithCategoryCount(products)` is called
- THEN the result SHALL contain `countByCategory` with category name keys and count/category info values
- AND `products` returned in the result envelope SHALL be mapped to:
  ```json
  {
    "idProduct": 1,
    "nameProduct": "Product Name",
    "price": 100,
    "descriptionProduct": "Description",
    "image": "image.png",
    "Category": "Category Name"
  }
  ```

#### Scenario: Product without category mapped as "Sin categoria"

- GIVEN a product whose `Category` association is null
- WHEN `transformWithCategoryCount` processes it
- THEN its `Category` field SHALL be `'Sin categoria'`
- AND `countByCategory['Sin categoria'].count` SHALL increment

### Requirement: API Route Has No Inline Logic

`src/routes/api/products.js` MUST NOT contain any data transformation logic. It SHALL only wire routes to controller methods.

#### Scenario: Route file only maps to controller

- GIVEN `routes/api/products.js` after refactoring
- WHEN inspected
- THEN it MUST NOT contain `.map()`, `countByCategory`, or inline `res.json()` with transformation
- AND each route SHALL delegate to `productApiController.method(req, res, next)`
