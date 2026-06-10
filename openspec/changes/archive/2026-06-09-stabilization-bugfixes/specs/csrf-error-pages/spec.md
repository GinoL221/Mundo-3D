# Delta for CSRF Error Pages

## MODIFIED Requirements

### Requirement: CSRF 403 Error Rendering

The CSRF middleware SHALL render a 403 Forbidden response when CSRF token validation fails. Controller errors on POST routes (not CSRF failures) MUST propagate through `next(err)` to the global error handler, not via inline `res.status(500)` responses.

(Previously: Only specified the CSRF middleware renders a 403. Did not address controller error propagation for POST routes that passed CSRF validation.)

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

#### Scenario: 403 page uses consolidated stylesheet

- GIVEN the CSS consolidation is complete
- WHEN the 403 error page renders
- THEN it MUST reference `styles.css` only
- AND MUST NOT reference any deleted per-page CSS file

#### Scenario: Controller error on CSRF-validated POST route reaches global handler

- GIVEN a POST request passes CSRF validation successfully
- WHEN the target controller's catch block receives an unhandled error
- THEN the controller SHALL call `next(err)` (not `res.status(500).send(...)`)
- AND the global error handler SHALL produce a consistent 500 error response