# Exploration Report: Style Consistency and Footer Clean-up

This report details the exploration of the codebase for proposed design system improvements, layout adjustments, and static page routes.

---

## 1. Context and Goals

We want to perform the following design system improvements:
1. **Header Reorganization**: 
   - Logo acts as a home link (already implemented, needs to be preserved).
   - Remove the "Inicio" link.
   - Center the search bar perfectly on desktop.
   - Align all remaining navigation links (Productos, Nuevo producto, Cart, Profile, and Theme Toggle) on the right.
   - Change the theme toggle to be icon-only (remove "MODE: DARK" / "MODE: LIGHT" text).
2. **Footer Cleanup & Placeholder Views**:
   - Remove the "Sucursales" section.
   - Implement placeholder routes, controller endpoints, and EJS views for: `/terms`, `/privacy`, `/faq`, `/step-by-step`, and `/help`.
3. **Theme Color Contrast and LCD Carousel Variables**:
   - Introduce a new dynamic semantic variable `--title-highlight` in `colors.css` to replace `--pico-yellow` on light backgrounds.
   - Introduce `--lcd-bg` and `--lcd-fg` theme-based variables for the LCD carousel.
4. **Button Widths in Forms**:
   - Resolve why form buttons in login/register are narrower than inputs and fix their alignments/margins.

---

## 2. Header Reorganization

### 2.1 File Locations
- **View template**: `src/views/partials/header.ejs`
- **Style sheet**: `public/css/components/navbar.css`
- **Theme toggle script**: `public/js/theme.js`
- **Unit tests**: `src/__tests__/theme.test.js`

### 2.2 Layout Analysis
Currently, `.navbar__inner` is styled using a flex column container that changes to a row on desktop:
```css
@media (min-width: 640px) {
  .navbar__inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
}
```
Because `justify-content: space-between` is used with three children (`.navbar__logo`, `.navbar__search`, and `.navbar__list`), the search bar is pushed to the middle but will not be centered *perfectly* relative to the viewport unless the left (logo) and right (nav links) elements have identical widths.

#### Proposed Layout Solutions
- **Option A (CSS Grid - Recommended)**: Change the desktop layout of `.navbar__inner` to a three-column grid:
  ```css
  @media (min-width: 640px) {
    .navbar__inner {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
    }
    .navbar__logo {
      grid-column: 1;
      justify-self: start;
    }
    .navbar__search {
      grid-column: 2;
      justify-self: center;
      margin: 0;
    }
    .navbar__list {
      grid-column: 3;
      justify-self: end;
    }
  }
  ```
  *Pros*: Guarantees perfect viewport-based centering for the search bar, regardless of logo or navigation menu widths. Highly modern and robust.
  *Cons*: None. Works cleanly as progressive enhancement on top of mobile flex layout.
  
- **Option B (Equal-Sized Flex Items)**: Make the logo and navigation list equal flex sizes:
  ```css
  .navbar__logo { flex: 1; display: flex; justify-content: flex-start; }
  .navbar__search { flex: 0 0 auto; }
  .navbar__list { flex: 1; display: flex; justify-content: flex-end; }
  ```
  *Pros*: Achieving centering using flexbox.
  *Cons*: Requires adding wrappers or altering flex properties on multiple levels.

### 2.3 Consolidating Navigation Links
Since we are removing the "Inicio" link, the remaining menu links (`Productos`, `Nuevo producto` (if logged), user profile/logout, `Carrito` (Cart), and the theme toggle button) should all sit on the right side.
We will consolidate them in `header.ejs` into a single `<ul>` menu (removing the split between `navbar__list--left` and `navbar__list--right`), which makes desktop alignment simple and keeps stacking clean on mobile.

### 2.4 Theme Toggle Behavior
The theme toggle currently displays text (`MODE: DARK` / `MODE: LIGHT`) and an icon (`◐`).
- **EJS changes**: Remove `<span class="theme-toggle-btn__text">` entirely. Keep the icon container `<span class="theme-toggle-btn__icon">`.
- **CSS changes**: Update `navbar.css` so `.theme-toggle-btn__icon` displays inline-flex on all screen sizes, not just mobile `< 640px`.
- **JS changes**: Update `public/js/theme.js` to change the icon character of `.theme-toggle-btn__icon` depending on the current theme:
  - Light mode: `☀️`
  - Dark mode: `🌙` (or `◐`)
- **Unit Tests changes**: Update `src/__tests__/theme.test.js` to assert the `.theme-toggle-btn__icon` textContent is updated to `☀️` or `🌙`, matching the JS behavior and removing the text-span mock assertions.

---

## 3. Footer Cleanup & Placeholder Views

### 3.1 File Locations
- **Footer template**: `src/views/partials/footer.ejs`
- **Routes**: `src/routes/mainRoutes.js`
- **Controllers**: `src/controllers/main/`

### 3.2 Removal and Clean-up
- Remove the entire "Sucursales" `<article>` block in `footer.ejs` (lines 4–11). This will leave the footer with two primary columns on desktop ("La Empresa" and "Ayuda"), plus the copyright/social bar at the bottom.

### 3.3 New Routes & Controller Endpoints
We will map the 5 placeholder routes in `src/routes/mainRoutes.js`:
- `/terms`
- `/privacy`
- `/faq`
- `/step-by-step`
- `/help`

Each route will have a corresponding controller function in the `src/controllers/main/` directory. Following the existing codebase pattern, we will create separate files:
- `terms.js`
- `privacy.js`
- `faq.js`
- `stepByStep.js`
- `help.js`

And export them all via `src/controllers/main/index.js`.
Each controller endpoint will render its respective EJS view:
```javascript
function terms(req, res) {
  res.render('terms');
}
module.exports = terms;
```

### 3.4 EJS Views
We will create 5 new files in `src/views/`:
1. `terms.ejs`
2. `privacy.ejs`
3. `faq.ejs`
4. `step-by-step.ejs`
5. `help.ejs`

To maintain visual consistency, these views will use the exact layout skeleton of `aboutUs.ejs`:
```html
<%- include('./partials/head') %>
<title>Page Title — Mundo 3D</title>
</head>
<body>
  <%- include('./partials/header') %>
  <main class="form-layout">
    <article class="about-content">
      <section>
        <h1>Page Title</h1>
        <p>Placeholder content for this page.</p>
      </section>
    </article>
  </main>
  <%- include('./partials/footer') %>
</body>
</html>
```

---

## 4. Theme Color Contrast and LCD Carousel Variables

### 4.1 File Locations
- **Token styles**: `public/css/tokens/colors.css`
- **Component styles**:
  - `public/css/components/about.css`
  - `public/css/components/feature-strip.css`
  - `public/css/components/product-card.css`
  - `public/css/components/navbar.css`
  - `public/css/components/footer.css`
  - `public/css/base/layout.css`
  - `public/css/components/carousel.css`

### 4.2 Semantic Highlight Color Contrast
On light background themes, `#ffec27` (`--pico-yellow`) is highly illegible due to poor contrast. We will define a dynamic semantic variable:
```css
/* public/css/tokens/colors.css */
:root {
  ...
  --title-highlight: var(--pico-yellow); /* Yellow in dark mode */
}

[data-theme="light"] {
  ...
  --title-highlight: #1a2a4a; /* High-contrast navy in light mode */
}
```
*(Alternative: we can also use `#8b7355` (bronze/gold) if we want a warm highlight color in light mode. Navy `#1a2a4a` matches the body text `--fg` and provides the highest possible contrast).*

We will replace `color: var(--pico-yellow);` with `color: var(--title-highlight);` in the following rules:
- `.about-content h1` and `.about-content h2` (About Page headings)
- `.feature-strip__title` (Feature Strip titles)
- `.page-heading` (Homepage title)
- `.empty-state h2` (Empty state heading)
- `.navbar__logo` (Navbar site logo - making it navy/bronze in light theme instead of yellow)
- `.navbar__link:hover` (Navbar links on hover)
- `.footer__section ul li a:hover` and `.footer__social a:hover` (Footer links on hover)
- `a:hover` (Base anchor tag hover state in `layout.css`)

### 4.3 Custom LCD Carousel Variables
Currently, `.carousel--lcd` hardcodes the dark mode colors:
```css
.carousel--lcd {
  background-color: #0f2010;
  color: #39ff14;
}
```
We will introduce two custom theme variables in `colors.css`:
- **Dark Mode (`:root`)**:
  - `--lcd-bg: var(--pico-dark-blue);` (retro dark blue: `#1d2b53`)
  - `--lcd-fg: var(--pico-yellow);` (retro yellow: `#ffec27`)
- **Light Mode (`[data-theme="light"]`)**:
  - `--lcd-bg: #8bac0f;` (classic Game Boy warm screen gray-green)
  - `--lcd-fg: #0f380f;` (classic Game Boy dark navy/green text)

Then in `carousel.css`:
- Update `.carousel--lcd` to use:
  - `background-color: var(--lcd-bg);`
  - `color: var(--lcd-fg);`
- Update `.carousel--lcd .carousel__prev:hover` and `.carousel--lcd .carousel__next:hover` to use:
  - `color: var(--lcd-bg);` (instead of hardcoded `#0f2010`).

---

## 5. Form Button Widths and Margins

### 5.1 Analysis of the Issue
In `login.ejs` and `register.ejs`:
- The input elements use class `form-card__input` which is styled with `width: 100%`.
- The buttons use class `form-card__btn` which has **no width specified** and **has a right margin**:
  ```css
  .form-card__btn, ... {
    padding: var(--space-sm) var(--space-md);
    margin-right: var(--space-sm);
  }
  ```
- Because there is no `width: 100%`, the buttons shrink to their text contents. Because they have `margin-right`, they sit offset and look visually misaligned with the inputs above them.

### 5.2 Proposed Solutions
- **Option A (Stretched Stacked Buttons)**: Apply `width: 100%` and `margin: 0 0 var(--space-sm) 0` to `.form-card__btn` so that they stack vertically and match the inputs perfectly.
- **Option B (Side-by-Side Flex Action Row - Recommended)**:
  In `register.ejs`, wrap the action buttons in a container:
  ```html
  <div class="form-card__actions">
    <button type="reset" class="form-card__btn form-card__btn--secondary">Borrar</button>
    <button type="submit" class="form-card__btn form-card__btn--primary">Registrarse</button>
  </div>
  ```
  And style the container in `forms.css`:
  ```css
  .form-card__actions {
    display: flex;
    gap: var(--space-sm);
    width: 100%;
    margin-top: var(--space-md);
  }
  .form-card__actions .form-card__btn {
    flex: 1;
    margin-right: 0; /* Remove offset margin */
  }
  ```
  For single-button forms (like `login.ejs`), we simply set the button's width to `100%` and clear its `margin-right`.

---

## 6. Recommendations & Next Steps

1. **Header Layout**: Adopt **Option A (CSS Grid)** for header alignment to guarantee perfect centering of the search bar.
2. **Button Layout**: Adopt **Option B (Flex Action Row)** for form buttons to look polished on desktop and mobile.
3. **Variable Names**: Use `--title-highlight` for contrast improvements and `--lcd-bg` / `--lcd-fg` for theme-specific LCD styling.
4. **Implementation Sequence**:
   - Define theme variables in `colors.css`.
   - Update header, footer, and component styles.
   - Implement the 5 controllers, views, and routes.
   - Refactor `theme.js` script and tests.
   - Run tests to confirm zero regressions.
