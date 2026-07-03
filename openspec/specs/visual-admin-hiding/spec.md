# Visual Admin Hiding Specification

## Purpose

Defines the conditional rendering of administrative controls in the Astro frontend, ensuring standard and staff users do not see options restricted to their role by the backend API, and specifying the role-based visibility for admin navigation links and action controls.

## Requirements

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
