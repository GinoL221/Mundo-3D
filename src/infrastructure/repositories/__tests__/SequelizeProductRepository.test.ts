import { SequelizeProductRepository } from '../SequelizeProductRepository';
import db, { ProductInstance } from '../../../database/models/db';

jest.mock('../../../database/models/db', () => ({
  Product: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  Category: {},
  Franchise: {},
}));

describe('SequelizeProductRepository', () => {
  let repository: SequelizeProductRepository;

  beforeEach(() => {
    repository = new SequelizeProductRepository();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all products mapped to domain entities', async () => {
      const mockInstances = [
        {
          IDProduct: 1,
          NameProduct: 'Product A',
          Price: '100.50',
          DescriptionProduct: 'Desc A',
          Image: 'imageA.jpg',
          idCategory: 10,
          idFranchise: 20,
          Category: { idCategory: 10, nameCategory: 'Category A' },
          Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
        },
      ];
      jest.mocked(db.Product.findAll).mockResolvedValue(mockInstances as unknown as ProductInstance[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].IDProduct).toBe(1);
      expect(result[0].NameProduct).toBe('Product A');
      expect(result[0].Price).toBe(100.5);
      expect(result[0].Category?.nameCategory).toBe('Category A');
      expect(result[0].Franchise?.nameFranchise).toBe('Franchise A');
    });
  });

  describe('findById', () => {
    it('should return mapped product if found', async () => {
      const mockInstance = {
        IDProduct: 1,
        NameProduct: 'Product A',
        Price: '100.50',
        DescriptionProduct: 'Desc A',
        Image: 'imageA.jpg',
        idCategory: 10,
        idFranchise: 20,
        Category: { idCategory: 10, nameCategory: 'Category A' },
        Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
      };
      jest.mocked(db.Product.findByPk).mockResolvedValue(mockInstance as unknown as ProductInstance);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.IDProduct).toBe(1);
      expect(result?.Price).toBe(100.5);
      expect(result?.Category?.nameCategory).toBe('Category A');
    });
  });

  describe('findLatest', () => {
    it('should return the latest product by ID', async () => {
      const mockInstance = {
        IDProduct: 2,
        NameProduct: 'Product B',
        Price: '200.00',
        DescriptionProduct: 'Desc B',
        Image: 'imageB.jpg',
        idCategory: 10,
        idFranchise: 20,
        Category: { idCategory: 10, nameCategory: 'Category A' },
        Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
      };
      jest.mocked(db.Product.findOne).mockResolvedValue(mockInstance as unknown as ProductInstance);

      const result = await repository.findLatest();

      expect(result).not.toBeNull();
      expect(result?.IDProduct).toBe(2);
      expect(result?.NameProduct).toBe('Product B');
    });
  });

  describe('create', () => {
    it('should create and return the product', async () => {
      const mockCreatedInstance = {
        IDProduct: 3,
        NameProduct: 'Product C',
        Price: '300.00',
        DescriptionProduct: 'Desc C',
        Image: 'imageC.jpg',
        idCategory: 10,
        idFranchise: 20,
      };

      const mockFetchedInstance = {
        ...mockCreatedInstance,
        Category: { idCategory: 10, nameCategory: 'Category A' },
        Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
      };

      jest.mocked(db.Product.create).mockResolvedValue(mockCreatedInstance as unknown as ProductInstance);
      jest.mocked(db.Product.findByPk).mockResolvedValue(mockFetchedInstance as unknown as ProductInstance);

      const result = await repository.create({
        NameProduct: 'Product C',
        Price: 300.0,
        DescriptionProduct: 'Desc C',
        Image: 'imageC.jpg',
        idCategory: 10,
        idFranchise: 20,
      });

      expect(result.IDProduct).toBe(3);
      expect(result.Price).toBe(300.0);
      expect(result.Category?.nameCategory).toBe('Category A');
    });
  });

  describe('update', () => {
    it('should update the product and return updated entity', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        IDProduct: 1,
        NameProduct: 'Product A',
        Price: '100.50',
        update: mockUpdate,
      };

      const mockFetchedInstance = {
        IDProduct: 1,
        NameProduct: 'Product A Updated',
        Price: '120.00',
        DescriptionProduct: 'Desc A',
        Image: 'imageA.jpg',
        idCategory: 10,
        idFranchise: 20,
        Category: { idCategory: 10, nameCategory: 'Category A' },
        Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
      };

      jest.mocked(db.Product.findByPk)
        .mockResolvedValueOnce(mockInstance as unknown as ProductInstance)
        .mockResolvedValueOnce(mockFetchedInstance as unknown as ProductInstance);

      const result = await repository.update(1, { NameProduct: 'Product A Updated', Price: 120.0 });

      expect(mockUpdate).toHaveBeenCalledWith({ NameProduct: 'Product A Updated', Price: 120.0 });
      expect(result?.NameProduct).toBe('Product A Updated');
      expect(result?.Price).toBe(120.0);
    });
  });

  describe('delete', () => {
    it('should return true if deleted successfully', async () => {
      jest.mocked(db.Product.destroy).mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(db.Product.destroy).toHaveBeenCalledWith({ where: { IDProduct: 1 } });
    });
  });
});
