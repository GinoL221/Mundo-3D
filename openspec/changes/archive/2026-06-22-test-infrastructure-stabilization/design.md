# Design Document: Test Infrastructure Stabilization

This design document outlines the technical approach, file modifications, and testing strategies to resolve Jest compilation issues, eliminate duplicate dynamic ts-node registration, clean up redundant module resets, ensure middleware type safety, and achieve target branch/statement coverage in repositories.

---

## 1. Architectural Changes

### 1.1. Isolated Modules Compilation in Jest
To prevent Jest from performing full type-checking during test transpilations (which causes test timeouts and high memory usage), we will configure `ts-jest` to run with `isolatedModules: true`.
An independent script `"type-check": "tsc --noEmit"` will be added to `package.json` to handle type validation separately.

**Proposed Changes in `jest.config.js`:**
```javascript
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.js", "**/src/**/*.test.ts"],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true }],
  },
  collectCoverageFrom: ["src/services/**/*.js", "src/**/*.ts"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
```

**Proposed Changes in `package.json`:**
```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js",
  "test": "jest",
  "type-check": "tsc --noEmit",
  "lint": "eslint src/",
  "format": "prettier --write \"src/**/*.js\""
}
```

### 1.2. Conditional ts-node Registration
To avoid duplicate compilation hooks being registered when loading `src/app.js` during test runs (e.g., inside Supertest suites), we will conditionally wrap the dynamic compiler registration.

**Proposed Changes in `src/app.js`:**
```javascript
// Register ts-node dynamically to require TypeScript modules in JavaScript
if (process.env.NODE_ENV !== 'test') {
  require('ts-node/register');
}
```

### 1.3. Removal of Redundant Module Resets
Calling `jest.resetModules()` in `beforeEach` forces Jest to clear the module cache and re-read/re-compile files on every test run. In test suites where modules are required only once at the top level (such as `cors.test.js`), it is redundant and slows execution down. In suites where environment variables or mocks must be re-evaluated (such as `theme.test.js`, `appConfig.test.js`, and `loginLimiter.test.ts`), we will replace global registry resets with targeted `jest.isolateModules()` blocks.

- **`src/__tests__/cors.test.js`**: Remove the `jest.resetModules()` call completely.
- **`src/__tests__/theme.test.js`**: Use `jest.isolateModules()` to reload the theme script in isolation for the listener test case, removing `jest.resetModules()` from the top of the test case.
- **`src/__tests__/appConfig.test.js`**: Wrap the `require('../app')` statements inside `jest.isolateModules()` blocks to test environment checks in isolation, and remove `jest.resetModules()` from `beforeEach`.
- **`src/infrastructure/middlewares/__tests__/loginLimiter.test.ts`**: Wrap the `require('../loginLimiter')` inside `jest.isolateModules()` blocks and remove `jest.resetModules()` from `beforeEach`.

---

## 2. Middleware Type Safety

To fix TypeScript compilation errors in `src/infrastructure/middlewares/userLogged.ts` (specifically line 52) under strict rules without resorting to the forbidden `any` type, we will cast the assigned `user` object to the required type contract of `session.userLogged`.

**Proposed Changes in `src/infrastructure/middlewares/userLogged.ts`:**
```typescript
const user = await verifyRememberTokenUseCase.execute(plainToken);
if (user && user.idUser === userId) {
  session.userLogged = user as Partial<UserDTO> & Record<string, unknown>;
} else {
  res.clearCookie('remember_token');
}
```

---

## 3. Repository Coverage Improvements

We will add new unit tests to bridge coverage gaps in the data repositories. All tests will preserve the existing mocked Sequelize model approach (no database dependencies).

### 3.1. `SequelizeShoppingCartRepository.ts`
- **Uncovered Branches**:
  - `toEntity` mapping when `product` is undefined/null.
  - Transaction rollbacks and error propagation in `syncCart`.
- **Design**:
  - Update `jest.mock` setup to mock `db.sequelize.transaction`, returning a mock transaction object with `commit` and `rollback` spy methods.
  - Add test case: `syncCart` successfully deletes items and creates new ones in a transaction.
  - Add test case: `syncCart` rolls back the transaction and propagates the error if any query throws.
  - Add test case: `findByUserId` returns entities without product details if `product` is null.

### 3.2. `SequelizeProductRepository.ts`
- **Uncovered Branches**:
  - `toEntity` mapping when `Category` or `Franchise` is null.
  - Null query results in `findById` and `findLatest`.
  - Fallback entity construction in `create` when `findById` returns null.
  - Null query check in `update` (record not found).
  - Conditional checks for optional updates (when fields are undefined in `update`).
  - Return value (`false`) in `delete` when no rows are deleted.
- **Design**:
  - Add test case: `findById` and `findLatest` returning `null` when record is not found.
  - Add test case: `create` returning fallback entity if find-by-ID post-creation lookup yields `null`.
  - Add test case: `update` returning `null` when updating non-existent record.
  - Add test case: `update` with empty updates `{}` to cover lines bypassing undefined properties.
  - Add test case: `delete` returning `false` if `deletedCount` is 0.
  - Add test case: `toEntity` handling null `Category` and `Franchise`.

### 3.3. `SequelizeCategoryRepository.ts` & `SequelizeFranchiseRepository.ts`
- **Uncovered Branches**:
  - Optional update properties (when `nameCategory` or `nameFranchise` are undefined).
- **Design**:
  - Add test cases in both repository suites calling `update(id, {})` (empty updates) to test the false branch of `if (category.nameCategory !== undefined)` and `if (franchise.nameFranchise !== undefined)`.

### 3.4. `SequelizeRememberTokenRepository.ts`
- **Uncovered Branches**:
  - `toEntity` handling null `createdAt`.
  - `create` handling omitted `createdAt`.
- **Design**:
  - Add test case: `create` omitting `createdAt` (passing null) uses default `new Date()`.
  - Add test case: `findByHash` mapping a record with a null `createdAt` returns an entity with `createdAt` as null.

---

## 4. Verification Plan

1. **Static Analysis & Linting**:
   - Run `npm run type-check` to verify that there are no TypeScript compilation errors.
   - Run `npm run lint` to verify that there are no unused variables, forbidden `any` types, or formatting errors.
2. **Unit Tests**:
   - Run `npm test` to verify that all existing and new tests pass successfully.
   - Verify that test coverage for the five repository files achieves >= 80% statement and branch coverage.
3. **Application Smoke Test**:
   - Start the app in development (`npm run dev`) and production (`npm start`) to confirm it launches successfully.
