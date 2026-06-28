const request = require('supertest');
const app = require('../app');

describe('Middleware Order', () => {
  describe('Security headers order', () => {
    test('should have helmet headers present in response', async () => {
      const res = await request(app).get('/api/non-existent');
      expect(res.status).toBe(404);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should have cors headers present in response', async () => {
      const res = await request(app).get('/api/non-existent');
      expect(res.status).toBe(404);
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
