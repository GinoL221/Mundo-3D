# Design: Style Consistency and Footer Page Integration

## Technical Approach

We will modernize the header navigation, implement the `footer-pages` capability, introduce theme variables, and correct form button alignment issues.

1. **Header Grid**: Change `.navbar__inner` on desktop (`@media (min-width: 1024px)`) to a 3-column CSS Grid: `grid-template-columns: 1fr auto 1fr;`. Center the search bar in the middle column, keep the logo left-aligned (`justify-self: start`), and group all nav/user elements on the right (`justify-self: end`).
2. **Icon-only Theme Toggle**: Remove text labels from EJS and update `theme.js` to dynamically change the `.theme-toggle-btn__icon` textContent between `☀️` and `🌙`.
3. **Footer Cleanup & Informational Routes**: Remove the 'Sucursales' article from `footer.ejs`. Map `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help` in `mainRoutes.js` using modular controllers under `src/controllers/main/` and render EJS layouts.
4. **Theme Tokens & Carousel**: Add custom CSS properties `--title-highlight`, `--lcd-bg`, and `--lcd-fg` to `colors.css`. Update `.carousel--lcd` to use these tokens for LCD styles (background, borders, text, hovers).
5. **Form Button Consistency**: Use a flex container `.form-card__actions` to wrap buttons, ensuring they scale correctly to 100% of the inputs' width.

---

## Architecture Decisions

| Decision | Choice | Alternatives Considered | Rationale |
| :--- | :--- | :--- | :--- |
| **Header Layout** | CSS Grid (`1fr auto 1fr`) on desktop | Flexbox with spacing/margins | Guarantees search bar is centered in the viewport, regardless of logo/menu sizes. |
| **Menu Grouping** | Consolidated `ul` for right-aligned items | Separate lists for categories | Simplifies layout flow and responsive wrapping on mobile. |
| **New View Layouts** | Reuse structure of `aboutUs.ejs` | Unique views layout | Guarantees consistent typography, styles, and spacing across all text pages. |
| **LCD Palette** | Custom variables in `colors.css` | Hardcoded colors in CSS | Allows components to adapt color choices based on active theme state. |

---

## Layout and Data Flow

### Desktop Header Layout (Grid)

```text
+-----------------------------------------------------------+
| [MUNDO 3D]          [Buscar productos...]       [Menu...] |
| (Column 1: Left)    (Column 2: Center)    (Column 3: Right)
+-----------------------------------------------------------+
```

### Routing & View Flow

```text
Request (GET /terms) ──> mainRoutes.js ──> controllers/main/terms.js ──> Render terms.ejs (uses head/header/footer partials)
```

---

## File Changes

| File | Action | Description |
| :--- | :--- | :--- |
| `src/routes/mainRoutes.js` | Modify | Add routes `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help`. |
| `src/controllers/main/index.js` | Modify | Import and export new controllers. |
| `src/controllers/main/*.js` | Create | Create `terms.js`, `privacy.js`, `faq.js`, `stepByStep.js`, `help.js` (simple page renderers). |
| `src/views/*.ejs` | Create | Create `terms.ejs`, `privacy.ejs`, `faq.ejs`, `step-by-step.ejs`, `help.ejs`. |
| `src/views/partials/header.ejs` | Modify | Reorganize elements, remove 'Inicio', consolidate list items. |
| `src/views/partials/footer.ejs` | Modify | Remove 'Sucursales' article section. |
| `public/js/theme.js` | Modify | Update toggle button text update to update icon content (`☀️` / `🌙`). |
| `public/css/tokens/colors.css` | Modify | Define `--title-highlight`, `--lcd-bg`, `--lcd-fg` in dark/light themes. |
| `public/css/components/navbar.css`| Modify | Implement desktop Grid on `.navbar__inner`, remove icon hiding. |
| `public/css/components/carousel.css`| Modify| Use `--lcd-bg` and `--lcd-fg` in `.carousel--lcd`. |
| `public/css/components/forms.css` | Modify | Implement `.form-card__actions` and stretch button margins. |
| `src/views/users/login.ejs` | Modify | Wrap button in `.form-card__actions`. |
| `src/views/users/register.ejs` | Modify | Wrap buttons in `.form-card__actions`. |
| `src/__tests__/theme.test.js` | Modify | Update mock environment and assertions to check icon element toggle. |

---

## Testing Strategy

| Target / Layer | Test Strategy | Test Cases |
| :--- | :--- | :--- |
| **Routes & Controllers** | Integration (Supertest) | GET requests to `/terms`, `/privacy`, `/faq`, `/step-by-step`, `/help` must return HTTP 200. |
| **Theme Toggle JS** | Unit (Jest) | Verify `applyTheme` updates `.theme-toggle-btn__icon` textContent correctly. |
| **Existing Suite** | Verification | Ensure all 90 existing tests pass without regressions. |

---

## Migration / Rollout

No database migrations or configuration flags are required. The changes can be safely deployed as a single deployment package.

---

## Open Questions

- **Game Boy styling vs request colors**: The spec notes classic Game Boy colors (`#8bac0f` / `#0f380f`) for light mode, while the prompt specifies `#e2dbce` / `#1a2a4a`. We will prioritize the prompt colors, leaving the old spec values as a fallback if needed.
