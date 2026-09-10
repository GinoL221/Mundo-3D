# Proposal: Frontend Design System Migration — Wave 0 Shared-System Extraction

## Status

Proposed. This artifact is limited to Wave 0 shared-system extraction. It does not authorize product-code implementation or the creation of specifications, design files, or task plans.

## Intent

Formalize the proven visual and interaction language of Home as a small, reusable frontend contract before migrating additional route families. The proposal reduces visual drift and migration risk while preserving Home as the current visual authority and keeping production behavior authoritative.

Wave 0 establishes shared foundations and migration mappings only. It prepares the next route wave—`/products`, `/product`, and `/cart`—without implementing or visually migrating those pages.

## Confirmed context and authorities

- Home is the approved visual authority. It must remain visually and behaviorally stable during extraction.
- Repository authorities seed the initial contract because the reachable Open Design project (`46d18005-747c-4a86-8bfb-fc2cd9fab6c0`) has no `designSystemId`, skill binding, or separate canonical artifacts.
- Authority order remains: `docs/diseno/manual-identidad.md`, `PRODUCT.md`, `DESIGN.md`, archived Home responsive evidence, then current Astro source as implementation truth.
- No external research lane is selected. Detailed WCAG acceptance tests must verify standards claims against authoritative WCAG documentation during later implementation planning.

## Tool authority boundaries

The migration uses this explicit sequence and ownership model:

1. **Open Design** owns the shared visual/system contract: semantic roles, tokens, component/state contracts, accessibility policy, compatibility boundaries, and migration-wave decisions.
2. **OpenPencil** owns concrete route compositions and responsive/state variants after the shared contract is approved. It prepares Wave 1 frames and matrices; it does not override production behavior.
3. **Astro production code** remains final truth for semantics, content, behavior, data, loading/error states, routing, and responsive implementation.
4. **Impeccable** performs refinement and accessibility/quality audit after implementation, preserving the approved Home-derived authority. It is not a competing source of product truth.
5. **Verification** establishes functional, deterministic visual, and accessibility evidence against the approved contract.

No unavailable Open Design or OpenPencil artifact is to be inferred. Any later canonical artifact must be explicitly adopted through the appropriate tool flow.

## Goals

- Extract a minimal semantic shared layer from proven Home behavior and styling.
- Define shared page-frame/container and section-rhythm rules, while identifying Home-only constants rather than promoting them blindly.
- Define typography roles, including the missing display role, without changing the approved font family or inventing a new scale authority.
- Define primary action, secondary/text action, focus, disabled, and interactive-target rules.
- Adopt **WCAG 2.2 Level AA** for migrated surfaces and retain the stricter local **44×44px minimum interactive-target policy**.
- Define paper/surface/border treatment without introducing gradients, shadows, glow, or a new radius doctrine.
- Preserve dark theme support incrementally on every migrated surface. Dark tokens remain implementation support, not an approved replacement brand identity.
- Define reusable loading, empty, error, and status presentation contracts without weakening current state behavior.
- Establish an image-rendering policy that leaves real product and brand imagery at normal rendering while isolating intentional pixel-art placeholders.
- Record legacy `--pico-*`, CRT/JRPG, default-shell, and related rules as migration debt and compatibility boundaries rather than deleting them prematurely.
- Prepare OpenPencil and verification matrices for Wave 1 routes and states.
- Keep Wave 0 independently reversible and within the 400 changed-line review boundary.

## Scope

Wave 0 implementation, in a later apply phase, may cover only:

- Shared semantic tokens/primitives derived from Home.
- Page frame, container, section rhythm, typography roles, action roles, focus/disabled treatment, target-size policy, and surface/border treatment.
- State presentation contracts for loading, empty, error, and status states.
- Compatibility mapping from legacy selectors and tokens to the new contract, with explicit migration-debt labels.
- Safe image-rendering boundaries for real imagery versus intentional placeholder pixel art.
- Documentation/matrices needed to prepare `/products`, `/product`, and `/cart` for Wave 1.
- Bounded verification of unchanged Home behavior and the extracted contract.

Wave 1 preparation must enumerate, at minimum, phone/tablet/desktop compositions and states:

- `/products`: populated, loading, no catalogue, no filter results, API error.
- `/product`: loading, populated, missing product, API error, add-to-cart success/disabled feedback.
- `/cart`: loading, empty, populated, price drift, checkout pending/error, guest redirect boundary.

The cart route slice will later replace fictitious shipping output with truthful wording that shipping and delivery are coordinated after the order. Exact copy remains a Wave 1 route decision.

## Non-goals and explicit exclusions

- No `/products`, `/product`, or `/cart` page implementation or migration.
- No default `Header`/`Footer` migration. Default shell convergence is a separate bounded wave after Wave 0 defines the contract.
- No admin, authentication, editorial, or other route migration.
- No big-bang redesign and no destabilization of Home.
- No product-code edits in this proposal phase; no specification, design, or task artifacts yet.
- No changes to APIs, domain services, cart authority, checkout behavior, routing strategy, or data models.
- No invented payment, shipping price, delivery promise, stock guarantee, customer proof, or commission workflow.
- No new dark-brand palette or replacement brand identity.
- No promotion of legacy PICO-8, CRT/JRPG, pixel-font, orange/crimson, shadow, gradient, or glow treatments into shared authority.
- No deletion of legacy compatibility rules until all consumers are identified and migrated.
- No replacement, reconstruction, recoloring, or filtering of approved brand assets.
- No broad visual-baseline program for Wave 1; its evidence is prepared, not implemented.
- No opportunistic cleanup of unrelated production issues, including existing production logging, unless a later bounded implementation explicitly requires it.

## Affected capabilities

- **Frontend visual system:** shared tokens, semantic roles, layout primitives, surfaces, borders, typography, actions, and focus states.
- **Accessibility:** WCAG 2.2 AA target, local 44×44px interaction targets, keyboard/focus behavior, state semantics, and contrast verification.
- **Theme support:** incremental dark-theme preservation without elevating dark tokens to brand authority.
- **Responsive behavior:** Home-derived content-driven boundaries and route-wave preparation across phone, tablet, and desktop.
- **State presentation:** consistent loading, empty, error, status, and disabled conventions while preserving route behavior.
- **Asset rendering:** separation of normal brand/product imagery from intentional pixel-art placeholders.
- **Migration governance:** explicit ownership boundaries, compatibility debt, route/state matrices, and reversible delivery slices.
- **Review and verification:** Home regression protection plus a prepared Wave 1 evidence model.

## Key design constraints

- Home remains the reference surface; extraction must not copy Home-only selectors indiscriminately.
- Existing Home evidence may inform contracts, including the 1104px frame, 280px card minimum, 16px body minimum, approximately 75ch prose measure, and content-driven breakpoints, but each value must be classified as shared or Home-specific before adoption.
- Existing production semantics, content, behavior, and state truth must be preserved.
- The shared contract must not make legacy styling appear canonical merely because it is globally imported today.
- Dark theme support must remain functional during migration without claiming a final dark visual identity.
- Accessibility acceptance must distinguish WCAG 2.2 AA conformance from the stricter local target-size rule.

## Risks and mitigations

| Risk                                | Impact                                                                                                              | Mitigation                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Cascade and import-order regression | Unrelated routes or Home may change unexpectedly                                                                    | Use semantic scoping, preserve explicit ownership, verify Home before/after, and map legacy selectors before changing global behavior.  |
| Authority drift                     | Legacy PICO/CRT/JRPG behavior becomes the accidental system                                                         | Label compatibility debt and admit only Home-proven rules into the shared contract.                                                     |
| Shell divergence                    | Premature Header/Footer unification can regress auth, admin visibility, keyboard behavior, or responsive navigation | Exclude default shell migration from Wave 0 and schedule a separate bounded shell wave.                                                 |
| State loss                          | Static compositions can omit meaningful loading, empty, error, or pending behavior                                  | Treat state contracts and route/state matrices as first-class acceptance inputs.                                                        |
| Dark-theme breakage                 | Incremental migration can break inverse assets or token relationships                                               | Verify light and dark behavior for each touched surface; do not invent a new dark palette.                                              |
| Image-policy blast radius           | Reset changes can alter placeholders, logos, avatars, and product imagery                                           | Isolate intentional pixel art and verify real imagery under a narrowly scoped policy.                                                   |
| Accessibility ambiguity             | AA and local target policy may be conflated                                                                         | Record both requirements separately and verify keyboard, focus, contrast, semantics, and 44×44px targets.                               |
| Missing visual evidence on Wave 1   | Later route migration may rely on subjective review                                                                 | Prepare explicit OpenPencil frames and state/viewport acceptance matrices now; execute them in Wave 1.                                  |
| Review-size overrun                 | A broad extraction becomes hard to review or safely revert                                                          | Forecast changed lines before implementation; keep the slice at or below 400 lines and pause under `ask-on-risk` if that cannot be met. |
| Tool-context gap                    | Unavailable canonical design artifacts could be silently invented                                                   | Use confirmed repository authorities only and record any later Open Design/OpenPencil artifact as an explicit adoption decision.        |

## Rollback

Wave 0 must be deployable as one independently reversible slice. Rollback means reverting the Wave 0 extraction and its compatibility mappings while leaving Home, route behavior, and the pre-existing legacy styles available. No migration may require a data, API, routing, or content rollback.

Before implementation, identify changed global imports, tokens, selectors, and component boundaries so they can be reverted without removing legacy consumers. If the forecast exceeds 400 changed lines, stop and ask for a delivery decision: chain the work into reviewable slices or explicitly authorize another strategy. Do not infer a size exception.

## Acceptance outcomes

Wave 0 is successful when all of the following are true:

1. A reviewed shared contract identifies which Home rules are global foundations and which remain Home-specific.
2. Authority boundaries between Open Design, OpenPencil, Astro, Impeccable, and verification are recorded and followed.
3. Home remains visually and behaviorally stable against its existing functional and visual evidence, including light/dark support where applicable.
4. Migrated/shared foundations meet WCAG 2.2 AA requirements and the local 44×44px target policy, with evidence planned for keyboard, focus, contrast, semantics, and state behavior.
5. Dark theme remains supported incrementally without being represented as a new approved brand identity.
6. Loading, empty, error, disabled, and status conventions preserve truthful behavior and do not introduce unsupported product claims.
7. Real imagery is not pixelated by default, while intentional pixel-art placeholders remain explicitly isolated.
8. Legacy compatibility rules are mapped as debt with known consumers; none are deleted without a bounded migration decision.
9. The default Header/Footer remains unchanged and is clearly assigned to a separate shell wave.
10. Wave 1 matrices and OpenPencil preparation cover the required routes, states, themes, and phone/tablet/desktop boundaries, with no Wave 1 page implementation included.
11. The final Wave 0 diff is independently reversible and at or below the 400 changed-line review boundary. If it cannot meet that boundary, implementation pauses for an explicit delivery decision under `ask-on-risk`.

## Delivery boundary

This proposal is the only artifact created in this phase. No product-code edits, specs, design artifact, or task artifact are included. Any later implementation must proceed through the approved sequence: contract/design decisions, OpenPencil preparation, bounded Astro change, Impeccable refinement/audit, then verification. Wave 1 route implementation and default shell migration require separate bounded proposals or explicitly approved follow-on slices.
