# Design: Header Browser-Behavior Modularization

## Technical Approach

Keep `Header.astro` markup and its processed client `<script>` as the browser entry point. Replace the mixed inline behavior with four explicit initializers under `frontend/src/scripts/`. Initializers receive browser dependencies at call time, so modules have no SSR-time DOM or storage access. `Layout.astro` remains the owner of pre-paint theme/CRT application; Header modules hydrate controls after the markup exists.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Four concern modules | Adds `cartBadge.ts`, but leaves Header as markup plus wiring and isolates reactive state | Choose; matches approved boundaries |
| Separate logout module | Smaller theoretical responsibility, but adds wiring and risks changing auth/cart ordering | Reject; logout stays with session UI |
| Module side effects at import | Less wiring, but unsafe for SSR and hard to test | Reject; use explicit initialization |
| Permanent subscriptions | Matches today’s full-page lifecycle, but leaks if navigation later swaps DOM | Reject; return idempotent cleanup and unsubscribe |

## Data Flow

```text
Layout inline head script ──→ html theme/CRT state (before paint)
Header processed script ──→ themeToggle / crtToggle / sessionUI / cartBadge
storage + session-changed ──→ sessionUI ──→ visibility, greeting, avatar
toggle click ──→ storage + html state + icon
CartService ──→ cartItems ──→ cartBadge ──→ #navbar-cart-badge
logout ──→ clearSession ──→ CartService.clearCart ──→ /login
```

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/scripts/sessionUI.ts` | Create | Session rendering, corrupt-storage reset, logout, and `storage`/`session-changed` listeners. |
| `frontend/src/scripts/themeToggle.ts` | Create | `theme` hydration, normalization, persistence, document attribute, and icon. |
| `frontend/src/scripts/crtToggle.ts` | Create | `retro-theme-preference` hydration, persistence, class, and icon. |
| `frontend/src/scripts/cartBadge.ts` | Create | Cart load, distinct-item badge rendering, Nano Store subscription, and cleanup. |
| `frontend/src/components/Header.astro` | Modify | Preserve markup; import and call the four initializers explicitly. |
| `frontend/src/scripts/header-modules.test.ts` | Create | Focused Vitest coverage using the existing `vi.stubGlobal` style and a small DOM fixture. |
| `e2e/tests/header.spec.ts` | Create | One focused persisted-preference/first-paint regression; existing `auth.spec.ts` already verifies `/login`. |
| `frontend/src/layouts/Layout.astro` | Unchanged | Its `is:inline` anti-flash script remains untouched. |

## Interfaces / Contracts

```ts
type Cleanup = () => void;

initializeSessionUI(document: Document, window: Window, storage: Storage): Cleanup;
initializeThemeToggle(document: Document, storage: Storage): Cleanup;
initializeCrtToggle(document: Document, storage: Storage): Cleanup;
initializeCartBadge(document: Document): Cleanup;
```

Each module owns its selectors and DOM queries. Each initializer keeps a module-local `WeakMap<Document, Cleanup>`: duplicate calls return the existing cleanup, cleanup is safe to call repeatedly, and cleanup removes event listeners or the Nano Store unsubscribe before clearing the guard. `cartBadge` preserves `loadCartFromStorage()` → initial render → `cartItems.subscribe()`; `CartList` remains an independent subscriber. No Astro lifecycle hooks are added because the current app has no view transitions; cleanup is defensive for future DOM replacement.

`sessionUI` depends on `hasAdminAccess`, `clearSession`, and `CartService.clearCart` only. Logout must prevent the anchor default, remove `token` then `user`, clear the cart, and finally assign `/login`. Theme/CRT modules depend only on DOM and storage. `cartBadge` depends on `cartItems` and `CartService.loadCartFromStorage`; no domain module imports these scripts.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Vitest | Session states/events, logout order, visual defaults/invalid normalization/toggles, cart count/empty behavior | One compact fixture; spy storage, DOM listeners, `CartService.clearCart`, and store unsubscribe. Include duplicate-init/cleanup and verify search remains handler-free. |
| Playwright | Layout first-paint boundary | Seed both preferences before navigation and assert the document state from the focused header test; do not add broad navigation coverage. |
| Existing E2E | Registration, login, invalid credentials, logout as guest | Run `e2e/tests/auth.spec.ts`; it already asserts `/login` and Header guest state. |

This maps the 14 acceptance/lifecycle cases to nine focused module/visual cases, one duplicate-init case, and the four existing auth cases. Forecast: approximately 285–315 authored production lines plus 65–80 authored test lines, or 350–395 changed lines total. `Decision needed before apply: No`; `Chained PRs recommended: No`; `400-line budget risk: Medium`. If implementation exceeds 400, stop and ask before continuing.

## Threat Matrix

N/A — no routing implementation, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is changed. The existing `/login` browser redirect is preserved.

## Migration / Rollout

No migration required. Rollback is a single revert of Header wiring and the four scripts (plus focused tests); `Layout.astro`, storage keys, cart data, and runtime APIs remain unchanged.

## Open Questions

None; module count, `/login` behavior, Layout ownership, and the 400-line guard are approved.
