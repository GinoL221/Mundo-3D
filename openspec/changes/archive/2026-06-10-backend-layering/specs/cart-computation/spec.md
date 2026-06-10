# Cart Computation Specification

## Purpose

Defines the cart total calculation capability owned by `CartService`, ensuring no controller contains domain math.

## Requirements

### Requirement: Compute Cart Total

`CartService` MUST expose `computeTotal(cartItems)` returning a number. Given an array of cart items where each has `product.Price` and `Quantity`, the method SHALL return the sum of `product.Price * Quantity` for all items.

#### Scenario: Multiple items compute correct total

- GIVEN cart items `[{product: {Price: 10}, Quantity: 2}, {product: {Price: 5}, Quantity: 3}]`
- WHEN `CartService.computeTotal(items)` is called
- THEN the result SHALL be `35`

#### Scenario: Empty cart returns zero

- GIVEN an empty array of cart items
- WHEN `CartService.computeTotal([])` is called
- THEN the result SHALL be `0`

### Requirement: No Inline Total Calculation in Controllers

The `calcularTotal` function MUST be removed from `viewShoppingCart.js`. The controller SHALL call `CartService.computeTotal` instead.

#### Scenario: viewShoppingCart uses CartService

- GIVEN `viewShoppingCart.js` needs to display cart total
- WHEN rendering the cart view
- THEN it SHALL pass `CartService.computeTotal(userShoppingCart)` as the `calcularTotal` function
- AND `calcularTotal` MUST NOT be defined in the controller file

### Requirement: Render Without path.join

`viewShoppingCart.js` MUST use `res.render('products/productCart')` instead of `res.render(path.join(__dirname, '../../views/products/productCart.ejs'))`.

#### Scenario: Cart view rendered with view name

- GIVEN `viewShoppingCart` renders the cart page
- THEN it SHALL call `res.render('products/productCart', { userShoppingCart, calcularTotal })`
- AND it MUST NOT use `path.join` for the view path
