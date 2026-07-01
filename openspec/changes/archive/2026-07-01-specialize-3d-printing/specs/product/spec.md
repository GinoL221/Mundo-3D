# Product Domain Hexagonal Architecture Specification

This specification defines the architectural rules and non-functional requirements for the Hexagonal Architecture migration of the Product domain slice (including Categories and Franchises).

## 1. Structural Layering Rules
- **Domain Layer (`src/domain`)**: MUST isolate entities and ports. It MUST NOT import from the application or infrastructure layers, nor import any third-party framework or database (e.g. Sequelize, Express).
- **Application Layer (`src/application`)**: MUST isolate Use Cases. They MUST depend only on Domain ports and MUST NOT import from the infrastructure layer. Use Cases MUST return plain DTOs (Data Transfer Objects) and MUST NOT return Sequelize model instances.
- **Infrastructure Layer (`src/infrastructure`)**: MUST handle Express routes, controllers, and Sequelize models. All Sequelize adapters MUST implement Domain Repository Ports and map database models to Domain Entities.
- **TypeScript Compilation**: The compiler configuration MUST enable strict mode (`"strict": true` in `tsconfig.json`) and prohibit any type-casting using `any`.

## 2. Naming & Database Mapping Rules
- **Sequelize Model (`src/database/models/Product.js`)**: MUST map properties to camelCase and define the matching snake_case database columns:
  - `idProduct` (Sequelize attribute) -> `id_product` (Database field, PRIMARY KEY, AUTO_INCREMENT)
  - `nameProduct` (Sequelize attribute) -> `name_product` (Database field)
  - `price` (Sequelize attribute) -> `price` (Database field)
  - `descriptionProduct` (Sequelize attribute) -> `description_product` (Database field)
  - `image` (Sequelize attribute) -> `image` (Database field)
  - `idCategory` (Sequelize attribute) -> `id_category` (Database field)
  - `idFranchise` (Sequelize attribute) -> `id_franchise` (Database field)
- **Legacy Compatibility (Getters)**: The Sequelize `Product` model MUST define legacy PascalCase getter methods returning the values of the camelCase properties:
  - `IDProduct` -> returns `idProduct`
  - `NameProduct` -> returns `nameProduct`
  - `Price` -> returns `price`
  - `DescriptionProduct` -> returns `descriptionProduct`
  - `Image` -> returns `image`
  - `IDCategory` -> returns `idCategory`
  - `IDFranchise` -> returns `idFranchise`
- **Domain Entity (`src/domain/entities/Product.ts`)**: Properties in the constructor MUST be camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`). The domain entity MUST expose legacy getter methods matching the PascalCase properties for backward compatibility. It MUST validate that the `price` is strictly greater than `0.00`. Instantiation with a price less than or equal to `0.00` is invalid and MUST throw an error.
- **Repository Interface (`src/domain/ports/IProductRepository.ts`)** and **Repository Implementation (`src/infrastructure/repositories/SequelizeProductRepository.ts`)**: MUST use the camelCase properties for queries and mutations.

## 3. API & Frontend Integration Rules
- **API Payload DTO Key camelCase Transition**: The `ProductDTO` interface and API response payload from `/api/products` (and specific `/api/product/:id`) MUST use camelCase naming conventions, making a clean break by updating the category name field key from `Category` to `category` (lowercase).
- **Astro Frontend Image Fallback Handling**: The frontend Astro templates (`index.astro`, `products.astro`) MUST correctly display product category illustrations based on the camelCase `category` property and implement visual fallbacks when a product's image or category data is missing or invalid (rendering `/images/illustrations/Otras.png` as fallback).

## 4. BDD Scenarios

### Scenario 1: Domain Layer Isolation
Given a developer writing code within `src/domain`
When importing other modules
Then the import path MUST NOT reference `src/application` or `src/infrastructure`
And the file MUST NOT import Sequelize or any ORM library

### Scenario 2: Use Case Return Contract
Given an application Use Case in `src/application/use-cases`
When the Use Case finishes executing
Then it MUST return a plain JavaScript/TypeScript object representing a DTO
And it MUST NOT return a Sequelize Model instance or any direct database reference

### Scenario 3: Database Port Implementation (Repository Adapter)
Given a Repository Adapter in `src/infrastructure/repositories`
When it implements a Repository Port interface from `src/domain`
Then it MUST use Sequelize models to access database state
And it MUST map the database objects into pure Domain Entities before returning them

### Scenario 4: Request validation and Controller Execution
Given an Express Controller handling a Product request
When a request is received
Then the controller MUST validate request parameters syntactically
And it MUST delegate business execution by calling a Use Case with plain parameters
And the controller MUST capture any business/validation errors to return proper HTTP responses or render EJS templates

### Scenario 5: Model Attribute and DB Column Mapping
Given the `Product` model in `src/database/models/Product.js`
When querying the database for a product
Then the model attributes MUST be camelCase (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`)
And the SQL query generated by Sequelize MUST reference the snake_case database columns (`id_product`, `name_product`, `price`, `description_product`, `image`, `id_category`, `id_franchise`)

### Scenario 6: Legacy Getter Compatibility
Given an instance of the `Product` model or domain entity
When accessing legacy PascalCase properties (e.g. `IDProduct`, `NameProduct`, `Price`, `DescriptionProduct`, `Image`)
Then they MUST return the value of their corresponding camelCase properties (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`)

### Scenario 7: Domain Entity Constructor and Properties
Given a product entity instantiated in the domain layer
When checking its properties
Then they MUST expose camelCase properties (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`)
And they MUST also support legacy PascalCase getters for backward compatibility

### Scenario 8: Database schema mapping check
Given a database query is executed against the `Product` table via the `SequelizeProductRepository`
When generating database operations or seeding
Then the SQL query generated by Sequelize MUST reference column names in snake_case (`id_product`, `name_product`, `price`, `description_product`, `image`, `id_category`, `id_franchise`)
And Sequelize model properties MUST map these columns to camelCase attributes (`idProduct`, `nameProduct`, `price`, `descriptionProduct`, `image`, `idCategory`, `idFranchise`)

### Scenario 9: Retrieving product lists through the REST API
Given a client requests the list of products from `/api/products`
When the request succeeds
Then the JSON API payload response MUST return products as an array of `ProductDTO` objects
And each object in the array MUST contain a `category` property in camelCase representing the category name string
And the payload MUST NOT contain a capitalized `Category` property

### Scenario 10: Retrieving a single product detail through the REST API
Given a client requests a specific product from `/api/product/:id`
When the request succeeds
Then the JSON API payload response MUST return a single `ProductDTO` object
And the object MUST contain the `category` property in camelCase representing the category name string
And the payload MUST NOT contain the capitalized `Category` property

### Scenario 11: Instantiating a product with a valid positive price
Given the `Product` domain entity class
When a new instance is created with a `price` of `29.99`
Then the instantiation MUST succeed
And the property `price` MUST be initialized to `29.99`

### Scenario 12: Instantiating a product with a zero price
Given the `Product` domain entity class
When a new instance is created with a `price` of `0.00`
Then the constructor MUST throw an error
And the instantiation MUST fail

### Scenario 13: Instantiating a product with a negative price
Given the `Product` domain entity class
When a new instance is created with a `price` of `-5.00`
Then the constructor MUST throw an error
And the instantiation MUST fail

### Scenario 14: Rendering catalog on index page with category visual fallbacks
Given the Astro index page `frontend/src/pages/index.astro` is rendered
When product information is fetched from `/api/products` and a product has a missing or null `category`
Then the template SHALL render a fallback illustration of `'Outras'` using the path `/images/illustrations/Outras.png`
And if a product has a custom illustration that fails to load, the image element `onerror` handler MUST set the source to `/images/illustrations/Outras.png`

### Scenario 15: Rendering catalog on products page with category visual fallbacks
Given the Astro products catalog page `frontend/src/pages/products.astro` is rendered
When product information is fetched from `/api/products` and a product has a missing or null `category`
Then the template SHALL resolve the category illustration using a local lookup map (defaulting to `'Outras'`)
And render the image using `/images/illustrations/Outras.png`

---

## 5. 3D Printing Properties and Specifications

### Requirement: Product 3D printing properties in Domain Entity

The `Product` domain entity constructor (`backend/src/domain/entities/Product.ts`) MUST support optional properties:
- `material` (string | null)
- `height` (number | null)
- `width` (number | null)
- `depth` (number | null)
- `finish` (string | null)
- `productionTime` (number | null)

These properties MUST have matching PascalCase getters (`Material`, `Height`, `Width`, `Depth`, `Finish`, `ProductionTime`) returning their values (or `null` if undefined/null).

The domain entity constructor MUST enforce the following constraints:
- `height`, `width`, and `depth` MUST be greater than or equal to `0` if defined.
- `productionTime` MUST be a positive integer and MUST NOT be greater than `30` (maximum 30 days) if defined.
- `material` MUST be either `'PLA'`, `'Resina'`, `'PETG'`, `'Flex'`, or a string starting with the prefix `'Otros: '` if defined.

#### Scenario: Product domain entity with valid 3D properties
- GIVEN the `Product` domain entity constructor
- WHEN a new instance is created with:
  - `material`: "Otros: Madera"
  - `height`: 10
  - `width`: 15
  - `depth`: 5
  - `finish`: "Pintado a mano"
  - `productionTime`: 20
- THEN the domain entity MUST be created successfully

#### Scenario: Product domain entity throws on invalid material
- GIVEN the `Product` domain entity constructor
- WHEN a new instance is created with `material` value of "Madera" (not in allowed list, lacking prefix)
- THEN the constructor MUST throw an error

#### Scenario: Product domain entity throws on production time exceeding 30 days
- GIVEN the `Product` domain entity constructor
- WHEN a new instance is created with `productionTime` of `31`
- THEN the constructor MUST throw an error

#### Scenario: Product domain entity throws on negative dimensions
- GIVEN the `Product` domain entity constructor
- WHEN a new instance is created with `height` of `-1`
- THEN the constructor MUST throw an error

---

### Requirement: Database Attribute and Schema Mapping

The Sequelize `Product` model (`backend/src/database/models/Product.js`) and database columns MUST map the new 3D attributes from camelCase to snake_case as follows:
- `material` -> `material`
- `height` -> `height`
- `width` -> `width`
- `depth` -> `depth`
- `finish` -> `finish`
- `productionTime` -> `production_time`

Sequelize model getters in PascalCase (`Material`, `Height`, `Width`, `Depth`, `Finish`, `ProductionTime`) MUST be supported.

---

### Requirement: Frontend Adapter Dimensions Formatting and Fallbacks

The frontend adapter function `adaptAPIProduct` (`frontend/src/domains/products/adapters/product.adapter.ts`) MUST map API response fields to display strings:
- `material`: defaults to `"A consultar"` if null/undefined.
- `finish`: defaults to `"A consultar"` if null/undefined.
- `productionTime`: if defined, formats as `"${productionTime} días"`, else defaults to `"A consultar"`.
- `height`, `width`, `depth`:
  - If at least one of these is defined (not null, not undefined, and not 0):
    - Any defined dimension MUST format as `"${val} cm"`.
    - Any missing (null/undefined/0) dimension MUST format as `"no definida"`.
  - If all of these are undefined or null or 0:
    - All three MUST fallback to `"A consultar"`.

#### Scenario: Frontend adapter handles partially defined dimensions
- GIVEN a product DTO returned by the API with `height` of `12`, `width` of `null`, and `depth` of `null`
- WHEN `adaptAPIProduct` is called on the DTO
- THEN the adapted product `height` MUST be `"12 cm"`
- AND the adapted product `width` MUST be `"no definida"`
- AND the adapted product `depth` MUST be `"no definida"`

#### Scenario: Frontend adapter handles fully undefined dimensions
- GIVEN a product DTO returned by the API with all dimensions set to `null`
- WHEN `adaptAPIProduct` is called on the DTO
- THEN the adapted product `height`, `width`, and `depth` MUST all be `"A consultar"`

#### Scenario: Frontend adapter displays custom material
- GIVEN a product DTO with `material` set to `"Otros: ABS"`
- WHEN `adaptAPIProduct` is called on the DTO
- THEN the adapted product `material` MUST be `"Otros: ABS"`
