import { SequelizeShoppingCartRepository } from '../SequelizeShoppingCartRepository';
import db, { ShoppingCartInstance } from '../../../database/models/db';
import { CartStatus } from '../../../domain/entities/ShoppingCart';

jest.mock('../../../database/models/db', () => ({
  ShoppingCart: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  Product: {},
}));

describe('SequelizeShoppingCartRepository', () => {
  let repository: SequelizeShoppingCartRepository;

  beforeEach(() => {
    repository = new SequelizeShoppingCartRepository();
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('should retrieve cart items for userId and map them to ShoppingCart entities with product details', async () => {
      const mockInstances = [
        {
          IDCart: 1,
          IDUser: 5,
          IDProduct: 10,
          Quantity: 3,
          UnitPrice: '15.50',
          CartStatus: 'ACTIVE',
          product: {
            idProduct: 10,
            nameProduct: 'Awesome 3D Print',
            price: '15.50',
            descriptionProduct: 'Cool print',
            image: 'image.jpg',
            idCategory: 1,
            idFranchise: 2,
          },
        },
      ];

      jest.mocked(db.ShoppingCart.findAll).mockResolvedValue(mockInstances as unknown as ShoppingCartInstance[]);

      const result = await repository.findByUserId(5);

      expect(db.ShoppingCart.findAll).toHaveBeenCalledWith({
        where: { IDUser: 5 },
        include: [{ model: db.Product, as: 'product' }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].idCart).toBe(1);
      expect(result[0].idUser).toBe(5);
      expect(result[0].idProduct).toBe(10);
      expect(result[0].quantity).toBe(3);
      expect(result[0].unitPrice).toBe(15.50);
      expect(result[0].status).toBe(CartStatus.ACTIVE);
      expect(result[0].product).toBeDefined();
      expect(result[0].product?.idProduct).toBe(10);
      expect(result[0].product?.nameProduct).toBe('Awesome 3D Print');
      expect(result[0].product?.price).toBe(15.50);

      // Legacy compatibility assertions
      expect(result[0].product?.IDProduct).toBe(10);
      expect(result[0].product?.NameProduct).toBe('Awesome 3D Print');
      expect(result[0].product?.Price).toBe(15.50);
    });

    it('should return empty list when no cart items found', async () => {
      jest.mocked(db.ShoppingCart.findAll).mockResolvedValue([]);

      const result = await repository.findByUserId(999);

      expect(result).toEqual([]);
    });
  });

  describe('getDistinctCount', () => {
    it('should return distinct count of active cart products', async () => {
      jest.mocked(db.ShoppingCart.count).mockResolvedValue(4);

      const result = await repository.getDistinctCount(5);

      expect(db.ShoppingCart.count).toHaveBeenCalledWith({
        where: {
          IDUser: 5,
          CartStatus: 'ACTIVE',
        },
        distinct: true,
        col: 'IDProduct',
      });
      expect(result).toBe(4);
    });
  });
});
