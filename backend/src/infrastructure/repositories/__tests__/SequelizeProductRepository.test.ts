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
          idProduct: 1,
          nameProduct: 'Product A',
          price: '100.50',
          descriptionProduct: 'Desc A',
          image: 'imageA.jpg',
          idCategory: 10,
          idFranchise: 20,
          Category: { idCategory: 10, nameCategory: 'Category A' },
          Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
        },
      ];
      jest.mocked(db.Product.findAll).mockResolvedValue(mockInstances as unknown as ProductInstance[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].idProduct).toBe(1);
      expect(result[0].nameProduct).toBe('Product A');
      expect(result[0].price).toBe(100.5);
      expect(result[0].Category?.nameCategory).toBe('Category A');
      expect(result[0].Franchise?.nameFranchise).toBe('Franchise A');

      // Legacy compatibility assertions
      expect(result[0].IDProduct).toBe(1);
      expect(result[0].NameProduct).toBe('Product A');
      expect(result[0].Price).toBe(100.5);
      expect(result[0].IDCategory).toBe(10);
      expect(result[0].IDFranchise).toBe(20);
    });
  });

  describe('findById', () => {
    it('should return mapped product if found', async () => {
      const mockInstance = {
        idProduct: 1,
        nameProduct: 'Product A',
        price: '100.50',
        descriptionProduct: 'Desc A',
        image: 'imageA.jpg',
        idCategory: 10,
        idFranchise: 20,
        Category: { idCategory: 10, nameCategory: 'Category A' },
        Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
      };
      jest.mocked(db.Product.findByPk).mockResolvedValue(mockInstance as unknown as ProductInstance);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.idProduct).toBe(1);
      expect(result?.price).toBe(100.5);
      expect(result?.Category?.nameCategory).toBe('Category A');

      // Legacy compatibility assertions
      expect(result?.IDProduct).toBe(1);
      expect(result?.Price).toBe(100.5);
    });

    it('should return null if product is not found', async () => {
      jest.mocked(db.Product.findByPk).mockResolvedValue(null);
      const result = await repository.findById(999);
      expect(result).toBeNull();
    });

    it('should map correctly when Category and Franchise details are missing', async () => {
      const mockInstance = {
        idProduct: 1,
        nameProduct: 'Product A',
        price: '100.50',
        descriptionProduct: 'Desc A',
        image: 'imageA.jpg',
        idCategory: 10,
        idFranchise: 20,
        Category: null,
        Franchise: null,
      };
      jest.mocked(db.Product.findByPk).mockResolvedValue(mockInstance as unknown as ProductInstance);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result?.Category).toBeUndefined();
      expect(result?.Franchise).toBeUndefined();
    });
  });

  describe('findLatest', () => {
    it('should return the latest product by ID', async () => {
      const mockInstance = {
        idProduct: 2,
        nameProduct: 'Product B',
        price: '200.00',
        descriptionProduct: 'Desc B',
        image: 'imageB.jpg',
        idCategory: 10,
        idFranchise: 20,
        Category: { idCategory: 10, nameCategory: 'Category A' },
        Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
      };
      jest.mocked(db.Product.findOne).mockResolvedValue(mockInstance as unknown as ProductInstance);

      const result = await repository.findLatest();

      expect(result).not.toBeNull();
      expect(result?.idProduct).toBe(2);
      expect(result?.nameProduct).toBe('Product B');

      // Legacy compatibility assertions
      expect(result?.IDProduct).toBe(2);
      expect(result?.NameProduct).toBe('Product B');
    });

    it('should return null if there are no products', async () => {
      jest.mocked(db.Product.findOne).mockResolvedValue(null);
      const result = await repository.findLatest();
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and return the product', async () => {
      const mockCreatedInstance = {
        idProduct: 3,
        nameProduct: 'Product C',
        price: '300.00',
        descriptionProduct: 'Desc C',
        image: 'imageC.jpg',
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
        nameProduct: 'Product C',
        price: 300.0,
        descriptionProduct: 'Desc C',
        image: 'imageC.jpg',
        idCategory: 10,
        idFranchise: 20,
      });

      expect(result.idProduct).toBe(3);
      expect(result.price).toBe(300.0);
      expect(result.Category?.nameCategory).toBe('Category A');

      // Legacy compatibility assertions
      expect(result.IDProduct).toBe(3);
      expect(result.Price).toBe(300.0);
    });

    it('should fallback to creation instance mapping if findById returns null in create', async () => {
      const mockCreatedInstance = {
        idProduct: 3,
        nameProduct: 'Product C',
        price: '300.00',
        descriptionProduct: 'Desc C',
        image: 'imageC.jpg',
        idCategory: 10,
        idFranchise: 20,
      };

      jest.mocked(db.Product.create).mockResolvedValue(mockCreatedInstance as unknown as ProductInstance);
      jest.mocked(db.Product.findByPk).mockResolvedValue(null);

      const result = await repository.create({
        nameProduct: 'Product C',
        price: 300.0,
        descriptionProduct: 'Desc C',
        image: 'imageC.jpg',
        idCategory: 10,
        idFranchise: 20,
      });

      expect(result.idProduct).toBe(3);
      expect(result.price).toBe(300.0);
      expect(result.Category).toBeUndefined();
      expect(result.Franchise).toBeUndefined();
    });

    it('should create and return the product with 3D printing attributes', async () => {
      const mockCreatedInstance = {
        idProduct: 4,
        nameProduct: '3D Product',
        price: '150.00',
        descriptionProduct: '3D print',
        image: '3d.jpg',
        idCategory: 1,
        idFranchise: 2,
        material: 'PLA',
        height: 10.5,
        width: 8.0,
        depth: 5.5,
        finish: 'Pintado',
        productionTime: 4,
      };

      const mockFetchedInstance = {
        ...mockCreatedInstance,
        Category: { idCategory: 1, nameCategory: 'Accesorios' },
        Franchise: { idFranchise: 2, nameFranchise: 'Zelda' },
      };

      jest.mocked(db.Product.create).mockResolvedValue(mockCreatedInstance as unknown as ProductInstance);
      jest.mocked(db.Product.findByPk).mockResolvedValue(mockFetchedInstance as unknown as ProductInstance);

      const result = await repository.create({
        nameProduct: '3D Product',
        price: 150.0,
        descriptionProduct: '3D print',
        image: '3d.jpg',
        idCategory: 1,
        idFranchise: 2,
        material: 'PLA',
        height: 10.5,
        width: 8.0,
        depth: 5.5,
        finish: 'Pintado',
        productionTime: 4,
      });

      expect(result.idProduct).toBe(4);
      expect(result.price).toBe(150.0);
      expect(result.Material).toBe('PLA');
      expect(result.Height).toBe(10.5);
      expect(result.Width).toBe(8.0);
      expect(result.Depth).toBe(5.5);
      expect(result.Finish).toBe('Pintado');
      expect(result.ProductionTime).toBe(4);
      expect(jest.mocked(db.Product.create)).toHaveBeenCalledWith(expect.objectContaining({
        material: 'PLA',
        height: 10.5,
        width: 8.0,
        depth: 5.5,
        finish: 'Pintado',
        productionTime: 4,
      }));
    });
  });

  describe('update', () => {
    it('should update the product and return updated entity', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        idProduct: 1,
        nameProduct: 'Product A',
        price: '100.50',
        update: mockUpdate,
      };

      const mockFetchedInstance = {
        idProduct: 1,
        nameProduct: 'Product A Updated',
        price: '120.00',
        descriptionProduct: 'Desc A',
        image: 'imageA.jpg',
        idCategory: 10,
        idFranchise: 20,
        Category: { idCategory: 10, nameCategory: 'Category A' },
        Franchise: { idFranchise: 20, nameFranchise: 'Franchise A' },
      };

      jest.mocked(db.Product.findByPk)
        .mockResolvedValueOnce(mockInstance as unknown as ProductInstance)
        .mockResolvedValueOnce(mockFetchedInstance as unknown as ProductInstance);

      const result = await repository.update(1, { nameProduct: 'Product A Updated', price: 120.0 });

      expect(mockUpdate).toHaveBeenCalledWith({ nameProduct: 'Product A Updated', price: 120.0 });
      expect(result?.nameProduct).toBe('Product A Updated');
      expect(result?.price).toBe(120.0);

      // Legacy compatibility assertions
      expect(result?.NameProduct).toBe('Product A Updated');
      expect(result?.Price).toBe(120.0);
    });

    it('should update other fields like description, image, idCategory, idFranchise', async () => {
      const mockUpdate = jest.fn();
      const mockInstance = {
        idProduct: 1,
        update: mockUpdate,
      };

      const mockFetchedInstance = {
        idProduct: 1,
        nameProduct: 'Product A',
        price: '100.50',
        descriptionProduct: 'New Desc',
        image: 'new.jpg',
        idCategory: 11,
        idFranchise: 21,
      };

      jest.mocked(db.Product.findByPk)
        .mockResolvedValueOnce(mockInstance as unknown as ProductInstance)
        .mockResolvedValueOnce(mockFetchedInstance as unknown as ProductInstance);

      const result = await repository.update(1, {
        descriptionProduct: 'New Desc',
        image: 'new.jpg',
        idCategory: 11,
        idFranchise: 21,
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        descriptionProduct: 'New Desc',
        image: 'new.jpg',
        idCategory: 11,
        idFranchise: 21,
      });
      expect(result?.descriptionProduct).toBe('New Desc');
      expect(result?.image).toBe('new.jpg');
    });

    it('should return null if product to update is not found', async () => {
      jest.mocked(db.Product.findByPk).mockResolvedValue(null);
      const result = await repository.update(999, { nameProduct: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true if deleted successfully', async () => {
      jest.mocked(db.Product.destroy).mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(db.Product.destroy).toHaveBeenCalledWith({ where: { idProduct: 1 } });
    });
    it('should return false if product is not found to delete', async () => {
      jest.mocked(db.Product.destroy).mockResolvedValue(0);
      const result = await repository.delete(999);
      expect(result).toBe(false);
    });
  });
});
