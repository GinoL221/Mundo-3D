## Exploration: EJS to Astro Migration

### Current State
Today, Mundo-3D is a hybrid JavaScript/TypeScript Express application that uses Server-Side Rendering (SSR) via the EJS template engine to render its frontend pages. Page routes and rendering logic are coupled within the Express controllers (`src/infrastructure/controllers/` and legacy `src/controllers/`), which read from the application database layer and call `res.render()`. A partial REST API also exists under `/api` for products and authentication (using JWT). Modular Vanilla CSS stylesheets are stored in `public/css/` and referenced via EJS layout partials.

### Affected Areas
- `src/app.js` — View engine (`ejs`), template paths, and view-rendering middlewares/routes will be removed.
- `src/views/` — All 21 EJS files (including layouts and partials) will be deprecated and replaced by Astro components.
- `src/infrastructure/routes/` — View routes (`productRoutes.ts`, `userRoutes.ts`, `cartRoutes.ts`, `staticPagesRoutes.ts`) will be removed, and `/api` routes will be expanded to support write actions (e.g., product creation, registration, cart modifications).
- `src/infrastructure/controllers/` — HTML controllers (`ProductController.ts`, `UserController.ts`, `CartController.ts`, `StaticPagesController.ts`) will be retired or refactored into JSON API controllers.
- `src/__tests__/` and `src/infrastructure/controllers/__tests__/` — Integration/controller tests that assert on `res.render` or EJS views will be refactored to check REST API endpoints (`res.json`) or replaced by frontend tests.

### Approaches
1. **Option A: Split Monorepo (Express API + Astro Frontend)** — Refactor the Express TS backend into a pure, headless JSON REST API. Migrate the frontend into a decoupled Astro workspace inside the same repository. Astro will handle all page routing, statically generate static views (SSG), and use client-side or server-side fetch to communicate with the `/api` Express endpoints.
   - **Pros**: Clean separation of presentation and business logic; independent deployment/scaling of frontend and backend; improved DX with Astro components; keeps the Express backend focused solely on data and security.
   - **Cons**: Requires proxy/CORS configuration during local development; requires refactoring view controllers to API endpoints; session cookies must be handled via shared domains or token headers.
   - **Effort**: High.

2. **Option B: Hybrid Server (Express hosting Astro SSR)** — Keep a single server structure, integrating Astro into Express via the `@astrojs/node` server-side rendering adapter in middleware mode. Express handles routing and uses Astro dynamically to render views on demand.
   - **Pros**: Single-port local execution; no CORS setup required; keeps existing cookie-based session architecture unchanged.
   - **Cons**: High coupling between the Astro frontend and the Express backend; harder to scale or deploy separately; increased server startup time and memory footprint.
   - **Effort**: Medium.

### Recommendation
We recommend **Option A: Split Monorepo (Express API + Astro Frontend)**. This aligns with Clean Architecture principles by separating the delivery mechanism (frontend) from core business logic.
- **Styling**: We will reuse the existing, highly structured Vanilla CSS stylesheets in `public/css/` (including variables, colors, layouts, and components) by importing them globally in Astro layouts. This fully complies with the project guidelines of using Vanilla CSS and avoids the unnecessary complexity of Tailwind CSS.
- **Tests**: The business logic and use cases (tested extensively) will remain 100% unaffected. Controller tests asserting on `res.render` will be refactored to verify JSON API responses, and Playwright will be introduced for Astro page end-to-end tests.

### Risks
- **Authentication/Session Migration**: Transitioning from session-cookie-based auth on views to JWT-based API auth in the frontend might introduce security vulnerabilities if not done carefully.
- **Form File Uploads**: Product creation routes require image uploads. Refactoring this to a REST API requires ensuring the Astro client submits multipart form-data correctly.

### Ready for Proposal
Yes
