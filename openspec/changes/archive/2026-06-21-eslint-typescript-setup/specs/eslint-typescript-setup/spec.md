# ESLint TypeScript Setup Specification

## Purpose
Establishes the technical requirements and validation criteria for migrating the project's ESLint configuration to a modern, flat-config-based TypeScript linting setup. This enforces strict type safety, type-aware linting, and code quality standards while keeping formatting rules separate in Prettier.

## Requirements

### Requirement 1: Flat Config and TypeScript-ESLint Integration
The project's ESLint configuration MUST use the modern Flat Config format and utilize `typescript-eslint` to support TypeScript parsing and rule sets.
- The package `typescript-eslint` MUST be installed as a development dependency.
- The `eslint.config.js` file MUST use the `tseslint.config()` helper or standard export arrays configured with `typescript-eslint` utilities.

### Requirement 2: Type-Aware Linting
ESLint MUST be configured to perform type-aware linting for all TypeScript files in `src/`.
- The parser MUST be set to `@typescript-eslint/parser`.
- The parser options MUST configure project-aware type analysis pointing to `./tsconfig.json` (e.g., `parserOptions.project` or using `projectService`).

### Requirement 3: Strict No-Explicit-Any Enforcement
The codebase MUST NOT allow explicit use of the `any` type in TypeScript files.
- The `@typescript-eslint/no-explicit-any` rule MUST be configured with a severity of `"error"`.

### Requirement 4: Strict Unused Variables Enforcement
Unused variables and arguments MUST be flagged by ESLint, except when explicitly marked.
- The `@typescript-eslint/no-unused-vars` rule MUST be configured with a severity of `"error"`.
- It MUST ignore unused variables or arguments whose names are prefixed with an underscore (e.g., `_req`, `_next`, `_`).

### Requirement 5: Separation of Concerns from Prettier
ESLint MUST NOT configure rules that dictate formatting code style (such as spacing, quotes, line endings, or braces placement), which are handled by Prettier.
- ESLint rules MUST only target code quality, logic, and type-safety.
- If necessary, `eslint-config-prettier` SHOULD be used, or conflicting formatting rules MUST be explicitly turned off.

### Requirement 6: Codebase Cleanliness and Coverage
All source code files under `src/` (both JavaScript and TypeScript) MUST be fully covered by the linting process.
- The `npm run lint` script in `package.json` MUST execute ESLint.
- The configuration and script MUST ensure that running `npm run lint` finishes with a status code of 0 and reports zero errors or warnings on the current codebase.
- Any existing violations of the strict type-safety rules in the `src/` directory MUST be corrected during implementation.

---

## Verification Scenarios

### Scenario 1: Clean Lint Execution
- GIVEN a compliant codebase with all dependencies and configurations correctly set up
- WHEN `npm run lint` is executed in the root directory
- THEN the linting process MUST complete with zero errors and zero warnings
- AND the exit code of the command MUST be 0

### Scenario 2: Error on Explicit Any Usage
- GIVEN a TypeScript source file under `src/` containing an explicit type annotation of `any` (e.g., `const value: any = "test";`)
- WHEN `npm run lint` is executed
- THEN ESLint MUST report a linting error for `@typescript-eslint/no-explicit-any`
- AND the command MUST return a non-zero exit code

### Scenario 3: Error on Unused Variables
- GIVEN a TypeScript source file under `src/` containing a variable declaration that is not used and is not prefixed with an underscore (e.g., `const unusedValue = 42;`)
- WHEN `npm run lint` is executed
- THEN ESLint MUST report a linting error for `@typescript-eslint/no-unused-vars`
- AND the command MUST return a non-zero exit code

### Scenario 4: Permitting Unused Variables with Underscore Prefix
- GIVEN a TypeScript source file under `src/` containing an unused variable or parameter prefixed with an underscore (e.g., `const _temp = 42;` or `function handle(_req: Request) {}`)
- WHEN `npm run lint` is executed
- THEN ESLint MUST NOT report a linting error or warning for that variable/parameter

### Scenario 5: Prettier Formatting Compatibility
- GIVEN the ESLint rules configuration
- WHEN ESLint runs on files in the project
- THEN it MUST NOT raise errors or warnings for formatting style variations (such as semi-colons, single vs double quotes, or indentation) that are managed by Prettier
