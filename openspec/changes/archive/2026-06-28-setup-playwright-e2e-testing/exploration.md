## Exploration: Integrate Playwright E2E Testing Framework

### Current State
Today, Mundo-3D is a decoupled e-commerce monorepo with an Astro 6.x frontend (`frontend/`) and an Express/TypeScript backend API (`backend/`). The frontend and backend run on separate development ports (`4321` and `3031` respectively). Communication occurs via client-side REST calls to `/api` with authentication tokens and cart state persisted in the browser's `localStorage`. Backend database integration tests are written in Jest and mock use-case scenarios (meaning they do not persist data to a real test database). There is currently no end-to-end (E2E) UI testing suite to verify critical paths (auth and cart flows).

---

### Affected Areas
- `pnpm-workspace.yaml` — Needs to include the new E2E package folder.
- Root `package.json` — Add orchestrator scripts to run E2E tests (`pnpm test:e2e`).
- `backend/index.js` — Modify `ensureDatabaseExists` to dynamically use the `NODE_ENV` configuration rather than a hardcoded `"development"` string.
- `.github/workflows/ci.yml` — Update CI pipeline to run MySQL service, install Playwright dependencies/browsers, run E2E tests, and upload reports.
- `e2e/` (New Folder) — Dedicated workspace containing Playwright configurations, type configurations, and test files.

---

### Approaches

#### 1. Workspace Location

##### Option A: Dedicated Workspace (`e2e/` at root)
* **Description**: Create a separate workspace at the monorepo root specifically for E2E tests.
* **Pros**:
  - **Complete Isolation**: Prevents heavy Playwright dependencies (`@playwright/test`) from bloat/dependency leaking into frontend client builds.
  - **Clean Configuration**: Isolation of `tsconfig.json` and linter settings, avoiding compiler conflicts with Astro's custom compiler or tsconfig structure.
  - **Standardization**: Fits perfectly with modern monorepo workspaces and allows easy filtering (e.g. `pnpm --filter e2e ...`).
* **Cons**:
  - Requires adding a folder to `pnpm-workspace.yaml`.
* **Effort**: Low (setup takes a few minutes).

##### Option B: Co-located inside Frontend (`frontend/e2e/` or `frontend/tests/e2e/`)
* **Description**: Keep E2E tests inside the existing `frontend/` Astro project.
* **Pros**:
  - Fewer folders at the root directory level.
  - Direct co-location with page components.
* **Cons**:
  - Bloats `frontend/package.json` with Node-specific testing tooling.
  - Potential tsconfig conflicts between Astro compiler and Playwright TS runner.
* **Effort**: Medium (due to configuration troubleshooting).

---

#### 2. Database & Environment Strategy for Tests

##### Option A: Shared Development Database with State Reset
* **Description**: Run tests against the development database instance and reset it.
* **Pros**: No separate DB container needed.
* **Cons**: State pollution. Running E2E tests will wipe local development product additions, users, and carts. Parallel runs are prone to conflicts.
* **Effort**: Low.

##### Option B: Dedicated Test Database (`mundo_3d_test`) with Dynamic Server Mounting
* **Description**: Run the Express backend in `NODE_ENV=test` pointing to `mundo_3d_test`, reset/seed the database before tests, and mount Playwright to test ports (`3032` for backend, `4322` for frontend).
* **Pros**:
  - Zero pollution of active development data.
  - Playwright's `webServer` config can spin up both servers in test mode on dedicated ports, run tests, and tear them down automatically.
  - High fidelity: tests the real integration of Astro, Express, and MySQL.
* **Cons**:
  - Requires a local MySQL instance (or a service container in CI) to be running.
* **Effort**: Medium.

##### Option C: API Mocking via Playwright Interceptors (`page.route`)
* **Description**: Intercept `/api` REST requests from Astro and return mock JSON payloads.
* **Pros**:
  - Fast execution and no database setup required.
  - Simplifies CI/CD setups.
* **Cons**:
  - Not a true E2E test. Misses API controller logic, schema validation, and database constraints.
* **Effort**: Medium.

---

### Recommendation
We recommend **Option A (Dedicated Workspace `e2e/`)** combined with **Option B (Dedicated Test Database)**. This ensures clean separation of concerns and maximum fidelity.

#### Integration Architecture:
1. **Directory Structure**:
   ```
   Mundo-3D/
   ├── e2e/
   │   ├── tests/
   │   │   ├── auth.spec.ts        # Login, Register, Logout tests
   │   │   └── cart.spec.ts        # Catalog navigation, Cart modifications
   │   ├── playwright.config.ts    # Configured with multi-webServer
   │   ├── tsconfig.json           # Isolated tsconfig
   │   └── package.json
   ```
2. **Environment & Port Isolation**:
   - Backend E2E port: `3032`
   - Frontend E2E port: `4322`
   - Database target: `mundo_3d_test`
3. **Deterministic State & LocalStorage**:
   - Create a helper database reset script in backend (e.g. `pnpm --filter backend run db:reset-test`) or run tables sync (`db.sequelize.sync({ force: true })`) in a global setup hook.
   - Utilize Playwright `storageState` to speed up authentication by saving the `token` and `user` properties in `localStorage` once, avoiding running full login flows for every cart test.

---

### Risks

1. **Database State Pollution & Race Conditions**:
   * *Risk*: Parallel tests modifying the same database records (e.g. attempting to create a user with the same email concurrently).
   * *Mitigation*: Run auth/registration tests sequentially, or use unique email generation (e.g., `test-${Date.now()}@example.com`) for each test.
2. **Port Conflicts**:
   * *Risk*: E2E run fails because port `3031` or `4321` is occupied by active dev servers.
   * *Mitigation*: Hardcode E2E run ports to separate values (`3032` and `4322`) and use Playwright `reuseExistingServer: !process.env.CI`.
3. **Flaky UI Transitions**:
   * *Risk*: Astro page transitions (client-side routing or DOM hydration delay) causing assertion failures.
   * *Mitigation*: Use Playwright's locator assertions (e.g., `expect(locator).toBeVisible()`) which automatically wait for the DOM to settle, avoiding raw timeouts.

---

### Ready for Proposal
Yes
