const request = require('supertest');
const express = require('express');
const app = require('../app');

// Proxy-Aware Runtime + Proxy-Aware Login Rate Limiting.
// Render terminates TLS at exactly one edge hop, so the app must trust
// precisely that hop: req.ip (and the rate-limiter key derived from it)
// then resolves to the real client address carried in X-Forwarded-For,
// and one abusive client can never lock every other client out.
describe('trust proxy — proxy-aware runtime and rate limiting', () => {
  const ENV_KEYS = ['NODE_ENV', 'LOGIN_LIMIT_MAX', 'LOGIN_LIMIT_WINDOW'];
  const original = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    jest.resetModules();
  });

  // Loads the real login limiter middleware with the NODE_ENV==='test'
  // short-circuit (loginLimiter.ts) disabled, so express-rate-limit runs
  // for real. Env is restored by afterEach.
  function loadRealLoginLimiter({ max }) {
    process.env.NODE_ENV = 'production';
    process.env.LOGIN_LIMIT_MAX = String(max);
    process.env.LOGIN_LIMIT_WINDOW = '60000';
    let middleware;
    jest.isolateModules(() => {
      middleware = require('../infrastructure/middlewares/loginLimiter').default;
    });
    return middleware;
  }

  // `status` models the login outcome. It matters because loginLimiter now
  // sets skipSuccessfulRequests: only failed attempts spend the budget, so a
  // stub that always answered 200 would be refunded every hit and could
  // never reach the cap.
  function buildProxyApp({ trustProxy, limiter, status = 200 }) {
    const proxyApp = express();
    if (trustProxy !== undefined) proxyApp.set('trust proxy', trustProxy);
    proxyApp.post('/login', limiter, (req, res) => res.status(status).json({ ip: req.ip }));
    return proxyApp;
  }

  it('the exported production app trusts exactly one proxy hop', () => {
    expect(app.get('trust proxy')).toBe(1);
  });

  it('resolves req.ip from the forwarded client IP when trusting one hop', async () => {
    const limiter = loadRealLoginLimiter({ max: 100 });
    const proxyApp = buildProxyApp({ trustProxy: 1, limiter });

    const res = await request(proxyApp).post('/login').set('X-Forwarded-For', '203.0.113.7');

    expect(res.status).toBe(200);
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('ignores a client-forged leading hop and uses the proxy-appended client IP', async () => {
    const limiter = loadRealLoginLimiter({ max: 100 });
    const proxyApp = buildProxyApp({ trustProxy: 1, limiter });

    // Client forged "1.2.3.4"; Render's edge appended the true client IP last.
    const res = await request(proxyApp)
      .post('/login')
      .set('X-Forwarded-For', '1.2.3.4, 198.51.100.23');

    expect(res.body.ip).toBe('198.51.100.23');
  });

  it('rate-limits each forwarded client IP in its own bucket: one client at the cap does not 429 another', async () => {
    const limiter = loadRealLoginLimiter({ max: 2 });
    // 401: only failed attempts count against the budget now.
    const proxyApp = buildProxyApp({ trustProxy: 1, limiter, status: 401 });
    const clientA = '203.0.113.10';
    const clientB = '203.0.113.20';

    // Client A exhausts its budget of 2 failures, so its 3rd attempt is refused.
    const a1 = await request(proxyApp).post('/login').set('X-Forwarded-For', clientA);
    const a2 = await request(proxyApp).post('/login').set('X-Forwarded-For', clientA);
    const a3 = await request(proxyApp).post('/login').set('X-Forwarded-For', clientA);
    expect([a1.status, a2.status, a3.status]).toEqual([401, 401, 429]);

    // Client B, a different forwarded IP, gets its own fresh bucket (proves
    // the limiter key really is the forwarded IP, not a shared/proxy value).
    const b1 = await request(proxyApp).post('/login').set('X-Forwarded-For', clientB);
    expect(b1.status).toBe(401);
  });
});
