// Deliberately separate from ordinary test discovery; the live fixture remains disabled.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/infrastructure/database/__tests__/RefreshTokenSandboxIsolation.mysql.ts'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },
};
