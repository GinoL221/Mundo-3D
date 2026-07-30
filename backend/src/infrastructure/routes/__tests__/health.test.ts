import request from 'supertest';
import express, { Express } from 'express';

// Mocked so the regression test below never touches a real database —
// it only needs to prove /api/products is not gated by readiness state.
jest.mock('../../../application/use-cases/ListProductsUseCase', () => ({
  ListProductsUseCase: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue([]),
  })),
}));

const { markReady, markUnready } = require('../../health/readinessState');

const buildHealthApp = (): Express => {
  const healthRouter = require('../health').default;
  const app = express();
  app.use('/health', healthRouter);
  return app;
};

describe('health routes', () => {
  afterEach(() => {
    markUnready();
  });

  describe('GET /health/live', () => {
    it('returns 200 with ok body and no-store header regardless of readiness', async () => {
      const app = buildHealthApp();

      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('GET /health/ready', () => {
    it('returns 503 with unavailable body before markReady()', async () => {
      const app = buildHealthApp();

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'unavailable' });
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('returns 200 with ok body after markReady()', async () => {
      markReady();
      const app = buildHealthApp();

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('GET /api/products regression', () => {
    it('is not gated by readiness state (stays non-503) while isReady() is false', async () => {
      markUnready();
      const fullApp = require('../../../app');

      const res = await request(fullApp).get('/api/products');

      expect(res.status).not.toBe(503);
    });
  });

  describe('mounted at /health in the real app', () => {
    it('serves /health/live and /health/ready through the actual app.js mount point', async () => {
      const fullApp = require('../../../app');

      const liveRes = await request(fullApp).get('/health/live');
      expect(liveRes.status).toBe(200);
      expect(liveRes.body).toEqual({ status: 'ok' });

      const readyBeforeRes = await request(fullApp).get('/health/ready');
      expect(readyBeforeRes.status).toBe(503);

      markReady();
      const readyAfterRes = await request(fullApp).get('/health/ready');
      expect(readyAfterRes.status).toBe(200);
    });
  });
});
