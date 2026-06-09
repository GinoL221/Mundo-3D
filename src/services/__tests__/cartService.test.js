const CartService = require('../cartService');

// Mock the database models
jest.mock('../../database/models/db', () => ({
  ShoppingCart: {
    findAll: jest.fn(),
  },
  Product: {},
}));

const { ShoppingCart } = require('../../database/models/db');

describe('CartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('returns cart items with products for a valid user', async () => {
      const mockCartItems = [
        { IDCart: 1, IDUser: 1, Quantity: 2, product: { IDProduct: 10, Price: 50 } },
        { IDCart: 2, IDUser: 1, Quantity: 1, product: { IDProduct: 11, Price: 30 } },
      ];
      ShoppingCart.findAll.mockResolvedValue(mockCartItems);

      const result = await CartService.findByUserId(1);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockCartItems);
      expect(ShoppingCart.findAll).toHaveBeenCalledWith({
        where: { IDUser: 1 },
        include: [{ model: expect.anything(), as: 'product' }],
      });
    });

    it('returns empty array for non-existent user', async () => {
      ShoppingCart.findAll.mockResolvedValue([]);

      const result = await CartService.findByUserId(999);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('returns all cart items', async () => {
      const mockAllItems = [
        { IDCart: 1, IDUser: 1, Quantity: 2 },
        { IDCart: 2, IDUser: 2, Quantity: 1 },
      ];
      ShoppingCart.findAll.mockResolvedValue(mockAllItems);

      const result = await CartService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockAllItems);
      expect(ShoppingCart.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no cart items exist', async () => {
      ShoppingCart.findAll.mockResolvedValue([]);

      const result = await CartService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});
