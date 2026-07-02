import { Request, Response, NextFunction } from 'express';
import { ProductApiController } from '../ProductApiController';
import { ListProductsUseCase } from '../../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../../application/use-cases/GetProductByIdUseCase';
import { GetLatestProductUseCase } from '../../../application/use-cases/GetLatestProductUseCase';
import { CreateProductUseCase } from '../../../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../../../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../../application/use-cases/DeleteProductUseCase';
import { AdjustProductStockUseCase } from '../../../application/use-cases/AdjustProductStockUseCase';
import { cleanupUploadedFile } from '../../utils/cleanupUploadedFile';

jest.mock('../../utils/cleanupUploadedFile', () => ({
  cleanupUploadedFile: jest.fn(),
}));

describe('ProductApiController', () => {
  let controller: ProductApiController;
  let mockListProductsUseCase: jest.Mocked<ListProductsUseCase>;
  let mockGetProductByIdUseCase: jest.Mocked<GetProductByIdUseCase>;
  let mockGetLatestProductUseCase: jest.Mocked<GetLatestProductUseCase>;
  let mockCreateProductUseCase: jest.Mocked<CreateProductUseCase>;
  let mockUpdateProductUseCase: jest.Mocked<UpdateProductUseCase>;
  let mockDeleteProductUseCase: jest.Mocked<DeleteProductUseCase>;
  let mockAdjustProductStockUseCase: jest.Mocked<AdjustProductStockUseCase>;

  let req: Partial<Request> & { file?: { filename: string } };
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListProductsUseCase = {
      execute: jest.fn(),
    } as any;
    mockGetProductByIdUseCase = {
      execute: jest.fn(),
    } as any;
    mockGetLatestProductUseCase = {
      execute: jest.fn(),
    } as any;
    mockCreateProductUseCase = {
      execute: jest.fn(),
    } as any;
    mockUpdateProductUseCase = {
      execute: jest.fn(),
    } as any;
    mockDeleteProductUseCase = {
      execute: jest.fn(),
    } as any;
    mockAdjustProductStockUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new ProductApiController(
      mockListProductsUseCase,
      mockGetProductByIdUseCase,
      mockGetLatestProductUseCase,
      mockCreateProductUseCase,
      mockUpdateProductUseCase,
      mockDeleteProductUseCase,
      mockAdjustProductStockUseCase
    );

    req = { params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
      send: jest.fn().mockReturnThis() as any,
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

  describe('create', () => {
    it('returns 201 and the created product, mapping req.file.filename to image', async () => {
      req.body = {
        nameProduct: 'Product A',
        price: '100',
        descriptionProduct: 'Desc',
        idCategory: '1',
        idFranchise: '2',
      };
      req.file = { filename: 'uploaded.png' };
      const mockProduct = { idProduct: 1, nameProduct: 'Product A', price: 100, image: 'uploaded.png', stock: 0 };
      mockCreateProductUseCase.execute.mockResolvedValue(mockProduct as any);

      await controller.create(req as Request, res as Response, next);

      expect(mockCreateProductUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ image: 'uploaded.png', nameProduct: 'Product A' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockProduct);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.body = { nameProduct: 'Product A', price: '100', descriptionProduct: 'Desc', idCategory: '1', idFranchise: '2' };
      req.file = { filename: 'uploaded.png' };
      const error = new Error('DB is down');
      mockCreateProductUseCase.execute.mockRejectedValue(error);

      await controller.create(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns 200 and the updated product on success', async () => {
      req.params = { id: '10' };
      req.body = { nameProduct: 'Updated Name' };
      const mockProduct = { idProduct: 10, nameProduct: 'Updated Name', price: 100, image: 'a.png', stock: 5 };
      mockUpdateProductUseCase.execute.mockResolvedValue(mockProduct as any);

      await controller.update(req as Request, res as Response, next);

      expect(mockUpdateProductUseCase.execute).toHaveBeenCalledWith(10, expect.objectContaining({ nameProduct: 'Updated Name' }));
      expect(res.json).toHaveBeenCalledWith(mockProduct);
      expect(next).not.toHaveBeenCalled();
    });

    it('never forwards a stock override from the request body to the use case', async () => {
      req.params = { id: '10' };
      req.body = { nameProduct: 'Updated Name', stock: 999 };
      mockUpdateProductUseCase.execute.mockResolvedValue({ idProduct: 10, stock: 5 } as any);

      await controller.update(req as Request, res as Response, next);

      const calledInput = mockUpdateProductUseCase.execute.mock.calls[0][1];
      expect(calledInput).not.toHaveProperty('stock');
    });

    it('returns 404 when the use case resolves null (product not found)', async () => {
      req.params = { id: '999' };
      req.body = { nameProduct: 'Updated Name' };
      mockUpdateProductUseCase.execute.mockResolvedValue(null);

      await controller.update(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Producto no encontrado' });
      expect(next).not.toHaveBeenCalled();
    });

    it('cleans up an already-uploaded replacement image when the product is not found (404)', async () => {
      req.params = { id: '999' };
      req.body = { nameProduct: 'Updated Name' };
      req.file = { filename: 'new.png', path: '/tmp/uploads/new.png' } as any;
      mockUpdateProductUseCase.execute.mockResolvedValue(null);

      await controller.update(req as Request, res as Response, next);

      expect(cleanupUploadedFile).toHaveBeenCalledWith('/tmp/uploads/new.png');
    });

    it('does not touch the filesystem (retains the uploaded image) when the update succeeds', async () => {
      req.params = { id: '10' };
      req.body = { nameProduct: 'Updated Name' };
      req.file = { filename: 'new.png', path: '/tmp/uploads/new.png' } as any;
      const mockProduct = { idProduct: 10, nameProduct: 'Updated Name', image: 'new.png', stock: 5 };
      mockUpdateProductUseCase.execute.mockResolvedValue(mockProduct as any);

      await controller.update(req as Request, res as Response, next);

      expect(cleanupUploadedFile).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '10' };
      req.body = { nameProduct: 'Updated Name' };
      const error = new Error('DB is down');
      mockUpdateProductUseCase.execute.mockRejectedValue(error);

      await controller.update(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('destroy', () => {
    it('returns 204 when the product was deleted', async () => {
      req.params = { id: '10' };
      mockDeleteProductUseCase.execute.mockResolvedValue(true);

      await controller.destroy(req as Request, res as Response, next);

      expect(mockDeleteProductUseCase.execute).toHaveBeenCalledWith(10);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when the product does not exist', async () => {
      req.params = { id: '999' };
      mockDeleteProductUseCase.execute.mockResolvedValue(false);

      await controller.destroy(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Producto no encontrado' });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '10' };
      const error = new Error('DB is down');
      mockDeleteProductUseCase.execute.mockRejectedValue(error);

      await controller.destroy(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('adjustStock', () => {
    it('returns 200 and the updated product on a valid delta', async () => {
      req.params = { id: '10' };
      req.body = { delta: 3 };
      const mockProduct = { idProduct: 10, stock: 8 };
      mockAdjustProductStockUseCase.execute.mockResolvedValue(mockProduct as any);

      await controller.adjustStock(req as Request, res as Response, next);

      expect(mockAdjustProductStockUseCase.execute).toHaveBeenCalledWith(10, 3);
      expect(res.json).toHaveBeenCalledWith(mockProduct);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when the use case resolves null (product not found)', async () => {
      req.params = { id: '999' };
      req.body = { delta: 3 };
      mockAdjustProductStockUseCase.execute.mockResolvedValue(null);

      await controller.adjustStock(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Producto no encontrado' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 409 when the use case throws "Insufficient stock"', async () => {
      req.params = { id: '10' };
      req.body = { delta: -50 };
      mockAdjustProductStockUseCase.execute.mockRejectedValue(new Error('Insufficient stock'));

      await controller.adjustStock(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when the use case throws "Delta must be a non-zero integer"', async () => {
      req.params = { id: '10' };
      req.body = { delta: 0 };
      mockAdjustProductStockUseCase.execute.mockRejectedValue(new Error('Delta must be a non-zero integer'));

      await controller.adjustStock(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '10' };
      req.body = { delta: 1 };
      const error = new Error('DB is down');
      mockAdjustProductStockUseCase.execute.mockRejectedValue(error);

      await controller.adjustStock(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
