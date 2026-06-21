# API Products Layer Specification (Slice 2B Delta)

This delta specification defines the camelCase property naming conventions and DTO response structures for the API products layer.

## Requirements

### Requirement: Product DTO Casing
The API endpoint payloads and `ProductDTO` interface MUST use camelCase property names.

#### Scenario: List products endpoint response structure
- GIVEN a GET request to `/api/products`
- WHEN the route handler delegates to `productApiController.index`
- THEN the controller SHALL return a JSON object envelope containing `{ count, countByCategory, products }`
- AND the `products` array elements SHALL have properties: `{ idProduct, nameProduct, price, descriptionProduct, image, Category }`

### Requirement: Category Count Transformation in Service
`ProductService.transformWithCategoryCount(products)` (or its application layer equivalents) MUST use camelCase property names when mapping output list elements.

#### Scenario: Service maps products to camelCase DTOs
- GIVEN an array of products with Category associations
- WHEN `ProductService.transformWithCategoryCount(products)` is called
- THEN the `products` returned in the result envelope SHALL be mapped to:
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
- AND if a product's Category association is null, `Category` SHALL be mapped to `"Sin categoria"`
