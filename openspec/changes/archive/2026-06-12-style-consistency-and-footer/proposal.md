# Proposal: Style Consistency and Footer Page Integration

## Intent
Modernize the website header/footer structure and fix critical styling bugs, including input/button alignment mismatch and contrast issues (yellow text on light background).

## Scope

### In Scope
- **Header Layout**: Reorganize header with Logo left (linked to homepage), search bar centered (desktop grid), and navigation/user options right (products, profile, cart, theme toggle). Theme toggle displays icon only.
- **Footer Refactor**: Remove 'Sucursales' section and point links to correct paths.
- **Placeholder Views & Routes**: Implement `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` views, routes, controllers, and EJS templates.
- **Contrast & Style System**: Define `--title-highlight` (yellow in dark mode, navy/accent in light mode) replacing hardcoded `--pico-yellow` on light backgrounds. Fix button alignment in login/registration.
- **LCD Carousel Variables**: Create `--lcd-bg` and `--lcd-fg` variables for the LCD carousel.

### Out of Scope
- Production copywriting for placeholder pages.
- Functional backend logic for search.

## Capabilities

### New Capabilities
- `footer-pages`: Covers routes, controllers, and placeholder views for terms, privacy, FAQ, step-by-step, and help pages.

### Modified Capabilities
- `css-design-system`: Add `--title-highlight`, `--lcd-bg`, `--lcd-fg` theme tokens, reorganise header layout, and strip mode text from theme toggle.
- `cart-and-forms`: Fix button/input horizontal alignment and width mismatch in forms.

## Approach
1. **Routing & Controllers**: Update `src/routes/mainRoutes.js` and `src/controllers/main/` to export new routes. Render standard EJS layouts for footer views.
2. **Tokens & Contrast**: Update `public/css/tokens/colors.css` with theme-aware custom properties (`--title-highlight`, `--lcd-bg`, `--lcd-fg`).
3. **Form Alignment**: Update `public/css/components/forms.css` to fix login/registration button margins/widths.
4. **Header/Footer Markup**: Modify `src/views/partials/header.ejs` and `src/views/partials/footer.ejs` for structural layout.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/routes/mainRoutes.js` | Modified | Registers new static/info routes |
| `src/controllers/main/` | Modified | Houses new actions for placeholders |
| `src/views/` | New | Adds terms, privacy, faq, step-by-step, help EJS files |
| `src/views/partials/` | Modified | Refactors header.ejs and footer.ejs layout |
| `public/css/tokens/colors.css` | Modified | Introduces theme token variables |
| `public/css/components/` | Modified | Updates navbar.css, footer.css, forms.css, carousel.css |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Layout shift on different screens | Low | Use PicoCSS variables and CSS flex/grid layout |

## Rollback Plan
Run `git checkout -- <modified-files>` to discard modifications. Delete newly added controller files, views, and routes.

## Success Criteria
- [ ] Footer links for terms, privacy, FAQ, step-by-step, and help render placeholder pages.
- [ ] 'Sucursales' section is removed.
- [ ] Header has logo left, search center, nav right, icon-only theme toggle.
- [ ] Contrast issues with yellow text on light backgrounds are resolved.
- [ ] Login/register form buttons align perfectly with form inputs.
- [ ] All 90 automated tests pass.

## Proposal Question Round
1. Should the placeholder pages render generic pixel-art layout or use standard text?
2. Should the search bar focus trigger any local visual feedback, or behave purely as a static input?
3. Should the theme toggle store the preference in `localStorage`, or only toggle the DOM attribute?
