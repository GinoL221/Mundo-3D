# Footer Pages Specification

## Purpose
Define routes, controllers, and EJS views for info pages, and clean up the footer.

## Requirements

### Requirement: Informational Routes and Views
The system MUST define `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` routes, each rendering its corresponding EJS view.

#### Scenario: Requesting footer pages
- GIVEN a client requests `/terms`
- WHEN the route is handled
- THEN the response MUST render `terms.ejs` with status 200

#### Scenario: Layout consistency
- GIVEN an informational page renders
- WHEN inspecting the DOM structure
- THEN the layout MUST include head, header, and footer partials

### Requirement: Footer Navigation Clean-up
The footer MUST NOT display the 'Sucursales' section, and footer links MUST target the newly created routes.

#### Scenario: Sucursales section removal
- GIVEN the footer component rendering
- WHEN inspecting the HTML content
- THEN the 'Sucursales' section MUST NOT be found

#### Scenario: Correct footer links
- GIVEN the footer links are rendered
- WHEN clicking on 'Términos y condiciones'
- THEN the link target MUST point to `/terms`
