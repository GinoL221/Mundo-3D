# Design: ESLint TypeScript Setup

This design document outlines the technical approach, architecture decisions, and file changes required to integrate TypeScript linting with the existing ESLint flat configuration for the `mundo-3d` project.

## 1. Technical Approach

To achieve type-aware linting while maintaining clean separation from code formatting rules, we will implement the following:
1. **typescript-eslint Integration**: Install `typescript-eslint` as a development dependency. We will use the `tseslint.config()` helper to wrap and merge our configuration objects.
2. **Type-Aware Linting Configuration**: For TypeScript files (`**/*.ts`), we will explicitly configure the parser (`@typescript-eslint/parser`) and parser options pointing to `./tsconfig.json` with the project root directory configured via `tsconfigRootDir: __dirname`.
3. **Strict Linting Rules**:
   - Enforce `@typescript-eslint/no-explicit-any` as an `"error"`.
   - Enforce `@typescript-eslint/no-unused-vars` as an `"error"`, ignoring unused arguments and variables that start with an underscore (e.g. `_req`, `_next`).
   - Disable the base `no-unused-vars` rule on TypeScript files to prevent duplicate reports.
4. **Prettier Separation**: Install and use `eslint-config-prettier` at the end of our flat configuration array to explicitly disable any formatting and stylistic rules that conflict with Prettier.

## 2. Architecture Decisions

### Flat Config Wrapper (`tseslint.config`)
Rather than exporting a raw array of configuration objects, we will utilize the official `tseslint.config(...)` helper. This helper provides TypeScript types for config composition and simplifies extending multiple configurations.

### Target Boundaries
We will isolate TypeScript-specific parser options and rules under a `files: ["**/*.ts", "**/*.tsx"]` pattern. This ensures that:
- Type-aware linting only runs on TypeScript files.
- ESLint will not try to parse vanilla JavaScript files (such as `public/js/**/*.js`) or config files (such as `eslint.config.js`) using the TypeScript parser, which would otherwise fail with TS parser configuration errors.

### Formatting Separation
Code formatting is strictly delegated to Prettier. No formatting rules (e.g. spacing, indentation, semi-colons) will be configured in ESLint. Adding `eslint-config-prettier` at the end of the flat configuration ensures that any formatting rules enabled by recommended configurations are disabled.

## 3. Configuration & Dependency Details

### Designed `eslint.config.js`
The updated configuration file will have the following structure:

```javascript
const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  // ESLint recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Global settings for all JavaScript and TypeScript files
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "no-console": "warn",
    },
  },

  // TypeScript files configuration
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Disable base rule to prevent duplicate warnings/errors
      "no-unused-vars": "off",
      // Strict type safety rule enforcement
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Specific settings for browser scripts
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
  },

  // Prettier config to override and disable conflicting styling rules
  eslintConfigPrettier
);
```

### DevDependencies and Scripts in `package.json`

To implement this design, we will add the following devDependencies:
- `typescript-eslint`: `^8.24.0`
- `eslint-config-prettier`: `^10.0.1`

The `lint` script in `package.json` will remain as:
- `"lint": "eslint src/"`

This script will run ESLint across all files under `src/`. Thanks to flat config file matching, ESLint will automatically match and lint both JavaScript and TypeScript files.

## 4. File Changes

### Modified Files
- [eslint.config.js](file:///home/ginopc/Desarrollo/Mundo-3D/eslint.config.js): Migrate config array to `tseslint.config` and apply type-aware TS rules and Prettier configuration.
- [package.json](file:///home/ginopc/Desarrollo/Mundo-3D/package.json): Add `typescript-eslint` and `eslint-config-prettier` to devDependencies.

### Created Files
- [design.md](file:///home/ginopc/Desarrollo/Mundo-3D/openspec/changes/eslint-typescript-setup/design.md): This design document.

## 5. Verification & Testing Strategy

### Scenario 1: Clean Lint Execution
- Run `npm run lint` on the codebase. It must complete with a status code of `0` and report zero errors or warnings on clean files.

### Scenario 2: Error on Explicit Any
- Add a temporary file `src/temp-any-test.ts` containing:
  ```typescript
  const testVal: any = "explicit-any";
  ```
- Run `npm run lint`. It must report an error for the `@typescript-eslint/no-explicit-any` rule and exit with a non-zero code.

### Scenario 3: Error on Unused Variables
- Add a temporary file `src/temp-unused-test.ts` containing:
  ```typescript
  const unusedVal = 42;
  ```
- Run `npm run lint`. It must report an error for the `@typescript-eslint/no-unused-vars` rule and exit with a non-zero code.

### Scenario 4: Permitting Unused Variables with Underscore Prefix
- Add a temporary file `src/temp-underscore-test.ts` containing:
  ```typescript
  const _unusedVal = 42;
  export function run(_req: any) {} // Note: `any` will trigger a different error, but the parameter name is allowed
  ```
- Run `npm run lint`. It must not report any `@typescript-eslint/no-unused-vars` errors.

### Scenario 5: Prettier Formatting Compatibility
- Ensure that formatting variations (such as double/single quotes or semicolons) do not trigger any ESLint warnings or errors, confirming that `eslint-config-prettier` is active and overriding rules.

## 6. Open Questions
- **Prettier integration checking**: We are disabling formatting rules in ESLint. Do we want a pre-commit hook (like `lint-staged`) to format files automatically? *(Recommendation: While useful, that is out of scope for this linting setup change.)*
