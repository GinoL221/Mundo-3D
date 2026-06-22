# Tasks: ESLint and TypeScript Integration

Forecast:
```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Phase 1: Foundation
- [x] Add `typescript-eslint` (`^8.24.0`) and `eslint-config-prettier` (`^10.0.1`) to `package.json` devDependencies.
- [x] Run `npm install` to install the newly added dependencies and update `package-lock.json`.

## Phase 2: Configuration
- [x] Update `eslint.config.js` to migrate to the Flat Config utilizing the `tseslint.config()` helper.
- [x] Merge base JavaScript rules (`js.configs.recommended`) and TypeScript recommended rules (`...tseslint.configs.recommended`).
- [x] Configure `no-unused-vars` to `"off"` in the TypeScript file matching section to prevent double reporting.
- [x] Enable `@typescript-eslint/no-explicit-any` as an `"error"`.
- [x] Enable `@typescript-eslint/no-unused-vars` as an `"error"`, with exceptions for variables/arguments starting with an underscore (regex: `^_`).
- [x] Append `eslint-config-prettier` at the end of the configuration array to disable stylistic formatting rules.

## Phase 3: Remediate Existing Code
- [x] Run the lint script (`npm run lint`) to identify violations in the `src/` directory.
- [x] Address explicit `any` declarations in the codebase (e.g., in controllers, repositories, and middlewares) by replacing them with specific types, interfaces, or `unknown` where applicable.
- [x] Fix unused variables and arguments or prefix them with `_` if they are required by method signatures.

## Phase 4: Verification
- [x] Run `npm run lint` on the codebase to ensure it completes successfully (exit code 0) with zero errors and warnings.
- [x] Verify that explicit `any` usage triggers an error:
  - Create a temporary file `src/temp-any-test.ts` with `const val: any = 1;`.
  - Run `npm run lint` and verify it fails with the `@typescript-eslint/no-explicit-any` error.
- [x] Verify that unused variables trigger an error:
  - Create a temporary file `src/temp-unused-test.ts` with `const unusedVal = 42;`.
  - Run `npm run lint` and verify it fails with the `@typescript-eslint/no-unused-vars` error.
- [x] Verify that underscore-prefixed unused variables are allowed:
  - Create a temporary file `src/temp-underscore-test.ts` with `const _unusedVal = 42;`.
  - Run `npm run lint` and verify it succeeds (or does not report unused variable errors on that line).
- [x] Delete all temporary test files (`src/temp-any-test.ts`, `src/temp-unused-test.ts`, `src/temp-underscore-test.ts`).
