const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { AUTH_COOKIE } = require('../infrastructure/security/cookieOptions');
const { accessTokenSignOptions } = require('../infrastructure/security/jwtOptions');

// Proves cookie-parser is wired into the app: without it, req.cookies is
// undefined and apiAuthMiddleware always answers 401, regardless of the
// Cookie header the client actually sent.
describe('cookie-parser wiring', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses the auth cookie so a valid but non-admin token reaches adminGuard (403, not 401)', async () => {
    const token = jwt.sign(
      { userId: 1, idRole: 2, typ: 'access' },
      'test-only-jwt-secret-not-for-production',
      accessTokenSignOptions('2h')
    );

    const res = await request(app).get('/api/users').set('Cookie', `${AUTH_COOKIE}=${token}`);

    expect(res.status).toBe(403);
  });

  it('rejects the same protected route with 401 when no auth cookie is sent', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
  });
});
