import { runRefreshTokenMysqlFixture } from './refreshTokenIsolationFixture';

// No live run is permitted until endpoint ownership and physical-session
// binding have been implemented and independently reviewed.
test('refresh-token MySQL isolation requires a verified fixture', async () => {
  await runRefreshTokenMysqlFixture();
});
