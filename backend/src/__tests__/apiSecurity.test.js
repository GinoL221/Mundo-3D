const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

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
const { authCookie, authAndCsrf } = require('./helpers/apiAuthTestHelpers');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
};

describe('REST API Security & Role Gating', () => {
  let app;
  let adminAuth;
  let userAuth;

  beforeAll(() => {
    adminAuth = authAndCsrf({ userId: 1, email: 'admin@test.com', category: 'Admin', idRole: 1 });
    userAuth = authAndCsrf({ userId: 2, email: 'user@test.com', category: 'User', idRole: 2 });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  describe('GET /api/users (Admin restriction)', () => {
    it('returns 401 when the auth cookie is missing', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token de autenticación no proporcionado');
      expect(mockListUsersExecute).not.toHaveBeenCalled();
    });

    it('returns 401 when the auth cookie is invalid', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', authCookie('invalid-token-signature-value'));
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token de autenticación inválido o expirado');
      expect(mockListUsersExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when authenticated user is not an admin (idRole !== Role.ADMIN)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', userAuth.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Acceso restringido');
      expect(mockListUsersExecute).not.toHaveBeenCalled();
    });

    it('allows access and returns 200 when authenticated user is admin (idRole === Role.ADMIN)', async () => {
      mockListUsersExecute.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', adminAuth.cookie);
      expect(res.status).toBe(200);
      expect(mockListUsersExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/users/:id (Admin restriction)', () => {
    it('returns 401 when the auth cookie is missing', async () => {
      const res = await request(app).get('/api/users/2');
      expect(res.status).toBe(401);
      expect(mockGetUserByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when authenticated user is not an admin', async () => {
      const res = await request(app)
        .get('/api/users/2')
        .set('Cookie', userAuth.cookie);
      expect(res.status).toBe(403);
      expect(mockGetUserByIdExecute).not.toHaveBeenCalled();
    });

    it('allows access and returns 200 when authenticated user is admin', async () => {
      mockGetUserByIdExecute.mockResolvedValue({ idUser: 2, email: 'user@test.com' });
      const res = await request(app)
        .get('/api/users/2')
        .set('Cookie', adminAuth.cookie);
      expect(res.status).toBe(200);
      expect(mockGetUserByIdExecute).toHaveBeenCalledWith(2);
    });
  });

  describe('GET /api/cart (User Authentication restriction)', () => {
    it('returns 401 when the auth cookie is missing', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.status).toBe(401);
      expect(mockGetCartByUserIdExecute).not.toHaveBeenCalled();
    });

    it('allows access and returns 200 for a standard authenticated user', async () => {
      mockGetCartByUserIdExecute.mockResolvedValue({ items: [], total: 0 });
      const res = await request(app)
        .get('/api/cart')
        .set('Cookie', userAuth.cookie);
      expect(res.status).toBe(200);
      expect(mockGetCartByUserIdExecute).toHaveBeenCalledWith(2);
    });
  });

  describe('PUT /api/cart (User Authentication restriction)', () => {
    it('returns 401 when the auth cookie is missing', async () => {
      const res = await request(app).put('/api/cart').send({ items: [] });
      expect(res.status).toBe(401);
      expect(mockSyncCartExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when the CSRF token is missing', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Cookie', userAuth.cookie)
        .send({ items: [] });
      expect(res.status).toBe(403);
      expect(mockSyncCartExecute).not.toHaveBeenCalled();
    });

    it('allows access, syncs, and returns 200 for authenticated user', async () => {
      mockSyncCartExecute.mockResolvedValue(undefined);
      mockGetCartByUserIdExecute.mockResolvedValue({ items: [], total: 0 });
      const res = await request(app)
        .put('/api/cart')
        .set('Cookie', userAuth.cookie)
        .set('X-CSRF-Token', userAuth.csrfToken)
        .send({ items: [{ productId: 10, quantity: 2 }] });

      expect(res.status).toBe(200);
      expect(mockSyncCartExecute).toHaveBeenCalledWith(2, [{ productId: 10, quantity: 2 }]);
      expect(mockGetCartByUserIdExecute).toHaveBeenCalledWith(2);
    });

    it('returns 400 when quantity is 0 (validation failure)', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Cookie', userAuth.cookie)
        .set('X-CSRF-Token', userAuth.csrfToken)
        .send({ items: [{ productId: 10, quantity: 0 }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(mockSyncCartExecute).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/users (Duplicate route removed)', () => {
    it('returns 404 Not Found', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ email: 'duplicate@test.com', password: 'password123' });
      expect(res.status).toBe(404);
    });
  });

  describe('errorHandler Pino logging integration', () => {
    it('routes uncaught exception through Pino logger.error', async () => {
      const { logger } = require('../infrastructure/logging/logger');
      const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

      mockListUsersExecute.mockRejectedValue(new Error('Test uncaught exception'));
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', adminAuth.cookie);

      expect(res.status).toBe(500);
      expect(loggerErrorSpy).toHaveBeenCalled();

      loggerErrorSpy.mockRestore();
    });
  });

  describe('POST /api/users/register rate limiting', () => {
    let originalEnv;

    beforeAll(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('returns 429 when request limit is exceeded', async () => {
      process.env.NODE_ENV = 'production';
      const agent = request(app);

      // Hits 1, 2, 3
      await agent.post('/api/users/register').send({});
      await agent.post('/api/users/register').send({});
      await agent.post('/api/users/register').send({});

      // Hit 4
      const res4 = await agent.post('/api/users/register').send({});
      expect(res4.status).toBe(429);
      expect(res4.body.error).toBe('Demasiados intentos de registro. Intente nuevamente en 15 minutos.');
    });
  });

  // `POST /api/users/refresh` is unauthenticated and exempt from csrfGuard by
  // design — a refresh happens exactly when the access token, and therefore
  // `req.user.userId`, may already be expired. The rate limiter is one of the
  // four defences that replace those, so it needs to be observed actually
  // returning 429 rather than merely configured: the middleware's own unit
  // test mocks `express-rate-limit`, which proves the configuration and
  // nothing about throttling.
  describe('POST /api/users/refresh rate limiting', () => {
    let originalEnv;

    beforeAll(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('returns 429 once the limit is exceeded, with no session and no CSRF token', async () => {
      // Reuse the app this suite already built. Re-requiring it under
      // NODE_ENV=production would trip app.js's own CORS_ORIGIN guard, which
      // is a separate protection and not what this test is about.
      process.env.NODE_ENV = 'production';
      const agent = request(app);

      // The limiter's default max is 10 per window; exhaust it, then prove
      // the next call is refused rather than merely counted.
      for (let i = 0; i < 10; i += 1) {
        await agent.post('/api/users/refresh');
      }

      const blocked = await agent.post('/api/users/refresh');
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toBe(
        'Demasiados intentos de refresco de sesión. Intente nuevamente en 15 minutos.'
      );
    });
  });
});
