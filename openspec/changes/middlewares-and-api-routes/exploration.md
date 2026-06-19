## Exploration: middlewares-and-api-routes

### Current State
The project currently has a mix of JavaScript and TypeScript middlewares, and JavaScript-only API routes and controllers:
1. **Middlewares**:
   - `src/middlewares/auth.js` defines web auth, guest auth, API token auth, and admin authorization guards.
   - `src/middlewares/csrf.js` provides session-based CSRF protection, skipping API routes.
   - `src/middlewares/errorHandler.js` is the global Express error-handler.
   - `src/middlewares/loginLimiter.js` applies rate-limiting for login requests using `express-rate-limit`.
   - `src/middlewares/upload.js` is a factory generating configured `multer` instances for file uploads.
   - `src/middlewares/userLogged.ts` (and its JS wrapper `userLogged.js`) verifies and loads authenticated users from session or remember tokens using hexagonal repositories and use cases.
   - `src/middlewares/validators/` contains Express validators for products (`productValidators.js`) and users (`userValidators.js`).
   - `src/middlewares/adminMiddlewares.js` is a deprecated barrel re-export that is no longer used by active code.

2. **API Routes & Controllers**:
   - Routes are located under `src/routes/api/`. `index.js` mounts `products.js` and `users.js`.
   - `src/routes/api/products.js` mounts endpoints for `/products`, `/product/:id`, and `/products/latest`, forwarding requests to `src/controllers/api/productApiController.js`.
   - `src/routes/api/users.js` mounts endpoints for `/users/login`, `/users`, and `/users/:id`. These route handlers contain inline business logic (generating JWT tokens, directly fetching from `UserService`), violating the Hexagonal Architecture constraint where controllers should map requests to use cases.
   - `src/controllers/api/productApiController.js` invokes the legacy `ProductService` directly, which depends on legacy Sequelize models.

### Affected Areas
- **Middlewares to Migrate & Move** (from `src/middlewares/` to `src/infrastructure/middlewares/` as TS files):
  - `src/middlewares/auth.js` → `src/infrastructure/middlewares/auth.ts`
  - `src/middlewares/csrf.js` → `src/infrastructure/middlewares/csrf.ts`
  - `src/middlewares/errorHandler.js` → `src/infrastructure/middlewares/errorHandler.ts`
  - `src/middlewares/loginLimiter.js` → `src/infrastructure/middlewares/loginLimiter.ts`
  - `src/middlewares/upload.js` → `src/infrastructure/middlewares/upload.ts`
  - `src/middlewares/userLogged.ts` → `src/infrastructure/middlewares/userLogged.ts` (move)
  - `src/middlewares/validators/productValidators.js` → `src/infrastructure/middlewares/validators/productValidators.ts`
  - `src/middlewares/validators/userValidators.js` → `src/infrastructure/middlewares/validators/userValidators.ts`
- **API Controllers & Routes to Migrate**:
  - `src/controllers/api/productApiController.js` → `src/infrastructure/controllers/api/ProductApiController.ts`
  - `src/routes/api/users.js` logic → `src/infrastructure/controllers/api/UserApiController.ts` (new TS controller to house the inline user API logic)
  - `src/routes/api/index.js` → `src/infrastructure/routes/api/index.ts`
  - `src/routes/api/products.js` → `src/infrastructure/routes/api/productApiRoutes.ts`
  - `src/routes/api/users.js` → `src/infrastructure/routes/api/userApiRoutes.ts`
- **Application & Domain Layers to Extend**:
  - `src/domain/ports/IUserRepository.ts` — Add `findAll(): Promise<User[]>`
  - `src/infrastructure/repositories/SequelizeUserRepository.ts` — Implement `findAll`
  - `src/application/use-cases/GetLatestProductUseCase.ts` — New use case for `/api/products/latest`
  - `src/application/use-cases/ListUsersUseCase.ts` — New use case for `/api/users`
  - `src/application/use-cases/GetUserByIdUseCase.ts` — New use case for `/api/users/:id`
- **Existing Routes to Update (fixing imports & removing `@ts-ignore`)**:
  - `src/infrastructure/routes/productRoutes.ts`
  - `src/infrastructure/routes/userRoutes.ts`
  - `src/infrastructure/routes/cartRoutes.ts`
- **Main Server File**:
  - `src/app.js` — Update middleware import paths and route mappings.
- **Test Suites to Update**:
  - `src/__tests__/apiSecurity.test.js`
  - `src/__tests__/apiUsersLogin.test.js`
  - `src/__tests__/authMiddleware.test.js`
  - `src/__tests__/userLogged.test.js`
- **Dead Code Cleanup (can be safely deleted)**:
  - `src/middlewares/adminMiddlewares.js`
  - `src/middlewares/userLogged.js`

### Approaches

#### 1. Middleware Organization
- **Approach A: Convert in-place (`src/middlewares/`)**
  - *Description*: Convert JS middlewares to TS but keep them in the root `src/middlewares/` directory.
  - *Pros*: Reduces path modifications in imports inside existing routes/controllers.
  - *Cons*: Deviates from Hexagonal Architecture structure where framework/Express-specific adapters belong to the `infrastructure` layer.
  - *Effort*: Low.

- **Approach B: Relocate to Infrastructure (`src/infrastructure/middlewares/`)**
  - *Description*: Relocate all middlewares to the infrastructure layer and convert them to TS.
  - *Pros*: Full alignment with Hexagonal Architecture. Groups Express-specific concerns (CSRF, cookies, rate limits, file uploads) cleanly. Same folder as `cartCount.ts`.
  - *Cons*: Requires updating imports inside the existing routers (`productRoutes.ts`, `userRoutes.ts`, `cartRoutes.ts`).
  - *Effort*: Medium.

#### 2. API Router Organization
- **Approach A: Monolithic API Router file**
  - *Description*: Combine all API endpoints into a single `src/infrastructure/routes/apiRoutes.ts` file.
  - *Pros*: Fewer files, slightly simpler configuration.
  - *Cons*: Combines products and users logic into one router, muddying separation of concerns.
  - *Effort*: Low.

- **Approach B: Modular Routing (`src/infrastructure/routes/api/`)**
  - *Description*: Replicate the original layout with an API index file that mounts independent `/products` and `/users` routers.
  - *Pros*: Preserves structural domain isolation, clean modular design.
  - *Cons*: Requires setting up a sub-directory and more files.
  - *Effort*: Low.

### Recommendation
1. **Middleware Organization**: Use **Approach B (Relocate to Infrastructure)**. Since we are refactoring the codebase to TypeScript and Hexagonal Architecture, maintaining a consistent structure where Express-specific adapters are placed in `src/infrastructure/` is critical for architectural cleanliness.
2. **API Router Organization**: Use **Approach B (Modular Routing)**. Splitting users and products API routes aligns with the screaming architecture pattern, matching the rest of the application.

### Risks
- **JWT & Session Typings**: Express's default `Request` object does not have typing fields like `session.userLogged` or `user` (for JWT payloads). Type casting (e.g. `req as any` or declaring `Express.Request` module augmentation) will be needed to avoid TypeScript compile-time errors.
- **Brittle Test Failures**: `apiSecurity.test.js` and `apiUsersLogin.test.js` contain hardcoded paths and mock dependencies. When files move and transform to TS, these tests must be carefully updated to reference the new infrastructure paths and ensure mock patterns still hold.
- **Express-rate-limit typings**: We need to make sure the packages are correctly typed, using `rateLimit` configuration with TS signatures.
- **Remember Token Secret**: Ensure environment variables (`JWT_SECRET`, `COOKIE_SECRET`, `SESSION_SECRET`) are strictly verified during initialization of TS adapters.

### Ready for Proposal
Yes. The affected code paths and dependencies are mapped. The next stage should focus on generating the proposal, detailing the exact specifications, task lists, and verification tests.
