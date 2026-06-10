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

  describe('computeTotal', () => {
    it('returns 0 for empty cart', () => {
      const result = CartService.computeTotal([]);

      expect(result).toBe(0);
    });

    it('returns correct total for single item', () => {
      const items = [{ product: { Price: 50 }, Quantity: 2 }];

      const result = CartService.computeTotal(items);

      expect(result).toBe(100);
    });

    it('returns correct total for multiple items', () => {
      const items = [
        { product: { Price: 50 }, Quantity: 2 },
        { product: { Price: 30 }, Quantity: 1 },
        { product: { Price: 20 }, Quantity: 3 },
      ];

      const result = CartService.computeTotal(items);

      expect(result).toBe(190); // 100 + 30 + 60
    });

    it('handles items with Price at root level (fallback)', () => {
      const items = [{ Price: 40, Quantity: 3 }];

      const result = CartService.computeTotal(items);

      expect(result).toBe(120);
    });
  });
});
