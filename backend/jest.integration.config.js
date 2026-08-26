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
  // Every integration file bootstraps the SAME shared mundo_3d_test database
  // (testDb.ts's bootstrapTestDatabase(), explicitly "idempotent per
  // process" — Jest runs each file in its own process). Parallel workers let
  // two files' sync({force:false}) race the same non-idempotent
  // `ALTER TABLE ... ADD INDEX`, which fails with a duplicate-key error on
  // the loser. Serial execution is the correct fix: these tests share a live
  // database and shouldn't run schema/bootstrap operations concurrently.
  maxWorkers: 1,
};
