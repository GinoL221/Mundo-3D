import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import router from '../customCommissionRequests';

describe('custom commission request routes', () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/', router);

  it('accepts a public request only after validating the required fields', async () => {
    const response = await request(app).post('/').send({ name: ' ', email: 'bad', idea: '' });
    expect(response.status).toBe(400);
  });

  it('does not echo submitted PII in public validation errors', async () => {
    const canary = 'PII-CANARY-private-user-7139@example.invalid';
    const response = await request(app).post('/').send({ name: `${canary}${'x'.repeat(110)}`, email: 'invalid-email', idea: canary });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain(canary);
  });

  it('requires authentication before listing request PII', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).not.toBe('public');
  });
});
