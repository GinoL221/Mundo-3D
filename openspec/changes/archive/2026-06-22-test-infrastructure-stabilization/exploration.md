# Exploration Report: Test Infrastructure Stabilization

This report analyzes the Jest test configuration, compilation performance, redundant dependencies loading inside tests, typescript errors, and repository branch coverage gaps in `Mundo-3D`.

## 1. File Exploration & Context Analysis

### Jest & TypeScript Config
* **`jest.config.js`**:
  Configured to run JavaScript tests using `babel-jest` and TypeScript tests using `ts-jest`.
  * Matches files pattern: `**/src/**/*.test.js`, `**/src/**/*.test.ts`.
  * Collects coverage from `src/services/**/*.js` and `src/**/*.ts`.
* **`tsconfig.json`**:
  Targets `es2022` with `commonjs` modules. TypeScript paths are processed natively by the compiler, and `ts-node` configuration sets `transpileOnly: true`.

### Redundant `ts-node/register` Inside Jest
* **`src/app.js`** imports `ts-node/register` at line 14:
  ```javascript
  require('ts-node/register');
  ```
  This registers `ts-node` compiler hooks dynamically to support loading TypeScript modules (like routers and middlewares) from CommonJS JavaScript code in production/development mode (`node index.js`).
* **Impact inside Jest**:
  Jest already handles compiling TypeScript module files via the `ts-jest` transformer configured globally in `jest.config.js`. When Jest runs, it handles import resolution. If `app.js` registers `ts-node` compiler hooks during tests, it sets up redundant file interception hooks.
* **Impact of Parallel Execution & Module Resetting**:
  Test suites such as `appConfig.test.js`, `cors.test.js`, `theme.test.js`, and `loginLimiter.test.ts` call `jest.resetModules()`. This clears Jest's internal module registry.
  * Every time a test suite calls `jest.resetModules()` and re-requires `../app`, `src/app.js` runs again, calling `require('ts-node/register')` repeatedly. This leads to duplicate compiler registrations, higher memory usage, and slower execution.
  * **Inefficient Test Pattern**: `cors.test.js` calls `jest.resetModules()` in `beforeEach()`, but requires the `app` instance globally at the top of the file. This means the app instance is *never* actually reloaded, making the module reset completely redundant.

---

## 2. Jest Compiler Performance Optimization Options

### Option 1: Configure `ts-jest` with `isolatedModules: true`
* **Description**:
  Add `isolatedModules: true` to the `ts-jest` configuration in `jest.config.js`. This tells `ts-jest` to compile each file individually without reading the rest of the type graph, bypassing strict semantic type checking during tests.
* **Pros**:
  * High performance improvement (compilation and startup time reduced by 2-3x).
  * No new dependencies required.
  * Preserves standard Jest structure.
* **Cons**:
  * TypeScript type errors will not fail test suites. Errors must be checked using ESLint or a separate `tsc --noEmit` validation step.

### Option 2: Swap `ts-jest` for `@swc/jest`
* **Description**:
  Replace `ts-jest` transformer with `@swc/jest` in `jest.config.js`.
* **Pros**:
  * Rust-based transpilation is extremely fast, reducing compilation overhead to near-zero.
* **Cons**:
  * Adds new devDependencies (`@swc/core`, `@swc/jest`).
  * Might cause edge-case discrepancies in decorator or metadata compilation configurations.

### Option 3: Conditionally Guard `ts-node/register` in `app.js`
* **Description**:
  Wrap the registration in `src/app.js` with an environment check:
  ```javascript
  if (process.env.NODE_ENV !== 'test') {
    require('ts-node/register');
  }
  ```
* **Pros**:
  * Prevents registering redundant compiler hooks in Jest, speeding up module loading.
  * Safe: Jest's transformer handles the TypeScript route files natively.
* **Cons**:
  * None.

---

## 3. Repository Coverage Gaps & Compilation Errors

### TypeScript Compilation Error in `userLogged.ts`
During coverage runs, Jest throws a compilation error:
```
Failed to collect coverage from /home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/middlewares/userLogged.ts
ERROR: src/infrastructure/middlewares/userLogged.ts:52:13 - error TS2322: Type 'UserDTO' is not assignable to type 'Partial<UserDTO> & Record<string, unknown>'.
```
* **Cause**: `session.userLogged` is typed as `Partial<UserDTO> & Record<string, unknown>` in `src/types/express.d.ts` (requiring string index signatures). `verifyRememberTokenUseCase.execute` returns a `UserDTO`, which does not have index signatures.
* **Fix**: Cast `user` at the assignment point to satisfy the compiler:
  ```typescript
  session.userLogged = user as Partial<UserDTO> & Record<string, unknown>;
  ```

### Branch Coverage Gaps in Repositories

1. **`SequelizeShoppingCartRepository.ts`** (57.89% Statement, 50% Branch Coverage):
   * **Uncovered Code**: The entire `syncCart` method (lines 52-78) is untested. This method manages transaction commits, rollbacks, and bulk item creation.
   * **Uncovered Branch**: In `toEntity()`, the scenario where `instance.product` is null/undefined is not covered by any test case.

2. **`SequelizeProductRepository.ts`** (81.81% Statement, 50% Branch Coverage):
   * **Uncovered Branch**: The fallback logic in `create` when `findById` returns null (line 99) is untested.
   * **Missing Test Paths**:
     * `findById` returning `null` when a product is not found (line 63).
     * `findLatest` returning `null` when no products exist (line 83).
     * `update` returning `null` when updating a non-existent product (line 114).
     * `delete` returning `false` when trying to delete a non-existent product (line 133).

3. **`SequelizeCategoryRepository.ts`** & **`SequelizeFranchiseRepository.ts`** (100% Statement, 83.33% Branch Coverage):
   * **Uncovered Branch**: The partial update check (e.g. `category.nameCategory !== undefined`) when no name is provided in the update object.

4. **`SequelizeRememberTokenRepository.ts`** (100% Statement, 83.33% Branch Coverage):
   * **Uncovered Branch**: The fallback logic for token creation date `createdAt: token.createdAt || new Date()` and the null branch for expiration date mapping in `toEntity()`.

---

## 4. Recommended Stabilization Plan

We recommend executing the following updates:

1. **Jest Compilation Speed**:
   * Update `jest.config.js` to configure `ts-jest` with `isolatedModules: true`.
   * Add a `type-check` script in `package.json` (`tsc --noEmit`) to ensure type safety is checked separately during CI/CD.
2. **Remove Redundant ts-node Hooks**:
   * Modify `src/app.js` to only require `ts-node/register` if `process.env.NODE_ENV !== 'test'`.
   * Remove redundant `jest.resetModules()` calls in test files where it does not actually reload modules (e.g., `cors.test.js`).
3. **Fix TypeScript Compilation Blockers**:
   * Cast `user` to `Partial<UserDTO> & Record<string, unknown>` in `src/infrastructure/middlewares/userLogged.ts` line 52.
4. **Bridge Branch Coverage Gaps**:
   * Add unit tests in `SequelizeShoppingCartRepository.test.ts` to test:
     * `syncCart` database success (transaction commit).
     * `syncCart` database failure (transaction rollback & error rethrow).
     * Mapping of product when `instance.product` is null in `toEntity`.
   * Add unit tests in `SequelizeProductRepository.test.ts` to test:
     * `findById` returning `null`.
     * `findLatest` returning `null`.
     * `update` returning `null`.
     * `delete` returning `false`.
     * The fallback initialization path in `create`.
   * Add partial update test coverage to Category, Franchise, and RememberToken repository tests.

---

## 5. Risks & Mitigation
* **Risk**: Skipping compiler type checking during tests could lead to unnoticed type regressions in test files.
  * **Mitigation**: Introduce standard `npm run type-check` before tests or as part of commit hooks/CI.
* **Risk**: Modifying `app.js` ts-node loading could break resolution in some obscure scripts.
  * **Mitigation**: Verify that `npm run dev` and `npm start` continue to run perfectly.
