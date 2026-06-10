# Asset Paths Specification

## Purpose

Ensures product images in the cart view use the correct path including the `products/` subdirectory, and that the codebase contains no dead views, unused imports, or debug statements.

## Requirements

### Requirement: Cart Image Path Correction

The product cart view (`src/views/products/productCart.ejs`) MUST reference product images using the `/img/products/` path prefix, not `/img/`.

#### Scenario: Cart product images load correctly

- GIVEN a product has an image file stored at `public/img/products/example.webp`
- WHEN the cart view renders the product's `<img>` element
- THEN the `src` attribute MUST contain `/img/products/` as the path prefix
- AND the image SHALL load without a 404 error

#### Scenario: Non-product images unaffected

- GIVEN other views reference images at `/img/` that are not product images
- WHEN the path correction is applied to `productCart.ejs`
- THEN those other views MUST NOT be modified

### Requirement: Dead View Removal

The following EJS views MUST NOT exist in the codebase, as they are unreachable and contain obsolete references:

- `src/views/products/product.ejs` — references MongoDB `_id`, a pre-Sequelize remnant
- `src/views/products/productMenu.ejs` — hardcoded static content, no route renders it
- `src/views/users/newUser.ejs` — duplicates `register.ejs`, no route renders it

#### Scenario: Dead product view is deleted

- GIVEN `src/views/products/product.ejs` contains MongoDB `_id` references
- WHEN the file is deleted
- THEN no route or controller SHALL reference it
- AND `grep -r "product.ejs" src/` MUST return no matches

#### Scenario: Dead productMenu view is deleted

- GIVEN `src/views/products/productMenu.ejs` contains only hardcoded HTML
- WHEN the file is deleted
- THEN no route or controller SHALL reference it

#### Scenario: Dead newUser view is deleted

- GIVEN `src/views/users/newUser.ejs` duplicates `register.ejs`
- WHEN the file is deleted
- THEN no route or controller SHALL reference it

### Requirement: No Debug Statements in Production Code

No `console.log` debug statements SHALL remain in production controller files.

#### Scenario: Debug console.log removed from viewShoppingCart

- GIVEN `src/controllers/users/viewShoppingCart.js` contains a `console.log` at line 18
- WHEN the debug statement is removed
- THEN `grep -n "console.log" src/controllers/users/viewShoppingCart.js` MUST return no matches