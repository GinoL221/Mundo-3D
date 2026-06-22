# Proposal: Test Infrastructure Stabilization

## Intent

Stabilize the test infrastructure of `Mundo-3D` by resolving Jest TypeScript compilation issues, eliminating redundant compiler hooks registration, cleaning up redundant module resets, and bridging critical branch coverage gaps in repositories to ensure robust testing.

## Scope

### In Scope
- Configure `ts-jest` with `isolatedModules: true` in `jest.config.js` to skip strict type checking during test runs and speed up compilation.
- Add a standalone `"type-check": "tsc --noEmit"` script in `package.json` to verify type safety independently of Jest.
- Conditionally wrap `require('ts-node/register')` in `src/app.js` with `if (process.env.NODE_ENV !== 'test')` to prevent redundant compiler hook registration during test executions.
- Remove redundant `jest.resetModules()` calls in test files where they do not reload modules or cause memory/performance issues:
  - `src/__tests__/cors.test.js`
  - `src/__tests__/theme.test.js`
  - `src/__tests__/appConfig.test.js`
  - `src/infrastructure/middlewares/__tests__/loginLimiter.test.ts`
- Fix the TypeScript compilation error in `src/infrastructure/middlewares/userLogged.ts` (line 52) by casting `user` assignment to `Partial<UserDTO> & Record<string, unknown>`.
- Implement unit test coverage targeting the uncovered branches of the repositories (`SequelizeShoppingCartRepository.ts`, `SequelizeProductRepository.ts`, `SequelizeCategoryRepository.ts`, `SequelizeFranchiseRepository.ts`, and `SequelizeRememberTokenRepository.ts`), maintaining the existing Sequelize mocking pattern.

### Out of Scope
- Migrating repository tests to run against a real database or an in-memory SQLite database (Sequelize model mocks will continue to be used).
- Rewriting core routing or business logic in the application.

## Capabilities

### New Capabilities
- Standalone command `npm run type-check` to run TypeScript compiler type checks.

### Modified Capabilities
- Faster and less memory-intensive test runs using `npm test`.

## Approach

1. **Configure Jest with `isolatedModules: true`**:
   - Update [jest.config.js](file:///home/ginopc/Desarrollo/Mundo-3D/jest.config.js) to pass `isolatedModules: true` in the `ts-jest` transformer configuration:
     ```javascript
     transform: {
       "^.+\\.jsx?$": "babel-jest",
       "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true }],
     }
     ```
2. **Add Type Check Script**:
   - Add `"type-check": "tsc --noEmit"` to `scripts` in [package.json](file:///home/ginopc/Desarrollo/Mundo-3D/package.json).
3. **Conditionally Register `ts-node` in `src/app.js`**:
   - Wrap the `require('ts-node/register')` statement in `src/app.js` with an environment check:
     ```javascript
     if (process.env.NODE_ENV !== 'test') {
       require('ts-node/register');
     }
     ```
4. **Remove Redundant `jest.resetModules()`**:
   - Clean up the `jest.resetModules()` calls in the affected test files:
     - `src/__tests__/appConfig.test.js`
     - `src/__tests__/cors.test.js`
     - `src/__tests__/theme.test.js`
     - `src/infrastructure/middlewares/__tests__/loginLimiter.test.ts`
5. **Fix Compilation Error**:
   - Cast `user` in `src/infrastructure/middlewares/userLogged.ts` to resolve compilation type assignment issues:
     ```typescript
     session.userLogged = user as Partial<UserDTO> & Record<string, unknown>;
     ```
6. **Bridge Branch Coverage Gaps**:
   - Add tests using mocked Sequelize model assertions to cover transactions and error paths in `SequelizeShoppingCartRepository.test.ts`.
   - Add tests covering fallback creation initialization and query results returning `null` in `SequelizeProductRepository.test.ts`.
   - Add tests for optional/partial updates in Category, Franchise, and RememberToken repository tests.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `jest.config.js` | Modified | Configure `ts-jest` transformer with `isolatedModules: true`. |
| `package.json` | Modified | Add `type-check` script in `scripts`. |
| `src/app.js` | Modified | Conditionally register `ts-node`. |
| `src/infrastructure/middlewares/userLogged.ts` | Modified | Type-cast `user` assignment to fix TS compilation. |
| Test files (`src/__tests__/...`, `src/infrastructure/middlewares/__tests__/...`) | Modified | Remove redundant `jest.resetModules()` calls. |
| Repository test files (`src/infrastructure/repositories/__tests__/...`) | Modified | Add unit test cases to target uncovered statement/branch scenarios. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Disabling type checking during Jest execution could let type errors in tests go unnoticed in local environments. | Med | Run `npm run type-check` before running tests, and ensure it runs in the CI/CD pipeline. |
| Modifying `app.js` ts-node loading could break module loading in custom scripts or dev servers. | Low | Verify that `npm run dev` and `npm start` continue to work properly. |

## Rollback Plan

Revert git changes for all affected files to restore original configuration and logic:
```bash
git checkout -- jest.config.js package.json src/app.js src/infrastructure/middlewares/userLogged.ts src/__tests__/appConfig.test.js src/__tests__/cors.test.js src/__tests__/theme.test.js src/infrastructure/middlewares/__tests__/loginLimiter.test.ts src/infrastructure/repositories/__tests__/
```

## Dependencies

- `typescript` (`^6.0.3`) - already installed
- `ts-jest` (`29.4.11`) - already installed
- `jest` (`30.4.2`) - already installed

## Success Criteria

- [ ] All tests run and pass without compilation blockers or performance/memory regressions.
- [ ] `npm run type-check` successfully validates types without throwing errors.
- [ ] Unit tests for `SequelizeShoppingCartRepository.ts`, `SequelizeProductRepository.ts`, and other repositories achieve targeted branch coverage (>= 80% statement and branch coverage where gaps exist) without database dependencies.
- [ ] The app launches successfully in development (`npm run dev`) and production (`npm start`).
