const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
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
      "no-restricted-properties": [
        "error",
        {
          object: "console",
          property: "log",
          message: "Use the structured logger (pino) instead of console.log in production code paths.",
        },
      ],
      "max-lines": [
        "error",
        { max: 250, skipBlankLines: false, skipComments: false },
      ],
    },
  },
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
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: [
      "src/database/seed.js",
      "src/database/migrate.js",
      "src/database/test-prepare.js",
      "tools/architecture/check.js",
    ],
    rules: {
      "no-console": "off",
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/__tests__/**/*.ts", "**/__tests__/**/*.js"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "max-lines": "off",
    },
  },
  eslintConfigPrettier
);
