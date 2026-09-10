# CSS Design System Specification

## Purpose

Token-driven CSS architecture replacing the monolithic `styles.css` with modular files, BEM naming in English, consolidated design tokens, and mobile-first responsive queries per component.

## Requirements

### Requirement: Design Token Files

The system MUST provide token files under `public/css/tokens/`: `colors.css` (including `--input-fg`, `--title-highlight`, `--lcd-bg`, and `--lcd-fg`), `typography.css`, and `spacing.css`.

(Previously: colors.css listed custom properties without `--title-highlight`, `--lcd-bg`, and `--lcd-fg`.)

#### Scenario: Tokens cascade correctly

- GIVEN `head.ejs` loads token files
- WHEN processing CSS cascade
- THEN `--title-highlight`, `--lcd-bg`, and `--lcd-fg` MUST resolve to dark-mode defaults

#### Scenario: Light theme overrides

- GIVEN `data-theme="light"` is set on `<html>`
- WHEN colors.css is evaluated
- THEN `--title-highlight` MUST resolve to `#1a2a4a`
- AND `--lcd-bg` and `--lcd-fg` MUST resolve to classic Game Boy colors (#8bac0f and #0f380f)

### Requirement: Breakpoint Token Consolidation

The system MUST define exactly three breakpoint custom properties: `--bp-mobile: 640px`, `--bp-tablet: 1024px`, `--bp-desktop: 1024px`. The previous `--breakpoint-mobile`, `--breakpoint-tablet`, and `--breakpoint-desktop` aliases MUST NOT exist anywhere in the CSS codebase after migration.

#### Scenario: Old breakpoint tokens removed

- GIVEN the migration is complete
- WHEN searching all CSS files for `--breakpoint-mobile`, `--breakpoint-tablet`, or `--breakpoint-desktop`
- THEN zero matches MUST be found

#### Scenario: New breakpoint tokens functional

- GIVEN `tokens/spacing.css` is loaded
- WHEN a component file uses `var(--bp-mobile)` in a media query
- THEN the value MUST resolve to `640px`

### Requirement: Modular CSS File Loading

`head.ejs` MUST load all CSS via ordered `<link>` tags: `normalize.css`, then `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `base/reset.css`, `base/layout.css`, then component files, then theme/override files. The monolithic `styles.css` MUST NOT be referenced after migration.

#### Scenario: All 14 CSS files loaded in order

- GIVEN `head.ejs` renders
- WHEN the `<link>` elements are listed in DOM order
- THEN there MUST be exactly 14 CSS `<link>` tags
- AND `tokens/colors.css` MUST appear before `base/reset.css`
- AND all component files MUST appear after `base/layout.css`
- AND `styles.css` MUST NOT appear

#### Scenario: No references to styles.css

- GIVEN the migration is complete
- WHEN searching all EJS files for `styles.css`
- THEN zero matches MUST be found

### Requirement: BEM Naming in English

All CSS class names MUST follow Block\_\_Element--Modifier convention in English. Spanish class names (`.barra-navegacion`, `.contenido_produc`, `.containerSectionIndex`, `.containerSections`, etc.) and mixed-language names MUST NOT exist after migration. Each component MUST have exactly one canonical Block name.

#### Scenario: No Spanish or mixed-language class names

- GIVEN the migration is complete
- WHEN running `rg "barra-navegacion|contenido_produc|containerSection"` in `src/views/` and `public/`
- THEN zero matches MUST be found

#### Scenario: Single canonical product grid name

- GIVEN product grid styles are defined
- WHEN searching for product grid class names
- THEN exactly one Block name MUST exist (`.product-grid`), not `.products_container`, `.containerSectionIndex`, or `.contenido_produc`

### Requirement: Mobile-First Responsive Queries

All media queries MUST use `min-width` breakpoints (mobile-first). Media queries MUST live in their owning component file, not in a separate responsive section.

#### Scenario: No max-width-only media queries for layout

- GIVEN all component CSS files after migration
- WHEN searching for media queries using `max-width`
- THEN only theme-specific overrides (e.g., `.theme-toggle-btn` icon/text swap at 639px) MAY use `max-width`
- AND layout breakpoints MUST use `min-width` exclusively

### Requirement: Progressive Deletion of Monolith

`styles.css` MUST be emptied section by section across 7 PR slices. At no point MUST `styles.css` contain styles that duplicate what exists in modular files, and at no point MUST any class be defined in both places simultaneously. After PR 7, `styles.css` MUST be deleted.

#### Scenario: Safe intermediate state

- GIVEN any PR slice is merged (PRs 1-6)
- WHEN the site loads
- THEN `styles.css` contains only the sections not yet migrated
- AND no class name exists in both `styles.css` and a component file

#### Scenario: Final state removes monolith

- GIVEN PR 7 is merged
- WHEN listing `public/css/styles.css`
- THEN the file MUST NOT exist

### Requirement: Grep Verification per PR

Each PR slice MUST include a grep verification step confirming zero references to old class names in both CSS and EJS files before merge.

#### Scenario: Grep check passes before merge

- GIVEN a PR slice updates class names
- WHEN running `rg` for all old class names replaced in that slice
- THEN the search MUST return zero matches in `src/views/` and `public/css/`

### Requirement: Input Foreground Token

The system MUST define a `--input-fg` custom property in `colors.css` for both dark and light themes. In dark mode `--input-fg` MUST resolve to a light color legible on `--input-bg`. In light mode `--input-fg` MUST resolve to a dark color legible on the light-mode `--input-bg`. The system MUST also override `--input-bg` in the `[data-theme="light"]` selector so that light-mode inputs have a non-black background.

#### Scenario: Dark mode input foreground resolves

- GIVEN `<html>` has no `data-theme` attribute (dark mode default)
- WHEN `--input-fg` is evaluated
- THEN it MUST resolve to a color with sufficient contrast on the dark-mode `--input-bg`

#### Scenario: Light mode input foreground and background override

- GIVEN `data-theme="light"` is set on `<html>`
- WHEN `[data-theme="light"]` selectors in `colors.css` are evaluated
- THEN `--input-bg` MUST resolve to a non-black background color
- AND `--input-fg` MUST resolve to a dark color legible on that background

### Requirement: Header Grid and Theme Toggle

The header navbar MUST use a CSS Grid layout on viewports ≥640px to center the search bar. The theme toggle MUST NOT display text labels and MUST display only the theme icon.

#### Scenario: Header grid on desktop

- GIVEN a viewport ≥640px
- WHEN the header renders
- THEN `.navbar__inner` MUST display as grid centering the search bar
- AND logo MUST align left, menu right

#### Scenario: Theme toggle icon-only

- GIVEN the header renders
- WHEN inspecting the theme toggle button
- THEN it MUST NOT contain a text element
- AND the icon container MUST display the current theme icon

### Requirement: Single Home Responsive Owner

Home responsive behavior MUST be governed by one mobile-first source of truth for its frame, navigation mode, grid, typography, spacing, header, and footer. Rules that produce conflicting Home behavior at the same viewport MUST NOT remain active. CSS and JavaScript navigation boundaries MUST both resolve compact mode through 1023px and exposed mode from 1024px.

#### Scenario: Home rules agree at boundaries

- GIVEN Home is evaluated at 639px, 640px, 1023px, and 1024px
- WHEN responsive rules resolve
- THEN each width MUST produce one unambiguous grid and navigation mode
- AND later style loading MUST NOT reverse that mode

#### Scenario: Mobile-first behavior remains continuous

- GIVEN the Home viewport increases from 320px through 1440px
- WHEN layout changes occur
- THEN each change MUST correspond to the confirmed content-fit boundaries
- AND no overlapping rule set MUST cause horizontal overflow or an intermediate contradictory state

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
