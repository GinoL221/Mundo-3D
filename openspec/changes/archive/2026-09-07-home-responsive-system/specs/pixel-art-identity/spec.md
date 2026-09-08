# Delta for Pixel Art Identity

## ADDED Requirements

### Requirement: Responsive Home Identity and Product Targets

Responsive Home states MUST preserve the current pixel-art palette, typography, square geometry, wordmark safeguards, and SVG control identity. Interactive product controls MUST provide a local target area of at least 44 by 44 CSS pixels. This 44px product policy MUST be documented as stricter than, and distinct from, the WCAG 2.2 Level AA 24px minimum.

#### Scenario: Identity persists across layout modes

- GIVEN Home renders in compact and exposed navigation modes
- WHEN visual properties are inspected
- THEN the established pixel-art palette, fonts, square geometry, wordmark behavior, and SVG controls MUST remain recognizable and uncropped

#### Scenario: Product controls meet local target policy

- GIVEN an interactive product control is rendered on Home
- WHEN its actionable area is measured at any supported viewport
- THEN its width and height MUST each be at least 44 CSS pixels

#### Scenario: Conformance claims remain accurate

- GIVEN documentation or test evidence describes target sizing
- WHEN it references the 44px Home policy
- THEN it MUST identify 44px as a local product requirement
- AND MUST NOT describe 44px as the WCAG AA minimum
