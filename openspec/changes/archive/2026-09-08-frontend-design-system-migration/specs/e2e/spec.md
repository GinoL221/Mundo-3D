# Delta for E2E Testing

## ADDED Requirements

### Requirement: Wave 0 Home Regression Evidence

Wave 0 verification MUST reuse the established Home functional and deterministic visual evidence to demonstrate unchanged behavior and presentation. Evidence MUST cover supported light and dark themes where applicable and MUST preserve fixed viewport, product fixture, motion, font, locale, timezone, device-pixel-ratio, image readiness, and rendering conditions used by the approved baseline.

#### Scenario: Home evidence detects extraction regressions

- GIVEN approved Home evidence exists before Wave 0
- WHEN verification runs after shared-system extraction
- THEN existing functional assertions MUST pass
- AND deterministic visual comparison MUST report no unapproved change across the established Home viewport matrix

#### Scenario: Both supported themes are checked

- GIVEN a Home surface affected by a shared foundation supports light and dark themes
- WHEN Wave 0 verification evaluates that surface
- THEN behavior, focus, contrast, imagery, and state meaning MUST be checked in each theme

### Requirement: Wave 0 Accessibility Evidence

Wave 0 verification MUST test the applicable WCAG 2.2 Level AA obligations of shared foundations and MUST separately test the local 44 by 44 CSS-pixel interactive-target policy. Evidence MUST include keyboard operation, visible focus, applicable contrast, semantic roles and states, and loading, empty, error, disabled, and status behavior.

#### Scenario: Accessibility evidence is complete and separated

- GIVEN a shared interaction or state contract is subject to verification
- WHEN its accessibility results are recorded
- THEN keyboard, focus, applicable contrast, semantics, and state behavior MUST have testable evidence
- AND WCAG 2.2 AA results MUST be reported separately from 44 by 44 CSS-pixel target measurements

### Requirement: Wave 1 Verification Matrix Preparation Only

Wave 0 MUST prepare, but MUST NOT execute as migrated-page evidence, an acceptance matrix for `/products`, `/product`, and `/cart` covering every required state in phone, tablet, and desktop viewports and both supported themes. The matrix MUST distinguish functional truth, future deterministic visual evidence, and future accessibility evidence.

#### Scenario: Required route states are enumerated

- GIVEN the Wave 1 acceptance matrix is reviewed
- WHEN route and state entries are enumerated
- THEN `/products` MUST include populated, loading, no catalogue, no filter results, and API error
- AND `/product` MUST include loading, populated, missing product, API error, and add-to-cart success and disabled feedback
- AND `/cart` MUST include loading, empty, populated, price drift, checkout pending and error, and the guest redirect boundary

#### Scenario: Matrix dimensions are complete

- GIVEN any required Wave 1 route state
- WHEN its planned evidence entries are inspected
- THEN phone, tablet, and desktop viewport preparations MUST exist
- AND light and dark theme preparations MUST exist
- AND planned functional, visual, and accessibility evidence MUST be identifiable

#### Scenario: Preparation is not represented as implementation evidence

- GIVEN Wave 0 is being accepted
- WHEN Wave 1 matrix entries are reviewed
- THEN they MUST be identified as preparation for a later wave
- AND they MUST NOT be reported as proof that a Wave 1 page has been migrated
