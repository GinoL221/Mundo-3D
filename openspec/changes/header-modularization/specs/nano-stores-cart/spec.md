# Delta for nano-stores-cart

## ADDED Requirements

### Requirement: Reactive Header Cart Badge

The Header badge MUST react to Nano Store state, show distinct products rather than summed quantities, and hide at zero.

#### Scenario: Badge shows distinct products

- GIVEN the cart contains products with any quantities
- WHEN Header loads or cart changes
- THEN the badge MUST immediately show the distinct-product count

#### Scenario: Badge hides for an empty cart

- GIVEN the cart contains no products
- WHEN Header loads or becomes empty
- THEN the badge MUST be hidden, not display zero
