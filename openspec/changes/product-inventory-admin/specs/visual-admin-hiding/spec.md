# Delta for Visual Admin Hiding

## REMOVED Requirements

### Requirement: Admin Navigation Controls Hiding

(Reason: Describes conditional rendering in EJS templates (`locals.userLogged.IDRole === 1`) for a "Nuevo producto" link served by the dead EJS admin web route. Confirmed orphaned — the repo has zero `.ejs` files (see admin-route-guard and csrf-error-pages deltas for the same verification). The nav link and its gating logic are superseded by the Astro-based requirement below.)
(Migration: None. Replaced by "Admin Nav Link Visibility" below.)

### Requirement: Admin Action Buttons Hiding in Views

(Reason: Same as above — describes EJS partial rendering (`locals.userLogged`) for product/user delete buttons in a template layer that no longer exists.)
(Migration: None. Replaced by "Delete Control Visibility" below.)

## ADDED Requirements

### Requirement: Admin Nav Link Visibility

`Header.astro` MUST show a navigation link to `/admin/products` only when the persisted `idRole` (read via `frontend/src/domains/auth/adapters/auth.adapter.ts` from localStorage) is `Role.ADMIN` or `Role.STAFF`. This is a presentation-layer convenience only — it MUST NOT be relied upon as the security boundary; the API's `requireRoles` guard (see admin-route-guard capability) is authoritative for authorization.

#### Scenario: ADMIN or STAFF sees the admin products link

- GIVEN a logged-in user whose persisted `idRole` is `Role.ADMIN` or `Role.STAFF`
- WHEN `Header.astro` renders
- THEN the `/admin/products` navigation link MUST be visible

#### Scenario: USER or logged-out visitor does not see the admin products link

- GIVEN a logged-out visitor, or a logged-in user whose persisted `idRole` is `Role.USER`
- WHEN `Header.astro` renders
- THEN the `/admin/products` navigation link MUST NOT be visible

### Requirement: Delete Control Visibility

Within the admin product section, the delete action/button MUST only be visible/enabled for `Role.ADMIN`. `Role.STAFF` MUST see create/edit/stock-adjust controls but MUST NOT see the delete control. This hiding is UX-only: it mirrors the backend Route Capability Matrix (STAFF receives 403 JSON from `DELETE /api/products/:id`), but the client-side check MUST NOT be treated as the security boundary — the API guard is authoritative regardless of what the UI renders.

#### Scenario: ADMIN sees delete control

- GIVEN a logged-in user whose persisted `idRole` is `Role.ADMIN`
- WHEN the admin product section renders a product row
- THEN the delete control MUST be visible and enabled

#### Scenario: STAFF does not see delete control

- GIVEN a logged-in user whose persisted `idRole` is `Role.STAFF`
- WHEN the admin product section renders a product row
- THEN the delete control MUST NOT be visible
- AND create, edit, and stock-adjust controls MUST remain visible
