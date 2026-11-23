import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const mockListExecute = jest.fn();
const mockGetByIdExecute = jest.fn();
const mockRegisterExecute = jest.fn();
const mockCreateRememberTokenExecute = jest.fn();

jest.mock('../../../../application/use-cases/ListUsersUseCase', () => ({
  ListUsersUseCase: jest.fn().mockImplementation(() => ({ execute: mockListExecute })),
}));

jest.mock('../../../../application/use-cases/GetUserByIdUseCase', () => ({
  GetUserByIdUseCase: jest.fn().mockImplementation(() => ({ execute: mockGetByIdExecute })),
}));

jest.mock('../../../../application/use-cases/RegisterUserUseCase', () => ({
  RegisterUserUseCase: jest.fn().mockImplementation(() => ({ execute: mockRegisterExecute })),
}));

jest.mock('../../../../application/use-cases/CreateRememberTokenUseCase', () => ({
  CreateRememberTokenUseCase: jest.fn().mockImplementation(() => ({
    execute: mockCreateRememberTokenExecute,
  })),
}));

import errorHandler from '../../../middlewares/errorHandler';
import { getJwtSecret } from '../../../security/JwtSecret';
import { accessTokenSignOptions } from '../../../security/jwtOptions';
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
  jwt.sign(
    { userId: 1, email: 'principal@test.com', category: 'test', idRole, typ: 'access' },
    JWT_SECRET,
    accessTokenSignOptions('1h')
  );

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

  describe('POST /api/users/register — optional image & voseo validation', () => {
    beforeEach(() => {
      mockCreateRememberTokenExecute.mockResolvedValue({
        idRememberToken: 1,
        tokenHash: 'hashed-token',
        idUser: 42,
        expiryDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        familyId: 'fam-register-test',
      });
    });

    it('returns 201 and creates user with image: null when no image is uploaded', async () => {
      const createdUser = {
        idUser: 42,
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'ana@example.com',
        image: null,
        idRole: Role.USER,
        category: 'User',
      };
      mockRegisterExecute.mockResolvedValue(createdUser);

      const res = await request(app)
        .post('/api/users/register')
        .field('firstName', 'Ana')
        .field('lastName', 'Lopez')
        .field('email', 'ana@example.com')
        .field('password', 'Password1!')
        .field('confirmPassword', 'Password1!');

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ user: createdUser });
      expect(mockRegisterExecute).toHaveBeenCalledWith({
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'ana@example.com',
        password: 'Password1!',
        image: null,
      });
    });

    it('returns 400 with the existing extension message when a .gif image is uploaded', async () => {
      const gifBytes = Buffer.from('GIF89a', 'ascii');

      const res = await request(app)
        .post('/api/users/register')
        .field('firstName', 'Ana')
        .field('lastName', 'Lopez')
        .field('email', 'ana@example.com')
        .field('password', 'Password1!')
        .field('confirmPassword', 'Password1!')
        .attach('image', gifBytes, { filename: 'avatar.gif', contentType: 'image/gif' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'field',
            path: 'image',
            location: 'body',
            msg: 'Las extensiones de archivos permitidas son .jpg, .png',
          }),
        ]),
      );
      expect(mockRegisterExecute).not.toHaveBeenCalled();
    });

    it('returns 400 with express-validator field errors in voseo when fields are missing', async () => {
      const res = await request(app).post('/api/users/register').send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([
        { type: 'field', value: '', msg: 'Ingresá tu nombre', path: 'firstName', location: 'body' },
        { type: 'field', value: '', msg: 'Ingresá tu apellido', path: 'lastName', location: 'body' },
        { type: 'field', value: '', msg: 'Ingresá tu correo', path: 'email', location: 'body' },
        { type: 'field', value: '', msg: 'Ingresá tu contraseña', path: 'password', location: 'body' },
        { type: 'field', value: '', msg: 'Confirmá tu contraseña', path: 'confirmPassword', location: 'body' },
      ]);
      expect(mockRegisterExecute).not.toHaveBeenCalled();
    });
  });
});
