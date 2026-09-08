# Technical Design: Frontend Design System Migration — Wave 0

## Status and scope

This design covers Wave 0 only. It defines a small repository-owned system contract, semantic CSS foundations, compatibility boundaries, and verification seams. It does not authorize `/products`, `/product`, `/cart`, default `Header`/`Footer`, API, data, routing, or state-behavior changes.

Home remains the visual and behavioral authority. Extraction is successful only when Home computes and behaves identically before and after the change in light and dark themes.

## Architecture

```text
identity manual / PRODUCT.md / DESIGN.md / Home evidence
                         │
                         ▼
docs/diseno/frontend-system-contract.md  ← Open Design renders repository file
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
 tokens/semantic.css          base/system-primitives.css
            │                         │
            └────────────┬────────────┘
                         ▼
 Home aliases with literal fallback + unchanged legacy component CSS
                         │
                         ▼
 Playwright contract checks + existing Home functional/visual evidence
```

The architecture is additive except for the global image reset. Shared rules load before all component CSS, so existing Home and legacy selectors retain the final say. Home adopts only variable aliases with literal fallbacks; it does not adopt new shared classes or change markup.

## Decisions

### 1. Repository-versioned Open Design contract

Create `docs/diseno/frontend-system-contract.md` as the canonical Wave 0 system-contract deliverable. Its frontmatter records:

- schema/version and `status: approved|draft`;
- Open Design project `46d18005-747c-4a86-8bfb-fc2cd9fab6c0`;
- repository path and Wave 0 revision;
- authority sources and ownership boundaries;
- semantic tokens/primitives, state contracts, accessibility policies, compatibility debt, and migration decisions;
- the compact Wave 1 preparation matrix and `frame_status: planned-not-created`.

Open Design resolves the project to `/workspace/mundo-3d` and can enumerate repository files through `/api/projects/<id>/files`; therefore it should render this Markdown file from the project file inventory. No `designSystemId`, private artifact identifier, write endpoint, or unavailable internal artifact API is invented. A later external artifact becomes authoritative only through an explicit adoption decision recorded in this file.

### 2. Token layering and ownership classification

Existing token files remain primitive/implementation sources. New `tokens/semantic.css` aliases them into intent-based roles; it does not duplicate theme values. Light/default and `[data-theme="dark"]` continue resolving through `colors.css`.

| Candidate                                                                       | Classification                 | Wave 0 treatment                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Paper, surface, ink, muted text, line, brand blue, accessible link, danger text | Shared                         | Semantic color roles alias existing theme tokens; add a theme-aware muted role.                                                               |
| IBM Plex Sans; display 40/600/1.10; H1/H2/body/label/caption roles              | Shared                         | Add the missing display and role aliases without replacing the current scale.                                                                 |
| 8px spacing rhythm                                                              | Shared                         | Reuse the existing scale for section and control-gap roles.                                                                                   |
| 1104px frame and 16px gutter                                                    | Shared public-storefront frame | Home-proven and suitable for the next public catalogue wave; Home keeps fallback literals. The legacy/default 1440px shell remains untouched. |
| Approximately 75ch prose measure                                                | Shared                         | Expose as a readable-prose maximum; consumers opt in.                                                                                         |
| 16px body minimum                                                               | Shared                         | Preserve the existing body token and document the minimum.                                                                                    |
| 44px actionable area                                                            | Shared local policy            | Expose one minimum-target token; report separately from WCAG AA.                                                                              |
| 640px and 1024px names                                                          | Shared responsive vocabulary   | Keep existing tokens/documentation; media-query placement remains content-driven because CSS custom properties cannot own media conditions.   |
| 280px card minimum                                                              | Home-only in Wave 0            | Keep `--home-card-min`; reconsider with real Wave 1 card content.                                                                             |
| Home fluid heading formulas, 18ch hero title, featured-card dimensions          | Home-only                      | Do not move from Home selectors. Only the 40px display endpoint is shared.                                                                    |
| Home commission colors, 6px/4px radii, dropdown shadow                          | Home-only/legacy exception     | Do not promote; no shared radius or elevation doctrine.                                                                                       |
| Global square geometry, PICO/CRT/JRPG effects                                   | Compatibility debt             | Preserve known consumers; never expose through semantic roles.                                                                                |

Semantic names use a `--sys-*` prefix to prevent collision with current tokens, for example `--sys-page-bg`, `--sys-text`, `--sys-text-muted`, `--sys-surface`, `--sys-border`, `--sys-action-bg`, `--sys-focus`, `--sys-frame-max`, `--sys-frame-gutter`, `--sys-prose-max`, and `--sys-target-min`.

### 3. CSS primitives, not a component framework

Add `base/system-primitives.css` under the 250-line cap. It contains only opt-in primitives:

- `.system-frame`: the fluid frame formula;
- `.system-section`: shared block rhythm;
- `.system-prose`: readable measure;
- `.system-action`, `--primary`, and `--text`: target, typography, focus, hover, and disabled behavior;
- `.system-state` plus `--loading`, `--empty`, `--error`, and `--status`: neutral presentation hooks;
- `[data-image-rendering="pixel-art"]`: the canonical explicit pixel-art marker.

It defines no gradients, shadows, glow, global radius, route layout, or content. Native elements remain preferred. CSS classes never supply semantics by themselves.

### 4. Shared state contract

The repository contract defines markup obligations independently of presentation:

| State           | Semantic contract                                                                                                                                       | Behavior boundary                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Loading/pending | Associate visible text with the affected region; set `aria-busy`; use `role="status"`/polite announcement only when a transition requires announcement. | Must mirror actual in-flight work and never alter it.                |
| Empty           | Heading or labelled region with truthful absence and an available next action.                                                                          | Initial empty content need not be a live region.                     |
| Error           | Problem plus truthful recovery; use `role="alert"` for newly occurring actionable failures, not static page copy.                                       | Distinct from empty/not-found; no invented claims.                   |
| Disabled        | Prefer native `disabled`; custom controls require `aria-disabled`, blocked activation, and keyboard parity.                                             | Must not imply completion or availability.                           |
| Status/success  | Visible text plus polite live status when produced asynchronously.                                                                                      | Must reflect production outcome and must not change routing or data. |

Wave 0 supplies these contracts and styles but does not replace Home templates or Wave 1 route state logic. Route copy and state transitions remain Astro/domain truth.

### 5. Image rendering and legacy compatibility

Change `base/reset.css` so ordinary `img` rendering is `auto`. Pixelation becomes opt-in through the canonical data marker. Existing explicit placeholder selectors remain compatibility aliases during Wave 0:

- `.home-featured-card__image--placeholder`;
- `.home-product-card__image--placeholder`;
- `.product-card__category-img--pixelart`;
- `.product-detail__image--pixelart`;
- `.empty-state__image` and existing inline placeholder declarations.

Real product images, cart images, avatars, and approved brand assets then use normal rendering without route edits. No image is filtered, recolored, reconstructed, or replaced. The generic marker is for new work; legacy aliases are removed only in their owning migration waves.

### 6. Accessibility evidence remains two ledgers

The system contract has separate evidence tables:

1. **WCAG 2.2 AA:** applicable keyboard, focus visibility/not-obscured, text/non-text contrast, name/role/value, status semantics, and target-size-minimum checks, verified against current authoritative W3C criteria during implementation planning.
2. **Local 44×44 policy:** measured actionable width and height in CSS pixels at every supported viewport, with no WCAG exception waiving the local rule.

Every touched shared role is checked in light and dark themes. Disabled/status meaning must survive without color. Focus uses a visible semantic focus role, but final contrast is measured against each actual adjacent background rather than assumed from token values.

## Import and cascade strategy

`frontend/src/layouts/Layout.astro` keeps one global import owner and uses this order:

1. `normalize.css`;
2. `tokens/colors.css`, `typography.css`, `spacing.css`;
3. new `tokens/semantic.css`;
4. `base/reset.css`, `layout.css`, `utilities.css`;
5. new `base/system-primitives.css`;
6. all existing component styles in their current relative order.

No compatibility stylesheet is loaded last. Existing component files themselves remain the compatibility layer, preventing a new high-specificity override tier. New selectors use one class (or one data attribute), no `!important`, and no route selector. Home variable aliases use fallbacks such as `var(--sys-frame-max, 1104px)`, so partial rollback cannot strand Home with unresolved values.

## Compatibility register boundary

The contract maps each debt item to consumers, replacement, owner, and removal gate:

- `--pico-*`: declarations in `tokens/colors.css`; consumers in navbar/nav toggles, product detail/cards, cart, alerts, forms/auth, profile, users/admin, footer, carousel, and error pages. Replacement is a semantic role where one exists; orange/crimson and retro palette entries otherwise have `no-equivalent`. Removal is per owning route/shell wave.
- CRT overlay/keyframes/preferences: `Layout.astro`, `base/layout.css`, `scripts/crtToggle.ts`, and header module tests. No shared equivalent; owner is a separate legacy-theme decision.
- JRPG cursor behavior: `nav-toggles.css` and `product-card.css`. No shared equivalent; default-shell/product waves own removal.
- Default shell: `Header.astro`, `Footer.astro`, `navbar.css`, `footer.css`, and `Layout variant="default"`. The semantic frame is a future replacement candidate, but Wave 0 does not alter these files/selectors beyond the shared import owner.
- Global square geometry and component shadows: preserved as legacy behavior, explicitly excluded from shared authority.
- Placeholder pixel selectors: temporary compatibility aliases to the explicit pixel-art policy; route owners migrate them later.

A debt entry cannot be deleted until its consumer search is refreshed, its owner wave is approved, and route evidence passes.

## Wave 1 OpenPencil preparation package

The repository contract records three viewport fixtures—phone `375×812`, tablet `768×1024`, desktop `1280×900`—and themes `light|dark`. Breakpoint edge tests remain a production verification concern, not OpenPencil device claims.

Each state below expands by the Cartesian product of all three viewports and both themes. Planned frame IDs are deterministic: `{route}--{state}--{theme}--{viewport}`. Every entry is marked `planned-not-created` until OpenPencil returns actual content.

| Route       | Required state keys                                                                                             | Planned entries |
| ----------- | --------------------------------------------------------------------------------------------------------------- | --------------: |
| `/products` | `populated`, `loading`, `no-catalogue`, `no-filter-results`, `api-error`                                        |              30 |
| `/product`  | `loading`, `populated`, `missing-product`, `api-error`, `add-success`, `add-disabled`                           |              36 |
| `/cart`     | `loading`, `empty`, `populated`, `price-drift`, `checkout-pending`, `checkout-error`, `guest-redirect-boundary` |              42 |

For every generated ID the package reserves separate columns for production-truth source, future OpenPencil frame reference, functional evidence, deterministic visual evidence, accessibility evidence, and status. All are preparation, not migration proof. Cart shipping/delivery copy remains unresolved Wave 1 route content.

## Exact candidate files and boundaries

| File                                                                            | Later apply action | Boundary                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `docs/diseno/frontend-system-contract.md`                                       | Create             | Renderable Open Design contract and compact Wave 1 package only.                                          |
| `frontend/src/styles/tokens/semantic.css`                                       | Create             | Aliases/roles only; both themes resolve through existing tokens.                                          |
| `frontend/src/styles/base/system-primitives.css`                                | Create             | Opt-in layout/action/state/image primitives; under 250 lines.                                             |
| `frontend/src/layouts/Layout.astro`                                             | Modify             | Add two imports only; do not alter shell selection or scripts.                                            |
| `frontend/src/styles/base/reset.css`                                            | Modify             | Normal image rendering; keep square-geometry debt unchanged.                                              |
| `frontend/src/styles/components/home-shell.css`                                 | Modify             | Alias only admitted shared values with literal fallbacks.                                                 |
| `frontend/src/styles/components/home.css`                                       | Modify if needed   | Point placeholder rendering at the canonical marker/compatibility selector without visual changes.        |
| `frontend/src/styles/components/home-products.css`                              | Modify if needed   | Same narrow placeholder alias; no card/grid extraction.                                                   |
| `e2e/tests/wave0-system-contract.spec.ts`                                       | Create             | Computed token, primitive, image, focus, disabled, state, theme, and 44×44 checks.                        |
| `e2e/tests/home-responsive.spec.ts`                                             | Narrow modify      | Preserve existing light baselines; parameterize or add dark coverage without changing fixtures/viewports. |
| `e2e/tests/home-product-loading.spec.ts`                                        | Preserve/run       | Existing Home success/empty/error behavior is regression evidence.                                        |
| `frontend/src/components/Header.astro`, `Footer.astro`; Wave 1 pages/components | Preserve           | Explicitly outside Wave 0.                                                                                |

## Data flow

```text
existing theme initializer → html[data-theme] → primitive color tokens
                                             → semantic aliases
                                             → opt-in system primitives
production async state → existing route semantics/DOM → presentation class only
product image classifier → real image (normal) | explicit placeholder marker (pixelated)
repository contract → Open Design file renderer → human approval
approved contract → later OpenPencil 108-slot preparation matrix → Wave 1, not Wave 0 code
```

## TDD seams and verification

1. **RED:** browser contract tests fail while semantic imports/primitives are absent and global images remain pixelated.
2. **GREEN:** add semantic aliases and opt-in primitives; change only image default and Home aliases needed for parity.
3. **TRIANGULATE:** test real and placeholder images, primary/text actions, native/custom disabled semantics, each state kind, keyboard focus, and both themes at phone/tablet/desktop fixtures.
4. **REFACTOR:** remove duplicate declarations only when computed Home screenshots remain unchanged; do not refactor route markup.

`wave0-system-contract.spec.ts` may inject inert test elements into the loaded Home DOM to exercise shared classes without creating a product route or test-only production page. It must separately report WCAG-oriented assertions and measured 44×44 results. Existing fixed locale, timezone, DPR, reduced motion, fixtures, font readiness, and image readiness remain unchanged.

Reuse all 13 established light Home screenshots. Add equivalent dark-theme deterministic comparisons for the established matrix, retaining the same viewport names and controlled Chromium environment. Existing Home loading tests remain the authority for success, loading, empty, and error behavior. Run frontend lint/check/build plus focused Playwright suites; no Wave 1 matrix entry is executed or reported as migration evidence.

## Rollout and rollback

Deliver Wave 0 as one source-only reversible slice after the contract is approved. There is no data, API, route, or content migration. Rollback removes the two new CSS imports/files and repository contract, restores the `img` reset, and reverts Home aliases. Literal fallbacks and untouched legacy component selectors keep Home/default routes operable even during a partial revert.

Do not delete PICO/CRT/JRPG/default-shell rules in rollout. If image verification finds an unclassified intentional pixel-art consumer, add it to the compatibility register and explicit marker list rather than restoring global pixelation.

## Changed-line containment

Forecast the later apply diff before editing:

| Slice                                                             |            Budget |
| ----------------------------------------------------------------- | ----------------: |
| Repository contract, including compatibility and compact matrices |     120–140 lines |
| Semantic tokens and system primitives                             |     105–125 lines |
| Import/reset/Home alias edits                                     |       20–35 lines |
| Focused tests and dark-matrix wiring                              |      85–100 lines |
| **Forecast**                                                      | **330–400 lines** |

Tests are exempt from the 250-line source cap, but new production CSS files remain below 250 lines independently. Do not expand 108 OpenPencil rows literally; use the deterministic matrix rule. Do not edit Wave 1 route files to add markers or state classes. Before apply, count actual added and deleted lines; if the forecast exceeds 400, pause under `ask-on-risk` for an explicit delivery decision. Do not infer chaining or `size:exception`.

## Risks and safeguards

- **Cascade regression:** additive low-specificity layer before components; Home snapshots in both themes.
- **Image blast radius:** inventory known image consumers, normal-by-default reset, explicit compatibility selectors, real/placeholder computed tests.
- **False shared authority:** every admitted value appears in the classification table; unclassified values stay Home/legacy-owned.
- **Accessibility overclaim:** WCAG AA and local 44×44 results use separate headings and evidence fields.
- **External-tool fiction:** repository file is the only Wave 0 Open Design deliverable; all OpenPencil entries start `planned-not-created`.
- **Scope creep:** default shell and all three Wave 1 routes are preserve-only boundaries.

## Open questions

None. A future inability to fit the implementation within 400 changed lines is a delivery gate, not a design ambiguity.
