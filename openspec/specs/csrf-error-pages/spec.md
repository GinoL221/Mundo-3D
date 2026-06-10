# CSRF Error Pages

## Purpose

The CSRF error pages capability defines the rendering behavior when CSRF token validation fails on a POST request, and the dedicated Forbidden error view that all error pages share. The view must conform to the PICO-8 pixel art design system.

## Requirements

### Requirement: CSRF 403 Error Rendering

The CSRF middleware SHALL render a proper 403 Forbidden response when CSRF token validation fails, using a dedicated `403Forbidden` EJS view (or a parameterized existing error view) instead of rendering `404NotFound.ejs`.

On CSRF failure, the response:
- MUST have HTTP status 403
- MUST NOT render the `404NotFound.ejs` view
- MUST display an error message appropriate to a 403 status (e.g., "Access denied" or "CSRF token validation failed")
- MUST render using the unified `styles.css` stylesheet (PICO-8 design system)

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

- GIVEN a POST request is submitted with a `_csrf` value of different byte length than the session token (causing a `timingSafeEqual` exception)
- WHEN the CSRF middleware processes the request
- THEN the response SHALL have status 403
- AND the middleware MUST catch the exception and render the 403 error page (not propagate the error)

#### Scenario: 403 page uses consolidated stylesheet

- GIVEN the CSS consolidation is complete and all old CSS files are deleted
- WHEN the 403 error page renders
- THEN it MUST reference `styles.css` only
- AND MUST NOT reference any deleted per-page CSS file

### Requirement: 403 Error View Template

The system MUST provide a `403Forbidden.ejs` view at `src/views/403Forbidden.ejs` that renders a Forbidden error page using the PICO-8 design system, Press Start 2P headings, and VT323 body text.

#### Scenario: 403 view renders with error message

- GIVEN the `403Forbidden.ejs` template exists
- WHEN the CSRF middleware renders this view with a `message` variable
- THEN the rendered HTML SHALL display the message content
- AND the page title or heading MUST indicate "Forbidden" or "403"
- AND the heading MUST use Press Start 2P font (`--font-heading`)
- AND the body text MUST use VT323 font (`--font-body`)