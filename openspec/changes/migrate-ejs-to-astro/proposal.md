# Proposal: Migrate EJS to Astro

## Intent

Migrate server-rendered EJS frontend to Astro to decouple presentation from backend business logic, refactoring Express into a headless JSON REST API.

## Scope

### In Scope
- Bootstrap Astro frontend root directory.
- Port EJS templates/partials to Astro components.
- Import Vanilla CSS globally in Astro layout.
- Pre-render static pages (`/aboutUs`, `/help`, `/faq`) via SSG.
- Async, non-blocking cart sync via Nano Stores.
- Migrate authentication to JWT-based API endpoints.
- Update Express routes/controllers to output JSON.
- Refactor integration/controller tests to verify JSON instead of HTML.
- Handle multipart image uploads from Astro via fetch.

### Out of Scope
- Modifying core domain/business logic.
- Introducing CSS frameworks like Tailwind.

## Capabilities

### New Capabilities
- `astro-frontend`: Astro codebase structure, routing, and component system.
- `nano-stores-cart`: Client-side cart state and non-blocking API synchronization.

### Modified Capabilities
- `user-auth`: Replace session-cookie-based auth with client-side JWT management.
- `api-jwt-auth`: Protect all user write and private backend endpoints with Bearer JWT tokens.
- `static-pages-controller`: Retire Express static page rendering in favor of SSG in Astro.
- `upload-middleware`: Accept multipart form data uploads triggered via client-side fetch.

## Approach

Implement a Split Monorepo. Express serves as a headless API at `/api`. Astro frontend runs as a decoupled app that pre-renders static assets and dynamically requests data from Express. Vanilla CSS in `public/css/` is imported globally in Astro. Client handles auth by requesting `/api/users/login` and attaching the Bearer JWT token to authorized requests.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app.js` | Modified | Disable EJS view engine and EJS view routes. |
| `src/infrastructure/controllers/` | Modified | Refactor controllers to output JSON. |
| `src/infrastructure/routes/` | Modified | Mount refactored REST endpoints. |
| `src/views/` | Removed | Deprecate EJS files. |
| `src/__tests__/` | Modified | Adapt integration tests to verify JSON. |
| `frontend/` | New | Astro project containing components and views. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JWT session leakage | Med | Store JWT securely and validate expiration. |
| Image upload payload mismatch | Low | Validate multipart boundaries on Astro fetch payload. |

## Rollback Plan

Revert git changes to restore `app.js` configuration, restore deprecated EJS files in `src/views/`, and revert controller response format from JSON back to view rendering.

## Dependencies

- Astro CLI (`astro`)
- `@nanostores/preact` or `@nanostores/react` (as needed for Astro state)

## Success Criteria

- [ ] Astro project builds successfully.
- [ ] Static pages pre-render via SSG.
- [ ] Cart updates sync asynchronously via Nano Stores.
- [ ] Express endpoints secure routes via JWT.
- [ ] Restructured backend tests pass successfully.
