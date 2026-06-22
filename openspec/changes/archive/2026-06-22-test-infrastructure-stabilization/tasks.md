# Tasks: Test Infrastructure Stabilization

## Review Workload Forecast
- Estimated changed lines: 200-250
- 400-line budget risk: Low
- Chained PRs recommended: No
- Delivery strategy: ask-on-risk
- Chain strategy: pending
- Decision needed before apply: No

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Phase 1: Foundation
- [x] Configure `ts-jest` transformer with `isolatedModules: true` in `jest.config.js` to skip type-checking in test transpilations.
- [x] Add `"type-check": "tsc --noEmit"` script to `package.json` to verify types independently.

## Phase 2: Execution Optimization & Middlewares
- [x] Conditionally register `ts-node/register` in `src/app.js` only when `process.env.NODE_ENV !== 'test'`.
- [x] Optimize module resets in `src/__tests__/cors.test.js` (remove `jest.resetModules()`).
- [x] Optimize module resets in `src/__tests__/theme.test.js` (use `jest.isolateModules()`).
- [x] Optimize module resets in `src/__tests__/appConfig.test.js` (use `jest.isolateModules()`).
- [x] Optimize module resets in `src/infrastructure/middlewares/__tests__/loginLimiter.test.ts` (use `jest.isolateModules()`).
- [x] Add type assignment cast to `Partial<UserDTO> & Record<string, unknown>` in `src/infrastructure/middlewares/userLogged.ts` to satisfy TS compiler constraints.

## Phase 3: Repository Test Coverage
- [x] Add unit tests in `src/infrastructure/repositories/__tests__/SequelizeShoppingCartRepository.test.ts` using mocked Sequelize transactions to verify successful deletion/creation and transaction rollbacks on error, achieving >=80% statement and branch coverage.
- [x] Add unit tests in `src/infrastructure/repositories/__tests__/SequelizeProductRepository.test.ts` targeting `toEntity` mappings, `null` checks on updates, queries returning `null`, and delete failures, achieving >=80% statement and branch coverage.
- [x] Add unit tests in `src/infrastructure/repositories/__tests__/SequelizeCategoryRepository.test.ts` verifying updates with undefined fields to cover all paths.
- [x] Add unit tests in `src/infrastructure/repositories/__tests__/SequelizeFranchiseRepository.test.ts` verifying updates with undefined fields to cover all paths.
- [x] Add unit tests in `src/infrastructure/repositories/__tests__/SequelizeRememberTokenRepository.test.ts` checking null values for `createdAt` during creation and retrieval.

## Phase 4: Verification & Smoke Test
- [x] Verify that all TypeScript compilation issues are resolved using `npm run type-check`.
- [x] Verify formatting and quality using `npm run lint`.
- [x] Run the complete Jest test suite using `npm test` and verify that repository file coverage is >=80% for statements and branches.
- [x] Smoke test application startup in development mode (`npm run dev`) and production mode (`npm start`).
