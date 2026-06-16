import { SequelizeCategoryRepository } from '../SequelizeCategoryRepository';
import db, { CategoryInstance } from '../../../database/models/db';

jest.mock('../../../database/models/db', () => ({
  Category: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

describe('SequelizeCategoryRepository', () => {
  let repository: SequelizeCategoryRepository;

  beforeEach(() => {
    repository = new SequelizeCategoryRepository();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all categories mapped to domain entities', async () => {
      const mockInstances = [
        { IDCategory: 1, NameCategory: 'Category A' },
        { IDCategory: 2, NameCategory: 'Category B' },
      ];
      jest.mocked(db.Category.findAll).mockResolvedValue(mockInstances as unknown as CategoryInstance[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].IDCategory).toBe(1);
      expect(result[0].NameCategory).toBe('Category A');
      expect(result[1].IDCategory).toBe(2);
      expect(result[1].NameCategory).toBe('Category B');
      expect(db.Category.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return mapped category if found', async () => {
      const mockInstance = { IDCategory: 1, NameCategory: 'Category A' };
      jest.mocked(db.Category.findByPk).mockResolvedValue(mockInstance as unknown as CategoryInstance);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.IDCategory).toBe(1);
      expect(result?.NameCategory).toBe('Category A');
      expect(db.Category.findByPk).toHaveBeenCalledWith(1);
    });

    it('should return null if not found', async () => {
      jest.mocked(db.Category.findByPk).mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
      expect(db.Category.findByPk).toHaveBeenCalledWith(999);
    });
  });

  describe('create', () => {
    it('should create and return the category', async () => {
      const mockInstance = { IDCategory: 1, NameCategory: 'New Category' };
      jest.mocked(db.Category.create).mockResolvedValue(mockInstance as unknown as CategoryInstance);

      const result = await repository.create({ NameCategory: 'New Category' });

      expect(result.IDCategory).toBe(1);
      expect(result.NameCategory).toBe('New Category');
      expect(db.Category.create).toHaveBeenCalledWith({ NameCategory: 'New Category' });
    });
  });

  describe('update', () => {
    it('should update the category and return updated entity', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        IDCategory: 1,
        NameCategory: 'Old Category',
        update: mockUpdate,
      };
      jest.mocked(db.Category.findByPk).mockResolvedValue(mockInstance as unknown as CategoryInstance);

      const result = await repository.update(1, { NameCategory: 'Updated Category' });

      expect(mockUpdate).toHaveBeenCalledWith({ NameCategory: 'Updated Category' });
      expect(result?.NameCategory).toBe('Old Category');
    });

    it('should return null if category to update is not found', async () => {
      jest.mocked(db.Category.findByPk).mockResolvedValue(null);

      const result = await repository.update(999, { NameCategory: 'Non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true if deleted successfully', async () => {
      jest.mocked(db.Category.destroy).mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(db.Category.destroy).toHaveBeenCalledWith({ where: { IDCategory: 1 } });
    });

    it('should return false if not deleted', async () => {
      jest.mocked(db.Category.destroy).mockResolvedValue(0);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });
});

