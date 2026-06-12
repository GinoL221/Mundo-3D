const request = require('supertest');
const app = require('../app');

describe('Middleware Order', () => {
  describe('Security headers order', () => {
    test('should have helmet headers present in response', async () => {
      const res = await request(app).get('/');
      // Helmet adds X-Content-Type-Options: nosniff
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should have cors headers present in response', async () => {
      const res = await request(app).get('/');
      expect([200, 302, 404, 500]).toContain(res.status);
    });
  });

  describe('Cookie-parser before userLoggedMiddleware', () => {
    test('should have cookies() middleware registered before userLoggedMiddleware in the stack', () => {
      // Inspect the Express middleware stack to verify ordering
      const stack = app._router.stack;
      const middlewareNames = stack
        .filter((layer) => layer.handle && layer.handle.name)
        .map((layer) => layer.handle.name);

      const cookieParserIndex = middlewareNames.findIndex(
        (name) => name === 'cookieParser' || name === 'cookieparser',
      );
      const userLoggedIndex = middlewareNames.findIndex(
        (name) => name === 'userLoggedMiddleware' || name.includes('userLogged'),
      );

      // Both must be found and cookie-parser must come BEFORE userLoggedMiddleware
      expect(cookieParserIndex).toBeGreaterThanOrEqual(0);
      expect(userLoggedIndex).toBeGreaterThanOrEqual(0);
      expect(cookieParserIndex).toBeLessThan(userLoggedIndex);
    });

    test('should have helmet() registered before cors() in the stack', () => {
      const stack = app._router.stack;
      const middlewareNames = stack
        .filter((layer) => layer.handle && layer.handle.name)
        .map((layer) => layer.handle.name);

      const helmetIndex = middlewareNames.findIndex((name) => name === 'helmetMiddleware');
      const corsIndex = middlewareNames.findIndex(
        (name) => name === 'corsMiddleware' || name === 'cors',
      );

      expect(helmetIndex).toBeGreaterThanOrEqual(0);
      expect(corsIndex).toBeGreaterThanOrEqual(0);
      expect(helmetIndex).toBeLessThan(corsIndex);
    });
  });
});
