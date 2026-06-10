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
