# Pre-Proposal: Frontend Design System Migration

## Status

Product decisions confirmed. Proposal may proceed.

## Confirmed direction

- Home is the approved visual authority and must remain behaviorally and visually stable during system extraction.
- The migration follows: Open Design → OpenPencil → Astro production code → Impeccable → verification.
- Open Design owns the shared visual/system contract; OpenPencil owns concrete route, state, and responsive compositions; production code remains implementation truth.
- Delivery is incremental: shared system first, route waves afterward.
- The first proposal covers Wave 0 only. It prepares Wave 1 (`/products`, `/product`, `/cart`) but does not implement those pages.

## Confirmed product and design decisions

1. Accessibility target: WCAG 2.2 Level AA for migrated surfaces, plus the stricter local 44×44px minimum interactive-target policy.
2. Dark theme: preserve it incrementally on every migrated surface. It remains implementation support, not an approved replacement brand identity.
3. Shared shell: migrate the default Header/Footer in a separate bounded wave after Wave 0 defines the contract; do not hide shell replacement inside Wave 0.
4. Cart honesty: replace fictitious shipping output with copy communicating that shipping and delivery are coordinated after the order. Exact production wording will be finalized in the cart route slice.
5. Review strategy: keep independently reversible slices within the 400 changed-line budget; ask before chaining or accepting an exception.

## Local tool evidence

- Open Design is reachable at `http://127.0.0.1:7456`.
- Mundo-3D project ID: `46d18005-747c-4a86-8bfb-fc2cd9fab6c0`.
- The project resolves to `/workspace/mundo-3d` and currently has no `designSystemId`, skill binding, or separate canonical Open Design artifacts.
- Therefore the approved repository authorities remain the source for the initial Open Design system contract; no missing external design system may be inferred.

## Research selection

No external research lane is selected. Existing Home evidence is sufficient for the Wave 0 proposal. Standards claims used during implementation must be verified against authoritative WCAG documentation when detailed acceptance tests are designed.

## Proposal boundary

Wave 0 may define and extract shared semantic foundations, compatibility boundaries, state patterns, image-rendering policy, and Wave 1 design/verification matrices. It must not migrate `/products`, `/product`, `/cart`, the default shell, admin routes, authentication routes, editorial routes, or backend behavior.
