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
      jest.mocked(db.Franchise.findAll).mockResolvedValue(mockInstances as unknown as FranchiseInstance[]);

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
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(mockInstance as unknown as FranchiseInstance);

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
      jest.mocked(db.Franchise.create).mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.create({ nameFranchise: 'New Franchise' });

      expect(result.idFranchise).toBe(1);
      expect(result.nameFranchise).toBe('New Franchise');
      expect(db.Franchise.create).toHaveBeenCalledWith({ nameFranchise: 'New Franchise' });
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
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(mockInstance as unknown as FranchiseInstance);

      const result = await repository.update(1, { nameFranchise: 'Updated Franchise' });

      expect(mockUpdate).toHaveBeenCalledWith({ nameFranchise: 'Updated Franchise' });
      expect(result?.nameFranchise).toBe('Old Franchise');
    });

    it('should return null if franchise to update is not found', async () => {
      jest.mocked(db.Franchise.findByPk).mockResolvedValue(null);

      const result = await repository.update(999, { nameFranchise: 'Non-existent' });

      expect(result).toBeNull();
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
  });
});

