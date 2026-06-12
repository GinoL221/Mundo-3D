# Tasks: Style Consistency and Footer Page Integration

## Review Workload Forecast
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Suggested Work Units
- Tasks 1.1 - 1.3: Foundation & Color Tokens
- Tasks 2.1 - 2.4: Informational Pages Implementation
- Tasks 3.1 - 3.7: Layout, Theme Toggle & Form Alignment
- Tasks 4.1 - 4.2: Verification & Testing
- Tasks 5.1: Refactoring & Cleanup

## Phase 1: Foundation / Infrastructure
- [x] 1.1 RED: Create `src/__tests__/footerPages.test.js` to assert GET requests to `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` return 200 OK and render correct EJS templates using Supertest.
- [x] 1.2 RED: Update `src/__tests__/theme.test.js` to assert the toggle icon element `.theme-toggle-btn__icon` textContent updates dynamically to `☀️` or `🌙` instead of text labels.
- [x] 1.3 Modify `public/css/tokens/colors.css` to add `--title-highlight`, `--lcd-bg`, and `--lcd-fg`. Replace yellow highlights with the dynamic highlight on light backgrounds.

## Phase 2: Core Implementation
- [x] 2.1 GREEN: Create simple page renderer controller files under `src/controllers/main/`: `terms.js`, `privacy.js`, `faq.js`, `stepByStep.js`, `help.js`.
- [x] 2.2 GREEN: Update `src/controllers/main/index.js` to import and export the newly created controllers.
- [x] 2.3 GREEN: Register `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` endpoints in `src/routes/mainRoutes.js` mapped to their controllers.
- [x] 2.4 GREEN: Create EJS views `terms.ejs`, `privacy.ejs`, `faq.ejs`, `step-by-step.ejs`, and `help.ejs` under `src/views/` containing boilerplate with head, header, and footer partials.

## Phase 3: Integration / Wiring
- [x] 3.1 Modify `src/views/partials/footer.ejs` to remove the 'Sucursales' article and map footer links to `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help`.
- [x] 3.2 Modify `src/views/partials/header.ejs` to remove text labels from the theme toggle button and reorganize header structure.
- [x] 3.3 Modify `public/js/theme.js` to change the `.theme-toggle-btn__icon` textContent dynamically to `☀️` or `🌙`.
- [x] 3.4 Modify `public/css/components/navbar.css` to implement desktop CSS Grid layout (`1fr auto 1fr`) on viewports ≥640px centering search bar, and remove icon hiding.
- [x] 3.5 Modify `public/css/components/carousel.css` to consume new LCD variables and resolve background/text contrast.
- [x] 3.6 Modify `src/views/users/login.ejs` and `src/views/users/register.ejs` to wrap form buttons inside `.form-card__actions`.
- [x] 3.7 Modify `public/css/components/forms.css` to style `.form-card__actions`, set button widths to 100%, and remove right margins.

## Phase 4: Testing / Verification
- [x] 4.1 Run the Jest test runner to verify that the newly added RED tests pass (GREEN status).
- [x] 4.2 Run the full test suite (`npm test`) to ensure zero regressions across the codebase.

## Phase 5: Cleanup / Polish
- [x] 5.1 REFACTOR: Clean up controller exports and EJS views to remove redundant code, comments, or placeholder text.
