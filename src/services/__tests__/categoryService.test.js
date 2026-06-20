const CategoryService = require('../categoryService');

// Mock the database models
jest.mock('../../database/models/db', () => ({
  Category: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
}));

const { Category } = require('../../database/models/db');

describe('CategoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all categories', async () => {
      const mockCategories = [
        { idCategory: 1, nameCategory: 'Electronics', IDCategory: 1, NameCategory: 'Electronics' },
        { idCategory: 2, nameCategory: 'Clothing', IDCategory: 2, NameCategory: 'Clothing' },
      ];
      Category.findAll.mockResolvedValue(mockCategories);

      const result = await CategoryService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockCategories);
      expect(Category.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no categories exist', async () => {
      Category.findAll.mockResolvedValue([]);

      const result = await CategoryService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('returns category when valid id is provided', async () => {
      const mockCategory = { idCategory: 1, nameCategory: 'Electronics', IDCategory: 1, NameCategory: 'Electronics' };
      Category.findByPk.mockResolvedValue(mockCategory);

      const result = await CategoryService.findById(1);

      expect(result).toEqual(mockCategory);
      expect(Category.findByPk).toHaveBeenCalledWith(1);
    });

    it('returns null when category not found', async () => {
      Category.findByPk.mockResolvedValue(null);

      const result = await CategoryService.findById(999);

      expect(result).toBeNull();
    });
  });
});
