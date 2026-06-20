# Astro Frontend Specification

This specification defines the architectural rules, file organization, routing, layouts, and component standards for the migrated Astro frontend.

## Requirements

### Requirement: Astro Project Structure and Decoupled Architecture
The Astro frontend MUST be organized in a decoupled directory structure under `/frontend` in the project root. It MUST contain distinct directories for layouts, pages, and components.

#### Scenario: Astro workspace initialization
- GIVEN the project directory structure
- WHEN the Astro frontend is compiled or built
- THEN the codebase MUST be located inside the `frontend/` directory
- AND the source files MUST follow the structure:
  - `frontend/src/pages/` for page routes
  - `frontend/src/components/` for reusable components
  - `frontend/src/layouts/` for pages layouts
  - `frontend/public/` for static assets

### Requirement: Astro Global Layout and Styling Integration
The frontend MUST utilize a reusable layout component that loads global styles from the shared Vanilla CSS stylesheet, ensuring visual consistency across all pages.

#### Scenario: Global layout imports Vanilla CSS
- GIVEN a layout file at `frontend/src/layouts/Layout.astro`
- WHEN a page uses this layout
- THEN the rendered HTML page MUST link the global stylesheet `public/css/styles.css` (or equivalent Vanilla CSS file)
- AND render pages within a unified layout header, nav, and footer structure

### Requirement: Static Page Pre-rendering (SSG)
Static pages (`/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help`) MUST be configured to pre-render at build time (SSG) to ensure rapid loading.

#### Scenario: SSG pages build static HTML files
- GIVEN the Astro build command is run
- WHEN pre-rendering static routes
- THEN Astro MUST compile `/aboutUs`, `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` into static HTML files
- AND these files MUST NOT require active backend database connections or use dynamic runtime queries on load

### Requirement: Dynamic Content Fetching
For dynamic views (such as the homepage `/` product list or product detail pages), Astro components MUST fetch JSON data from the Express REST API.

#### Scenario: Homepage renders products from API fetch
- GIVEN a client requests the homepage `/`
- WHEN the homepage component renders
- THEN the component MUST make a fetch request to `/api/products` on the Express backend
- AND parse the JSON response to render the dynamic list of product components
