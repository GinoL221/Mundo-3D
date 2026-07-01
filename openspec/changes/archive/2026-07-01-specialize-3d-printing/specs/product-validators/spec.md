# Product Validators Specification

## Purpose

Defines express-validator chains for product forms, extracted from route files into dedicated validator modules.

## Requirements

### Requirement: Product Form Validators Module

`src/middlewares/validators/productValidators.js` MUST export `validationsForm` — the complete express-validator chain currently defined inline in `productsRoutes.js` (productName, price, description, category, franchise, image validation).

#### Scenario: validationsForm preserves identical validation logic

- GIVEN the existing `validationsForm` array from `productsRoutes.js`
- WHEN the validator chain is moved to `productValidators.js`
- THEN each field rule (notEmpty, isString, isLength, custom image check) SHALL produce the same validation errors
- AND the exported array SHALL be directly usable as route middleware

#### Scenario: productsRoutes imports validators

- GIVEN `productsRoutes.js` after refactoring
- THEN it SHALL import `validationsForm` from `../middlewares/validators/productValidators`
- AND it MUST NOT define `body()` chains inline

### Requirement: Image Validation Uniqueness

`postNewProduct.js` MUST NOT manually check `req.file` — the express-validator `image` custom validator already covers missing files.

#### Scenario: Duplicate image check removed

- GIVEN `postNewProduct.js` currently has `if (!req.file) { throw new Error('...') }`
- WHEN the duplicate check is removed
- THEN express-validator's `validationsForm` SHALL be the sole source of image validation
- AND `postNewProduct.js` MUST NOT contain a manual `req.file` check

---

## 5. 3D Printing Attributes Validation

### Requirement: Validation of 3D Printing Attributes in validationsForm

The express-validator middleware `validationsForm` (`backend/src/infrastructure/middlewares/validators/productValidators.ts`) MUST validate the new 3D printing properties:
- `material`: Optional, but if provided and not empty, it MUST be either `'PLA'`, `'Resina'`, `'PETG'`, `'Flex'`, or a string starting with the prefix `'Otros: '`.
- `height`: Optional, but if provided, it MUST be a non-negative float/number.
- `width`: Optional, but if provided, it MUST be a non-negative float/number.
- `depth`: Optional, but if provided, it MUST be a non-negative float/number.
- `finish`: Optional.
- `productionTime`: Optional, but if provided, it MUST be an integer between `1` and `30` (maximum 30 days).

#### Scenario: Validate product form with valid material
- GIVEN a request to validate product inputs
- WHEN the request body contains a `material` value of `'PLA'`
- THEN the express-validator MUST accept the `material` field

#### Scenario: Validate product form with valid custom material
- GIVEN a request to validate product inputs
- WHEN the request body contains a `material` value of `'Otros: Madera'`
- THEN the express-validator MUST accept the `material` field

#### Scenario: Validate product form with invalid material format
- GIVEN a request to validate product inputs
- WHEN the request body contains a `material` value of `'Madera'` (which is not in the allowed list and lacks the prefix)
- THEN the express-validator MUST reject the `material` field with an error message

#### Scenario: Validate product form with valid productionTime
- GIVEN a request to validate product inputs
- WHEN the request body contains a `productionTime` value of `15`
- THEN the express-validator MUST accept the `productionTime` field

#### Scenario: Validate product form with invalid productionTime greater than 30
- GIVEN a request to validate product inputs
- WHEN the request body contains a `productionTime` value of `31`
- THEN the express-validator MUST reject the `productionTime` field with an error message

#### Scenario: Validate product form with negative dimension
- GIVEN a request to validate product inputs
- WHEN the request body contains a `height` value of `-5`
- THEN the express-validator MUST reject the `height` field with an error message
