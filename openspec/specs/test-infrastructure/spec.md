# Specification: Test Infrastructure Stabilization

## Purpose

Establish stable, fast, and type-safe test execution patterns for `Mundo-3D` and improve test coverage of repositories while ensuring strict TypeScript compilation.

## Requirements

### Requirement: Jest Execution & Compilation Speed

Jest test executions MUST compile modules quickly without triggering test runner timeouts.
1. **Isolated Modules Compilation**: The `ts-jest` transformer in Jest MUST be configured with `isolatedModules: true` to bypass type-checking during test transpilations, relying on an independent type check step.
2. **Conditional ts-node Registration**: Dynamic TS loading hooks (`ts-node/register`) in `backend/src/app.js` MUST NOT register when the application runs in a test environment (`process.env.NODE_ENV === 'test'`), avoiding duplicate compilation hooks.
3. **No Redundant Module Resets**: Test files that do not dynamically re-evaluate modules MUST NOT call `jest.resetModules()`.

#### Scenario: Compiling TS tests with Jest
- GIVEN a TS test is executed with Jest
- WHEN the test transpile starts
- THEN `ts-jest` MUST compile the test modules using `isolatedModules: true`
- AND the runner MUST NOT invoke full type checking during transpilations.

#### Scenario: Launching App in Test Environment
- GIVEN the application is required in a test file (e.g., `supertest(app)`)
- WHEN `backend/src/app.js` is imported
- THEN `ts-node/register` MUST NOT be registered.

---

### Requirement: Middleware Type Safety

Middlewares written in TypeScript MUST compile successfully under strict compiler configuration without using the `any` type.
Specifically, in `backend/src/infrastructure/middlewares/userLogged.ts`, variables representing logged-in users assigned to `req.session.userLogged` MUST be explicitly typed or casted to their respective type contracts (`Partial<UserDTO> & Record<string, unknown>`) instead of using `any`.

#### Scenario: Assigning logged user to session
- GIVEN a verified `user` DTO object of type `UserDTO`
- WHEN assigning the user object to `session.userLogged`
- THEN the assignment MUST be casted to `Partial<UserDTO> & Record<string, unknown>` to ensure type safety and avoid compiler errors.

---

### Requirement: Repository Coverage Threshold

All data repository implementations (Category, Franchise, Product, RememberToken, ShoppingCart) MUST achieve at least 80% statement and branch coverage. The existing unit testing architecture using mocked Sequelize model instances MUST be preserved (no database dependencies).

#### Scenario: Testing ShoppingCart repository sync
- GIVEN a set of shopping cart items to sync
- WHEN `syncCart` is invoked
- THEN it MUST open a Sequelize transaction, delete active items, create new items, and commit the transaction
- AND if any database operation fails, the transaction MUST be rolled back and the error thrown.

#### Scenario: Testing Category repository updates
- GIVEN a mock Category instance
- WHEN calling `update` with partial data or non-existent IDs
- THEN it MUST handle updating appropriate attributes and handle `null` fallbacks.

#### Scenario: Testing Franchise repository updates
- GIVEN a mock Franchise instance
- WHEN calling `update` with partial data or non-existent IDs
- THEN it MUST handle updating appropriate attributes and handle `null` fallbacks.

#### Scenario: Testing RememberToken repository queries and updates
- GIVEN a mock RememberToken instance
- WHEN calling `findByToken` or `create` or `delete`
- THEN it MUST handle empty query results returning `null` or valid mappings.

#### Scenario: Testing Product repository queries
- GIVEN a product query by ID
- WHEN calling `findById` or `findLatest`
- THEN if a product is not found, the repository MUST return `null` and handle creation fallback scenarios properly.
