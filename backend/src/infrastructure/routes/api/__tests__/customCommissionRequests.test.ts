import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { Role } from '../../../../domain/Role';

const mockListExecute = jest.fn();

jest.mock('../../../../application/use-cases/ListCustomCommissionRequestsUseCase', () => ({
  ListCustomCommissionRequestsUseCase: jest
    .fn()
    .mockImplementation(() => ({ execute: mockListExecute })),
}));

import errorHandler from '../../../middlewares/errorHandler';
import { authAndCsrf } from '../../../../__tests__/helpers/apiAuthTestHelpers';

const buildApp = (): Express => {
  const commissionRequestsRouter = require('../customCommissionRequests').default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/custom-commission-requests', commissionRequestsRouter);
  app.use(errorHandler);
  return app;
};

const activeRequest = {
  idCustomCommissionRequest: 17,
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  idea: 'A small dragon sculpture',
  idProduct: null,
  createdAt: new Date('2026-10-01T12:00:00.000Z'),
  expiresAt: new Date('2026-10-31T12:00:00.000Z'),
};

describe('GET /api/custom-commission-requests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('rejects anonymous reads before listing stored contact data', async () => {
    const response = await request(app).get('/api/custom-commission-requests');

    expect(response.status).toBe(401);
    expect(mockListExecute).not.toHaveBeenCalled();
  });

  it('rejects USER reads before listing stored contact data', async () => {
    const user = authAndCsrf({
      userId: 23,
      email: 'user@example.test',
      category: 'User',
      idRole: Role.USER,
    });
    const response = await request(app)
      .get('/api/custom-commission-requests')
      .set('Cookie', user.cookie);

    expect(response.status).toBe(403);
    expect(mockListExecute).not.toHaveBeenCalled();
  });

  it.each([
    ['STAFF', Role.STAFF, 'Staff'],
    ['ADMIN', Role.ADMIN, 'Admin'],
  ] as const)(
    'returns only the use-case result to %s and marks it non-cacheable',
    async (_label, role, category) => {
      const user = authAndCsrf({
        userId: 31,
        email: `${category.toLowerCase()}@example.test`,
        category,
        idRole: role,
      });
      mockListExecute.mockResolvedValue([activeRequest]);

      const response = await request(app)
        .get('/api/custom-commission-requests')
        .set('Cookie', user.cookie);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual([
        {
          ...activeRequest,
          createdAt: activeRequest.createdAt.toISOString(),
          expiresAt: activeRequest.expiresAt.toISOString(),
        },
      ]);
      expect(mockListExecute).toHaveBeenCalledTimes(1);
      expect(mockListExecute).toHaveBeenCalledWith();
    },
  );

  it('returns an empty list when no unexpired requests are available', async () => {
    const admin = authAndCsrf({
      userId: 1,
      email: 'admin@example.test',
      category: 'Admin',
      idRole: Role.ADMIN,
    });
    mockListExecute.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/custom-commission-requests')
      .set('Cookie', admin.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockListExecute).toHaveBeenCalledTimes(1);
  });
});
