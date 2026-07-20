import { SequelizeFranchiseRepository } from '../SequelizeFranchiseRepository';
import db, { FranchiseInstance } from '../../../database/models/db';

jest.mock('../../../database/models/db', () => ({
  Franchise: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

describe('SequelizeFranchiseRepository', () => {
  let repository: SequelizeFranchiseRepository;

  beforeEach(() => {
    repository = new SequelizeFranchiseRepository();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all franchises mapped to domain entities', async () => {
      const mockInstances = [
        { idFranchise: 1, nameFranchise: 'Franchise A' },
        { idFranchise: 2, nameFranchise: 'Franchise B' },
      ];
      jest
        .mocked(db.Franchise.findAll)
        .mockResolvedValue(mockInstances as unknown as FranchiseInstance[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].idFranchise).toBe(1);
      expect(result[0].nameFranchise).toBe('Franchise A');
      expect(result[1].idFranchise).toBe(2);
      expect(result[1].nameFranchise).toBe('Franchise B');
      expect(db.Franchise.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return mapped franchise if found', async () => {
      const mockInstance = { idFranchise: 1, nameFranchise: 'Franchise A' };
      jest
        .mocked(db.Franchise.findByPk)
        .mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.idFranchise).toBe(1);
      expect(result?.nameFranchise).toBe('Franchise A');
      expect(db.Franchise.findByPk).toHaveBeenCalledWith(1);
    });

    it('should return null if not found', async () => {
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
      expect(db.Franchise.findByPk).toHaveBeenCalledWith(999);
    });
  });

  describe('create', () => {
    it('should create and return the franchise', async () => {
      const mockInstance = { idFranchise: 1, nameFranchise: 'New Franchise' };
      jest
        .mocked(db.Franchise.create)
        .mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.create({ nameFranchise: 'New Franchise' });

      expect(result.idFranchise).toBe(1);
      expect(result.nameFranchise).toBe('New Franchise');
      expect(db.Franchise.create).toHaveBeenCalledWith({ nameFranchise: 'New Franchise' });
    });

    it('translates a duplicate name into the stable franchise conflict error', async () => {
      const { UniqueConstraintError } = jest.requireActual('sequelize');
      jest
        .mocked(db.Franchise.create)
        .mockRejectedValue(new UniqueConstraintError({ message: 'duplicate name', errors: [] }));

      await expect(repository.create({ nameFranchise: 'Existing Franchise' })).rejects.toThrow(
        'DUPLICATE_FRANCHISE_NAME',
      );
    });
  });

  describe('update', () => {
    it('should update the franchise and return updated entity', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        idFranchise: 1,
        nameFranchise: 'Old Franchise',
        update: mockUpdate,
      };
      jest
        .mocked(db.Franchise.findByPk)
        .mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.update(1, { nameFranchise: 'Updated Franchise' });

      expect(mockUpdate).toHaveBeenCalledWith({ nameFranchise: 'Updated Franchise' });
      expect(result?.nameFranchise).toBe('Old Franchise');
    });

    it('should update successfully without changing name if nameFranchise is undefined', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        idFranchise: 1,
        nameFranchise: 'Old Franchise',
        update: mockUpdate,
      };
      jest
        .mocked(db.Franchise.findByPk)
        .mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.update(1, {});

      expect(mockUpdate).toHaveBeenCalledWith({});
      expect(result?.nameFranchise).toBe('Old Franchise');
    });

    it('should return null if franchise to update is not found', async () => {
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(null);

      const result = await repository.update(999, { nameFranchise: 'Non-existent' });

      expect(result).toBeNull();
    });

    it('translates a duplicate update without changing the existing franchise entity', async () => {
      const { UniqueConstraintError } = jest.requireActual('sequelize');
      const mockInstance = {
        idFranchise: 1,
        nameFranchise: 'Original Franchise',
        update: jest
          .fn()
          .mockRejectedValue(new UniqueConstraintError({ message: 'duplicate name', errors: [] })),
      };
      jest
        .mocked(db.Franchise.findByPk)
        .mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      await expect(repository.update(1, { nameFranchise: 'Existing Franchise' })).rejects.toThrow(
        'DUPLICATE_FRANCHISE_NAME',
      );
      expect(mockInstance.nameFranchise).toBe('Original Franchise');
    });
  });

  describe('delete', () => {
    it('should return true if deleted successfully', async () => {
      jest.mocked(db.Franchise.destroy).mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(db.Franchise.destroy).toHaveBeenCalledWith({ where: { idFranchise: 1 } });
    });

    it('should return false if not deleted', async () => {
      jest.mocked(db.Franchise.destroy).mockResolvedValue(0);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });

    it('translates a foreign-key violation into the franchise domain error', async () => {
      const { ForeignKeyConstraintError } = jest.requireActual('sequelize');
      jest
        .mocked(db.Franchise.destroy)
        .mockRejectedValue(new ForeignKeyConstraintError({ message: 'FK violation' }));

      await expect(repository.delete(1)).rejects.toThrow('Franchise has associated products');
    });

    it('preserves non-foreign-key errors from the database', async () => {
      jest.mocked(db.Franchise.destroy).mockRejectedValue(new Error('Unexpected database error'));

      await expect(repository.delete(1)).rejects.toThrow('Unexpected database error');
    });
  });
});
