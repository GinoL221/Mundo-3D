import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

const mockListExecute = jest.fn();
const mockGetByIdExecute = jest.fn();

jest.mock('../../../../application/use-cases/ListUsersUseCase', () => ({
  ListUsersUseCase: jest.fn().mockImplementation(() => ({ execute: mockListExecute })),
}));

jest.mock('../../../../application/use-cases/GetUserByIdUseCase', () => ({
  GetUserByIdUseCase: jest.fn().mockImplementation(() => ({ execute: mockGetByIdExecute })),
}));

import errorHandler from '../../../middlewares/errorHandler';
import { getJwtSecret } from '../../../security/JwtSecret';
import { Role } from '../../../../domain/Role';

const JWT_SECRET = getJwtSecret();

// This is the integration-level guard-matrix test for the user admin
// routes (product-inventory-admin PR2/PR3 follow-up, closing a WARNING
// from the change's own verify-report). It exercises the real Express
// pipeline — apiAuthMiddleware → adminGuard → controller — with only the
// use-case classes mocked at the module boundary, so it never touches a
// real database (stays in the default `npm test` mock-only suite). It
// mirrors `routes/api/__tests__/products.test.ts`'s exact style. Unlike
// the products mutation routes, `/api/users` is ADMIN-only (no STAFF
// allow-list), per the admin-route-guard spec's Route Capability Matrix.
const buildApp = (): Express => {
  const usersRouter = require('../users').default;
  const app = express();
  app.use(express.json());
  app.use('/api', usersRouter);
  app.use(errorHandler);
  return app;
};

const signToken = (idRole: number) =>
  jwt.sign({ userId: 1, email: 'principal@test.com', category: 'test', idRole }, JWT_SECRET, {
    expiresIn: '1h',
  });

const adminToken = signToken(Role.ADMIN);
const staffToken = signToken(Role.STAFF);
const userToken = signToken(Role.USER);

describe('api/users admin routes — guard matrix', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  describe('GET /api/users', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(401);
      expect(mockListExecute).not.toHaveBeenCalled();
    });

    it('returns 401 with a bad/malformed Bearer token', async () => {
      const res = await request(app).get('/api/users').set('Authorization', 'Bearer not-a-real-token');

      expect(res.status).toBe(401);
      expect(mockListExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not ADMIN)', async () => {
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(mockListExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated STAFF (/api/users is ADMIN-only)', async () => {
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(mockListExecute).not.toHaveBeenCalled();
    });

    it('returns 200 for ADMIN', async () => {
      mockListExecute.mockResolvedValue([{ idUser: 1, email: 'a@test.com' }]);

      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 1, users: [{ idUser: 1, email: 'a@test.com' }] });
      expect(mockListExecute).toHaveBeenCalled();
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).get('/api/users/1');

      expect(res.status).toBe(401);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 401 with a bad/malformed Bearer token', async () => {
      const res = await request(app).get('/api/users/1').set('Authorization', 'Bearer not-a-real-token');

      expect(res.status).toBe(401);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not ADMIN)', async () => {
      const res = await request(app).get('/api/users/1').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated STAFF (/api/users/:id is ADMIN-only)', async () => {
      const res = await request(app).get('/api/users/1').set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 200 for ADMIN', async () => {
      mockGetByIdExecute.mockResolvedValue({ idUser: 1, email: 'a@test.com' });

      const res = await request(app).get('/api/users/1').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ idUser: 1, email: 'a@test.com' });
      expect(mockGetByIdExecute).toHaveBeenCalledWith(1);
    });
  });
});
