module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.js', '**/src/**/*.test.ts'],
  // Real-DB integration tests (*.integration.test.ts) run separately via
  // `pnpm --filter backend test:integration` (see jest.integration.config.js) so plain
  // `pnpm --filter backend test` stays fast, mock-only, and DB-independent for local devs.
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.(ts|js)$'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest',
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
    '!src/database/test-prepare.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  // Ratcheted below the actual 94.57/93.69/85.94/84.2 (2026-08-31 audit) —
  // enough margin for normal fluctuation, still high enough to catch a real
  // regression instead of the old 50% floor, which protected nothing.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
};
