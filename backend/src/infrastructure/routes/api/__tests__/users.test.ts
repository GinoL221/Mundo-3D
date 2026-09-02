import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
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
import { authCookie } from '../../../../__tests__/helpers/apiAuthTestHelpers';

const JWT_SECRET = getJwtSecret();
const mockAuthenticateExecute = jest.fn();

jest.mock('../../../../application/use-cases/AuthenticateUserUseCase', () => ({
  AuthenticateUserUseCase: jest.fn().mockImplementation(() => ({ execute: mockAuthenticateExecute })),
}));

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
  app.use(cookieParser());
  app.use('/api', usersRouter);
  app.use(errorHandler);
  return app;
};

const signToken = (idRole: number) =>
  jwt.sign({ userId: 1, email: 'principal@test.com', category: 'test', idRole, typ: 'access' }, JWT_SECRET, {
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
      const res = await request(app).get('/api/users').set('Cookie', authCookie('not-a-real-token'));

      expect(res.status).toBe(401);
      expect(mockListExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not ADMIN)', async () => {
      const res = await request(app).get('/api/users').set('Cookie', authCookie(userToken));

      expect(res.status).toBe(403);
      expect(mockListExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated STAFF (/api/users is ADMIN-only)', async () => {
      const res = await request(app).get('/api/users').set('Cookie', authCookie(staffToken));

      expect(res.status).toBe(403);
      expect(mockListExecute).not.toHaveBeenCalled();
    });

    it('returns 200 for ADMIN', async () => {
      mockListExecute.mockResolvedValue([{ idUser: 1, email: 'a@test.com' }]);

      const res = await request(app).get('/api/users').set('Cookie', authCookie(adminToken));

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
      const res = await request(app).get('/api/users/1').set('Cookie', authCookie('not-a-real-token'));

      expect(res.status).toBe(401);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not ADMIN)', async () => {
      const res = await request(app).get('/api/users/1').set('Cookie', authCookie(userToken));

      expect(res.status).toBe(403);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated STAFF (/api/users/:id is ADMIN-only)', async () => {
      const res = await request(app).get('/api/users/1').set('Cookie', authCookie(staffToken));

      expect(res.status).toBe(403);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });

    it('returns 200 for ADMIN', async () => {
      mockGetByIdExecute.mockResolvedValue({ idUser: 1, email: 'a@test.com' });

      const res = await request(app).get('/api/users/1').set('Cookie', authCookie(adminToken));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ idUser: 1, email: 'a@test.com' });
      expect(mockGetByIdExecute).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /api/users/logout', () => {
    it('returns 204 with a valid auth cookie and no request body required', async () => {
      const res = await request(app).post('/api/users/logout').set('Cookie', authCookie(userToken));

      expect(res.status).toBe(204);
    });

    it('returns 204 without an auth cookie (idempotent — logout must never error)', async () => {
      const res = await request(app).post('/api/users/logout');

      expect(res.status).toBe(204);
    });

    it('does not require an X-CSRF-Token header (pre-auth/fail-safe exemption)', async () => {
      const res = await request(app).post('/api/users/logout').set('Cookie', authCookie(userToken));

      expect(res.status).not.toBe(403);
    });
  });

  describe('CSRF exemption on pre-auth endpoints', () => {
    it('POST /api/users/login succeeds with no X-CSRF-Token header', async () => {
      mockAuthenticateExecute.mockResolvedValue({
        idUser: 1,
        email: 'user@test.com',
        category: 'User',
        idRole: Role.USER,
        firstName: 'Jane',
        image: null,
      });

      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'user@test.com', password: 'password123' });

      expect(res.status).not.toBe(403);
    });

    it('POST /api/users/register succeeds with no X-CSRF-Token header (existing 400 = validation, not CSRF)', async () => {
      const res = await request(app).post('/api/users/register').send({});

      expect(res.status).not.toBe(403);
    });
  });
});
