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
        { IDFranchise: 1, NameFranchise: 'Franchise A' },
        { IDFranchise: 2, NameFranchise: 'Franchise B' },
      ];
      jest.mocked(db.Franchise.findAll).mockResolvedValue(mockInstances as unknown as FranchiseInstance[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].IDFranchise).toBe(1);
      expect(result[0].NameFranchise).toBe('Franchise A');
      expect(result[1].IDFranchise).toBe(2);
      expect(result[1].NameFranchise).toBe('Franchise B');
      expect(db.Franchise.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return mapped franchise if found', async () => {
      const mockInstance = { IDFranchise: 1, NameFranchise: 'Franchise A' };
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.IDFranchise).toBe(1);
      expect(result?.NameFranchise).toBe('Franchise A');
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
      const mockInstance = { IDFranchise: 1, NameFranchise: 'New Franchise' };
      jest.mocked(db.Franchise.create).mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.create({ NameFranchise: 'New Franchise' });

      expect(result.IDFranchise).toBe(1);
      expect(result.NameFranchise).toBe('New Franchise');
      expect(db.Franchise.create).toHaveBeenCalledWith({ NameFranchise: 'New Franchise' });
    });
  });

  describe('update', () => {
    it('should update the franchise and return updated entity', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        IDFranchise: 1,
        NameFranchise: 'Old Franchise',
        update: mockUpdate,
      };
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.update(1, { NameFranchise: 'Updated Franchise' });

      expect(mockUpdate).toHaveBeenCalledWith({ NameFranchise: 'Updated Franchise' });
      expect(result?.NameFranchise).toBe('Old Franchise');
    });

    it('should return null if franchise to update is not found', async () => {
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(null);

      const result = await repository.update(999, { NameFranchise: 'Non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true if deleted successfully', async () => {
      jest.mocked(db.Franchise.destroy).mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(db.Franchise.destroy).toHaveBeenCalledWith({ where: { IDFranchise: 1 } });
    });

    it('should return false if not deleted', async () => {
      jest.mocked(db.Franchise.destroy).mockResolvedValue(0);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });
});

