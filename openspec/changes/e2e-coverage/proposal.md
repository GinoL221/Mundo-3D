# Proposal: Broader E2E Coverage

## Intent

P2 tech debt (#5774). Playwright covers auth happy paths, cart, header, and 3D specs. Three user-visible areas have **zero** E2E coverage, and each is where a silent regression would be most expensive:

1. **Admin product management** — the only privileged, destructive, non-idempotent surface in the app. Role gating is enforced twice (client `hasAdminAccess`/`isAdminOnly`, server `requireRoles(ADMIN, STAFF)`/`adminGuard`). Only a real browser proves the two agree.
2. **Registration failure paths** — `auth.spec.ts` only asserts success. Duplicate email and missing image are the two rejections a real user actually hits.
3. **Product listing/detail error & empty states** — `products.astro` and `product.astro` ship dedicated error/empty DOM branches that nothing exercises; they can rot undetected.

## Scope

### In Scope
- `admin-products.spec.ts`: role visibility (admin sees, staff sees, regular user and guest do not), create/edit/delete CRUD, destructive delete confirm dialog, stock-adjust in-flight double-click guard, 401-mid-session redirect.
- Registration failure cases appended to `auth.spec.ts`: duplicate email (400) and missing image (400 `"Tienes que subir una imagen"`), asserted through the frontend's error surface, not the raw API.
- `product-states.spec.ts`: listing error state, listing empty state, detail error for invalid/nonexistent id.
- A STAFF fixture user — none exists today (`users.json` seeds only ADMIN and regular USER).

### Out of Scope
- Authenticated cart resync on new session (already covered by unit/integration tests).
- Payment/checkout completion, search, filtering, pagination — these features do not exist.
- Rate-limiter behavior.
- Additional WebGL/3D assertions beyond `product-3d-specs.spec.ts`.
- Any production code change. Tests only; a failing test becomes a separate change.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `e2e`: adds required admin-CRUD, registration-rejection, and error/empty-state verification to the E2E contract.

## Approach

Three independent spec files, one per area, reusing the existing `storageState` login pattern from `auth.spec.ts`. Role fixtures come from the seeded users; the missing STAFF user is added where the E2E-only "Luigi" product already is (`test-prepare.js`), so production seed data stays untouched. Error and empty states are driven by route interception (`page.route`) rather than by breaking the backend, keeping the suite deterministic under `workers: 1`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `e2e/tests/admin-products.spec.ts` | New | Role gating + CRUD + destructive/non-idempotent guards |
| `e2e/tests/auth.spec.ts` | Modified | Duplicate-email and missing-image rejections |
| `e2e/tests/product-states.spec.ts` | New | Listing/detail error and empty states |
| `backend/src/database/test-prepare.js` | Modified | Seed a STAFF (role 3) fixture user |
| `openspec/specs/e2e/spec.md` | Modified | Delta spec |
| `frontend/src/pages/admin/products/*.astro` | Possible | Stable test hooks only if selectors prove unusable |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Admin CRUD mutates shared seed data and leaks across tests | High | Each test creates and cleans its own product; never edit or delete seeded rows |
| Registration tests trip the rate limiter | Med | Unique emails per run; keep rejection tests few |
| Double-click stock guard is timing-dependent | Med | Intercept and hold the PATCH to control in-flight window; no `waitForTimeout` |
| Asserting Spanish copy makes tests brittle | Med | Prefer stable ids/roles; assert copy only where it is the contract |
| STAFF fixture drifts from production role semantics | Low | Fixture mirrors `Role.STAFF = 3` from `auth.adapter.ts` |
| PR #1 alone approaches the 400-line review budget | Med | Ship as three independent PRs (see below) |

## Delivery Forecast

Three independent PRs — no stacking needed, since the spec files share no code:

1. `admin-products.spec.ts` + STAFF fixture (largest, ~250–350 lines)
2. registration rejection cases (~60–90 lines)
3. `product-states.spec.ts` (~100–150 lines)

- Decision needed before apply: Yes
- Chained PRs recommended: No — independent PRs
- 400-line budget risk: Medium

## Rollback Plan

Per-PR revert. Test-only, so reverting removes coverage and changes no runtime behavior. The `test-prepare.js` STAFF fixture is recreated on every `db:test:prepare` run and touches only the test database.

## Dependencies

- Existing Playwright harness (`workers: 1`, `fullyParallel: false`) and MySQL test DB via `db:test:prepare`.
- CI `e2e` job already gates on Playwright; no new infrastructure.

## Success Criteria

- [ ] Admin product area is invisible and unreachable for guest and regular user, visible for ADMIN and STAFF, with delete visible only for ADMIN.
- [ ] Create, edit, and delete of a product each verified end-to-end, including the delete confirm dialog.
- [ ] A double-clicked stock adjust is blocked at the client while the first request is in flight (second click has no additional effect); backend atomicity is explicitly out of scope (known tech debt).
- [ ] A session expiring mid-flow redirects instead of silently failing.
- [ ] Duplicate-email and missing-image registrations surface an error and do not create a user.
- [ ] Listing error, listing empty, and detail error states each render their branch.
- [ ] `pnpm test:e2e` green across 3 consecutive runs (no flakes); no production code changed.

## Resolved Decisions (verified against source, no longer open)

1. **STAFF is a real role**, not aspirational — `Role.STAFF = 3` gates products/categories/franchises routes consistently (`requireRoles(Role.ADMIN, Role.STAFF)`) and is documented in `product.admin.service.ts`/`session.service.ts`. Only a test fixture is missing. STAFF visibility cases stay in scope.
2. **Double-clicked stock adjust**: the backend explicitly accepts non-idempotency as known tech debt (see comment in `AdjustProductStockUseCase.ts`: "partial mitigation... does not prevent a double-applied delta"). The frontend compensates with a client-side in-flight guard (`index.astro`'s stock +/- handler disables/ignores clicks while a request is pending). The E2E test asserts **the client-side guard** (second click during an in-flight request has no additional effect), not backend-level atomicity. Success criterion reworded accordingly.
3. **Delete vs. product-in-cart**: no such rule exists anywhere (`DeleteProductUseCase.execute` deletes unconditionally). Nothing to assert beyond the confirm dialog and successful deletion — dropped from scope.
4. **401 mid-session in admin editor**: behavior is already unambiguous — `handleUnauthorized()` calls `clearSession()` and does a silent `window.location.href = '/login'` redirect, no message, no form preservation. Assert exactly that.
5. **Spanish error copy stability**: kept as the proposal's own default — assert stable ids/roles/DOM structure; assert copy text only where the string itself is the contract (e.g. the specific 400 messages already covered by controller tests).
