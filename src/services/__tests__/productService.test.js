const ProductService = require('../productService');

// Mock the database models
jest.mock('../../database/models/db', () => ({
  Product: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  },
  Category: {},
  Franchise: {},
}));

const { Product } = require('../../database/models/db');

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns an array of products', async () => {
      const mockProducts = [
        { IDProduct: 1, NameProduct: 'Product A' },
        { IDProduct: 2, NameProduct: 'Product B' },
      ];
      Product.findAll.mockResolvedValue(mockProducts);

      const result = await ProductService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockProducts);
      expect(Product.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no products exist', async () => {
      Product.findAll.mockResolvedValue([]);

      const result = await ProductService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('returns product when valid id is provided', async () => {
      const mockProduct = { IDProduct: 1, NameProduct: 'Product A' };
      Product.findByPk.mockResolvedValue(mockProduct);

      const result = await ProductService.findById(1);

      expect(result).toEqual(mockProduct);
      expect(Product.findByPk).toHaveBeenCalledWith(1);
    });

    it('returns null when product not found', async () => {
      Product.findByPk.mockResolvedValue(null);

      const result = await ProductService.findById(999);

      expect(result).toBeNull();
    });

    it('returns null for invalid id', async () => {
      Product.findByPk.mockResolvedValue(null);

      const result = await ProductService.findById('invalid');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a new product', async () => {
      const inputData = {
        NameProduct: 'New Product',
        Price: 99.99,
        DescriptionProduct: 'A test product',
        Image: 'test.jpg',
        IDCategory: 1,
        IDFranchise: 1,
      };
      const createdProduct = { IDProduct: 3, ...inputData };
      Product.create.mockResolvedValue(createdProduct);

      const result = await ProductService.create(inputData);

      expect(result).toEqual(createdProduct);
      expect(Product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          NameProduct: 'New Product',
          Price: 99.99,
        }),
      );
    });
  });

  describe('remove', () => {
    it('returns true when product is deleted', async () => {
      const mockProduct = {
        IDProduct: 1,
        destroy: jest.fn().mockResolvedValue(true),
      };
      Product.findByPk.mockResolvedValue(mockProduct);

      const result = await ProductService.remove(1);

      expect(result).toBe(true);
      expect(mockProduct.destroy).toHaveBeenCalled();
    });

    it('returns false when product not found', async () => {
      Product.findByPk.mockResolvedValue(null);

      const result = await ProductService.remove(999);

      expect(result).toBe(false);
    });
  });
});
