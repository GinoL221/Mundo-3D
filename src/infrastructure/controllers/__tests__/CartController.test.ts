import { CartController } from '../CartController';
import { Request, Response, NextFunction } from 'express';

describe('CartController', () => {
  let controller: CartController;
  let mockGetCartByUserIdUseCase: any;
  let req: Partial<Request> & { session?: any };
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    mockGetCartByUserIdUseCase = { execute: jest.fn() };
    controller = new CartController(mockGetCartByUserIdUseCase);

    req = {
      session: {
        userLogged: { idUser: 42 }
      }
    };
    res = {
      render: jest.fn(),
    };
    next = jest.fn();
  });

  describe('viewCart', () => {
    it('should retrieve cart, calculate total, and render products/productCart', async () => {
      const mockResult = {
        items: [
          {
            IDCart: 1,
            IDUser: 42,
            IDProduct: 10,
            Quantity: 2,
            UnitPrice: 100,
            CartStatus: 'ACTIVE',
            hasPriceDrift: false,
            product: { IDProduct: 10, NameProduct: 'Test Product', Price: 100, Image: 'img.jpg' }
          }
        ],
        total: 200
      };
      mockGetCartByUserIdUseCase.execute.mockResolvedValue(mockResult);

      await controller.viewCart(req as Request, res as Response, next);

      expect(mockGetCartByUserIdUseCase.execute).toHaveBeenCalledWith(42);
      expect(res.render).toHaveBeenCalledWith('products/productCart', {
        userShoppingCart: mockResult.items,
        total: 200
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should render products/productCart with different items and total (Triangulation)', async () => {
      const mockResult = {
        items: [
          {
            IDCart: 2,
            IDUser: 42,
            IDProduct: 20,
            Quantity: 1,
            UnitPrice: 50,
            CartStatus: 'ACTIVE',
            hasPriceDrift: true,
            product: { IDProduct: 20, NameProduct: 'Other Product', Price: 60, Image: 'other.jpg' }
          }
        ],
        total: 50
      };
      mockGetCartByUserIdUseCase.execute.mockResolvedValue(mockResult);

      await controller.viewCart(req as Request, res as Response, next);

      expect(mockGetCartByUserIdUseCase.execute).toHaveBeenCalledWith(42);
      expect(res.render).toHaveBeenCalledWith('products/productCart', {
        userShoppingCart: mockResult.items,
        total: 50
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should propagate errors to next middleware when use case fails', async () => {
      const error = new Error('Database connection failed');
      mockGetCartByUserIdUseCase.execute.mockRejectedValue(error);

      await controller.viewCart(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.render).not.toHaveBeenCalled();
    });
  });
});
