import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { EmptyCartException } from '../../../../domain/exceptions/EmptyCartException';
import { InsufficientStockException } from '../../../../domain/exceptions/InsufficientStockException';
import { IllegalOrderTransitionException } from '../../../../domain/exceptions/IllegalOrderTransitionException';
import { Role } from '../../../../domain/Role';

const mockCreateOrderExecute = jest.fn();
const mockGetOrderByIdExecute = jest.fn();
const mockListOrdersExecute = jest.fn();
const mockConfirmOrderPaymentExecute = jest.fn();
const mockCancelOrderExecute = jest.fn();

jest.mock('../../../../application/use-cases/CreateOrderUseCase', () => ({
  CreateOrderUseCase: jest.fn().mockImplementation(() => ({ execute: mockCreateOrderExecute })),
}));
jest.mock('../../../../application/use-cases/GetOrderByIdUseCase', () => ({
  GetOrderByIdUseCase: jest.fn().mockImplementation(() => ({ execute: mockGetOrderByIdExecute })),
}));
jest.mock('../../../../application/use-cases/ListOrdersUseCase', () => ({
  ListOrdersUseCase: jest.fn().mockImplementation(() => ({ execute: mockListOrdersExecute })),
}));
jest.mock('../../../../application/use-cases/ConfirmOrderPaymentUseCase', () => ({
  ConfirmOrderPaymentUseCase: jest.fn().mockImplementation(() => ({ execute: mockConfirmOrderPaymentExecute })),
}));
jest.mock('../../../../application/use-cases/CancelOrderUseCase', () => ({
  CancelOrderUseCase: jest.fn().mockImplementation(() => ({ execute: mockCancelOrderExecute })),
}));

import errorHandler from '../../../middlewares/errorHandler';
import { authAndCsrf } from '../../../../__tests__/helpers/apiAuthTestHelpers';

const buildApp = (): Express => {
  const ordersRouter = require('../orders').default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', ordersRouter);
  app.use(errorHandler);
  return app;
};

const buyer = authAndCsrf({ userId: 7, email: 'buyer@test.com', category: 'User', idRole: Role.USER });
const staff = authAndCsrf({ userId: 8, email: 'staff@test.com', category: 'Staff', idRole: Role.STAFF });
const admin = authAndCsrf({ userId: 1, email: 'admin@test.com', category: 'Admin', idRole: Role.ADMIN });

const sampleOrder = {
  idOrder: 41,
  idUser: 7,
  status: 'AWAITING_PAYMENT',
  items: [],
  totalAmount: 3000,
  createdAt: '2026-08-28T14:03:11.000Z',
  paymentReference: null,
};

describe('api/orders routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  describe('POST /api/orders', () => {
    it('returns 400 IDEMPOTENCY_KEY_REQUIRED when the Idempotency-Key header is missing', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      expect(mockCreateOrderExecute).not.toHaveBeenCalled();
    });

    it('returns 201 and the created order on a happy path', async () => {
      mockCreateOrderExecute.mockResolvedValue(sampleOrder);

      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken)
        .set('Idempotency-Key', 'key-1');

      expect(res.status).toBe(201);
      expect(res.body).toEqual(sampleOrder);
      expect(mockCreateOrderExecute).toHaveBeenCalledWith(7, 'key-1');
    });

    it('returns 409 EMPTY_CART when the cart is empty', async () => {
      mockCreateOrderExecute.mockRejectedValue(new EmptyCartException());

      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken)
        .set('Idempotency-Key', 'key-1');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMPTY_CART');
    });

    it('returns 409 INSUFFICIENT_STOCK with the full shortages list', async () => {
      const shortages = [
        { idProduct: 12, productName: 'Maceta Groot', requested: 3, available: 1 },
        { idProduct: 19, productName: 'Casco Mando', requested: 1, available: 0 },
      ];
      mockCreateOrderExecute.mockRejectedValue(new InsufficientStockException(shortages));

      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken)
        .set('Idempotency-Key', 'key-1');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
      expect(res.body.shortages).toEqual(shortages);
    });

    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).post('/api/orders').set('Idempotency-Key', 'key-1');

      expect(res.status).toBe(401);
      expect(mockCreateOrderExecute).not.toHaveBeenCalled();
    });

    it('returns 403 without an X-CSRF-Token header even with a valid auth cookie', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', buyer.cookie)
        .set('Idempotency-Key', 'key-1');

      expect(res.status).toBe(403);
      expect(mockCreateOrderExecute).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/orders/:id', () => {
    it('returns 200 for the owning buyer', async () => {
      mockGetOrderByIdExecute.mockResolvedValue(sampleOrder);

      const res = await request(app)
        .get('/api/orders/41')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(sampleOrder);
      expect(mockGetOrderByIdExecute).toHaveBeenCalledWith(41, 7, false);
    });

    it('returns 200 for ADMIN even when not the owner (ADMIN bypass)', async () => {
      mockGetOrderByIdExecute.mockResolvedValue(sampleOrder);

      const res = await request(app)
        .get('/api/orders/41')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken);

      expect(res.status).toBe(200);
      expect(mockGetOrderByIdExecute).toHaveBeenCalledWith(41, 1, true);
    });

    it('returns 404 for a non-owner buyer', async () => {
      mockGetOrderByIdExecute.mockResolvedValue(null);

      const otherBuyer = authAndCsrf({ userId: 99, email: 'other@test.com', category: 'User', idRole: Role.USER });
      const res = await request(app)
        .get('/api/orders/41')
        .set('Cookie', otherBuyer.cookie)
        .set('X-CSRF-Token', otherBuyer.csrfToken);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });

    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).get('/api/orders/41');

      expect(res.status).toBe(401);
      expect(mockGetOrderByIdExecute).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/orders', () => {
    it('returns 200 and the order list for ADMIN', async () => {
      mockListOrdersExecute.mockResolvedValue([sampleOrder]);

      const res = await request(app)
        .get('/api/orders')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([sampleOrder]);
    });

    it('returns 403 for STAFF', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Cookie', staff.cookie)
        .set('X-CSRF-Token', staff.csrfToken);

      expect(res.status).toBe(403);
      expect(mockListOrdersExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for a plain buyer', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken);

      expect(res.status).toBe(403);
      expect(mockListOrdersExecute).not.toHaveBeenCalled();
    });

    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).get('/api/orders');

      expect(res.status).toBe(401);
      expect(mockListOrdersExecute).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/orders/:id/confirm-payment', () => {
    it('returns 200 for ADMIN on success', async () => {
      mockConfirmOrderPaymentExecute.mockResolvedValue({ ...sampleOrder, status: 'PAID' });

      const res = await request(app)
        .post('/api/orders/41/confirm-payment')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAID');
    });

    it('returns 409 ILLEGAL_ORDER_TRANSITION on double-confirm', async () => {
      mockConfirmOrderPaymentExecute.mockRejectedValue(new IllegalOrderTransitionException());

      const res = await request(app)
        .post('/api/orders/41/confirm-payment')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ILLEGAL_ORDER_TRANSITION');
    });

    it('returns 403 for STAFF', async () => {
      const res = await request(app)
        .post('/api/orders/41/confirm-payment')
        .set('Cookie', staff.cookie)
        .set('X-CSRF-Token', staff.csrfToken);

      expect(res.status).toBe(403);
      expect(mockConfirmOrderPaymentExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for a plain buyer', async () => {
      const res = await request(app)
        .post('/api/orders/41/confirm-payment')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken);

      expect(res.status).toBe(403);
      expect(mockConfirmOrderPaymentExecute).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('returns 200 for ADMIN on success', async () => {
      mockCancelOrderExecute.mockResolvedValue({ ...sampleOrder, status: 'CANCELLED' });

      const res = await request(app)
        .post('/api/orders/41/cancel')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('returns 409 ILLEGAL_ORDER_TRANSITION on a second cancel', async () => {
      mockCancelOrderExecute.mockRejectedValue(new IllegalOrderTransitionException());

      const res = await request(app)
        .post('/api/orders/41/cancel')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ILLEGAL_ORDER_TRANSITION');
    });

    it('returns 403 for STAFF', async () => {
      const res = await request(app)
        .post('/api/orders/41/cancel')
        .set('Cookie', staff.cookie)
        .set('X-CSRF-Token', staff.csrfToken);

      expect(res.status).toBe(403);
      expect(mockCancelOrderExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for a plain buyer', async () => {
      const res = await request(app)
        .post('/api/orders/41/cancel')
        .set('Cookie', buyer.cookie)
        .set('X-CSRF-Token', buyer.csrfToken);

      expect(res.status).toBe(403);
      expect(mockCancelOrderExecute).not.toHaveBeenCalled();
    });
  });
});
