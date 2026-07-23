## Exploration: header-modularization

### Current State

`frontend/src/components/Header.astro` contains the complete navbar markup plus a processed Astro `<script>` of roughly 166 lines. The script currently combines five responsibilities: session hydration and role-based visibility, logout, light/dark theme hydration and toggling, CRT preference hydration and toggling, and the Nano Stores cart badge.

The search bar is explicitly visual-only: its input and button have accessible labels, but no behavior. It must remain unchanged. `Layout.astro` also contains a separate `is:inline` head script that applies the stored `theme` and `retro-theme-preference` before first paint. That anti-flash script is a distinct browser-lifecycle concern and must not be moved into the extracted modules.

Astro's default component scripts are processed, support TypeScript and imports, are bundled/deduplicated, and may be automatically inlined when small. Therefore `Header.astro` can import browser modules from `frontend/src/scripts/` through its existing processed `<script>`. The modules must not be imported from Astro frontmatter, and the `Layout.astro` `is:inline` script must remain inline.

### Affected Areas

- `frontend/src/components/Header.astro` — current markup, DOM selectors, script ordering, and all behavior being split.
- `frontend/src/layouts/Layout.astro` — first-paint theme/CRT initialization; must remain behaviorally independent and unchanged.
- `frontend/src/domains/auth/components/LoginForm.astro` — stores `token` and `user`, dispatches `session-changed`, then redirects to `/`.
- `frontend/src/domains/auth/components/RegisterForm.astro` — same session storage/event contract as login.
- `frontend/src/domains/auth/services/session.service.ts` — shared `hasAdminAccess` and `clearSession` behavior; Header currently only imports `hasAdminAccess`.
- `frontend/src/domains/cart/services/CartService.ts` — Nano Store state, `cart` storage, `clearCart()`, and cart persistence events.
- `frontend/src/domains/cart/components/CartList.astro` — independently loads the cart and subscribes to the same store on the cart page.
- `frontend/src/styles/components/navbar.css`, `frontend/src/styles/base/layout.css`, `frontend/src/styles/components/product-card.css` — selectors depend on the existing IDs/classes and `crt-theme-active` class.
- `frontend/package.json`, `frontend/astro.config.mjs`, `frontend/tsconfig.json` — Vitest test command and default Astro/TypeScript bundling configuration.
- `frontend/src/domains/auth/services/session.service.test.ts`, `frontend/src/domains/cart/services/CartService.test.ts` — existing service-level test patterns; no Header coverage exists.
- `openspec/specs/navbar-and-footer/spec.md`, `openspec/specs/retro-visual-theme/spec.md`, `openspec/specs/e2e/spec.md`, `openspec/specs/nano-stores-cart/spec.md` — behavior boundaries and one notable logout redirect inconsistency.

### Evidence and Responsibility Map

| Responsibility | Current contract | Recommended boundary |
|---|---|---|
| Session UI | Reads `token`/`user`; toggles `.guest-only`, `.user-only`, `.admin-only`; supports `firstName`/`FirstName` and `image`/`Image`; calls `hasAdminAccess`; cleans corrupt auth storage | `scripts/sessionUI.ts` |
| Logout | `#navbar-logout` is an anchor; prevents default; removes auth storage, then calls `CartService.clearCart()`, then redirects to `/login` | Keep with session transition in `sessionUI.ts`; preserve the removal-before-clear order. Do not combine it with cart badge rendering. |
| Theme toggle | `theme` key, default `dark`; sets `html[data-theme]`; toggles `light`/`dark`; updates `.theme-toggle-btn__icon` | `scripts/themeToggle.ts` |
| CRT toggle | `retro-theme-preference` key, default `enabled`; toggles `html.crt-theme-active`; updates `.crt-toggle-btn__icon` | `scripts/crtToggle.ts` |
| Cart badge | `cartItems.get().length` (distinct product count, not quantity sum); hides when zero; calls `CartService.loadCartFromStorage()` and subscribes to the store | Prefer a separate `scripts/cartBadge.ts`; otherwise this responsibility remains in Header and the split is incomplete. |
| Search | No event handler; visual-only input/button | Remain in Header unchanged and out of scope |

Observed DOM/event/storage contracts that must remain stable:

- IDs/classes: `navbar-greeting`, `navbar-avatar`, `navbar-logout`, `theme-toggle`, `theme-toggle-btn__icon`, `crt-toggle`, `crt-toggle-btn__icon`, `navbar-cart-badge`, `.guest-only`, `.user-only`, `.admin-only`.
- Storage keys: `token`, `user`, `theme`, `retro-theme-preference`, and `cart` through `CartService`.
- Events: `storage` and `session-changed` update session UI; `CartService` emits `cart-updated`, while the Header badge reacts directly to the Nano Store subscription.
- Defaults: dark theme and enabled CRT. Invalid theme values normalize to the dark DOM state in Header; non-`enabled` CRT values disable the class.
- `Layout.astro` must continue applying the saved theme/CRT state before body paint. Extracted modules should hydrate controls only.
- Current accessibility semantics must stay unchanged: search button is `type="button"` with `aria-label`, theme/CRT controls are buttons with labels, logout is a keyboard-activatable anchor with `preventDefault`, and the dropdown remains governed by CSS `:hover`/`:focus-within`. Adding `aria-pressed`, relabeling, or changing logout to a button would be a separate behavior/accessibility change.

### Approaches

1. **Strict three-module extraction** — Move session/logout to `sessionUI.ts` and theme/CRT logic to the two proposed toggle modules, while leaving cart badge code in `Header.astro`.
   - Pros: exactly matches the candidate file list; lowest change surface; preserves the cart integration locally.
   - Cons: Header still owns a stateful behavior; cart is not a clear module boundary; future changes still require editing Header.
   - Effort: Low

2. **Four-concern extraction** — Use the three proposed modules and add `scripts/cartBadge.ts`; keep logout in `sessionUI.ts` because it is an authentication transition whose existing side effect clears the cart.
   - Pros: Header becomes markup plus explicit initialization; cart badge is separated from session UI; each browser concern is independently testable; preserves the existing logout order and store contract.
   - Cons: Adds one small module beyond the candidate list; `sessionUI.ts` still depends on `CartService` for the required logout side effect.
   - Effort: Medium

3. **Pure session UI plus separate logout module** — Keep session rendering in `sessionUI.ts` and create a dedicated logout module, with cart badge separate as well.
   - Pros: smallest conceptual responsibility per module.
   - Cons: three new session-related boundaries for one handler; more wiring and test surface without reducing the cross-domain cart-clear requirement; higher risk of changing event/order behavior.
   - Effort: Medium

### Recommendation

Approach 2 is the soundest modularization. The proposed three-way split is conceptually correct, but it omits the cart badge, which is a separate reactive concern and should not be folded into session UI. Logout should remain with session UI rather than with the badge: it is triggered by an auth control, but its cart-clearing side effect must remain explicit and ordered as `remove token/user` → `CartService.clearCart()` → redirect. If the change must be limited strictly to the three named files, use Approach 1 and record that the cart badge remains intentionally in Header.

Each extracted module should expose an initialization function called by the existing processed Header script, rather than relying on unstructured top-level side effects. This preserves browser-only execution, makes execution order explicit, and avoids accidentally moving code into SSR/frontmatter. Keep the existing markup, selectors, labels, storage keys, events, defaults, and `Layout.astro` anti-flash script unchanged. Preserve the search bar as visual-only.

### Risks

- **Logout redirect mismatch:** current Header redirects to `/login`, while `openspec/specs/e2e/spec.md` says logout redirects to `/`. Behavior-preserving refactoring should keep `/login`, but this requires product/requirements confirmation before proposal.
- **Logout ordering regression:** clearing the cart before removing the token would cause `CartService.clearCart()` to attempt an authenticated backend sync; the current order prevents that.
- **Astro execution/lifecycle changes:** importing browser modules from frontmatter or changing `is:inline` behavior could access browser globals during SSR or reintroduce theme flash. The app currently has no view-transition setup, so do not add lifecycle complexity in this refactor.
- **Duplicate initialization:** `Layout.astro` and Header both initialize theme/CRT state, and `CartList.astro` independently loads/subscribes to the cart. Do not remove either existing initialization without a separate behavior change.
- **Silent browser-storage behavior:** Header currently uses unguarded `localStorage` access, while service helpers are more defensive. Adding new error handling may change behavior; preserve current behavior unless explicitly scoped.
- **Accessibility drift:** changing element types, labels, dropdown behavior, or toggle semantics while extracting logic would expand scope beyond modularization.
- **Spec drift:** existing navbar specs refer to `.cart-badge`, while the live markup uses `.cart-link__badge`; preserve the live selector unless a separate spec/UI change is approved.

The expected production refactor can remain below the 400 changed-line review budget: approximately 280–330 authored additions/deletions for the four-concern split, depending on how much wiring is retained in Header. Focused tests should be budgeted explicitly; broad new E2E coverage could push the total over the limit. No production code or tests were changed during this exploration.

### Open Product Questions

- Should this change permit the additional `scripts/cartBadge.ts`, or must it be limited strictly to the three proposed modules?
- Should the behavior-preserving implementation retain the current `/login` logout redirect, despite the E2E spec's `/` expectation?
- Does the 400-line budget apply only to the production refactor, or also to new focused tests added in the implementation phase?

### Ready for Proposal

Yes, after the orchestrator obtains decisions on the three open questions above. The proposal should explicitly mark the search bar, markup/accessibility changes, and logout redirect correction as out of scope unless the user expands the change.
