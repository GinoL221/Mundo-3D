import { Request, Response, NextFunction } from 'express';
import { CartApiController } from '../CartApiController';
import { GetCartByUserIdUseCase } from '../../../application/use-cases/GetCartByUserIdUseCase';
import { SyncCartUseCase } from '../../../application/use-cases/SyncCartUseCase';

describe('CartApiController', () => {
  let controller: CartApiController;
  let mockGetCartByUserIdUseCase: jest.Mocked<GetCartByUserIdUseCase>;
  let mockSyncCartUseCase: jest.Mocked<SyncCartUseCase>;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockGetCartByUserIdUseCase = {
      execute: jest.fn(),
    } as any;
    mockSyncCartUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new CartApiController(
      mockGetCartByUserIdUseCase,
      mockSyncCartUseCase
    );

    req = {
      user: { userId: 5, email: 'user@test.com', category: 'User', idRole: 2 },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    next = jest.fn();
  });

  describe('getCart', () => {
    it('returns 200 and the user shopping cart', async () => {
      const mockCartResult = {
        items: [
          {
            IDCart: 1,
            IDUser: 5,
            IDProduct: 10,
            Quantity: 2,
            UnitPrice: 100.0,
            CartStatus: 'ACTIVE',
            product: {
              idProduct: 10,
              nameProduct: 'Product A',
              price: 100.0,
              image: 'imgA.png',
            },
            hasPriceDrift: false,
          },
        ],
        total: 200.0,
      };

      mockGetCartByUserIdUseCase.execute.mockResolvedValue(mockCartResult);

      await controller.getCart(req as Request, res as Response, next);

      expect(mockGetCartByUserIdUseCase.execute).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith(mockCartResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 if user is not set in request', async () => {
      req.user = undefined;

      await controller.getCart(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no autenticado' });
      expect(mockGetCartByUserIdUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('syncCart', () => {
    it('calls SyncCartUseCase, then returns updated cart DTO', async () => {
      req.body = {
        items: [{ productId: 10, quantity: 2 }],
      };

      const mockCartResult = {
        items: [
          {
            IDCart: 1,
            IDUser: 5,
            IDProduct: 10,
            Quantity: 2,
            UnitPrice: 100.0,
            CartStatus: 'ACTIVE',
            product: {
              idProduct: 10,
              nameProduct: 'Product A',
              price: 100.0,
              image: 'imgA.png',
            },
            hasPriceDrift: false,
          },
        ],
        total: 200.0,
      };

      mockSyncCartUseCase.execute.mockResolvedValue(undefined);
      mockGetCartByUserIdUseCase.execute.mockResolvedValue(mockCartResult);

      await controller.syncCart(req as Request, res as Response, next);

      expect(mockSyncCartUseCase.execute).toHaveBeenCalledWith(5, [{ productId: 10, quantity: 2 }]);
      expect(mockGetCartByUserIdUseCase.execute).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        cart: mockCartResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 if user is not set in request for syncCart', async () => {
      req.user = undefined;

      await controller.syncCart(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no autenticado' });
      expect(mockSyncCartUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
