import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { Role } from '../../../../domain/Role';
import { authCookie, authAndCsrf } from '../../../../__tests__/helpers/apiAuthTestHelpers';

const mockCreateExecute = jest.fn();
const mockUpdateExecute = jest.fn();
const mockDeleteExecute = jest.fn();
const mockAdjustStockExecute = jest.fn();

jest.mock('../../../../application/use-cases/CreateProductUseCase', () => ({
  CreateProductUseCase: jest.fn().mockImplementation(() => ({ execute: mockCreateExecute })),
}));

jest.mock('../../../../application/use-cases/UpdateProductUseCase', () => ({
  UpdateProductUseCase: jest.fn().mockImplementation(() => ({ execute: mockUpdateExecute })),
}));

jest.mock('../../../../application/use-cases/DeleteProductUseCase', () => ({
  DeleteProductUseCase: jest.fn().mockImplementation(() => ({ execute: mockDeleteExecute })),
}));

jest.mock('../../../../application/use-cases/AdjustProductStockUseCase', () => ({
  AdjustProductStockUseCase: jest.fn().mockImplementation(() => ({ execute: mockAdjustStockExecute })),
}));

import errorHandler from '../../../middlewares/errorHandler';

// This is the integration-level guard-matrix test for the product mutation
// routes (product-inventory-admin PR2, cookie/CSRF-migrated in
// jwt-cookie-migration PR2). It exercises the real Express pipeline —
// apiAuthMiddleware → csrfGuard → requireRoles → upload/validators →
// controller — with only the use-case classes mocked at the module boundary,
// so it never touches a real database (stays in the default `npm test`
// mock-only suite; see
// backend/src/infrastructure/repositories/__tests__/*.integration.test.ts
// for the separate real-DB suite run via `npm run test:integration`).
const buildApp = (): Express => {
  const productsRouter = require('../products').default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', productsRouter);
  app.use(errorHandler);
  return app;
};

const adminAuth = authAndCsrf({ userId: 1, email: 'principal@test.com', category: 'test', idRole: Role.ADMIN });
const staffAuth = authAndCsrf({ userId: 1, email: 'principal@test.com', category: 'test', idRole: Role.STAFF });
const userAuth = authAndCsrf({ userId: 1, email: 'principal@test.com', category: 'test', idRole: Role.USER });

const validProductFields = {
  nameProduct: 'Super Mario 3D',
  price: '1250',
  descriptionProduct: 'An awesome action figure',
  idCategory: '1',
  idFranchise: '2',
};

describe('api/products mutation routes — guard matrix', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  describe('POST /api/products', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).post('/api/products').send(validProductFields);

      expect(res.status).toBe(401);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns 401 with a bad/malformed auth cookie', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Cookie', authCookie('not-a-real-token'))
        .send(validProductFields);

      expect(res.status).toBe(401);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns 201 for STAFF with a valid multipart request', async () => {
      mockCreateExecute.mockResolvedValue({ idProduct: 1, ...validProductFields, stock: 0 });

      const res = await request(app)
        .post('/api/products')
        .set('Cookie', staffAuth.cookie)
        .set('X-CSRF-Token', staffAuth.csrfToken)
        .field(validProductFields)
        .attach('image', Buffer.from('fake-image-bytes'), 'test.png');

      expect(res.status).toBe(201);
      expect(mockCreateExecute).toHaveBeenCalled();
    });

    it('returns 201 for ADMIN with a valid multipart request', async () => {
      mockCreateExecute.mockResolvedValue({ idProduct: 1, ...validProductFields, stock: 0 });

      const res = await request(app)
        .post('/api/products')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .field(validProductFields)
        .attach('image', Buffer.from('fake-image-bytes'), 'test.png');

      expect(res.status).toBe(201);
      expect(mockCreateExecute).toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not in the create allow-list)', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Cookie', userAuth.cookie)
        .set('X-CSRF-Token', userAuth.csrfToken)
        .field(validProductFields)
        .attach('image', Buffer.from('fake-image-bytes'), 'test.png');

      expect(res.status).toBe(403);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when the CSRF token is missing', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Cookie', adminAuth.cookie)
        .field(validProductFields)
        .attach('image', Buffer.from('fake-image-bytes'), 'test.png');

      expect(res.status).toBe(403);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/products/:id', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).put('/api/products/1').send({ nameProduct: 'Updated Name Here' });

      expect(res.status).toBe(401);
      expect(mockUpdateExecute).not.toHaveBeenCalled();
    });

    it('returns 401 with a bad/malformed auth cookie', async () => {
      const res = await request(app)
        .put('/api/products/1')
        .set('Cookie', authCookie('not-a-real-token'))
        .send({ nameProduct: 'Updated Name Here' });

      expect(res.status).toBe(401);
      expect(mockUpdateExecute).not.toHaveBeenCalled();
    });

    it('returns 200 for STAFF', async () => {
      mockUpdateExecute.mockResolvedValue({ idProduct: 1, nameProduct: 'Updated Name Here', stock: 5 });

      const res = await request(app)
        .put('/api/products/1')
        .set('Cookie', staffAuth.cookie)
        .set('X-CSRF-Token', staffAuth.csrfToken)
        .send({ nameProduct: 'Updated Name Here' });

      expect(res.status).toBe(200);
      expect(mockUpdateExecute).toHaveBeenCalled();
    });

    it('returns 200 for ADMIN', async () => {
      mockUpdateExecute.mockResolvedValue({ idProduct: 1, nameProduct: 'Updated Name Here', stock: 5 });

      const res = await request(app)
        .put('/api/products/1')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .send({ nameProduct: 'Updated Name Here' });

      expect(res.status).toBe(200);
      expect(mockUpdateExecute).toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not in the update allow-list)', async () => {
      const res = await request(app)
        .put('/api/products/1')
        .set('Cookie', userAuth.cookie)
        .set('X-CSRF-Token', userAuth.csrfToken)
        .send({ nameProduct: 'Updated Name Here' });

      expect(res.status).toBe(403);
      expect(mockUpdateExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when the CSRF token is missing', async () => {
      const res = await request(app)
        .put('/api/products/1')
        .set('Cookie', adminAuth.cookie)
        .send({ nameProduct: 'Updated Name Here' });

      expect(res.status).toBe(403);
      expect(mockUpdateExecute).not.toHaveBeenCalled();
    });

    it('never forwards a stock field present in the request body to the use case', async () => {
      mockUpdateExecute.mockResolvedValue({ idProduct: 1, nameProduct: 'Updated Name Here', stock: 5 });

      await request(app)
        .put('/api/products/1')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .send({ nameProduct: 'Updated Name Here', stock: 999 });

      const calledInput = mockUpdateExecute.mock.calls[0][1];
      expect(calledInput).not.toHaveProperty('stock');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).delete('/api/products/1');

      expect(res.status).toBe(401);
      expect(mockDeleteExecute).not.toHaveBeenCalled();
    });

    it('returns 401 with a bad/malformed auth cookie', async () => {
      const res = await request(app)
        .delete('/api/products/1')
        .set('Cookie', authCookie('not-a-real-token'));

      expect(res.status).toBe(401);
      expect(mockDeleteExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for STAFF (delete is ADMIN-only)', async () => {
      const res = await request(app)
        .delete('/api/products/1')
        .set('Cookie', staffAuth.cookie)
        .set('X-CSRF-Token', staffAuth.csrfToken);

      expect(res.status).toBe(403);
      expect(mockDeleteExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when the CSRF token is missing', async () => {
      const res = await request(app).delete('/api/products/1').set('Cookie', adminAuth.cookie);

      expect(res.status).toBe(403);
      expect(mockDeleteExecute).not.toHaveBeenCalled();
    });

    it('returns 204 for ADMIN', async () => {
      mockDeleteExecute.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/products/1')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken);

      expect(res.status).toBe(204);
      expect(mockDeleteExecute).toHaveBeenCalledWith(1);
    });
  });

  describe('PATCH /api/products/:id/stock', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).patch('/api/products/1/stock').send({ delta: 1 });

      expect(res.status).toBe(401);
      expect(mockAdjustStockExecute).not.toHaveBeenCalled();
    });

    it('returns 401 with a bad/malformed auth cookie', async () => {
      const res = await request(app)
        .patch('/api/products/1/stock')
        .set('Cookie', authCookie('not-a-real-token'))
        .send({ delta: 1 });

      expect(res.status).toBe(401);
      expect(mockAdjustStockExecute).not.toHaveBeenCalled();
    });

    it('returns 200 for STAFF', async () => {
      mockAdjustStockExecute.mockResolvedValue({ idProduct: 1, stock: 8 });

      const res = await request(app)
        .patch('/api/products/1/stock')
        .set('Cookie', staffAuth.cookie)
        .set('X-CSRF-Token', staffAuth.csrfToken)
        .send({ delta: 3 });

      expect(res.status).toBe(200);
      expect(mockAdjustStockExecute).toHaveBeenCalledWith(1, 3);
    });

    it('returns 200 for ADMIN', async () => {
      mockAdjustStockExecute.mockResolvedValue({ idProduct: 1, stock: 8 });

      const res = await request(app)
        .patch('/api/products/1/stock')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .send({ delta: 3 });

      expect(res.status).toBe(200);
      expect(mockAdjustStockExecute).toHaveBeenCalledWith(1, 3);
    });

    it('returns 403 for an authenticated USER (not in the stock allow-list)', async () => {
      const res = await request(app)
        .patch('/api/products/1/stock')
        .set('Cookie', userAuth.cookie)
        .set('X-CSRF-Token', userAuth.csrfToken)
        .send({ delta: 3 });

      expect(res.status).toBe(403);
      expect(mockAdjustStockExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when the CSRF token is missing', async () => {
      const res = await request(app)
        .patch('/api/products/1/stock')
        .set('Cookie', adminAuth.cookie)
        .send({ delta: 3 });

      expect(res.status).toBe(403);
      expect(mockAdjustStockExecute).not.toHaveBeenCalled();
    });

    it('returns 409 when the use case rejects an over-drawing delta', async () => {
      mockAdjustStockExecute.mockRejectedValue(new Error('Insufficient stock'));

      const res = await request(app)
        .patch('/api/products/1/stock')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .send({ delta: -999 });

      expect(res.status).toBe(409);
    });

    it('returns 400 when delta is zero', async () => {
      mockAdjustStockExecute.mockRejectedValue(new Error('Delta must be a non-zero integer'));

      const res = await request(app)
        .patch('/api/products/1/stock')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .send({ delta: 0 });

      expect(res.status).toBe(400);
    });
  });
});
