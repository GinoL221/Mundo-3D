# Frontend Migration Waves Specification

## Purpose

Define ownership, preparation, and exclusion boundaries that keep Wave 0 limited to shared-system extraction and reserve route composition and implementation for later bounded waves.

## Requirements

### Requirement: Wave 0 Tool Ownership Boundaries

Wave 0 MUST follow the authority order approved by the proposal: Open Design owns the shared visual and system contract; OpenPencil owns future concrete route, state, responsive, theme, and viewport compositions; Astro production code remains final truth for semantics, content, behavior, data, routing, and responsive implementation; Impeccable performs post-implementation refinement and audit without replacing approved authority; and verification owns functional, deterministic visual, and accessibility evidence.

#### Scenario: Conflicting artifact defers to production truth

- GIVEN a prepared composition conflicts with current production semantics, content, data, behavior, or routing
- WHEN the conflict is reviewed
- THEN Astro production behavior MUST remain authoritative
- AND the prepared composition MUST NOT silently redefine product truth

### Requirement: OpenPencil Wave 1 Preparation

After approval of the Open Design shared contract, Wave 0 MUST prepare OpenPencil compositions or an explicit preparation package for `/products`, `/product`, and `/cart`. Each preparation entry MUST identify route, required state, light or dark theme, and phone, tablet, or desktop viewport. If OpenPencil content is unavailable, Wave 0 MUST record the gap and MUST NOT claim that frames exist or infer their contents.

#### Scenario: Products preparation is complete

- GIVEN Wave 1 preparation is reviewed for `/products`
- WHEN its entries are enumerated
- THEN populated, loading, no catalogue, no filter results, and API error MUST each be represented for phone, tablet, and desktop
- AND each entry MUST identify light and dark theme preparation

#### Scenario: Product-detail preparation is complete

- GIVEN Wave 1 preparation is reviewed for `/product`
- WHEN its entries are enumerated
- THEN loading, populated, missing product, API error, add-to-cart success, and disabled feedback MUST each be represented for phone, tablet, and desktop
- AND each entry MUST identify light and dark theme preparation

#### Scenario: Cart preparation is complete

- GIVEN Wave 1 preparation is reviewed for `/cart`
- WHEN its entries are enumerated
- THEN loading, empty, populated, price drift, checkout pending, checkout error, and guest redirect boundary MUST each be represented for phone, tablet, and desktop
- AND each entry MUST identify light and dark theme preparation

#### Scenario: Unavailable OpenPencil evidence is disclosed

- GIVEN OpenPencil cannot be accessed during Wave 0
- WHEN preparation status is reported
- THEN the unavailable integration and outstanding entries MUST be recorded
- AND no composition or screen content MUST be represented as retrieved or approved

### Requirement: Strict Wave 0 Implementation Exclusion

Wave 0 MUST NOT implement, migrate, or restyle the `/products`, `/product`, or `/cart` pages and MUST NOT implement or migrate the default Header or Footer shell. It MUST NOT change APIs, domain services, cart authority, checkout behavior, routing, data models, route content, or current route state behavior. Prepared matrices, compatibility mappings, and contracts MUST NOT be treated as authorization for those changes.

#### Scenario: Wave 1 page change is rejected from Wave 0

- GIVEN a proposed Wave 0 change alters markup, behavior, or route-owned presentation for `/products`, `/product`, or `/cart`
- WHEN scope compliance is evaluated
- THEN the change MUST be excluded from Wave 0
- AND it MUST require a separately approved bounded route wave

#### Scenario: Default shell change is rejected from Wave 0

- GIVEN a proposed Wave 0 change migrates or replaces the default Header or Footer
- WHEN scope compliance is evaluated
- THEN the change MUST be excluded from Wave 0
- AND default-shell convergence MUST remain assigned to a separate bounded shell wave

### Requirement: Independently Reversible Wave 0 Boundary

Wave 0 MUST remain independently reversible while leaving Home, route behavior, and pre-existing legacy styles available. Its implementation forecast MUST remain at or below 400 changed lines; if that boundary cannot be met, implementation MUST pause under `ask-on-risk` for an explicit delivery decision and MUST NOT infer a size exception.

#### Scenario: Wave 0 can be rolled back alone

- GIVEN Wave 0 has been applied
- WHEN its extraction and compatibility mappings are reverted
- THEN Home and route behavior MUST remain available through the pre-existing styles and consumers
- AND no data, API, routing, or content rollback MUST be required

#### Scenario: Review budget is exceeded

- GIVEN the forecast for Wave 0 exceeds 400 changed lines
- WHEN implementation scope is reviewed
- THEN implementation MUST pause for an explicit delivery decision
- AND neither chaining nor a size exception MUST be inferred
