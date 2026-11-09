import express, { Request, Response } from 'express';
import request from 'supertest';

describe('revokeRefreshLimiter middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('proves the budget is consumed by successful (204) revokes and blocks when exhausted', async () => {
    process.env.REVOKE_REFRESH_LIMIT_MAX = '3';
    process.env.REVOKE_REFRESH_LIMIT_WINDOW = '60000';

    let revokeRefreshLimiter: any;
    jest.isolateModules(() => {
      revokeRefreshLimiter = require('../revokeRefreshLimiter').default;
    });

    const app = express();
    app.use(revokeRefreshLimiter);
    app.post('/api/users/refresh/revoke', (_req: Request, res: Response) => {
      res.status(204).end();
    });

    // Requests 1, 2, 3 succeed with 204
    const res1 = await request(app).post('/api/users/refresh/revoke');
    expect(res1.status).toBe(204);

    const res2 = await request(app).post('/api/users/refresh/revoke');
    expect(res2.status).toBe(204);

    const res3 = await request(app).post('/api/users/refresh/revoke');
    expect(res3.status).toBe(204);

    // Request 4 must be rate-limited (429) because successful requests are NOT skipped
    const res4 = await request(app).post('/api/users/refresh/revoke');
    expect(res4.status).toBe(429);
    expect(res4.body).toEqual({
      error: 'Demasiados intentos de revocación de sesión. Intente nuevamente en 15 minutos.',
    });
  });
});
