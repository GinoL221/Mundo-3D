# Proposal: Header Browser-Behavior Modularization

## Intent

Reduce the mixed responsibilities in `Header.astro` without changing the user-visible Header contract. Extract browser behavior into four focused modules while correcting the stale logout expectation to the already-approved `/login` destination.

## Scope

### In Scope

- Extract `sessionUI.ts`, `themeToggle.ts`, `crtToggle.ts`, and `cartBadge.ts` under `frontend/src/scripts/`.
- Keep logout in `sessionUI.ts` with the exact ordering: remove `token`/`user` → `CartService.clearCart()` → redirect to `/login`.
- Preserve Header markup, selectors, IDs/classes, storage keys, events, defaults, first-paint behavior, accessibility semantics, and the visual-only search.
- Align the stale E2E/OpenSpec logout expectation with `/login`; add only focused behavioral tests needed within the 400 authored-line budget.

### Out of Scope

- Any markup, styling, accessibility, search behavior, or dropdown interaction changes.
- Moving or altering `Layout.astro`’s inline pre-paint theme/CRT initialization.
- New product behavior, broader E2E coverage, cart-domain changes, or a separate logout module.

## Capabilities

### New Capabilities

- None; this is a modularization of existing behavior.

### Modified Capabilities

- `navbar-and-footer`: preserve Header session and navigation behavior, including the existing logout control ownership.
- `retro-visual-theme`: preserve theme and CRT toggle behavior, defaults, persistence, and first-paint contract.
- `nano-stores-cart`: preserve the reactive Header cart badge behavior and Nano Stores integration.
- `e2e`: change only the logout destination verification from `/` to the approved `/login` contract.

## Approach

Keep the existing processed Astro `<script>` as the browser entry point. Import and explicitly initialize the four modules there; do not import browser modules from Astro frontmatter or alter the `is:inline` Layout script. Preserve existing DOM/event/storage contracts and the cart store subscription. Keep auth transition logic and its cart-clear dependency together so token removal precedes cart clearing. Module extraction and explicit initialization are architecture/design concerns, not product capability requirements.

## Affected Areas

| Area                                                     | Impact                | Description                                                                           |
| -------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| `frontend/src/components/Header.astro`                   | Modified              | Retains markup and wires module initialization.                                       |
| `frontend/src/scripts/*.ts`                              | New                   | Four browser-behavior boundaries.                                                     |
| `frontend/src/layouts/Layout.astro`                      | Unchanged             | Pre-paint theme/CRT initialization remains inline.                                    |
| `frontend/src/domains/auth`, `frontend/src/domains/cart` | Preserved integration | Existing service, storage, event, and Nano Store contracts remain intact.             |
| `openspec/specs/navbar-and-footer/spec.md`               | Modified              | Header session and navigation behavior remains owned by the navbar/header capability. |
| `openspec/specs/retro-visual-theme/spec.md`              | Modified              | Theme and CRT behavior remains owned by the retro visual theme capability.            |
| `openspec/specs/nano-stores-cart/spec.md`                | Modified              | Header cart badge behavior remains owned by the Nano Stores cart capability.          |
| `openspec/specs/e2e/spec.md`                             | Modified              | Only the logout verification expectation changes to `/login`.                         |

## Risks

| Risk                                               | Likelihood | Mitigation                                                                        |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| Initialization or logout ordering changes behavior | Med        | Explicit initialization and focused tests for ordering, defaults, and events.     |
| SSR/browser lifecycle regression or theme flash    | Low        | Keep imports in processed Header script and leave Layout inline script unchanged. |
| Review scope exceeds 400 authored lines            | Med        | Include production and tests in one budget; defer broad E2E coverage.             |

## Rollback Plan

Revert the modularized Header wiring and the four new modules, then restore the prior E2E expectation only if `/login` is rejected. No persisted data migration is required.

## Dependencies

- Existing Astro processed-script bundling, `session.service.ts`, `CartService`, Nano Stores, and current Vitest setup.

## Success Criteria

- [ ] Header behavior and accessibility remain equivalent, including theme/CRT defaults, cart badge updates, session visibility, and visual-only search.
- [ ] Logout removes auth storage, clears the cart, and redirects to `/login` in that order.
- [ ] `Layout.astro` still prevents first-paint theme/CRT flash.
- [ ] Authored production and test changes remain at or below 400 changed lines.
