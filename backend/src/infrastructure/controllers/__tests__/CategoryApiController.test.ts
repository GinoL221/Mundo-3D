import { Request, Response, NextFunction } from 'express';
import { CategoryApiController } from '../CategoryApiController';
import { ListCategoriesUseCase } from '../../../application/use-cases/ListCategoriesUseCase';
import { GetCategoryByIdUseCase } from '../../../application/use-cases/GetCategoryByIdUseCase';
import { CreateCategoryUseCase } from '../../../application/use-cases/CreateCategoryUseCase';
import { UpdateCategoryUseCase } from '../../../application/use-cases/UpdateCategoryUseCase';
import { DeleteCategoryUseCase } from '../../../application/use-cases/DeleteCategoryUseCase';

describe('CategoryApiController', () => {
  let controller: CategoryApiController;
  let mockListCategoriesUseCase: jest.Mocked<ListCategoriesUseCase>;
  let mockGetCategoryByIdUseCase: jest.Mocked<GetCategoryByIdUseCase>;
  let mockCreateCategoryUseCase: jest.Mocked<CreateCategoryUseCase>;
  let mockUpdateCategoryUseCase: jest.Mocked<UpdateCategoryUseCase>;
  let mockDeleteCategoryUseCase: jest.Mocked<DeleteCategoryUseCase>;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListCategoriesUseCase = { execute: jest.fn() } as any;
    mockGetCategoryByIdUseCase = { execute: jest.fn() } as any;
    mockCreateCategoryUseCase = { execute: jest.fn() } as any;
    mockUpdateCategoryUseCase = { execute: jest.fn() } as any;
    mockDeleteCategoryUseCase = { execute: jest.fn() } as any;

    controller = new CategoryApiController(
      mockListCategoriesUseCase,
      mockGetCategoryByIdUseCase,
      mockCreateCategoryUseCase,
      mockUpdateCategoryUseCase,
      mockDeleteCategoryUseCase
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
    it('returns 200 and the plain category array on success', async () => {
      const mockResult = [
        { idCategory: 1, nameCategory: 'Action Figures' },
        { idCategory: 2, nameCategory: 'Vehicles' },
      ];
      mockListCategoriesUseCase.execute.mockResolvedValue(mockResult as any);

      await controller.index(req as Request, res as Response, next);

      expect(mockListCategoriesUseCase.execute).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      const error = new Error('DB is down');
      mockListCategoriesUseCase.execute.mockRejectedValue(error);

      await controller.index(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('returns 200 and the category on success', async () => {
      req.params = { id: '10' };
      const mockCategory = { idCategory: 10, nameCategory: 'Action Figures' };
      mockGetCategoryByIdUseCase.execute.mockResolvedValue(mockCategory as any);

      await controller.show(req as Request, res as Response, next);

      expect(mockGetCategoryByIdUseCase.execute).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith(mockCategory);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when the error message matches "Category not found"', async () => {
      req.params = { id: '999' };
      mockGetCategoryByIdUseCase.execute.mockRejectedValue(new Error('Category not found'));

      await controller.show(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards to next when the error message does not match "Category not found"', async () => {
      req.params = { id: '10' };
      const error = new Error('DB is down');
      mockGetCategoryByIdUseCase.execute.mockRejectedValue(error);

      await controller.show(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 400 when :id is not numeric, instead of falling through to a 500', async () => {
      req.params = { id: 'not-a-number' };

      await controller.show(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockGetCategoryByIdUseCase.execute).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('returns 201 and the created category on success', async () => {
      req.body = { nameCategory: 'Action Figures' };
      const mockCategory = { idCategory: 1, nameCategory: 'Action Figures' };
      mockCreateCategoryUseCase.execute.mockResolvedValue(mockCategory as any);

      await controller.create(req as Request, res as Response, next);

      expect(mockCreateCategoryUseCase.execute).toHaveBeenCalledWith({ nameCategory: 'Action Figures' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCategory);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.body = { nameCategory: 'Action Figures' };
      const error = new Error('DB is down');
      mockCreateCategoryUseCase.execute.mockRejectedValue(error);

      await controller.create(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns 200 and the updated category on success', async () => {
      req.params = { id: '10' };
      req.body = { nameCategory: 'Updated Name' };
      const mockCategory = { idCategory: 10, nameCategory: 'Updated Name' };
      mockUpdateCategoryUseCase.execute.mockResolvedValue(mockCategory as any);

      await controller.update(req as Request, res as Response, next);

      expect(mockUpdateCategoryUseCase.execute).toHaveBeenCalledWith(10, { nameCategory: 'Updated Name' });
      expect(res.json).toHaveBeenCalledWith(mockCategory);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when the use case resolves null (category not found)', async () => {
      req.params = { id: '999' };
      req.body = { nameCategory: 'Updated Name' };
      mockUpdateCategoryUseCase.execute.mockResolvedValue(null);

      await controller.update(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '10' };
      req.body = { nameCategory: 'Updated Name' };
      const error = new Error('DB is down');
      mockUpdateCategoryUseCase.execute.mockRejectedValue(error);

      await controller.update(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('returns 400 when :id is not numeric, instead of falling through to a 500', async () => {
      req.params = { id: 'not-a-number' };
      req.body = { nameCategory: 'Updated Name' };

      await controller.update(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockUpdateCategoryUseCase.execute).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('returns 204 when the category was deleted', async () => {
      req.params = { id: '10' };
      mockDeleteCategoryUseCase.execute.mockResolvedValue(true);

      await controller.destroy(req as Request, res as Response, next);

      expect(mockDeleteCategoryUseCase.execute).toHaveBeenCalledWith(10);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when the category does not exist', async () => {
      req.params = { id: '999' };
      mockDeleteCategoryUseCase.execute.mockResolvedValue(false);

      await controller.destroy(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 409 when the use case throws "Category has associated products"', async () => {
      req.params = { id: '10' };
      mockDeleteCategoryUseCase.execute.mockRejectedValue(new Error('Category has associated products'));

      await controller.destroy(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No se puede eliminar la categoría porque tiene productos asociados',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '10' };
      const error = new Error('DB is down');
      mockDeleteCategoryUseCase.execute.mockRejectedValue(error);

      await controller.destroy(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('returns 400 when :id is not numeric, instead of falling through to a 500', async () => {
      req.params = { id: 'not-a-number' };

      await controller.destroy(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockDeleteCategoryUseCase.execute).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
