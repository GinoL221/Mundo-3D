// Config for REAL-DATABASE integration tests only (*.integration.test.ts or
// *.integration.test.js). Run via `npm run test:integration`. Requires a
// reachable MySQL/MariaDB (DB_HOST/DB_USER/DB_PASS env vars — see
// database/config/config.js's `test`/`development` environments). Kept
// separate from jest.config.js so the default `npm test` stays fast,
// mock-only, and DB-independent for local devs without MySQL running.
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/**/*.integration.test.ts", "**/src/**/*.integration.test.js"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true }],
  },
  testTimeout: 30000,
};
