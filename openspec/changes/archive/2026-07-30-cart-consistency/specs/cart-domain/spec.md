# Delta for Cart Domain

## MODIFIED Requirements

### Requirement: Stock Limits Validation

The cart item `quantity` MUST be an integer greater than 0, and it MUST NOT exceed the maximum stock boundary limit of 99.
(Previously: ceiling was 10 — arbitrary, corrected to match the validator's intended 1–99 range.)

#### Scenario: Valid quantity at ceiling boundary

- GIVEN a quantity of 99
- WHEN instantiating the domain entity
- THEN the entity SHALL be successfully created

#### Scenario: Exceeding quantity limit

- GIVEN a quantity of 100
- WHEN instantiating the domain entity
- THEN the entity validation SHALL throw a validation error
