module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.js", "**/src/**/*.test.ts"],
  // Real-DB integration tests (*.integration.test.ts) run separately via
  // `npm run test:integration` (see jest.integration.config.js) so plain
  // `npm test` stays fast, mock-only, and DB-independent for local devs.
  testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\.ts$"],
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
