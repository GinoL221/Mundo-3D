# Design: Playwright E2E Testing Framework Setup

## Technical Approach

Introduce an isolated `/e2e` workspace using Playwright to run end-to-end user tests targeting a local test database (`mundo_3d_test`). The system will orchestrate test execution by spinning up the backend and frontend on dedicated test ports (3032 and 4322) via Playwright `webServer` multi-config. Database state is managed deterministically through a setup hook resetting and seeding the test schema prior to running tests, and authentication is cached using `storageState` to allow seamless multi-scenario verification without redundant login actions.

## Architecture Decisions

### Decision: Database Seeding & Reset Hook

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Manual CLI migration/reset script | Requires manual script steps before starting tests; potential desync. | **Rejected** |
| Sequelize `sync({ force: true })` in Playwright `globalSetup` | Re-creates database schema dynamically per test run; guarantees clean state; executes programmatically. | **Chosen** — Simple, reliable, and decoupled from the app lifecycle. |

### Decision: Session State Reuse (`storageState`)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Log in before each cart test | Increases test execution time; pollutes authentication path. | **Rejected** |
| Playwright `storageState` file cache | Saves cookies and local storage to `e2e/.auth/user.json` once, reusing it for cart tests. | **Chosen** — Significantly reduces execution overhead and isolates auth concerns. |

## Data Flow

During test preparation and execution, the data flow is orchestrated as follows:

```
[Playwright Runner]
       │ (1) Triggers db:test:prepare
       ▼
[test-prepare.js] ──(2) Recreates & Seeds──► [mundo_3d_test DB]
       │
       │ (3) Starts webServers
       ├───► [Backend API (Port 3032)] ◄─── (4) Queries ───► [mundo_3d_test DB]
       │                                                          ▲
       └───► [Frontend (Port 4322)] ◄──(5) PUBLIC_API_URL ────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `pnpm-workspace.yaml` | Modify | Add `e2e` workspace folder to monorepo configuration. |
| `package.json` | Modify | Add root-level scripts `test:e2e` and `test:e2e:all`. |
| `backend/package.json` | Modify | Add `db:test:prepare` script. |
| `backend/index.js` | Modify | Resolve `ensureDatabaseExists` environment dynamically from `process.env.NODE_ENV`. |
| `backend/src/database/test-prepare.js` | Create | Database initialization script for clean seeding. |
| `e2e/package.json` | Create | Playwright package dependency and test runner configurations. |
| `e2e/tsconfig.json` | Create | TypeScript setup for E2E tests. |
| `e2e/playwright.config.ts` | Create | Configuration for browsers, multi-webServer, and globalSetup. |
| `e2e/global-setup.ts` | Create | Hook running database reset-and-seed prior to execution. |
| `e2e/tests/auth.spec.ts` | Create | E2E authentication validation tests (register, login, logout). |
| `e2e/tests/cart.spec.ts` | Create | E2E shopping cart and navigation validation tests. |
| `.github/workflows/ci.yml` | Modify | CI job definition updating to run mysql service, cache Playwright, and run tests. |

## Interfaces / Contracts

### Playwright Config (`e2e/playwright.config.ts`)
```typescript
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),
  webServer: [
    {
      command: 'pnpm --filter backend start',
      port: 3032,
      env: { NODE_ENV: 'test', PORT: '3032' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter frontend dev --port 4322',
      port: 4322,
      env: { PUBLIC_API_URL: 'http://localhost:3032' },
      reuseExistingServer: !process.env.CI,
    }
  ],
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup']
    }
  ]
});
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| E2E Auth | Registration, login, invalid credentials, and logout flows | Sequence of pages and forms assertions using standard Chromium/Firefox/WebKit browser context |
| E2E Cart | Add to cart, badge counts, item listing in cart, and guest checkout redirects | Local storage assertion and UI navigation assertions with optional authentication injection |

## Migration / Rollout

No database migration or rollout concerns. A test-only database `mundo_3d_test` is created, utilized, and disposed of per run.

## Open Questions

- [ ] Should we cache the Playwright browser directories globally on developer machines or only inside GitHub Actions cache?
- [ ] Do we need to run all browser projects (Chromium, Firefox, WebKit) locally by default in `test:e2e`, or should we default to Chromium to save time?
