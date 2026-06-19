const request = require('supertest');

describe('CORS Integration Tests', () => {
  jest.setTimeout(20000);

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  it('allows access from default origin http://localhost:3000 when CORS_ORIGIN is unset', async () => {
    delete process.env.CORS_ORIGIN;
    const app = require('../app');

    const res = await request(app)
      .get('/')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('blocks access from other origins when CORS_ORIGIN is unset', async () => {
    delete process.env.CORS_ORIGIN;
    const app = require('../app');

    const res = await request(app)
      .get('/')
      .set('Origin', 'http://malicious.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows access from custom whitelist origin if configured in CORS_ORIGIN', async () => {
    process.env.CORS_ORIGIN = 'https://mundo3d.com';
    const app = require('../app');

    const res = await request(app)
      .get('/')
      .set('Origin', 'https://mundo3d.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://mundo3d.com');
  });

  it('blocks access from default origin if custom whitelist origin is configured', async () => {
    process.env.CORS_ORIGIN = 'https://mundo3d.com';
    const app = require('../app');

    const res = await request(app)
      .get('/')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
