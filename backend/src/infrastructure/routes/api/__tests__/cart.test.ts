import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

const mockGetCartByUserIdExecute = jest.fn();
const mockSyncCartExecute = jest.fn();

jest.mock('../../../../application/use-cases/GetCartByUserIdUseCase', () => {
  return {
    GetCartByUserIdUseCase: jest.fn().mockImplementation(() => ({
      execute: mockGetCartByUserIdExecute,
    })),
  };
});

jest.mock('../../../../application/use-cases/SyncCartUseCase', () => {
  return {
    SyncCartUseCase: jest.fn().mockImplementation(() => ({
      execute: mockSyncCartExecute,
    })),
  };
});

import errorHandler from '../../../middlewares/errorHandler';
import { getJwtSecret } from '../../../security/JwtSecret';

const JWT_SECRET = getJwtSecret();

const buildApp = (): Express => {
  const cartRouter = require('../cart').default;
  const app = express();
  app.use(express.json());
  app.use('/api', cartRouter);
  app.use(errorHandler);
  return app;
};

const authToken = jwt.sign(
  { userId: 5, email: 'user@test.com', category: 'User', idRole: 2 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('api/cart routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  describe('GET /api/cart', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).get('/api/cart');

      expect(res.status).toBe(401);
      expect(mockGetCartByUserIdExecute).not.toHaveBeenCalled();
    });

    it('returns 200 and the user cart when authenticated', async () => {
      const mockCart = {
        items: [
          {
            idCart: 1,
            idUser: 5,
            idProduct: 10,
            quantity: 2,
            unitPrice: 100,
            status: 'ACTIVE',
            product: { idProduct: 10, nameProduct: 'Product A', price: 100, image: 'a.png' },
            hasPriceDrift: false,
          },
        ],
        total: 200,
      };
      mockGetCartByUserIdExecute.mockResolvedValue(mockCart);

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCart);
      expect(mockGetCartByUserIdExecute).toHaveBeenCalledWith(5);
    });
  });

  describe('PUT /api/cart', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app)
        .put('/api/cart')
        .send({ items: [{ productId: 10, quantity: 1 }] });

      expect(res.status).toBe(401);
      expect(mockSyncCartExecute).not.toHaveBeenCalled();
    });

    it('adds an item: syncs a cart that includes a new product and returns the updated cart', async () => {
      const mockCart = {
        items: [
          {
            idCart: 1,
            idUser: 5,
            idProduct: 10,
            quantity: 1,
            unitPrice: 100,
            status: 'ACTIVE',
            product: { idProduct: 10, nameProduct: 'Product A', price: 100, image: 'a.png' },
            hasPriceDrift: false,
          },
        ],
        total: 100,
      };
      mockSyncCartExecute.mockResolvedValue(undefined);
      mockGetCartByUserIdExecute.mockResolvedValue(mockCart);

      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: 10, quantity: 1 }] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, cart: mockCart });
      expect(mockSyncCartExecute).toHaveBeenCalledWith(5, [{ productId: 10, quantity: 1 }]);
    });

    it('removes an item: syncs a cart without a previously present product and returns the updated cart', async () => {
      const mockCartAfterRemoval = { items: [], total: 0 };
      mockSyncCartExecute.mockResolvedValue(undefined);
      mockGetCartByUserIdExecute.mockResolvedValue(mockCartAfterRemoval);

      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: 10, quantity: 1 }] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, cart: mockCartAfterRemoval });
      expect(mockSyncCartExecute).toHaveBeenCalledWith(5, [{ productId: 10, quantity: 1 }]);
    });

    it('updates quantity: syncs a cart with a changed quantity for an existing product', async () => {
      const mockCartAfterUpdate = {
        items: [
          {
            idCart: 1,
            idUser: 5,
            idProduct: 10,
            quantity: 5,
            unitPrice: 100,
            status: 'ACTIVE',
            product: { idProduct: 10, nameProduct: 'Product A', price: 100, image: 'a.png' },
            hasPriceDrift: false,
          },
        ],
        total: 500,
      };
      mockSyncCartExecute.mockResolvedValue(undefined);
      mockGetCartByUserIdExecute.mockResolvedValue(mockCartAfterUpdate);

      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: 10, quantity: 5 }] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, cart: mockCartAfterUpdate });
      expect(mockSyncCartExecute).toHaveBeenCalledWith(5, [{ productId: 10, quantity: 5 }]);
    });

    it('returns 400 and does not call SyncCartUseCase when items fails validation (quantity out of range)', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: 10, quantity: 0 }] });

      expect(res.status).toBe(400);
      expect(mockSyncCartExecute).not.toHaveBeenCalled();
    });

    it('clears the cart: syncs an empty items array and returns the emptied cart', async () => {
      const mockEmptyCart = { items: [], total: 0 };
      mockSyncCartExecute.mockResolvedValue(undefined);
      mockGetCartByUserIdExecute.mockResolvedValue(mockEmptyCart);

      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, cart: mockEmptyCart });
      expect(mockSyncCartExecute).toHaveBeenCalledWith(5, []);
    });
  });
});
