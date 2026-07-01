import { Request, Response, NextFunction } from 'express';
import { ProductApiController } from '../ProductApiController';
import { ListProductsUseCase } from '../../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../../application/use-cases/GetProductByIdUseCase';
import { GetLatestProductUseCase } from '../../../application/use-cases/GetLatestProductUseCase';

describe('ProductApiController', () => {
  let controller: ProductApiController;
  let mockListProductsUseCase: jest.Mocked<ListProductsUseCase>;
  let mockGetProductByIdUseCase: jest.Mocked<GetProductByIdUseCase>;
  let mockGetLatestProductUseCase: jest.Mocked<GetLatestProductUseCase>;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockListProductsUseCase = {
      execute: jest.fn(),
    } as any;
    mockGetProductByIdUseCase = {
      execute: jest.fn(),
    } as any;
    mockGetLatestProductUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new ProductApiController(
      mockListProductsUseCase,
      mockGetProductByIdUseCase,
      mockGetLatestProductUseCase
    );

    req = { params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    next = jest.fn();
  });

  describe('index', () => {
    it('returns 200 and the product list on success', async () => {
      const mockResult = {
        products: [{ idProduct: 1, nameProduct: 'Product A', price: 100, image: 'a.png' }],
      };
      mockListProductsUseCase.execute.mockResolvedValue(mockResult as any);

      await controller.index(req as Request, res as Response, next);

      expect(mockListProductsUseCase.execute).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      const error = new Error('DB is down');
      mockListProductsUseCase.execute.mockRejectedValue(error);

      await controller.index(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('returns 200 and the product on success', async () => {
      req.params = { id: '10' };
      const mockProduct = { idProduct: 10, nameProduct: 'Product A', price: 100, image: 'a.png' };
      mockGetProductByIdUseCase.execute.mockResolvedValue(mockProduct as any);

      await controller.show(req as Request, res as Response, next);

      expect(mockGetProductByIdUseCase.execute).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith(mockProduct);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when the error message matches "Product not found"', async () => {
      req.params = { id: '999' };
      mockGetProductByIdUseCase.execute.mockRejectedValue(new Error('Product not found'));

      await controller.show(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Producto no encontrado' });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards to next when the error message does not match "Product not found"', async () => {
      req.params = { id: '10' };
      const error = new Error('DB is down');
      mockGetProductByIdUseCase.execute.mockRejectedValue(error);

      await controller.show(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('latest', () => {
    it('returns 200 and the latest product on success', async () => {
      const mockProduct = { idProduct: 5, nameProduct: 'Newest', price: 50, image: 'n.png' };
      mockGetLatestProductUseCase.execute.mockResolvedValue(mockProduct as any);

      await controller.latest(req as Request, res as Response, next);

      expect(mockGetLatestProductUseCase.execute).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockProduct);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when the error message matches "Product not found"', async () => {
      mockGetLatestProductUseCase.execute.mockRejectedValue(new Error('Product not found'));

      await controller.latest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'No hay productos disponibles.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards to next when the error message does not match "Product not found"', async () => {
      const error = new Error('DB is down');
      mockGetLatestProductUseCase.execute.mockRejectedValue(error);

      await controller.latest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
