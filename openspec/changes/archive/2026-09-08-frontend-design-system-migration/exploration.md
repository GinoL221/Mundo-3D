# Exploration: Frontend Design System Migration

## Status

Ready for a bounded proposal, with tool-access and product-decision gaps recorded below.

## Executive Summary

Mundo 3D already has an approved visual authority and one production-proven reference surface: Home. The safest migration is incremental. First formalize Home's shipped visual language as a small shared contract, then migrate coherent route waves without redesigning behavior. Astro production code remains implementation truth; design tools should describe and preview the intended contract, not override repository behavior.

The first implementation slice should be **Wave 0 only**: inventory and extract a narrowly bounded set of shared foundations from Home (page frame, typography roles, action/link roles, surface/border treatment, focus/target rules, and loading/empty/error state conventions), while preparing explicit mappings for Wave 1 (`/products`, `/product`, `/cart`). Wave 1 page implementation must not be silently included. The likely combined Wave 0 + Wave 1 change crosses multiple Astro components, global CSS files, route styles, and E2E suites and is unsafe against the 400-line review budget without a later delivery decision.

## Authorities and Evidence

Authority order:

1. `docs/diseno/manual-identidad.md` — approved brand identity, assets, palette, IBM Plex Sans, photography, icon direction, voice, and WCAG-oriented brand rules.
2. `PRODUCT.md` — evaluator-first product purpose, catalogue-first positioning, truthful capability boundaries, rioplatense voice, and fixed catalogue/role commitments.
3. `DESIGN.md` — technical translation and implementation-debt register.
4. Archived Home change evidence under `openspec/changes/archive/2026-09-07-home-responsive-system/` — the strongest validated responsive/system precedent.
5. Astro source — current implementation truth, including contradictions and legacy debt.

Home is the visual authority because it is the only surface with a dedicated shell, coherent workshop-vitrine composition, consolidated responsive ownership, deterministic visual baselines, and verified state behavior. Its authority is directional rather than a license to copy Home-only selectors into every page.

The requested `docs/diseno/frontend-adaptation-playbook.md` is absent at the stated path and no matching adaptation-playbook filename was found. This is a documentation gap, not evidence that its intended rules are obsolete.

## Current Frontend Shape

- Astro exposes 17 routes under `frontend/src/pages/`, including the proposed Wave 1 routes: `products.astro`, `product.astro`, and `cart.astro`.
- `frontend/src/layouts/Layout.astro` globally imports all token, base, Home, default-shell, product, cart, form, and utility styles. It switches between dedicated `HomeHeader`/`HomeFooter` and legacy/default `Header`/`Footer`.
- Home has dedicated components and CSS (`HomeHeader.astro`, `HomeFooter.astro`, `home-*`) plus a single responsive owner split into base/desktop delegates. The archived verification records a 13-viewport current matrix and passing historical evidence with reconciliation warnings.
- Non-Home routes use the default header, which still contains a disabled search affordance and a structurally different navigation/account model from Home.
- Shared tokens exist in `frontend/src/styles/tokens/`, but legacy aliases and global resets remain active. `reset.css` globally applies pixelated image rendering and square corners.
- The catalogue uses `ProductSearch.astro` + `ProductCard.astro`, URL-driven filtering, client rendering, and `product-grid.css`/`product-card.css`.
- Product detail is largely route-local markup and client behavior with `product-detail.css`; it still contains PICO aliases, shadow/elevation, retro panel decoration, uppercase action copy, and inline display styles.
- Cart uses `CartList.astro` and `cart.css`; behavior is comparatively mature, but presentation contains fake shipping text (`Envio: $ 000`), formal `su` voice, inline styles, pixel-art empty imagery, and generic/global state classes.
- Product code includes `console.error` in a production path, conflicting with repository standards; migration should record but not opportunistically broaden into unrelated cleanup unless required by touched behavior.

## Existing Home Evidence

The archived Home responsive change establishes reusable contracts:

- content-driven breakpoints with `640px`, `1024px`, a `1104px` frame, `280px` card minimum, `16px` body minimum, and approximately `75ch` prose;
- native non-modal disclosure navigation with synchronized `hidden`/`aria-expanded`, Escape focus restoration, and aligned CSS/JS boundaries;
- deterministic Playwright fixtures, reduced motion, fixed theme/locale/timezone/DPR, image/font readiness, overflow assertions, and Chromium screenshots;
- explicit preservation of dynamic success, loading, empty, and error states;
- local 44×44px target policy, correctly distinguished from WCAG AA's target-size minimum.

The archived report is historical evidence, not a claim that all current screenshots were freshly executed during this exploration.

## Visual-Test Coverage

Current E2E coverage is behaviorally strong for the proposed Wave 1:

- `/products`: real search/filter/direct-query behavior, pagination with a routed response, plus empty and API-error states.
- `/product`: real product loading, 404/API-error states, 3D specifications, and add-to-cart flow.
- `/cart`: guest/authenticated flows, item persistence/removal/quantity, checkout routing, hydration, price drift, and race behavior.

Visual regression is concentrated on Home. Thirteen Home Chromium Linux baselines exist under `e2e/tests/home-responsive.spec.ts-snapshots/`; there are no equivalent visual baselines for `/products`, `/product`, or `/cart`. Existing Wave 1 tests should be preserved as functional truth and augmented later with bounded route/state/viewport visual and accessibility checks rather than rewritten wholesale.

## Tool-Flow Contract

1. **Open Design** — hold system direction, semantic roles, component/state contract, and migration-wave decisions. Local project ID supplied: `46d18005-747c-4a86-8bfb-fc2cd9fab6c0`.
2. **OpenPencil** — create concrete route screens and responsive/state variants after the Open Design contract is approved.
3. **Astro production code** — final truth for semantics, content, behavior, data/loading states, and responsive implementation.
4. **Impeccable** — refinement/audit after implementation, preserving the incumbent authority; the manual detector is only needed after changed UI is finished.
5. **Verification** — functional E2E first, then deterministic visual comparison and accessibility checks across approved states and boundaries.

No Open Design or OpenPencil integration was available in this executor session, so project contents and screen files could not be inspected. The project ID is therefore recorded but not represented as retrieved evidence.

## Approaches

### A. Incremental contract extraction and wave migration — recommended

Extract only proven Home rules into shared semantic primitives, keep Home stable, and migrate route families one wave at a time.

- Pros: preserves production truth, limits regressions, supports reviewable visual evidence, and prevents legacy rules becoming accidental system rules.
- Cons: temporary coexistence of Home, shared, and legacy styles; requires explicit ownership boundaries.

### B. Migrate Home and Wave 1 together

- Pros: immediate visible consistency across the shopping path.
- Cons: likely exceeds 400 changed lines across global CSS, components, routes, and tests; mixes system extraction with three page redesigns; weakens rollback and review attribution.

### C. Token-only normalization

- Pros: smallest initial diff.
- Cons: cannot resolve duplicated markup, shell divergence, state patterns, or legacy PICO/CRT selectors; risks cosmetic renaming without a usable component contract.

## Recommended First Bounded Scope

### Wave 0 — shared-system extraction only

Define and implement, in a later apply phase, a minimal semantic layer derived from Home:

- shared page frame/container and section rhythm;
- type roles including the missing display role, without changing approved font or scale authority;
- primary action, secondary/text action, focus ring, disabled state, and minimum target policy;
- paper/surface/border treatment with no gradients, shadows, glow, or new radius doctrine;
- reusable loading, empty, error, and status presentation contracts;
- image-rendering policy that defaults real product and brand imagery to normal rendering while isolating intentional placeholder pixel art;
- compatibility mapping that labels legacy `--pico-*`, CRT/JRPG, and default-shell rules as migration debt rather than deleting them;
- a Wave 1 screen/state matrix and selector-to-contract mapping, but **no `/products`, `/product`, or `/cart` page implementation**.

Review safety: target Wave 0 as one independently reversible slice at or below 400 changed lines. If extracting the default header/footer, replacing global reset behavior, or adding broad visual baselines pushes the forecast over budget, pause under `ask-on-risk` and choose a chain strategy; do not infer an exception.

### Wave 1 preparation

Prepare OpenPencil frames and acceptance matrices for:

- `/products`: populated, loading, no catalogue, no filter results, API error; phone/tablet/desktop.
- `/product`: loading, populated, missing product, API error, add-to-cart success/disabled feedback; phone/tablet/desktop.
- `/cart`: loading, empty, populated, price drift, checkout pending/error, guest redirect boundary; phone/tablet/desktop.

Implementation should likely be split by reviewable route slices rather than shipping all three with Wave 0.

## Non-Goals

- No UI implementation or product-code edits during exploration.
- No proposal, specification, design, or task artifact yet.
- No full-site big-bang redesign.
- No change to product APIs, domain services, cart authority, checkout behavior, routing strategy, or data models.
- No invented payment, shipping price, delivery promise, stock guarantee, customer proof, or commission workflow.
- No new dark-brand palette; current dark tokens remain product implementation status.
- No reintroduction or expansion of PICO-8, CRT, JRPG, pixel-font, orange, crimson, shadow, gradient, or glow treatments.
- No deletion of legacy compatibility rules until all consumers are identified and migrated.
- No replacement, reconstruction, recoloring, or filtering of approved brand assets.
- No broad header/footer migration hidden inside Wave 0 unless separately bounded and admitted.

## Open Product and Design Decisions

1. Is WCAG 2.2 AA the required conformance target, with 44×44px retained as a stricter local interaction policy?
2. Should the dark workshop theme remain supported during every migration wave despite lacking an approved dark brand palette?
3. Should the default header converge on Home's disclosure/navigation contract in Wave 0, or be a separate shell wave?
4. Which Home dimensions become global tokens versus Home-specific layout constants (`1104px`, `280px`, heading clamps, `75ch`)?
5. Should catalogue and detail pages use visible H1s as part of the editorial hierarchy, replacing visually hidden page headings?
6. What truthful cart copy replaces `Envio: $ 000`, and should checkout remain labelled as an order action while payment is absent?
7. Should intentional pixel-art fallback illustrations remain, be redrawn later, or simply be isolated from real image rendering in this migration?
8. What is the approved visual-baseline environment and screenshot-diff policy for non-Home routes?
9. Which route/state combinations are required for each migration wave before a page is considered migrated?
10. Does Open Design already contain canonical component names or screen decisions that must be imported before proposal work?

## Candidate Artifact Paths

Exploration artifact created now:

- `openspec/changes/frontend-design-system-migration/exploration.md`

Potential later artifacts, only after phase approval:

- `openspec/changes/frontend-design-system-migration/proposal.md`
- `openspec/changes/frontend-design-system-migration/specs/css-design-system/spec.md`
- `openspec/changes/frontend-design-system-migration/specs/frontend-migration-waves/spec.md`
- `openspec/changes/frontend-design-system-migration/specs/e2e/spec.md`
- `openspec/changes/frontend-design-system-migration/design.md`
- `openspec/changes/frontend-design-system-migration/tasks.md`
- Open Design project `46d18005-747c-4a86-8bfb-fc2cd9fab6c0`: system contract and migration-wave board (exact internal path unknown until tool access).
- OpenPencil: `design/frontend-design-system-migration/wave-1/` or the repository's established design-file location (none was discoverable in this session); screen names should encode route, state, theme, and viewport.
- Later visual baselines: `e2e/tests/frontend-wave-1.spec.ts-snapshots/`, preferably separated by route if review size requires it.

## Migration Risks

- **Review-size risk — high:** system extraction plus three page migrations will likely exceed 400 lines and span too many concerns.
- **Cascade risk — high:** all component CSS is globally imported; generic selectors and import order can regress unrelated routes.
- **Authority drift — high:** legacy production CSS contains PICO aliases, pixel rendering, shadow, and CRT/JRPG behavior that must not be promoted into the shared contract.
- **Shell divergence — medium/high:** Home and default headers differ semantically and visually; premature unification can regress auth, admin visibility, keyboard behavior, and responsive navigation.
- **State-truth risk — high:** loading/error/empty/pending states are client-rendered and behaviorally significant; static mockups can omit them.
- **Visual-evidence gap — medium/high:** only Home has screenshot baselines; Wave 1 lacks visual and explicit accessibility regression coverage.
- **Content-honesty risk — high:** cart shipping/payment wording and commission messaging can imply capabilities that do not exist.
- **Global image-policy risk — medium:** changing `reset.css` can alter placeholders, logos, avatars, and all product imagery at once.
- **Dark-theme risk — medium:** migration can accidentally treat unapproved dark tokens as brand authority or break the inverse logo contract.
- **Tool-context risk — medium:** Open Design/OpenPencil contents were unavailable, and the referenced adaptation playbook is missing.
- **Source-size risk — medium:** `ProductSearch.astro`, `CartList.astro`, and route scripts are already substantial; presentation extraction must respect the 250-line source cap without mixing behavioral refactors into visual migration.

## External Research Value

Optional external research would add limited value now. The archived Home research already covers content-driven breakpoints, disclosure semantics, target-size distinctions, deterministic Playwright screenshots, and overflow checks. A narrow research lane would be useful only for one of these unresolved choices:

- selecting and documenting WCAG 2.2 AA as the project conformance target;
- validating an accessible e-commerce filter pattern across responsive layouts;
- defining a reproducible cross-platform screenshot-baseline policy;
- checking current guidance for honest non-payment checkout/order wording.

Research should not block a Wave 0 proposal once local Open Design context and product decisions are available.

## Exploration Limitations

CodeGraph was checked first as required, but `.codegraph/` was absent and this executor had no shell or CodeGraph tool with which to initialize/query it. Filesystem discovery was therefore used as a read-only fallback. Impeccable's context launcher could not be executed for the same tool-access reason; the injected preflight states that frontend context was already resolved, and its source documents were read directly. Open Design and OpenPencil project contents were not accessible in this session.

## Ready for Proposal

Yes, for a **Wave 0-only proposal** that preserves Home and explicitly excludes Wave 1 page implementation. Before proposal conclusions are locked, retrieve Open Design project context, resolve the missing adaptation playbook, and answer the decisions about accessibility level, dark-theme support, shell timing, truthful cart wording, and visual-baseline policy.
