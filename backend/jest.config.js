module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.js', '**/src/**/*.test.ts'],
  // Real-DB integration tests (*.integration.test.ts) run separately via
  // `pnpm --filter backend test:integration` (see jest.integration.config.js) so plain
  // `pnpm --filter backend test` stays fast, mock-only, and DB-independent for local devs.
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.(ts|js)$'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
  // JS+TS production scope (spec: Jest Coverage Collection Configuration).
  // Excludes tests/types plus operational CLI-only DB tooling that runs
  // against a live database and is not part of the running Express app
  // (dev/test setup scripts, declarative migrations). Exclusions are
  // reported by scripts/generate-coverage-risk-map.js, never hidden.
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/database/migrations/**',
    '!src/database/reset-db.js',
    '!src/database/test-prepare.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
