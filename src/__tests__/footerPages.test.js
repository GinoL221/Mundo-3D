const request = require('supertest');
const app = require('../app');

describe('Footer Pages Integration Tests', () => {
  test('GET /terms should return 200 and contain relevant heading', async () => {
    const res = await request(app).get('/terms');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Términos y condiciones');
  });

  test('GET /privacy should return 200 and contain relevant heading', async () => {
    const res = await request(app).get('/privacy');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Política de privacidad');
  });

  test('GET /faq should return 200 and contain relevant heading', async () => {
    const res = await request(app).get('/faq');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Preguntas frecuentes');
  });

  test('GET /step-by-step should return 200 and contain relevant heading', async () => {
    const res = await request(app).get('/step-by-step');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Paso a paso');
  });

  test('GET /help should return 200 and contain relevant heading', async () => {
    const res = await request(app).get('/help');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Ayuda');
  });
});
