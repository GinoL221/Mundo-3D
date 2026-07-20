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
        { idCategory: 1, nameCategory: 'Category A' },
        { idCategory: 2, nameCategory: 'Category B' },
      ];
      jest.mocked(db.Category.findAll).mockResolvedValue(mockInstances as unknown as CategoryInstance[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].idCategory).toBe(1);
      expect(result[0].nameCategory).toBe('Category A');
      expect(result[1].idCategory).toBe(2);
      expect(result[1].nameCategory).toBe('Category B');
      expect(db.Category.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return mapped category if found', async () => {
      const mockInstance = { idCategory: 1, nameCategory: 'Category A' };
      jest.mocked(db.Category.findByPk).mockResolvedValue(mockInstance as unknown as CategoryInstance);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.idCategory).toBe(1);
      expect(result?.nameCategory).toBe('Category A');
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
      const mockInstance = { idCategory: 1, nameCategory: 'New Category' };
      jest.mocked(db.Category.create).mockResolvedValue(mockInstance as unknown as CategoryInstance);

      const result = await repository.create({ nameCategory: 'New Category' });

      expect(result.idCategory).toBe(1);
      expect(result.nameCategory).toBe('New Category');
      expect(db.Category.create).toHaveBeenCalledWith({ nameCategory: 'New Category' });
    });
  });

  describe('update', () => {
    it('should update the category and return updated entity', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        idCategory: 1,
        nameCategory: 'Old Category',
        update: mockUpdate,
      };
      jest.mocked(db.Category.findByPk).mockResolvedValue(mockInstance as unknown as CategoryInstance);

      const result = await repository.update(1, { nameCategory: 'Updated Category' });

      expect(mockUpdate).toHaveBeenCalledWith({ nameCategory: 'Updated Category' });
      expect(result?.nameCategory).toBe('Old Category');
    });

    it('should update successfully without changing name if nameCategory is undefined', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        idCategory: 1,
        nameCategory: 'Old Category',
        update: mockUpdate,
      };
      jest.mocked(db.Category.findByPk).mockResolvedValue(mockInstance as unknown as CategoryInstance);

      const result = await repository.update(1, {});

      expect(mockUpdate).toHaveBeenCalledWith({});
      expect(result?.nameCategory).toBe('Old Category');
    });

    it('should return null if category to update is not found', async () => {
      jest.mocked(db.Category.findByPk).mockResolvedValue(null);

      const result = await repository.update(999, { nameCategory: 'Non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true if deleted successfully', async () => {
      jest.mocked(db.Category.destroy).mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(db.Category.destroy).toHaveBeenCalledWith({ where: { idCategory: 1 } });
    });

    it('should return false if not deleted', async () => {
      jest.mocked(db.Category.destroy).mockResolvedValue(0);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });

    it('should rethrow a domain error when destroy fails with ForeignKeyConstraintError', async () => {
      const { ForeignKeyConstraintError } = jest.requireActual('sequelize');
      jest.mocked(db.Category.destroy).mockRejectedValue(new ForeignKeyConstraintError({ message: 'FK violation' }));

      await expect(repository.delete(1)).rejects.toThrow('Category has associated products');
    });

    it('should propagate a non-FK error unchanged', async () => {
      jest.mocked(db.Category.destroy).mockRejectedValue(new Error('Unexpected database error'));

      await expect(repository.delete(1)).rejects.toThrow('Unexpected database error');
    });
  });
});

