import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const mockListExecute = jest.fn();
const mockGetByIdExecute = jest.fn();
const mockCreateExecute = jest.fn();
const mockUpdateExecute = jest.fn();
const mockDeleteExecute = jest.fn();

jest.mock('../../../../application/use-cases/ListFranchisesUseCase', () => ({
  ListFranchisesUseCase: jest.fn().mockImplementation(() => ({ execute: mockListExecute })),
}));
jest.mock('../../../../application/use-cases/GetFranchiseByIdUseCase', () => ({
  GetFranchiseByIdUseCase: jest.fn().mockImplementation(() => ({ execute: mockGetByIdExecute })),
}));
jest.mock('../../../../application/use-cases/CreateFranchiseUseCase', () => ({
  CreateFranchiseUseCase: jest.fn().mockImplementation(() => ({ execute: mockCreateExecute })),
}));
jest.mock('../../../../application/use-cases/UpdateFranchiseUseCase', () => ({
  UpdateFranchiseUseCase: jest.fn().mockImplementation(() => ({ execute: mockUpdateExecute })),
}));
jest.mock('../../../../application/use-cases/DeleteFranchiseUseCase', () => ({
  DeleteFranchiseUseCase: jest.fn().mockImplementation(() => ({ execute: mockDeleteExecute })),
}));

import { Role } from '../../../../domain/Role';
import errorHandler from '../../../middlewares/errorHandler';
import { getJwtSecret } from '../../../security/JwtSecret';
import { accessTokenSignOptions } from '../../../security/jwtOptions';
import { authCookie, authAndCsrf } from '../../../../__tests__/helpers/apiAuthTestHelpers';

const buildApp = (): Express => {
  const apiRouter = require('../index').default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
};

const signToken = (idRole: Role) =>
  jwt.sign(
    { userId: 1, email: 'principal@test.com', category: 'test', idRole, typ: 'access' },
    getJwtSecret(),
    accessTokenSignOptions('1h')
  );

const adminToken = signToken(Role.ADMIN);
const userToken = signToken(Role.USER);

const adminAuth = authAndCsrf({ userId: 1, email: 'principal@test.com', category: 'test', idRole: Role.ADMIN });
const staffAuth = authAndCsrf({ userId: 1, email: 'principal@test.com', category: 'test', idRole: Role.STAFF });

describe('api/franchises routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('mounts through the API router and keeps reads open', async () => {
    const franchises = [{ idFranchise: 1, nameFranchise: 'Studio Ghibli' }];
    mockListExecute.mockResolvedValue(franchises);

    const res = await request(app).get('/api/franchises');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(franchises);
    expect(mockListExecute).toHaveBeenCalledTimes(1);
  });

  it('gets an existing franchise and maps a missing one to 404', async () => {
    mockGetByIdExecute
      .mockResolvedValueOnce({ idFranchise: 1, nameFranchise: 'Studio Ghibli' })
      .mockRejectedValueOnce(new Error('Franchise not found'));

    expect((await request(app).get('/api/franchises/1')).status).toBe(200);
    expect((await request(app).get('/api/franchises/999')).status).toBe(404);
    expect(mockGetByIdExecute).toHaveBeenNthCalledWith(1, 1);
    expect(mockGetByIdExecute).toHaveBeenNthCalledWith(2, 999);
  });

  it.each(['not-a-number', '1junk'])(
    'rejects invalid id %s without calling a use case',
    async (id) => {
      const res = await request(app).get(`/api/franchises/${id}`);

      expect(res.status).toBe(400);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing token', undefined, 401],
    ['malformed token', 'invalid', 401],
    ['USER token', userToken, 403],
  ])('rejects POST for %s', async (_caseName, tokenValue, status) => {
    const req = request(app).post('/api/franchises').send({ nameFranchise: 'Studio Ghibli' });
    const res = tokenValue ? await req.set('Cookie', authCookie(tokenValue)) : await req;

    expect(res.status).toBe(status);
    expect(mockCreateExecute).not.toHaveBeenCalled();
  });

  it('returns 403 for a valid ADMIN cookie without an X-CSRF-Token header', async () => {
    const res = await request(app)
      .post('/api/franchises')
      .set('Cookie', authCookie(adminToken))
      .send({ nameFranchise: 'Studio Ghibli' });

    expect(res.status).toBe(403);
    expect(mockCreateExecute).not.toHaveBeenCalled();
  });

  it.each([
    ['ADMIN', adminAuth],
    ['STAFF', staffAuth],
  ])('creates for %s', async (_role, auth) => {
    mockCreateExecute.mockResolvedValue({ idFranchise: 1, nameFranchise: 'Studio Ghibli' });

    const res = await request(app)
      .post('/api/franchises')
      .set('Cookie', auth.cookie)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({ nameFranchise: 'Studio Ghibli' });

    expect(res.status).toBe(201);
    expect(mockCreateExecute).toHaveBeenCalledWith({ nameFranchise: 'Studio Ghibli' });
  });

  it('returns the stable duplicate conflict for an existing franchise name', async () => {
    const franchises = [{ idFranchise: 1, nameFranchise: 'Existing Franchise' }];
    const before = structuredClone(franchises);
    mockCreateExecute.mockImplementation(async ({ nameFranchise }) => {
      if (franchises.some((franchise) => franchise.nameFranchise === nameFranchise)) {
        throw new Error('DUPLICATE_FRANCHISE_NAME');
      }
      const created = { idFranchise: franchises.length + 1, nameFranchise };
      franchises.push(created);
      return created;
    });

    const res = await request(app)
      .post('/api/franchises')
      .set('Cookie', adminAuth.cookie)
      .set('X-CSRF-Token', adminAuth.csrfToken)
      .send({ nameFranchise: 'Existing Franchise' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'DUPLICATE_FRANCHISE_NAME' });
    expect(franchises).toEqual(before);
  });

  it.each([{}, { nameFranchise: '   ' }, { nameFranchise: 42 }])(
    'rejects invalid franchise names before creation',
    async (body) => {
      const res = await request(app)
        .post('/api/franchises')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .send(body);

      expect(res.status).toBe(400);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing token', undefined, 401],
    ['USER token', userToken, 403],
  ])('rejects PUT for %s', async (_caseName, tokenValue, status) => {
    const req = request(app).put('/api/franchises/1').send({ nameFranchise: 'Updated' });
    const res = tokenValue ? await req.set('Cookie', authCookie(tokenValue)) : await req;

    expect(res.status).toBe(status);
    expect(mockUpdateExecute).not.toHaveBeenCalled();
  });

  it('returns 403 for a valid ADMIN cookie without an X-CSRF-Token header', async () => {
    const res = await request(app)
      .put('/api/franchises/1')
      .set('Cookie', authCookie(adminToken))
      .send({ nameFranchise: 'Updated' });

    expect(res.status).toBe(403);
    expect(mockUpdateExecute).not.toHaveBeenCalled();
  });

  it.each([
    ['ADMIN', adminAuth],
    ['STAFF', staffAuth],
  ])('updates for %s and maps a missing franchise to 404', async (_role, auth) => {
    mockUpdateExecute
      .mockResolvedValueOnce({ idFranchise: 1, nameFranchise: 'Updated' })
      .mockResolvedValueOnce(null);

    expect(
      (
        await request(app)
          .put('/api/franchises/1')
          .set('Cookie', auth.cookie)
          .set('X-CSRF-Token', auth.csrfToken)
          .send({ nameFranchise: 'Updated' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .put('/api/franchises/999')
          .set('Cookie', auth.cookie)
          .set('X-CSRF-Token', auth.csrfToken)
          .send({ nameFranchise: 'Updated' })
      ).status,
    ).toBe(404);
  });

  it('returns the stable duplicate conflict without updating the target franchise', async () => {
    const franchises = [
      { idFranchise: 1, nameFranchise: 'Target Franchise' },
      { idFranchise: 2, nameFranchise: 'Existing Franchise' },
    ];
    const before = structuredClone(franchises);
    mockUpdateExecute.mockImplementation(async (id, { nameFranchise }) => {
      const target = franchises.find((franchise) => franchise.idFranchise === id);
      if (!target) return null;
      if (
        franchises.some(
          (franchise) => franchise.idFranchise !== id && franchise.nameFranchise === nameFranchise,
        )
      ) {
        throw new Error('DUPLICATE_FRANCHISE_NAME');
      }
      target.nameFranchise = nameFranchise;
      return target;
    });

    const res = await request(app)
      .put('/api/franchises/1')
      .set('Cookie', adminAuth.cookie)
      .set('X-CSRF-Token', adminAuth.csrfToken)
      .send({ nameFranchise: 'Existing Franchise' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'DUPLICATE_FRANCHISE_NAME' });
    expect(franchises).toEqual(before);
  });

  it('rejects unauthenticated and STAFF deletes', async () => {
    expect((await request(app).delete('/api/franchises/1')).status).toBe(401);
    expect(
      (
        await request(app)
          .delete('/api/franchises/1')
          .set('Cookie', staffAuth.cookie)
          .set('X-CSRF-Token', staffAuth.csrfToken)
      ).status,
    ).toBe(403);
    expect(mockDeleteExecute).not.toHaveBeenCalled();
  });

  it('returns 403 for a valid ADMIN cookie delete without an X-CSRF-Token header', async () => {
    const res = await request(app).delete('/api/franchises/1').set('Cookie', adminAuth.cookie);

    expect(res.status).toBe(403);
    expect(mockDeleteExecute).not.toHaveBeenCalled();
  });

  it('deletes for ADMIN and maps missing and FK-conflict responses', async () => {
    mockDeleteExecute
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('Franchise has associated products'));
    const authorizedDelete = (id: number) =>
      request(app)
        .delete(`/api/franchises/${id}`)
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken);

    expect((await authorizedDelete(1)).status).toBe(204);
    expect((await authorizedDelete(999)).status).toBe(404);
    expect((await authorizedDelete(2)).status).toBe(409);
  });
});
