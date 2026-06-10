const FranchiseService = require('../franchiseService');

// Mock the database models
jest.mock('../../database/models/db', () => ({
  Franchise: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
}));

const { Franchise } = require('../../database/models/db');

describe('FranchiseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all franchises', async () => {
      const mockFranchises = [
        { IDFranchise: 1, NameFranchise: 'Franchise A' },
        { IDFranchise: 2, NameFranchise: 'Franchise B' },
      ];
      Franchise.findAll.mockResolvedValue(mockFranchises);

      const result = await FranchiseService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockFranchises);
      expect(Franchise.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no franchises exist', async () => {
      Franchise.findAll.mockResolvedValue([]);

      const result = await FranchiseService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('returns franchise when valid id is provided', async () => {
      const mockFranchise = { IDFranchise: 1, NameFranchise: 'Franchise A' };
      Franchise.findByPk.mockResolvedValue(mockFranchise);

      const result = await FranchiseService.findById(1);

      expect(result).toEqual(mockFranchise);
      expect(Franchise.findByPk).toHaveBeenCalledWith(1);
    });

    it('returns null when franchise not found', async () => {
      Franchise.findByPk.mockResolvedValue(null);

      const result = await FranchiseService.findById(999);

      expect(result).toBeNull();
    });
  });
});
