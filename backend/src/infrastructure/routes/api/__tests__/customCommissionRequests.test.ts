import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { Role } from '../../../../domain/Role';
import { CustomCommissionRequest } from '../../../../domain/entities/CustomCommissionRequest';
import { Product } from '../../../../domain/entities/Product';

const mockListExecute = jest.fn();
const mockRepositoryCreate = jest.fn();
const mockProductFindById = jest.fn();

jest.mock('../../../../application/use-cases/ListCustomCommissionRequestsUseCase', () => ({
  ListCustomCommissionRequestsUseCase: jest
    .fn()
    .mockImplementation(() => ({ execute: mockListExecute })),
}));

jest.mock('../../../repositories/SequelizeCustomCommissionRequestRepository', () => ({
  SequelizeCustomCommissionRequestRepository: jest.fn().mockImplementation(() => ({
    create: mockRepositoryCreate,
    listActive: jest.fn(),
    purgeExpired: jest.fn(),
  })),
}));

jest.mock('../../../repositories/SequelizeProductRepository', () => ({
  SequelizeProductRepository: jest.fn().mockImplementation(() => ({
    findById: mockProductFindById,
  })),
}));

import errorHandler from '../../../middlewares/errorHandler';
import { authAndCsrf } from '../../../../__tests__/helpers/apiAuthTestHelpers';

const buildApp = (): Express => {
  const commissionRequestsRouter = require('../customCommissionRequests').default;
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/custom-commission-requests', commissionRequestsRouter);
  app.use(errorHandler);
  return app;
};

const validSubmission: Record<string, unknown> = {
  name: 'Ari',
  email: 'ari@example.test',
  idea: 'A dragon sculpture',
};

let nextIpOctet = 10;
const nextTestIp = (): string => `198.51.100.${nextIpOctet++}`;
const postSubmission = (
  app: Express,
  body: Record<string, unknown>,
  ip = nextTestIp(),
) =>
  request(app)
    .post('/api/custom-commission-requests')
    .set('X-Forwarded-For', ip)
    .send(body);

const submittedRequest = new CustomCommissionRequest(
  17,
  'Ari',
  'ari@example.test',
  'A dragon sculpture',
  7,
  new Date('2026-10-01T12:00:00.000Z'),
  new Date('2026-10-31T12:00:00.000Z'),
);
const existingProduct = new Product(7, 'A small dragon', 1, null, null, 1, 1);

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
    mockRepositoryCreate.mockResolvedValue(submittedRequest);
    mockProductFindById.mockResolvedValue(existingProduct);
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

const PII_CANARY = 'PII-CANARY';
const invalidSubmissions: Array<[string, Record<string, unknown>]> = [
  ['missing name', { email: 'ari@example.test', idea: 'A dragon' }],
  ['blank name', { ...validSubmission, name: '   ' }],
  ['non-text name', { ...validSubmission, name: 42 }],
  ['overlong name', { ...validSubmission, name: `${PII_CANARY}${'N'.repeat(101)}` }],
  ['missing email', { name: 'Ari', idea: 'A dragon' }],
  ['blank email', { ...validSubmission, email: '   ' }],
  ['invalid email', { ...validSubmission, email: `${PII_CANARY}@` }],
  ['overlong email', { ...validSubmission, email: `${'a'.repeat(250)}@test.com` }],
  ['missing idea', { name: 'Ari', email: 'ari@example.test' }],
  ['blank idea', { ...validSubmission, idea: '   ' }],
  ['overlong idea', { ...validSubmission, idea: `${PII_CANARY}${'I'.repeat(5001)}` }],
  ['unexpected field', { ...validSubmission, attachment: PII_CANARY }],
  ['zero product id', { ...validSubmission, idProduct: 0 }],
  ['fractional product id', { ...validSubmission, idProduct: 1.5 }],
  ['string product id', { ...validSubmission, idProduct: '7' }],
];

describe('POST /api/custom-commission-requests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepositoryCreate.mockResolvedValue(submittedRequest);
    mockProductFindById.mockResolvedValue(existingProduct);
    app = buildApp();
  });

  it.each(invalidSubmissions)('rejects %s without persistence or data echo', async (_label, body) => {
    const response = await postSubmission(app, body);
    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ msg: expect.any(String) })]));
    expect(response.text).not.toContain(PII_CANARY);
    expect(mockRepositoryCreate).not.toHaveBeenCalled();
  });

  it('accepts an existing product and returns only a trimmed receipt', async () => {
    const response = await postSubmission(app, { name: ' Ari ', email: 'ari@example.test', idea: ' A dragon ', idProduct: 7 });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ idCustomCommissionRequest: 17, createdAt: '2026-10-01T12:00:00.000Z', expiresAt: '2026-10-31T12:00:00.000Z' });
    expect(mockProductFindById).toHaveBeenCalledWith(7);
    expect(mockRepositoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ari', email: 'ari@example.test', idea: 'A dragon', idProduct: 7 }),
    );
  });

  it('rejects a selected product that does not exist', async () => {
    mockProductFindById.mockResolvedValueOnce(null);
    const response = await postSubmission(app, { ...validSubmission, idProduct: 999 });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Selected product does not exist' });
    expect(mockRepositoryCreate).not.toHaveBeenCalled();
  });

  it('sanitizes persistence and product-lookup failures', async () => {
    mockRepositoryCreate.mockRejectedValueOnce(new Error(PII_CANARY));
    const persistence = await postSubmission(app, { ...validSubmission, email: `${PII_CANARY}@example.test` });
    expect(persistence).toMatchObject({ status: 500, body: { error: 'Unable to submit custom commission request' } });
    expect(persistence.text).not.toContain(PII_CANARY);
    expect(mockProductFindById).not.toHaveBeenCalled();

    mockProductFindById.mockRejectedValueOnce(new Error(PII_CANARY));
    const lookup = await postSubmission(app, { ...validSubmission, idProduct: 7 });
    expect(lookup).toMatchObject({ status: 500, body: { error: 'Unable to submit custom commission request' } });
    expect(lookup.text).not.toContain(PII_CANARY);
    expect(mockRepositoryCreate).toHaveBeenCalledTimes(1);
  });

  it('allows five requests per IP each hour and isolates another IP', async () => {
    const limitedIp = '198.51.100.200';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await postSubmission(app, validSubmission, limitedIp)).status).toBe(201);
    }
    expect(mockProductFindById).not.toHaveBeenCalled();
    const limited = await postSubmission(app, { ...validSubmission, email: `${PII_CANARY}@example.test` }, limitedIp);
    expect(limited).toMatchObject({ status: 429, body: { error: 'Too many requests. Please try again later.' } });
    expect(limited.text).not.toContain(PII_CANARY);
    expect((await postSubmission(app, validSubmission, '198.51.100.201')).status).toBe(201);
    expect(mockRepositoryCreate).toHaveBeenCalledTimes(6);
  });
});
