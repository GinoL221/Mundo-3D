// ESLint for the Astro workspace. Deliberately complementary to
// tools/quality-check.js, which keeps sole ownership of the 250-line cap and
// the console.log ban (it also covers .css, which ESLint cannot parse). This
// config owns what only a real linter can see: unused bindings, floating
// promises, loose equality and unsafe `any` flow.
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'src/styles/**'],
  },

  js.configs.recommended,

  // Type-aware rules for plain TypeScript modules (domains, scripts, lib).
  // .astro files are excluded here on purpose — their frontmatter is parsed
  // by astro-eslint-parser, which does not feed a TS program.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Astro components: syntax-aware linting without type information.
  ...astro.configs['flat/recommended'],

  {
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // The TS-aware unused-vars rule only exists where the plugin is loaded,
  // which the type-checked block above does for **/*.ts only.
  {
    files: ['**/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Everything under src/ ships to the browser: page scripts, domain
  // services and the client-side entry points in src/scripts.
  {
    files: ['src/**/*.{ts,astro}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Build-time tooling and config run under Node instead.
  {
    files: ['tools/**/*.js', '*.config.mjs', '*.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // Vitest specs. The disabled rules are all mock idioms, not defects:
  // `any` is a deliberate tool in fixtures; `json: async () => dto` is the
  // canonical way to stub a Response even with nothing to await; and
  // `fetchMock.mockImplementation(() => Promise.resolve(...))` returns a
  // promise into a signature the rule reads as void-returning.
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  eslintConfigPrettier,
]);
