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

  describe('update', () => {
    it('updates product fields and returns updated product', async () => {
      const existingProduct = {
        IDProduct: 1,
        NameProduct: 'Old Name',
        Price: 50,
        DescriptionProduct: 'Old desc',
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(1, {
        NameProduct: 'New Name',
        Price: 75,
      });

      expect(result).toEqual(existingProduct);
      expect(existingProduct.NameProduct).toBe('New Name');
      expect(existingProduct.Price).toBe(75);
      expect(existingProduct.save).toHaveBeenCalled();
    });

    it('returns null when product not found', async () => {
      Product.findByPk.mockResolvedValue(null);

      const result = await ProductService.update(999, { NameProduct: 'Test' });

      expect(result).toBeNull();
      expect(Product.findByPk).toHaveBeenCalledWith(999);
    });

    it('preserves unchanged fields when partial update', async () => {
      const existingProduct = {
        IDProduct: 2,
        NameProduct: 'Keep Name',
        Price: 30,
        DescriptionProduct: 'Keep desc',
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(2, { Price: 45 });

      expect(result).toBe(existingProduct);
      expect(existingProduct.NameProduct).toBe('Keep Name');
      expect(existingProduct.Price).toBe(45);
      expect(existingProduct.DescriptionProduct).toBe('Keep desc');
    });

    it('updates optional fields Image, IDCategory, IDFranchise and returns updated product', async () => {
      const existingProduct = {
        IDProduct: 1,
        NameProduct: 'Old Name',
        Price: 50,
        DescriptionProduct: 'Old desc',
        Image: 'old.jpg',
        IDCategory: 2,
        IDFranchise: 3,
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(1, {
        Image: 'new.jpg',
        IDCategory: 4,
        IDFranchise: 5,
      });

      expect(result).toEqual(existingProduct);
      expect(existingProduct.Image).toBe('new.jpg');
      expect(existingProduct.IDCategory).toBe(4);
      expect(existingProduct.IDFranchise).toBe(5);
      expect(existingProduct.save).toHaveBeenCalled();
    });

    it('preserves optional fields Image, IDCategory, IDFranchise when not provided in data', async () => {
      const existingProduct = {
        IDProduct: 1,
        NameProduct: 'Old Name',
        Price: 50,
        DescriptionProduct: 'Old desc',
        Image: 'old.jpg',
        IDCategory: 2,
        IDFranchise: 3,
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(1, {
        NameProduct: 'New Name',
      });

      expect(result).toEqual(existingProduct);
      expect(existingProduct.NameProduct).toBe('New Name');
      expect(existingProduct.Image).toBe('old.jpg');
      expect(existingProduct.IDCategory).toBe(2);
      expect(existingProduct.IDFranchise).toBe(3);
      expect(existingProduct.save).toHaveBeenCalled();
    });
  });

  describe('findLatest', () => {
    it('returns the most recent product with category', async () => {
      const latestProduct = {
        IDProduct: 5,
        NameProduct: 'Latest',
        Category: { IDCategory: 1, NameCategory: 'Figures' },
      };
      Product.findOne.mockResolvedValue(latestProduct);

      const result = await ProductService.findLatest();

      expect(result).toEqual(latestProduct);
      expect(Product.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['IDProduct', 'DESC']],
          include: expect.arrayContaining([
            expect.objectContaining({
              model: expect.anything(),
              as: 'Category',
            }),
          ]),
        }),
      );
    });

    it('returns null when no products exist', async () => {
      Product.findOne.mockResolvedValue(null);

      const result = await ProductService.findLatest();

      expect(result).toBeNull();
    });
  });

  describe('transformWithCategoryCount', () => {
    it('returns correct structure with empty array', () => {
      const result = ProductService.transformWithCategoryCount([]);

      expect(result).toEqual({
        count: 0,
        countByCategory: {},
        products: [],
      });
    });

    it('transforms products and counts by category', () => {
      const products = [
        {
          IDProduct: 1,
          NameProduct: 'Product A',
          Price: 50,
          DescriptionProduct: 'Desc A',
          Image: 'a.jpg',
          Category: { IDCategory: 1, IDType: 10, NameCategory: 'Figures' },
        },
        {
          IDProduct: 2,
          NameProduct: 'Product B',
          Price: 30,
          DescriptionProduct: 'Desc B',
          Image: 'b.jpg',
          Category: { IDCategory: 1, IDType: 10, NameCategory: 'Figures' },
        },
        {
          IDProduct: 3,
          NameProduct: 'Product C',
          Price: 20,
          DescriptionProduct: 'Desc C',
          Image: 'c.jpg',
          Category: { IDCategory: 2, IDType: 20, NameCategory: 'Decorations' },
        },
      ];

      const result = ProductService.transformWithCategoryCount(products);

      expect(result.count).toBe(3);
      expect(result.countByCategory['Figures'].count).toBe(2);
      expect(result.countByCategory['Figures'].category).toEqual({
        IDCategory: 1,
        IDType: 10,
      });
      expect(result.countByCategory['Decorations'].count).toBe(1);
      expect(result.countByCategory['Decorations'].category).toEqual({
        IDCategory: 2,
        IDType: 20,
      });
      expect(result.products).toHaveLength(3);
      expect(result.products[0]).toEqual({
        IDProduct: 1,
        NameProduct: 'Product A',
        Price: 50,
        DescriptionProduct: 'Desc A',
        Image: 'a.jpg',
        Category: 'Figures',
      });
    });

    it('handles products without category', () => {
      const products = [
        {
          IDProduct: 1,
          NameProduct: 'No Cat Product',
          Price: 15,
          DescriptionProduct: 'No category',
          Image: 'x.jpg',
          Category: null,
        },
      ];

      const result = ProductService.transformWithCategoryCount(products);

      expect(result.count).toBe(1);
      expect(result.countByCategory['Sin categoría'].count).toBe(1);
      expect(result.countByCategory['Sin categoría'].category).toBeNull();
      expect(result.products[0].Category).toBe('Sin categoría');
    });
  });
});
