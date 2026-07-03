# CSRF Error Pages

> **RETIRED**: This capability was completely removed as of the `product-inventory-admin` change (2026-07-02). The application now uses JSON+Bearer authentication exclusively — no EJS-based CSRF middleware exists, and no EJS view layer exists to render 403 error pages. This spec is archived here for historical reference only. See `sdd/product-inventory-admin/specs/csrf-error-pages/spec.md` for the removal rationale.

## Purpose

The CSRF error pages capability defines the rendering behavior when CSRF token validation fails on a POST request, and the dedicated Forbidden error view that all error pages share. The view must conform to the PICO-8 pixel art design system.

**NOTE**: This capability is superseded by the JSON 401/403 error responses defined in the admin-route-guard capability.

## Requirements

### Requirement: CSRF 403 Error Rendering

The CSRF middleware SHALL render a 403 Forbidden response when CSRF token validation fails. Controller errors on POST routes (not CSRF failures) MUST propagate through `next(err)` to the global error handler, not via inline `res.status(500)` responses.

#### Scenario: Missing CSRF token renders 403 page

- GIVEN a POST request is submitted without a `_csrf` field or `x-csrf-token` header
- WHEN the CSRF middleware processes the request
- THEN the response SHALL have status 403
- AND the response body MUST contain a message indicating access was denied due to invalid or missing CSRF token
- AND the response MUST NOT render the `404NotFound.ejs` template

#### Scenario: Invalid CSRF token renders 403 page

- GIVEN a POST request is submitted with a `_csrf` value that does not match the session token
- WHEN the CSRF middleware processes the request
- THEN the response SHALL have status 403
- AND the response body MUST contain a message indicating access was denied due to invalid CSRF token

#### Scenario: CSRF token length mismatch renders 403

- GIVEN a POST request is submitted with a `_csrf` value of different byte length than the session token
- WHEN the CSRF middleware processes the request
- THEN the response SHALL have status 403
- AND the middleware MUST catch the exception and render the 403 error page

#### Scenario: 403 page uses multi-file CSS loading

- GIVEN the CSS migration is complete
- WHEN the 403 error page renders
- THEN it MUST load CSS via multiple `<link>` tags in `head.ejs` (normalize, tokens, base, components)
- AND MUST NOT reference `styles.css`
- AND the error page content MUST use the `.error-page` BEM class

#### Scenario: Controller error on CSRF-validated POST route reaches global handler

- GIVEN a POST request passes CSRF validation successfully
- WHEN the target controller's catch block receives an unhandled error
- THEN the controller SHALL call `next(err)` (not `res.status(500).send(...)`)
- AND the global error handler SHALL produce a consistent 500 error response

### Requirement: 403 Error View Template

The system MUST provide a `403Forbidden.ejs` view at `src/views/403Forbidden.ejs` that renders a Forbidden error page using the PICO-8 design system, Press Start 2P headings, and VT323 body text. Error page styling MUST come from `components/error-pages.css`.

(Previously: Referenced `styles.css` for error page styling.)

#### Scenario: 403 view renders with error message

- GIVEN the `403Forbidden.ejs` template exists
- WHEN the CSRF middleware renders this view with a `message` variable
- THEN the rendered HTML SHALL display the message content
- AND the page title or heading MUST indicate "Forbidden" or "403"
- AND the heading MUST use Press Start 2P font (`--font-heading`)
- AND the body text MUST use VT323 font (`--font-body`)