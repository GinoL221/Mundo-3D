# Profile Read-only Contract

This contract defines the first safe delivery for the authenticated `/profile` surface. It closes the existing header link without inventing account-editing capabilities that the current backend does not provide.

## Decision

Implement a read-only self-profile in two slices:

1. `GET /api/users/me` derives the user identity from the verified access session.
2. Astro `/profile` renders the returned account data with the workshop-vitrine system.

No profile mutation is part of this contract.

## Quick path

1. Add the backend self endpoint behind `apiAuthMiddleware`.
2. Add a frontend profile service and `/profile` route using `authFetch`.
3. Verify guest, authenticated, refresh/retry, image fallback, and no-horizontal-overflow behaviour.

## API contract

### `GET /api/users/me`

**Authentication:** required. The endpoint MUST derive the user ID from `req.user.userId`. It MUST NOT accept an ID in the path, query string, or request body.

**Success: `200 OK`**

```json
{
  "user": {
    "idUser": 42,
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.test",
    "image": "/img/users/ada.png",
    "idRole": 2,
    "category": null
  }
}
```

The response MUST NOT include password hashes, refresh-token data, confirmation tokens, or other persistence internals. `image` MAY be `null`.

**Unauthenticated: `401 Unauthorized`**

Use the repository's existing safe API error shape. Do not disclose whether another user exists.

**Authenticated principal missing: `404 Not Found`**

Return the repository's generic user-not-found error. This is an integrity failure, not a client-selectable resource lookup.

### Security and middleware order

The route MUST use:

```text
apiAuthMiddleware → controller
```

The first phase is read-only, so CSRF protection is not required. Any future mutation MUST be a separate contract using:

```text
apiAuthMiddleware → csrfGuard → validation/upload → controller
```

## Frontend contract

### Route

`/profile` uses the shared `Layout.astro` shell and renders a visible page heading in Rioplatense Spanish. The authenticated state shows:

- first and last name;
- email;
- profile image with a safe default fallback;
- role/category only if the final UI decision confirms that they help the portfolio/evaluation surface.

The page MUST remain read-only: no edit buttons, upload input, password form, email form, or role controls.

### Guest behaviour

Direct navigation by a guest MUST NOT expose profile data. Because the current Astro app has no route-guard layer, the page should render an honest sign-in state with a link to `/login` after the API returns `401`; it must not fabricate an empty profile.

### Data and session behaviour

- Use `authFetch` so the established refresh-and-retry behaviour remains authoritative.
- Do not read `m3d_user` as the profile source of truth; it is display-session data and does not contain the complete profile.
- A successful read MUST NOT mutate cookies, local storage, roles, or cart state.
- Preserve the existing image URL resolution/fallback conventions.
- Preserve the shared shell, semantic tokens, IBM Plex Sans, visible focus, 44px targets, and no-overflow responsive behaviour.

## Explicitly out of scope

- Editing first name or last name.
- Replacing or deleting the profile image.
- Changing email address or password.
- Email-change confirmation or recovery notifications.
- Role/category changes.
- Session revocation or reauthentication flows.
- Reusing admin-only `GET /api/users/:id` for self-service.

Those capabilities require separate contracts because they change persistence, validation, CSRF, upload cleanup, session synchronisation, or account security.

## Implementation boundaries

Expected first-slice surfaces:

| Layer                     | Candidate surface                                                     | Responsibility                                                                            |
| ------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Backend port              | `UserRepositoryPort`                                                  | Add a self-profile read only if the existing `findById` boundary cannot be reused safely. |
| Backend use case          | New self-profile use case or a narrowly scoped existing read use case | Map the authenticated user to a safe DTO.                                                 |
| Backend controller/routes | `UserApiController`, `backend/src/infrastructure/routes/api/users.ts` | Derive identity from `req.user`; expose `GET /users/me` before any `/:id` route.          |
| Frontend service          | `frontend/src/domains/auth` or a dedicated profile domain             | Parse the response and map stable error states.                                           |
| Frontend route            | `frontend/src/pages/profile.astro`                                    | Render read-only states through `Layout.astro`.                                           |
| Frontend styles           | Dedicated profile surface stylesheet                                  | Replace legacy/PICO assumptions with the workshop-vitrine tokens.                         |

The exact use-case and domain placement MUST be confirmed against the repository locality rules before implementation.

## Acceptance evidence

### Backend

- [ ] `GET /api/users/me` returns `401` without a valid access session.
- [ ] An authenticated user receives only their own DTO.
- [ ] The endpoint has no user-ID input that can be substituted by the caller.
- [ ] The response excludes password, refresh-token, and confirmation-token data.
- [ ] Existing admin `GET /api/users/:id` behaviour remains unchanged.

### Frontend

- [ ] An authenticated user sees the visible Profile heading and safe account data.
- [ ] A guest sees the sign-in state and no profile data.
- [ ] Null or broken images fall back to the approved default avatar without a broken-image icon.
- [ ] Expired access follows the existing one-refresh/one-retry path.
- [ ] Mobile and desktop views have no horizontal overflow.
- [ ] Focus indicators and interactive targets remain usable at every tested width.
- [ ] The header's `/profile` link resolves to a real page.

### Required viewport evidence

At minimum, run the focused browser evidence at:

- `390×844` light and dark;
- `1280×900` light and dark.

## Current repository evidence

- `HomeHeader.astro` links authenticated users to `/profile`.
- No `frontend/src/pages/profile.astro` currently exists.
- The backend currently exposes admin-only `GET /api/users/:id`, not a self-profile endpoint.
- `UserDTO` already excludes password data and contains the safe identity fields needed for this read-only slice.
- `m3d_user` is display data, not a complete profile source of truth.

## Next decision gate

After this contract is accepted, implementation may proceed as a bounded backend-plus-frontend slice. Password, email, image, and editable-name work MUST remain separate until their own security and lifecycle contracts are approved.
