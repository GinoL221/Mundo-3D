# Validation Dedup Specification

## Purpose

Eliminates duplicate image validation where express-validator and manual controller checks both verify `req.file`.

## Requirements

### Requirement: No Duplicate File Validation in postNewProduct

`postNewProduct.js` MUST NOT contain a manual `if (!req.file)` check. The `validationsForm` express-validator chain already validates the image field, making the manual check redundant.

#### Scenario: Manual file check removed

- GIVEN `postNewProduct.js` currently contains `if (!req.file) { throw new Error('...') }`
- WHEN the duplicate is removed
- THEN the express-validator `image` custom validator SHALL be the sole source of image-missing errors
- AND `postNewProduct.js` MUST NOT reference `req.file` for validation purposes

#### Scenario: Missing image still produces validation error

- GIVEN a product creation request without an attached file
- WHEN `validationsForm` processes the request
- THEN express-validator SHALL produce the image-required error
- AND `postNewProduct.js` SHALL render the form with the validation error (no manual throw)
