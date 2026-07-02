// Config for REAL-DATABASE integration tests only (*.integration.test.ts).
// Run via `npm run test:integration`. Requires a reachable MySQL/MariaDB
// (DB_HOST/DB_USER/DB_PASS env vars — see database/config/config.js's
// `test` environment). Kept separate from jest.config.js so the default
// `npm test` stays fast, mock-only, and DB-independent for local devs
// without MySQL running.
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/**/*.integration.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true }],
  },
  testTimeout: 30000,
};
