import express, { Request, Response } from 'express';
import request from 'supertest';
import { customCommissionRequestValidators } from '../customCommissionRequestValidators';
import handleValidationErrors from '../../handleValidationErrors';

describe('custom commission request validators', () => {
  const app = express();
  app.use(express.json());
  app.post('/', customCommissionRequestValidators, handleValidationErrors, (req: Request, res: Response) => res.json(req.body));
  it.each([
    [{ name: 'Ari', email: 'ari@example.com', idea: 'Dragon' }, 200],
    [{ name: ' Ari ', email: 'ari@example.com', idea: ' Dragon ', idProduct: 12 }, 200],
    [{ name: '', email: 'ari@example.com', idea: 'Dragon' }, 400],
    [{ name: 'Ari', email: 'not-email', idea: 'Dragon' }, 400],
    [{ name: 'Ari', email: 'ari@example.com', idea: '' }, 400],
    [{ name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: 0 }, 400],
    [{ name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: 1.5 }, 400],
    [{ name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: '12' }, 400],
    [{ name: 'Ari', email: 'ari@example.com', idea: 'Dragon', attachment: 'forbidden' }, 400],
    [{ name: 'A'.repeat(101), email: 'ari@example.com', idea: 'Dragon' }, 400],
    [{ name: 'Ari', email: 'ari@example.com', idea: 'D'.repeat(5001) }, 400],
  ])('validates and trims fields', async (body, status) => {
    const response = await request(app).post('/').send(body);
    expect(response.status).toBe(status);
    if (status === 200) expect(response.body).toEqual({ ...body, name: body.name.trim(), idea: body.idea.trim() });
  });
});
