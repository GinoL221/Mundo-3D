// Explicit opt-in suite: ordinary fast/real-DB tests keep their existing scope.
module.exports = {
  ...require('./jest.integration.config'),
  testMatch: ['**/src/infrastructure/database/__tests__/DemoSandboxProductRepositories.mysql.ts'],
};
