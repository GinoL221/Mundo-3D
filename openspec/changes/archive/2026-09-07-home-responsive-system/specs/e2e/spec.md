# Delta for E2E Testing

## ADDED Requirements

### Requirement: Home Responsive Regression Matrix

The E2E suite MUST validate Home at `320`, `360`, `375`, `639`, `640`, `768x1024`, `820`, `960`, `1023`, `1024x768`, `1279`, `1280`, and `1440` CSS-pixel viewports. Each fixture MUST assert its expected grid and navigation mode, frame fit, readable typography, uncropped identity assets, 44px product targets, and absence of horizontal overflow.

#### Scenario: Every confirmed viewport is covered

- GIVEN the Home responsive E2E suite is executed
- WHEN its viewport cases are enumerated
- THEN every confirmed width and dimension pair MUST run as an explicit case
- AND every case MUST assert root content width does not exceed viewport width

#### Scenario: Boundary pairs behave as specified

- GIVEN the `639/640`, `1023/1024`, and `1279/1280` pairs
- WHEN each pair is compared
- THEN 639px MUST use one column and 640px MUST use two columns
- AND 1023px MUST use compact navigation while 1024px MUST expose horizontal navigation and use three columns when viable
- AND 1279px and 1280px MUST retain the centered 1104px maximum frame without an unconfirmed structural change

### Requirement: Deterministic Behavioral and Visual Evidence

Home responsive verification MUST combine behavioral assertions with screenshot baselines captured in one fixed local Chromium environment. Screenshot runs MUST use deterministic product fixtures and fixed theme, motion, font, and rendering state. Live API integration MUST be tested separately and MUST NOT supply screenshot data.

#### Scenario: Compact disclosure behavior is verified

- GIVEN a compact Home viewport
- WHEN the control is operated with Enter or Space and then Escape
- THEN tests MUST verify visibility, stable `aria-controls`, synchronized `aria-expanded`, and focus restoration
- AND tests MUST verify ordinary navigation has no ARIA menu roles or modal behavior

#### Scenario: Screenshot state is deterministic

- GIVEN a screenshot baseline or comparison is captured
- WHEN Home reaches its settled fixture state
- THEN Chromium, products, theme, motion, fonts, and rendering settings MUST match the baseline environment
- AND the expected screenshot MUST match within the approved project threshold

#### Scenario: API integration remains separate

- GIVEN the live products API success, empty, and error paths require verification
- WHEN integration tests execute
- THEN they MUST validate the existing Home loading outcomes independently of screenshot fixtures
