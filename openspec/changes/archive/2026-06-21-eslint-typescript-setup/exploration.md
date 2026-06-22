# Exploration Report: ESLint TypeScript Setup

This report outlines the findings and proposed plan to configure ESLint in the root project to support TypeScript (`.ts`) files using Flat Config.

## Current Setup Assessment
- **ESLint Version**: `10.4.1` (Flat Config is fully supported and mandatory).
- **TypeScript Version**: `6.0.3` (already installed).
- **Current ESLint Configuration (`eslint.config.js`)**:
  - Uses standard JS configurations.
  - Exports a raw array.
  - CommonJS module format.
- **Project Structure**:
  - Source files are in the `src/` directory.
  - `tsconfig.json` is configured to target files under `src/**/*`.

## Research Findings
- The modern, official way to lint TypeScript with ESLint (especially with ESLint 9/10 flat config) is to use the `typescript-eslint` wrapper package.
- `typescript-eslint` bundles both the parser (`@typescript-eslint/parser`) and the plugin (`@typescript-eslint/eslint-plugin`), simplifying dependency management.
- We should use `tseslint.config(...)` in `eslint.config.js` to define our configuration.
- ESLint v9/v10 has removed the `--ext` flag. In Flat Config, ESLint relies on the `files` patterns specified in the configuration array to determine which files to lint. Adding typescript-eslint's recommended configuration automatically registers parser/rules for TypeScript file patterns.

## Required Dependencies
The following dependency needs to be installed as a development dependency:
- `typescript-eslint` (current version compatible with ESLint 10, e.g., `^8.0.0` or latest).

## Proposed ESLint Flat Configuration
The `eslint.config.js` file will be modified as follows:

```javascript
const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
      "no-unused-vars": "warn",
      "no-console": "warn",
    },
  },
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
  }
);
```

## Risks and Considerations
- **Parser Compatibility**: Ensure all TS rules don't conflict with existing JS rules. Since `tseslint.configs.recommended` only applies to TypeScript files by default, existing JS code will not be impacted by TypeScript-specific rules.
