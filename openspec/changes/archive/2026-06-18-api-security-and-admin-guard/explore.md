## Exploration: api-security-and-admin-guard

### Current State
Today, the Mundo-3D application utilizes session-based authentication backed by `express-session` and signed remember-me cookies:
- **API Endpoints**: 
  - Mounted under `/api` in `src/app.js` using `src/routes/api/index.js`.
  - Includes GET routes `/api/products` (returns product/category counts), `/api/product/:id` (single product), `/api/products/latest` (latest product), `/api/users` (all users), and `/api/users/:id` (single user).
  - Currently, `/api/users` and `/api/users/:id` are completely unprotected. Anyone can perform GET requests and retrieve user details (even though passwords are excluded).
- **Authentication**:
  - The login session is established in `src/infrastructure/controllers/UserController.ts` (`processLogin`), saving details in `req.session.userLogged`.
  - A signed cookie `remember_token` is set if "remember me" is checked.
  - The global `userLoggedMiddleware` (`src/middlewares/userLogged.ts`) runs on all routes, verifying the session or validating/auto-logging users via `remember_token`.
  - Importantly, the session payload created during standard login does not currently save `IDRole` or `Category` properties.
- **Middlewares**:
  - `src/middlewares/auth.js` defines `isUser`, `authMiddleware`, and `guestMiddleware` which perform checks and redirect to `/login` or `/profile`. Redirects are unsuitable for API endpoints, which expect JSON responses (e.g., `401 Unauthorized` or `403 Forbidden`).
  - `src/middlewares/adminMiddlewares.js` is a placeholder file that re-exports standard user auth functions without defining any administrator role logic.
- **Database / User Model**:
  - The database table `User` defined in `DB.md` and the Sequelize `User.js` model in `src/database/models/User.js` do not have an `IDRole` or `isAdmin` column.
  - However, the `User.ts` domain model entity and `UserDTO.ts` DTO already define optional properties: `IDRole?: number | null` and `Category?: string | null`.
  - The domain layer is already pre-configured to handle `IDRole: 1` as `'Admin'` and `IDRole: 2` as a standard user, as shown in the existing mock tests.

### Affected Areas
- `DB.md` — Need to add `IDRole INT DEFAULT 2` (or non-nullable with a default value) to the `User` table creation script.
- `src/database/models/User.js` — Define `IDRole` attribute with a default value in the Sequelize User model.
- `src/database/models/db.d.ts` — Update `UserAttributes` interface to include `IDRole?: number` and `Category?: string`.
- `src/infrastructure/repositories/SequelizeUserRepository.ts` — Ensure created or queried users populate `IDRole` and maps the domain `Category` attribute correctly (e.g., `1` maps to `'Admin'`, `2` to `'User'`).
- `src/infrastructure/controllers/UserController.ts` — Save `IDRole` and `Category` to the `req.session.userLogged` object upon successful login.
- `src/middlewares/adminMiddlewares.js` — Update this or create a new middleware file (e.g., `src/middlewares/adminGuard.ts` or `src/middlewares/apiAuth.ts`) to verify if a user is logged in, and if they have administrator privileges.
- `src/routes/api/users.js` — Apply API authentication and admin guard middlewares to protect the user endpoints.
- `src/infrastructure/routes/productRoutes.ts` — Replace `isUser` with the admin guard middleware for sensitive mutations (creating, editing, and deleting products).

### Approaches
1. **Session-Based Guard with Database Role Schema Addition (Recommended)**
   - **Description**: Add the missing `IDRole` column to the `User` database table and model. Modify standard login to include the role in the session. Implement an `apiAuth` middleware (returning `401` status) and an `adminGuard` middleware (checking `IDRole === 1` / `Category === 'Admin'`, returning `403` status for API or redirecting for web). Protect sensitive `/api` routes and product mutation web routes.
   - **Pros**: Matches the pre-designed attributes in the domain layers, respects session architecture, easy to implement without adding third-party packages, and ensures proper REST-compliant error codes for API routes.
   - **Cons**: Requires modifying the database table schema and Sequelize model (already syncs on startup via `sequelize.sync()`).
   - **Effort**: Medium (approx. 2-3 hours).

2. **JSON Web Token (JWT) Authentication for API Only**
   - **Description**: Introduce JWT authentication strictly for routes under `/api`. Issue a JWT token on `/api/login` and verify it in an authorization header middleware.
   - **Pros**: Standard practice for public-facing stateless APIs.
   - **Cons**: High complexity; introduces new package dependencies (e.g., `jsonwebtoken`), requires client-side storage management, and creates duplicate login implementations (session vs. token).
   - **Effort**: High.

3. **Email Whitelist Authorization (No Schema Change)**
   - **Description**: Check if the logged-in user email belongs to a hardcoded list of admin emails (or set via `.env`).
   - **Pros**: Fast to implement without database modifications.
   - **Cons**: Extremely insecure, rigid, and does not leverage the pre-defined `IDRole` attributes present in the domain entities.
   - **Effort**: Low.

### Recommendation
Implement **Approach 1 (Session-Based Guard with Database Role Schema Addition)**. This approach integrates cleanly with the existing Express sessions, utilizes the pre-established `IDRole` domain models, and correctly supports separate handlers for web views (redirects) and API endpoints (JSON error statuses).

### Risks
- **Session Object Deserialization**: Since the session stores the user object, we must ensure that any middleware updates `req.session.userLogged` to include the user's role on login, otherwise existing tests or logins might evaluate role checks as undefined.
- **API Response Compatibility**: Clients consuming the API need correct HTTP response status codes (`401` / `403`) instead of redirects to HTML pages (`302` to `/login`). The new middlewares must distinguish between regular view routes and `/api` JSON responses.

### Ready for Proposal
Yes. The orchestrator should proceed to define the proposal detailing:
- The database schema change (adding `IDRole` to `User` table).
- The middleware functions (`apiAuth` and `adminGuard` for API and web routes).
- Implementation of admin restrictions on `/api/users*` and product writing endpoints.
