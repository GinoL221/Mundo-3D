import express, { Express } from 'express';
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

const buildApp = (): Express => {
  const apiRouter = require('../index').default;
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
};

const signToken = (idRole: Role) =>
  jwt.sign({ userId: 1, email: 'principal@test.com', category: 'test', idRole }, getJwtSecret(), {
    expiresIn: '1h',
  });

const adminToken = signToken(Role.ADMIN);
const staffToken = signToken(Role.STAFF);
const userToken = signToken(Role.USER);

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
    ['malformed token', 'Bearer invalid', 401],
    ['USER token', `Bearer ${userToken}`, 403],
  ])('rejects POST for %s', async (_caseName, authorization, status) => {
    const req = request(app).post('/api/franchises').send({ nameFranchise: 'Studio Ghibli' });
    const res = authorization ? await req.set('Authorization', authorization) : await req;

    expect(res.status).toBe(status);
    expect(mockCreateExecute).not.toHaveBeenCalled();
  });

  it.each([
    ['ADMIN', adminToken],
    ['STAFF', staffToken],
  ])('creates for %s', async (_role, token) => {
    mockCreateExecute.mockResolvedValue({ idFranchise: 1, nameFranchise: 'Studio Ghibli' });

    const res = await request(app)
      .post('/api/franchises')
      .set('Authorization', `Bearer ${token}`)
      .send({ nameFranchise: 'Studio Ghibli' });

    expect(res.status).toBe(201);
    expect(mockCreateExecute).toHaveBeenCalledWith({ nameFranchise: 'Studio Ghibli' });
  });

  it.each([{}, { nameFranchise: '   ' }, { nameFranchise: 42 }])(
    'rejects invalid franchise names before creation',
    async (body) => {
      const res = await request(app)
        .post('/api/franchises')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      expect(res.status).toBe(400);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing token', undefined, 401],
    ['USER token', `Bearer ${userToken}`, 403],
  ])('rejects PUT for %s', async (_caseName, authorization, status) => {
    const req = request(app).put('/api/franchises/1').send({ nameFranchise: 'Updated' });
    const res = authorization ? await req.set('Authorization', authorization) : await req;

    expect(res.status).toBe(status);
    expect(mockUpdateExecute).not.toHaveBeenCalled();
  });

  it.each([
    ['ADMIN', adminToken],
    ['STAFF', staffToken],
  ])('updates for %s and maps a missing franchise to 404', async (_role, token) => {
    mockUpdateExecute
      .mockResolvedValueOnce({ idFranchise: 1, nameFranchise: 'Updated' })
      .mockResolvedValueOnce(null);

    expect(
      (
        await request(app)
          .put('/api/franchises/1')
          .set('Authorization', `Bearer ${token}`)
          .send({ nameFranchise: 'Updated' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .put('/api/franchises/999')
          .set('Authorization', `Bearer ${token}`)
          .send({ nameFranchise: 'Updated' })
      ).status,
    ).toBe(404);
  });

  it('rejects unauthenticated and STAFF deletes', async () => {
    expect((await request(app).delete('/api/franchises/1')).status).toBe(401);
    expect(
      (await request(app).delete('/api/franchises/1').set('Authorization', `Bearer ${staffToken}`))
        .status,
    ).toBe(403);
    expect(mockDeleteExecute).not.toHaveBeenCalled();
  });

  it('deletes for ADMIN and maps missing and FK-conflict responses', async () => {
    mockDeleteExecute
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('Franchise has associated products'));
    const authorizedDelete = (id: number) =>
      request(app).delete(`/api/franchises/${id}`).set('Authorization', `Bearer ${adminToken}`);

    expect((await authorizedDelete(1)).status).toBe(204);
    expect((await authorizedDelete(999)).status).toBe(404);
    expect((await authorizedDelete(2)).status).toBe(409);
  });
});
