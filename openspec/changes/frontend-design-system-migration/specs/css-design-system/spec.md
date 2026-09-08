# Delta for CSS Design System

## ADDED Requirements

### Requirement: Wave 0 Semantic Foundations and Ownership Classification

The Wave 0 shared contract MUST define semantic roles for page frame and container, section rhythm, typography including a display role, primary and secondary or text actions, focus, disabled treatment, surfaces, and borders. Every candidate value derived from Home MUST be classified as either a shared foundation or Home-specific before adoption; current evidence such as the 1104px frame, 280px card minimum, 16px body minimum, approximately 75ch prose measure, and content-driven breakpoints MUST NOT become shared authority solely because Home uses it. The contract MUST preserve the approved font family and MUST NOT establish gradients, shadows, glow, or a new radius doctrine as shared foundations.

#### Scenario: Home-derived value is classified

- GIVEN a Home token, dimension, selector, or visual rule is proposed for Wave 0
- WHEN the shared contract is reviewed
- THEN it MUST identify the rule as shared or Home-specific
- AND an unclassified rule MUST NOT be admitted to the shared layer

#### Scenario: Shared semantic roles are complete

- GIVEN the Wave 0 shared contract is reviewed
- WHEN its semantic foundations are enumerated
- THEN it MUST include the defined layout, rhythm, typography, action, focus, disabled, surface, and border roles
- AND it MUST NOT promote prohibited legacy visual treatments into shared authority

### Requirement: Home Stability During Extraction

Wave 0 MUST preserve Home's existing semantics, content, behavior, responsive modes, light and dark presentation, and approved deterministic visual evidence. Shared extraction MUST NOT transfer ownership of Home-specific selectors or constants, and MUST NOT alter Home merely to demonstrate reuse.

#### Scenario: Home remains stable

- GIVEN the approved Home evidence before Wave 0
- WHEN the Wave 0 shared layer and compatibility mapping are applied
- THEN Home behavior and responsive outcomes MUST remain unchanged
- AND deterministic comparisons MUST show no unapproved visual change in either supported theme

### Requirement: Accessible Shared Interaction Contract

Shared foundations introduced by Wave 0 MUST support WCAG 2.2 Level AA for applicable migrated content and interactions. Independently, every interactive target governed by the shared contract MUST provide a minimum actionable area of 44 by 44 CSS pixels under the local product policy; documentation and evidence MUST NOT describe 44 by 44 CSS pixels as the WCAG 2.2 AA minimum.

#### Scenario: WCAG conformance is evaluated separately

- GIVEN a shared surface is evaluated for accessibility
- WHEN its conformance evidence is recorded
- THEN applicable WCAG 2.2 Level AA criteria MUST be evaluated against authoritative WCAG documentation
- AND the result MUST be recorded separately from the local target-size result

#### Scenario: Local target policy is measured

- GIVEN an interactive target governed by the shared contract
- WHEN its actionable area is measured at a supported viewport
- THEN its width and height MUST each be at least 44 CSS pixels
- AND any exception permitted by WCAG target-size criteria MUST NOT waive this local policy

### Requirement: Focus, Keyboard, Contrast, and State Semantics

Shared interactive contracts MUST preserve native semantics or expose equivalent accessible semantics, MUST be operable by keyboard, MUST provide a visible focus indicator, and MUST communicate disabled and status conditions without relying on color alone. Text, controls, focus indicators, and meaningful graphical objects MUST meet their applicable WCAG 2.2 Level AA contrast requirements in each supported theme.

#### Scenario: Keyboard and focus behavior remains perceivable

- GIVEN a user navigates a shared interactive control using only a keyboard
- WHEN focus reaches and activates the control
- THEN focus MUST remain visibly identifiable
- AND activation and resulting state MUST be available through appropriate semantics

#### Scenario: State meaning survives without color

- GIVEN a loading, disabled, error, or status presentation is shown
- WHEN color cues are unavailable
- THEN its meaning MUST remain perceivable through text, structure, or accessible state
- AND applicable contrast MUST pass in light and dark themes

### Requirement: Incremental Light and Dark Theme Preservation

Every shared foundation touched in Wave 0 MUST remain functional in both existing light and dark themes. Dark-theme tokens MUST remain implementation support and MUST NOT be represented as an approved replacement brand identity; Wave 0 MUST NOT invent a new dark palette or alter approved brand assets for theme accommodation.

#### Scenario: Shared role resolves in both themes

- GIVEN a shared semantic role is rendered in light and dark themes
- WHEN its presentation and interaction states are evaluated
- THEN content, boundaries, focus, and status meaning MUST remain perceivable in both themes
- AND neither rendering MUST require a replacement brand identity

### Requirement: Shared State Presentation Contracts

Wave 0 MUST define reusable presentation contracts for loading, empty, error, disabled, and status states while preserving each route's production semantics, behavior, data truth, and current outcomes. These contracts MUST provide an identifiable state, truthful user-facing meaning, and an accessible announcement or semantic relationship when the state change requires one. They MUST NOT invent payment, shipping price, delivery, stock, customer-proof, or commission claims.

#### Scenario: Loading and status transitions remain truthful

- GIVEN production behavior enters loading, pending, disabled, success, or other status conditions
- WHEN a shared presentation contract represents the condition
- THEN the represented state MUST match production truth
- AND the contract MUST NOT change the underlying action or outcome

#### Scenario: Empty and error states remain distinguishable

- GIVEN a route has either no valid content or a failed request
- WHEN the corresponding shared state is rendered
- THEN empty and error outcomes MUST be semantically distinguishable
- AND each MUST communicate truthful next-step information without unsupported claims

### Requirement: Legacy Compatibility Mapping

Wave 0 MUST provide a compatibility mapping for legacy `--pico-*` tokens, PICO-8, CRT/JRPG, default-shell, and related selectors or rules. Each mapping MUST identify known consumers, its semantic replacement or an explicit no-equivalent status, and migration-debt ownership. Wave 0 MUST NOT delete a legacy token, selector, rule, import, or default Header/Footer consumer.

#### Scenario: Legacy consumer is mapped without deletion

- GIVEN a legacy token, selector, or rule remains in use
- WHEN Wave 0 compatibility is reviewed
- THEN its known consumers and migration status MUST be recorded
- AND the legacy behavior MUST remain available to those consumers

#### Scenario: Legacy style lacks shared authority

- GIVEN a globally imported legacy rule has no Home-proven semantic equivalent
- WHEN it is classified
- THEN it MUST be marked as compatibility debt or no-equivalent
- AND it MUST NOT become canonical merely because it is globally loaded

### Requirement: Open Design System Contract Deliverable

Wave 0 MUST produce a reviewable Open Design system-contract deliverable for project `46d18005-747c-4a86-8bfb-fc2cd9fab6c0` that records semantic roles, tokens, component and state contracts, accessibility policies, compatibility boundaries, authority ownership, and migration-wave decisions. The deliverable MUST derive only from the confirmed repository authorities unless a later artifact is explicitly adopted; it MUST NOT infer unavailable Open Design or OpenPencil content.

#### Scenario: Contract records authority boundaries

- GIVEN the Open Design system contract is reviewed
- WHEN ownership is inspected
- THEN Open Design MUST own the shared visual and system contract
- AND OpenPencil, Astro production code, Impeccable, and verification MUST retain the distinct responsibilities stated in the approved proposal

#### Scenario: Missing external artifact is not invented

- GIVEN the Open Design project has no confirmed design-system binding or canonical artifact
- WHEN the Wave 0 contract is prepared
- THEN repository authorities MUST seed the contract
- AND any later external artifact MUST require an explicit adoption decision before becoming authoritative
