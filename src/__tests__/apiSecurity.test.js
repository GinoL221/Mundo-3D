const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const mockListUsersExecute = jest.fn();
const mockGetUserByIdExecute = jest.fn();
const mockGetCartByUserIdExecute = jest.fn();
const mockSyncCartExecute = jest.fn();

jest.mock('../application/use-cases/ListUsersUseCase', () => ({
  ListUsersUseCase: jest.fn().mockImplementation(() => ({
    execute: mockListUsersExecute,
  })),
}));

jest.mock('../application/use-cases/GetUserByIdUseCase', () => ({
  GetUserByIdUseCase: jest.fn().mockImplementation(() => ({
    execute: mockGetUserByIdExecute,
  })),
}));

jest.mock('../application/use-cases/GetCartByUserIdUseCase', () => ({
  GetCartByUserIdUseCase: jest.fn().mockImplementation(() => ({
    execute: mockGetCartByUserIdExecute,
  })),
}));

jest.mock('../application/use-cases/SyncCartUseCase', () => ({
  SyncCartUseCase: jest.fn().mockImplementation(() => ({
    execute: mockSyncCartExecute,
  })),
}));

const apiRouter = require('../infrastructure/routes/api/index').default;
const errorHandler = require('../infrastructure/middlewares/errorHandler').default;

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
};

describe('REST API Security & Role Gating', () => {
  let app;
  let adminToken;
  let userToken;
  let invalidToken;

  beforeAll(() => {
    adminToken = jwt.sign(
      { userId: 1, email: 'admin@test.com', category: 'Admin', idRole: 1 },
      JWT_SECRET
    );
    userToken = jwt.sign(
      { userId: 2, email: 'user@test.com', category: 'User', idRole: 2 },
      JWT_SECRET
    );
    invalidToken = 'invalid-token-signature-value';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  describe('GET /api/users (Admin restriction)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token de autenticación no proporcionado');
      expect(mockListUsersExecute).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization token is invalid', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${invalidToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token de autenticación inválido o expirado');
      expect(mockListUsersExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when authenticated user is not an admin (idRole !== 1)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Acceso restringido a administradores');
      expect(mockListUsersExecute).not.toHaveBeenCalled();
    });

    it('allows access and returns 200 when authenticated user is admin (idRole === 1)', async () => {
      mockListUsersExecute.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(mockListUsersExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/users/:id (Admin restriction)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/users/2');
      expect(res.status).toBe(401);
      expect(mockGetUserByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when authenticated user is not an admin', async () => {
      const res = await request(app)
        .get('/api/users/2')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(mockGetUserByIdExecute).not.toHaveBeenCalled();
    });

    it('allows access and returns 200 when authenticated user is admin', async () => {
      mockGetUserByIdExecute.mockResolvedValue({ idUser: 2, email: 'user@test.com' });
      const res = await request(app)
        .get('/api/users/2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(mockGetUserByIdExecute).toHaveBeenCalledWith(2);
    });
  });

  describe('GET /api/cart (User Authentication restriction)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.status).toBe(401);
      expect(mockGetCartByUserIdExecute).not.toHaveBeenCalled();
    });

    it('allows access and returns 200 for a standard authenticated user', async () => {
      mockGetCartByUserIdExecute.mockResolvedValue({ items: [], total: 0 });
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(mockGetCartByUserIdExecute).toHaveBeenCalledWith(2);
    });
  });

  describe('PUT /api/cart (User Authentication restriction)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).put('/api/cart').send({ items: [] });
      expect(res.status).toBe(401);
      expect(mockSyncCartExecute).not.toHaveBeenCalled();
    });

    it('allows access, syncs, and returns 200 for authenticated user', async () => {
      mockSyncCartExecute.mockResolvedValue(undefined);
      mockGetCartByUserIdExecute.mockResolvedValue({ items: [], total: 0 });
      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ items: [{ productId: 10, quantity: 2 }] });

      expect(res.status).toBe(200);
      expect(mockSyncCartExecute).toHaveBeenCalledWith(2, [{ productId: 10, quantity: 2 }]);
      expect(mockGetCartByUserIdExecute).toHaveBeenCalledWith(2);
    });
  });
});
