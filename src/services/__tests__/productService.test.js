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
        { idProduct: 1, nameProduct: 'Product A' },
        { idProduct: 2, nameProduct: 'Product B' },
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
      const mockProduct = { idProduct: 1, nameProduct: 'Product A' };
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
        nameProduct: 'New Product',
        price: 99.99,
        descriptionProduct: 'A test product',
        image: 'test.jpg',
        idCategory: 1,
        idFranchise: 1,
      };
      const createdProduct = { idProduct: 3, ...inputData };
      Product.create.mockResolvedValue(createdProduct);

      const result = await ProductService.create(inputData);

      expect(result).toEqual(createdProduct);
      expect(Product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nameProduct: 'New Product',
          price: 99.99,
        }),
      );
    });
  });

  describe('remove', () => {
    it('returns true when product is deleted', async () => {
      const mockProduct = {
        idProduct: 1,
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
        idProduct: 1,
        nameProduct: 'Old Name',
        price: 50,
        descriptionProduct: 'Old desc',
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(1, {
        nameProduct: 'New Name',
        price: 75,
      });

      expect(result).toEqual(existingProduct);
      expect(existingProduct.nameProduct).toBe('New Name');
      expect(existingProduct.price).toBe(75);
      expect(existingProduct.save).toHaveBeenCalled();
    });

    it('returns null when product not found', async () => {
      Product.findByPk.mockResolvedValue(null);

      const result = await ProductService.update(999, { nameProduct: 'Test' });

      expect(result).toBeNull();
      expect(Product.findByPk).toHaveBeenCalledWith(999);
    });

    it('preserves unchanged fields when partial update', async () => {
      const existingProduct = {
        idProduct: 2,
        nameProduct: 'Keep Name',
        price: 30,
        descriptionProduct: 'Keep desc',
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(2, { price: 45 });

      expect(result).toBe(existingProduct);
      expect(existingProduct.nameProduct).toBe('Keep Name');
      expect(existingProduct.price).toBe(45);
      expect(existingProduct.descriptionProduct).toBe('Keep desc');
    });

    it('updates optional fields Image, IDCategory, IDFranchise and returns updated product', async () => {
      const existingProduct = {
        idProduct: 1,
        nameProduct: 'Old Name',
        price: 50,
        descriptionProduct: 'Old desc',
        image: 'old.jpg',
        idCategory: 2,
        idFranchise: 3,
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(1, {
        image: 'new.jpg',
        idCategory: 4,
        idFranchise: 5,
      });

      expect(result).toEqual(existingProduct);
      expect(existingProduct.image).toBe('new.jpg');
      expect(existingProduct.idCategory).toBe(4);
      expect(existingProduct.idFranchise).toBe(5);
      expect(existingProduct.save).toHaveBeenCalled();
    });

    it('preserves optional fields Image, IDCategory, IDFranchise when not provided in data', async () => {
      const existingProduct = {
        idProduct: 1,
        nameProduct: 'Old Name',
        price: 50,
        descriptionProduct: 'Old desc',
        image: 'old.jpg',
        idCategory: 2,
        idFranchise: 3,
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findByPk.mockResolvedValue(existingProduct);

      const result = await ProductService.update(1, {
        nameProduct: 'New Name',
      });

      expect(result).toEqual(existingProduct);
      expect(existingProduct.nameProduct).toBe('New Name');
      expect(existingProduct.image).toBe('old.jpg');
      expect(existingProduct.idCategory).toBe(2);
      expect(existingProduct.idFranchise).toBe(3);
      expect(existingProduct.save).toHaveBeenCalled();
    });
  });

  describe('findLatest', () => {
    it('returns the most recent product with category', async () => {
      const latestProduct = {
        idProduct: 5,
        nameProduct: 'Latest',
        Category: { idCategory: 1, nameCategory: 'Figures' },
      };
      Product.findOne.mockResolvedValue(latestProduct);

      const result = await ProductService.findLatest();

      expect(result).toEqual(latestProduct);
      expect(Product.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['idProduct', 'DESC']],
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
          idProduct: 1,
          nameProduct: 'Product A',
          price: 50,
          descriptionProduct: 'Desc A',
          image: 'a.jpg',
          Category: { idCategory: 1, nameCategory: 'Figures' },
        },
        {
          idProduct: 2,
          nameProduct: 'Product B',
          price: 30,
          descriptionProduct: 'Desc B',
          image: 'b.jpg',
          Category: { idCategory: 1, nameCategory: 'Figures' },
        },
        {
          idProduct: 3,
          nameProduct: 'Product C',
          price: 20,
          descriptionProduct: 'Desc C',
          image: 'c.jpg',
          Category: { idCategory: 2, nameCategory: 'Decorations' },
        },
      ];

      const result = ProductService.transformWithCategoryCount(products);

      expect(result.count).toBe(3);
      expect(result.countByCategory['Figures'].count).toBe(2);
      expect(result.countByCategory['Figures'].category).toEqual({
        idCategory: 1,
      });
      expect(result.countByCategory['Decorations'].count).toBe(1);
      expect(result.countByCategory['Decorations'].category).toEqual({
        idCategory: 2,
      });
      expect(result.products).toHaveLength(3);
      expect(result.products[0]).toEqual({
        idProduct: 1,
        nameProduct: 'Product A',
        price: 50,
        descriptionProduct: 'Desc A',
        image: 'a.jpg',
        Category: 'Figures',
      });
    });

    it('handles products without category', () => {
      const products = [
        {
          idProduct: 1,
          nameProduct: 'No Cat Product',
          price: 15,
          descriptionProduct: 'No category',
          image: 'x.jpg',
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
