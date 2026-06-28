# Proposal: Playwright E2E Testing Framework Setup

## Intent

Establish an end-to-end (E2E) UI testing suite using Playwright to verify critical application paths (authentication and shopping cart flows) in an isolated sandbox, preventing regressions.

## Scope

### In Scope
- Create `/e2e` workspace folder at monorepo root.
- Configure Playwright with Chromium (default local) and Firefox/WebKit.
- Configure isolated test ports: backend `3032` (NODE_ENV=test), frontend `4322`, targeting database `mundo_3d_test`.
- Automate database reset/seeding in Playwright `globalSetup` hook.
- Implement Playwright `storageState` to reuse authentication for cart tests.
- Add E2E tests for auth (`auth.spec.ts`) and cart (`cart.spec.ts`).
- Integrate tests into GitHub Actions workflow (`.github/workflows/ci.yml`).

### Out of Scope
- Unit/integration testing for backend APIs (handled by Jest).
- Third-party payment gateway mock/sandbox checkout flow testing.
- Docker-compose orchestration for local E2E runs.

## Capabilities

### New Capabilities
- `e2e-testing`: Playwright E2E UI testing suite validating auth and cart integration.

### Modified Capabilities
- None

## Approach

- Setup standalone `/e2e` package with dedicated `tsconfig.json` and linter configuration.
- Configure Playwright `webServer` to launch frontend and backend on test ports.
- Implement `globalSetup` script to execute database migrations on `mundo_3d_test`.
- Save authentication state in a temporary file to skip login in cart tests.
- Run auth tests sequentially to avoid registration collisions.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `pnpm-workspace.yaml` | Modified | Add `e2e` folder to monorepo. |
| `package.json` | Modified | Add root `pnpm test:e2e` and `pnpm test:e2e:all` scripts. |
| `backend/` | Modified | Dynamic test database matching in initialization config. |
| `.github/workflows/ci.yml` | Modified | Setup MySQL service container and run Playwright E2E tests. |
| `e2e/` | New | Playwright workspace, config, helper utilities, and specs. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Test DB Pollution | Medium | Reset DB in `globalSetup`; run auth tests sequentially; unique registration data. |
| Port Conflicts | Low | Map test run to dedicated ports `4322` and `3032`. |
| Flaky UI assertions | Medium | Use locator-based assertions (auto-waiting) instead of static timeouts. |

## Rollback Plan

Delete the `/e2e` directory, and revert changes to `pnpm-workspace.yaml`, root `package.json`, `backend/` database config, and `.github/workflows/ci.yml`.

## Dependencies

- Local MySQL service running during test execution.

## Success Criteria

- [ ] `pnpm test:e2e` runs successfully locally and starts all servers.
- [ ] All E2E tests pass consistently in local and GitHub Actions CI.
