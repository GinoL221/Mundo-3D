import { ProductController } from '../ProductController';
import { Request, Response } from 'express';
import path from 'path';
import { validationResult } from 'express-validator';

jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

describe('ProductController', () => {
  let controller: ProductController;
  let mockListProductsUseCase: any;
  let mockGetProductByIdUseCase: any;
  let mockCreateProductUseCase: any;
  let mockUpdateProductUseCase: any;
  let mockDeleteProductUseCase: any;
  let mockCategoryRepo: any;
  let mockFranchiseRepo: any;

  let req: Partial<Request> & { file?: { filename: string } };
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    mockListProductsUseCase = { execute: jest.fn() };
    mockGetProductByIdUseCase = { execute: jest.fn() };
    mockCreateProductUseCase = { execute: jest.fn() };
    mockUpdateProductUseCase = { execute: jest.fn() };
    mockDeleteProductUseCase = { execute: jest.fn() };
    mockCategoryRepo = { findAll: jest.fn(), findById: jest.fn() };
    mockFranchiseRepo = { findAll: jest.fn(), findById: jest.fn() };

    controller = new ProductController(
      mockListProductsUseCase,
      mockGetProductByIdUseCase,
      mockCreateProductUseCase,
      mockUpdateProductUseCase,
      mockDeleteProductUseCase,
      mockCategoryRepo,
      mockFranchiseRepo
    );

    req = {};
    res = {
      render: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('getAllProducts', () => {
    it('should render products/products with all products DTO', async () => {
      const mockResult = {
        count: 1,
        products: [
          {
            IDProduct: 1,
            NameProduct: 'Test Product',
            Price: 100,
            DescriptionProduct: 'Desc',
            Image: 'img.jpg',
            IDCategory: 1,
            IDFranchise: 1,
            Category: 'Cat 1',
          },
        ],
        countByCategory: {},
      };
      mockListProductsUseCase.execute.mockResolvedValue(mockResult);

      await controller.getAllProducts(req as Request, res as Response, next);

      expect(mockListProductsUseCase.execute).toHaveBeenCalledTimes(1);
      expect(res.render).toHaveBeenCalledWith('products/products', {
        allProducts: mockResult.products,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error if use case throws', async () => {
      const error = new Error('Database Error');
      mockListProductsUseCase.execute.mockRejectedValue(error);

      await controller.getAllProducts(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getProductById', () => {
    it('should render productDetail if product is found', async () => {
      req.params = { id: '1' };
      const mockProduct = {
        IDProduct: 1,
        NameProduct: 'Product 1',
        Price: 100,
        DescriptionProduct: 'Desc',
        Image: 'img.jpg',
        IDCategory: 1,
        IDFranchise: 1,
        Category: 'Cat 1',
      };
      mockGetProductByIdUseCase.execute.mockResolvedValue(mockProduct);

      await controller.getProductById(req as Request, res as Response, next);

      expect(mockGetProductByIdUseCase.execute).toHaveBeenCalledWith(1);
      expect(res.render).toHaveBeenCalledWith(
        path.join(__dirname, '../../../views/products/productDetail.ejs'),
        { product: mockProduct }
      );
    });

    it('should render 404NotFound if product is not found', async () => {
      req.params = { id: '999' };
      mockGetProductByIdUseCase.execute.mockRejectedValue(new Error('Product not found'));

      await controller.getProductById(req as Request, res as Response, next);

      expect(res.render).toHaveBeenCalledWith(
        path.join(__dirname, '../../../views/404NotFound.ejs'),
        { message: 'Product not found' }
      );
    });
  });

  describe('formNewProduct', () => {
    it('should render newProduct template with categories and franchises', async () => {
      const mockCategories = [{ IDCategory: 1, NameCategory: 'Cat A' }];
      const mockFranchises = [{ IDFranchise: 2, NameFranchise: 'Fran A' }];
      mockCategoryRepo.findAll.mockResolvedValue(mockCategories);
      mockFranchiseRepo.findAll.mockResolvedValue(mockFranchises);

      await controller.formNewProduct(req as Request, res as Response, next);

      expect(res.render).toHaveBeenCalledWith(
        path.join(__dirname, '../../../views/products/newProduct.ejs'),
        { categories: mockCategories, franchises: mockFranchises }
      );
    });
  });

  describe('postNewProduct', () => {
    it('should redirect to /products on successful creation', async () => {
      // Mock validationResult to be empty
      (validationResult as unknown as jest.Mock).mockReturnValue({
        isEmpty: () => true,
      });

      req.body = {
        productName: 'New Product',
        price: '150.00',
        description: 'New Desc',
        category: '1',
        franchise: '2',
      };
      req.file = { filename: 'new_image.jpg' };

      mockCreateProductUseCase.execute.mockResolvedValue({});

      await controller.postNewProduct(req as Request & { file?: { filename: string } }, res as Response, next);

      expect(mockCreateProductUseCase.execute).toHaveBeenCalledWith({
        NameProduct: 'New Product',
        Price: 150.0,
        DescriptionProduct: 'New Desc',
        Image: 'new_image.jpg',
        IDCategory: 1,
        IDFranchise: 2,
      });
      expect(res.redirect).toHaveBeenCalledWith('/products');
    });
  });

  describe('confirmModifyProduct', () => {
    it('should redirect to /products on successful update', async () => {
      req.params = { id: '1' };
      req.body = {
        productName: 'Updated Product',
        price: '180.00',
        description: 'Updated Desc',
      };
      mockUpdateProductUseCase.execute.mockResolvedValue({});

      await controller.confirmModifyProduct(req as Request, res as Response, next);

      expect(mockUpdateProductUseCase.execute).toHaveBeenCalledWith(1, {
        NameProduct: 'Updated Product',
        Price: 180.0,
        DescriptionProduct: 'Updated Desc',
      });
      expect(res.redirect).toHaveBeenCalledWith('/products');
    });

    it('should render 404NotFound if product to modify not found', async () => {
      req.params = { id: '999' };
      req.body = { productName: 'Updated Product' };
      mockUpdateProductUseCase.execute.mockResolvedValue(null);

      await controller.confirmModifyProduct(req as Request, res as Response, next);

      expect(res.render).toHaveBeenCalledWith(
        path.join(__dirname, '../../../views/404NotFound.ejs'),
        { message: 'Product not found' }
      );
    });
  });

  describe('deleteProduct', () => {
    it('should redirect to /products on successful delete', async () => {
      req.params = { id: '1' };
      mockDeleteProductUseCase.execute.mockResolvedValue(true);

      await controller.deleteProduct(req as Request, res as Response, next);

      expect(mockDeleteProductUseCase.execute).toHaveBeenCalledWith(1);
      expect(res.redirect).toHaveBeenCalledWith('/products');
    });

    it('should send 404 if product to delete is not found', async () => {
      req.params = { id: '999' };
      mockDeleteProductUseCase.execute.mockResolvedValue(false);

      await controller.deleteProduct(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Producto no encontrado');
    });
  });
});
