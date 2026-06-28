# Tasks: Playwright E2E Testing Framework Setup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 lines (mostly test configuration and new E2E test files) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full Playwright E2E framework and test suite | Single PR | Completely decoupled workspace under `/e2e`, minimal impact on app logic |

## Phase 1: Workspace Initialization

- [x] 1.1 Add `e2e` folder to packages list in `pnpm-workspace.yaml`
- [x] 1.2 Create `e2e/package.json` with Playwright devDependencies and test scripts
- [x] 1.3 Create `e2e/tsconfig.json` for TypeScript configuration targeting ES2022 and Node

## Phase 2: Backend/Frontend Dynamic Environment Adjustments

- [x] 2.1 Update `package.json` in root to add `test:e2e` and `test:e2e:all` scripts
- [x] 2.2 Modify `backend/index.js` to conditionally skip `ensureDatabaseExists` when `process.env.NODE_ENV === 'test'`

## Phase 3: Test Setup & Database Hooks

- [x] 3.1 Create `backend/src/database/test-prepare.js` using Sequelize `sync({ force: true })` and root seeds to recreate `mundo_3d_test`
- [x] 3.2 Add `db:test:prepare` script to `backend/package.json` to trigger the test-prepare script
- [x] 3.3 Create `e2e/playwright.config.ts` configuring multi-webServer, chromium project, and globalSetup hook
- [x] 3.4 Create `e2e/global-setup.ts` to execute the backend `db:test:prepare` script programmatically before tests run

## Phase 4: E2E Test Suite Coding

- [x] 4.1 Create `e2e/tests/auth.spec.ts` with registration, login, invalid credentials, and logout tests
- [x] 4.2 Create `e2e/tests/cart.spec.ts` reusing cached `storageState` authentication to test cart additions, badge updates, and checkout redirects

## Phase 5: CI/CD Integration

- [x] 5.1 Modify `.github/workflows/ci.yml` to set up MySQL service container for tests, cache Playwright browsers, and run `npm run test:e2e`

## Phase 6: Verification

- [x] 6.1 Execute `npm run test:e2e` locally to verify that all webServers spin up, the DB resets, and all specs pass
- [x] 6.2 Push to CI and verify that the GitHub Actions run executes the Playwright E2E test job successfully
