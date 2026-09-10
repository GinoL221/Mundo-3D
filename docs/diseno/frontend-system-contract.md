---
title: Frontend system contract
status: approved
open_design_project: 46d18005-747c-4a86-8bfb-fc2cd9fab6c0
repository_path: docs/diseno/frontend-system-contract.md
wave: 0A
---

# Frontend system contract

## Authority and boundary

Home and `docs/diseno/manual-identidad.md` are visual authority; `PRODUCT.md` and `DESIGN.md` constrain implementation. Open Design owns this repository-rendered contract, OpenPencil owns future compositions, Astro owns production semantics/content/behavior/data/routing, Impeccable audits refinement, and verification owns evidence. No external design-system artifact is adopted. Wave 0A changes only this contract, semantic roles, opt-in primitives, their imports, and foundation evidence; routes, default Header/Footer, APIs, routing, data, and state behavior remain preserve-only.

## Admission ledger

| Home-derived value                                       | Classification     | Wave 0 treatment                           |
| -------------------------------------------------------- | ------------------ | ------------------------------------------ |
| paper, surface, ink, border, blue, link, danger text     | shared             | theme-resolving `--sys-*` aliases          |
| IBM Plex Sans; 40px display; 16px body; 8px rhythm       | shared             | role aliases, no scale replacement         |
| 1104px frame, 16px gutter, 75ch prose, 44px target       | shared             | opt-in public-storefront roles             |
| 640px/1024px vocabulary                                  | shared             | document only; queries stay content-driven |
| 280px cards, fluid hero, 18ch title, featured dimensions | Home-only          | retain Home ownership                      |
| commission colors, 6px/4px radii, dropdown shadow        | Home-only/legacy   | no shared promotion                        |
| PICO, CRT/JRPG, square geometry                          | compatibility debt | preserve with no semantic equivalent       |

## Semantic contract

`semantic.css` aliases primitive ownership: `--sys-page-bg`, `--sys-surface`, `--sys-text`, `--sys-text-muted`, `--sys-border`, `--sys-action-bg`, `--sys-action-text`, `--sys-action-text-link`, `--sys-danger-text`, `--sys-focus`, font/text/space roles, `--sys-frame-max`, `--sys-frame-gutter`, `--sys-prose-max`, and `--sys-target-min`. Light and dark resolve through existing color tokens. No Home-only or legacy value becomes a system token.

`system-primitives.css` supplies only `.system-frame`, `.system-section`, `.system-prose`, `.system-action` (`--primary`, `--text`), `.system-state` (`--loading`, `--empty`, `--error`, `--status`), visible `:focus-visible`, disabled presentation, and `[data-image-rendering="pixel-art"]`. These are opt-in presentation hooks, never route selectors or CSS-created semantics; no global radius, shadow, gradient, or glow exists.

## State and accessibility contracts

| State    | Required markup/behavior                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| loading  | truthful text, affected region `aria-busy`; polite status only for announced transitions                      |
| empty    | labelled/heading region, truthful absence and next action                                                     |
| error    | recovery text; newly occurring actionable failure may use `role="alert"`                                      |
| disabled | native `disabled` preferred; custom control requires `aria-disabled`, blocked activation, and keyboard parity |
| status   | visible outcome and polite live status when asynchronous                                                      |

### WCAG 2.2 AA ledger

| Evidence                                    | 0A result                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| keyboard, name/role/value, status semantics | focused injected-DOM contract coverage                                                |
| visible focus and applicable contrast       | light/dark computed roles; adjacent-background contrast remains consumer verification |

### Local 44×44 CSS-pixel ledger

| Evidence                             | 0A result                                       |
| ------------------------------------ | ----------------------------------------------- |
| primary and text action width/height | focused injected-DOM coverage in light and dark |

The 44×44 policy is local and is not represented as a WCAG exception or minimum.

## Legacy debt and rollback

`--pico-*` remains for legacy components; CRT/JRPG, default shell, square geometry, and placeholder selectors remain with their owners. A debt item requires refreshed consumer search, approved owner wave, and passing route evidence before removal. Reverting 0A removes these two imports/files and this contract while leaving legacy imports and consumers operational; no data, API, routing, or content rollback occurs.

## Wave 1 preparation (planned-not-created)

Fixtures are phone `375×812`, tablet `768×1024`, desktop `1280×900`, in light and dark. Deterministically generate `{route}--{state}--{theme}--{viewport}` for each state × 3 viewports × 2 themes: `/products` (`populated`, `loading`, `no-catalogue`, `no-filter-results`, `api-error`) = 30; `/product` (`loading`, `populated`, `missing-product`, `api-error`, `add-success`, `add-disabled`) = 36; `/cart` (`loading`, `empty`, `populated`, `price-drift`, `checkout-pending`, `checkout-error`, `guest-redirect-boundary`) = 42. **Total: 108 entries, all `planned-not-created`**, each reserving production truth, OpenPencil reference, functional, visual, accessibility, and status evidence. They are preparation only, never Wave 1 migration proof.
