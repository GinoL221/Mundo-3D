# Controller Consistency Specification

## Purpose

Defines the one-file-per-action controller pattern and view rendering convention for the main route group.

## Requirements

### Requirement: One-File-Per-Action for Main Controllers

The monolithic `mainController.js` MUST be replaced by a `src/controllers/main/` directory containing one file per action (`index.js`, etc.) and a barrel `index.js` that re-exports them.

#### Scenario: index action in separate file

- GIVEN `src/controllers/main/index.js` exists
- WHEN `main/index.js` is imported
- THEN it SHALL export an async function `index(req, res, next)` that renders the homepage

#### Scenario: barrel re-exports all actions

- GIVEN `src/controllers/main/index.js` barrel file
- WHEN a route file imports from `../controllers/main`
- THEN it SHALL receive `{ index, aboutUs }` as named exports

### Requirement: AboutUs Handled by Controller

The inline `/aboutUs` handler in `mainRoutes.js` MUST be replaced by a controller method `aboutUs` in `src/controllers/main/aboutUs.js`.

#### Scenario: aboutUs route uses controller

- GIVEN a GET request to `/aboutUs`
- WHEN the route is matched
- THEN `mainController.aboutUs(req, res, next)` SHALL be called
- AND the route file MUST NOT contain an inline `(req, res) => {}` handler

### Requirement: View Rendering Without path.join

All controllers MUST use `res.render('viewName')` with the EJS view name, NOT `res.render(path.join(__dirname, '../views/...'))`.

#### Scenario: main index renders with view name

- GIVEN the main `index` controller
- WHEN rendering the homepage
- THEN it SHALL call `res.render('index', { products })`
- AND it MUST NOT use `path.join(__dirname, ...)` for the view path

#### Scenario: aboutUs renders with view name

- GIVEN the `aboutUs` controller
- WHEN rendering the about page
- THEN it SHALL call `res.render('aboutUs')`
- AND it MUST NOT use `path.join(__dirname, ...)` for the view path
