# Cart Computation Specification

## Purpose

Defines the cart total calculation capability, ensuring no controller contains domain math.

## Requirements

### Requirement: Compute Cart Total

The system MUST calculate the cart total in the use case or controller layer by summing the product of quantity and unit price for all active items in the cart.
(Previously: CartService MUST expose computeTotal(cartItems) returning the sum of product.Price * Quantity.)

#### Scenario: Multiple items compute correct total

- GIVEN cart items `[{UnitPrice: 10, Quantity: 2}, {UnitPrice: 5, Quantity: 3}]`
- WHEN the cart total is calculated
- THEN the result SHALL be `35`

#### Scenario: Empty cart returns zero

- GIVEN an empty array of cart items
- WHEN the cart total is calculated
- THEN the result SHALL be `0`

### Requirement: No Inline Total Calculation in Controllers

The `CartController` MUST NOT perform inline math calculations to get the cart total. It SHALL delegate total calculation to the use case layer or a mapper.
(Previously: The calcularTotal function must be removed from viewShoppingCart.js, calling CartService.computeTotal instead.)

#### Scenario: CartController uses precalculated total

- GIVEN `CartController` needs to display the cart total
- WHEN rendering the cart view
- THEN it SHALL pass the total calculated by the use case to the EJS template
- AND the controller file MUST NOT perform raw total sum logic

### Requirement: Render Without path.join

The `CartController` MUST render `'products/productCart'` using standard relative paths instead of using `path.join`.
(Previously: viewShoppingCart.js MUST use res.render('products/productCart') instead of using path.join for absolute paths.)

#### Scenario: Cart view rendered with view name

- GIVEN `CartController` renders the cart page
- THEN it SHALL call `res.render('products/productCart', { userShoppingCart, calcularTotal })`
- AND it MUST NOT use `path.join` for the view path
