import { Transaction } from 'sequelize';
import { SequelizeShoppingCartRepository } from '../SequelizeShoppingCartRepository';
import db, { ShoppingCartInstance, ProductInstance } from '../../../database/models/db';
import { CartStatus } from '../../../domain/entities/ShoppingCart';
import { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';

jest.mock('../../../database/models/db', () => ({
  ShoppingCart: {
    findAll: jest.fn(),
    count: jest.fn(),
    destroy: jest.fn(),
    create: jest.fn(),
  },
  Product: {
    findAll: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
    query: jest.fn(),
  },
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
          idCart: 1,
          idUser: 5,
          idProduct: 10,
          quantity: 3,
          unitPrice: '15.50',
          cartStatus: 'ACTIVE',
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
        where: { idUser: 5 },
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

    it('should map to ShoppingCart entity without product details if product is undefined/null', async () => {
      const mockInstances = [
        {
          idCart: 2,
          idUser: 5,
          idProduct: 10,
          quantity: 3,
          unitPrice: '15.50',
          cartStatus: 'ACTIVE',
          product: null,
        },
      ];

      jest.mocked(db.ShoppingCart.findAll).mockResolvedValue(mockInstances as unknown as ShoppingCartInstance[]);

      const result = await repository.findByUserId(5);

      expect(result).toHaveLength(1);
      expect(result[0].product).toBeUndefined();
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
          idUser: 5,
          cartStatus: 'ACTIVE',
        },
        distinct: true,
        col: 'idProduct',
      });
      expect(result).toBe(4);
    });
  });

  describe('syncCart', () => {
    let mockTx: any;

    beforeEach(() => {
      mockTx = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      };
      (db.sequelize.transaction as jest.Mock).mockResolvedValue(mockTx);
    });

    it('should successfully sync cart items within a transaction', async () => {
      const userId = 5;
      const items = [
        { productId: 10, quantity: 2, unitPrice: 15 },
        { productId: 11, quantity: 1, unitPrice: 30 },
      ];

      (db.ShoppingCart.destroy as jest.Mock).mockResolvedValue(1);
      (db.ShoppingCart.create as jest.Mock).mockResolvedValue({});

      await repository.syncCart(userId, items);

      expect(db.sequelize.transaction).toHaveBeenCalled();
      expect(db.ShoppingCart.destroy).toHaveBeenCalledWith({
        where: {
          idUser: userId,
          cartStatus: 'ACTIVE',
        },
        transaction: mockTx,
      });
      expect(db.ShoppingCart.create).toHaveBeenNthCalledWith(
        1,
        {
          idUser: userId,
          idProduct: 10,
          quantity: 2,
          unitPrice: 15,
          cartStatus: 'ACTIVE',
        },
        { transaction: mockTx }
      );
      expect(db.ShoppingCart.create).toHaveBeenNthCalledWith(
        2,
        {
          idUser: userId,
          idProduct: 11,
          quantity: 1,
          unitPrice: 30,
          cartStatus: 'ACTIVE',
        },
        { transaction: mockTx }
      );
      expect(mockTx.commit).toHaveBeenCalled();
      expect(mockTx.rollback).not.toHaveBeenCalled();
    });

    it('should rollback transaction and throw error if destroy fails', async () => {
      const userId = 5;
      const items = [{ productId: 10, quantity: 2, unitPrice: 15 }];
      const testError = new Error('Database delete error');

      (db.ShoppingCart.destroy as jest.Mock).mockRejectedValue(testError);

      await expect(repository.syncCart(userId, items)).rejects.toThrow(testError);

      expect(mockTx.rollback).toHaveBeenCalled();
      expect(mockTx.commit).not.toHaveBeenCalled();
    });

    it('should rollback transaction and throw error if create fails', async () => {
      const userId = 5;
      const items = [{ productId: 10, quantity: 2, unitPrice: 15 }];
      const testError = new Error('Database insert error');

      (db.ShoppingCart.destroy as jest.Mock).mockResolvedValue(1);
      (db.ShoppingCart.create as jest.Mock).mockRejectedValue(testError);

      await expect(repository.syncCart(userId, items)).rejects.toThrow(testError);

      expect(mockTx.rollback).toHaveBeenCalled();
      expect(mockTx.commit).not.toHaveBeenCalled();
    });

    it('should write a quantity-99 item that reads back cleanly through findByUserId (split-brain regression)', async () => {
      const userId = 5;
      const items = [{ productId: 10, quantity: 99, unitPrice: 15 }];

      (db.ShoppingCart.destroy as jest.Mock).mockResolvedValue(1);
      (db.ShoppingCart.create as jest.Mock).mockResolvedValue({});

      await repository.syncCart(userId, items);

      const createdRow = (db.ShoppingCart.create as jest.Mock).mock.calls[0][0];

      const roundTrippedInstance = {
        idCart: 1,
        idUser: userId,
        idProduct: createdRow.idProduct,
        quantity: createdRow.quantity,
        unitPrice: String(createdRow.unitPrice),
        cartStatus: createdRow.cartStatus,
        product: null,
      };

      jest
        .mocked(db.ShoppingCart.findAll)
        .mockResolvedValue([roundTrippedInstance] as unknown as ShoppingCartInstance[]);

      // If toEntity() threw (e.g. a stale ceiling rejecting a valid quantity-99
      // row on read), this await would reject and fail the test.
      const result = await repository.findByUserId(userId);

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(99);
    });
  });

  // orders-checkout Work Unit 4: these replace the throwing stubs added in
  // Work Unit 2. Both must never combine `lock` with `include` — Sequelize
  // would emit `SELECT ... FOR UPDATE` across the join, locking `Product`
  // rows as an unintended side effect (design.md's explicit rejection).
  describe('findActiveForUpdate', () => {
    const mockTx = {} as unknown as TransactionContext;

    it('locks only ShoppingCart rows (no include) then reads Product names/stock in a second, non-locking query', async () => {
      const mockCartInstances = [
        { idCart: 1, idUser: 5, idProduct: 10, quantity: 2, unitPrice: '15.50', cartStatus: 'ACTIVE' },
        { idCart: 2, idUser: 5, idProduct: 20, quantity: 1, unitPrice: '30.00', cartStatus: 'ACTIVE' },
      ];
      const mockProductInstances = [
        { idProduct: 10, nameProduct: 'Figure A', price: '15.50', descriptionProduct: null, image: null, idCategory: 1, idFranchise: 1 },
        { idProduct: 20, nameProduct: 'Figure B', price: '30.00', descriptionProduct: null, image: null, idCategory: 1, idFranchise: 1 },
      ];
      jest.mocked(db.ShoppingCart.findAll).mockResolvedValueOnce(mockCartInstances as unknown as ShoppingCartInstance[]);
      jest.mocked(db.Product.findAll).mockResolvedValueOnce(mockProductInstances as unknown as ProductInstance[]);

      const result = await repository.findActiveForUpdate(5, mockTx);

      const cartCallArgs = jest.mocked(db.ShoppingCart.findAll).mock.calls[0][0];
      expect(cartCallArgs).toEqual(
        expect.objectContaining({
          where: { idUser: 5, cartStatus: 'ACTIVE' },
          transaction: mockTx,
          lock: Transaction.LOCK.UPDATE,
        })
      );
      expect(cartCallArgs).not.toHaveProperty('include');

      const productCallArgs = jest.mocked(db.Product.findAll).mock.calls[0][0];
      expect(productCallArgs).not.toHaveProperty('lock');
      expect(productCallArgs).toEqual(expect.objectContaining({ transaction: mockTx }));

      expect(result).toHaveLength(2);
      expect(result[0].product?.nameProduct).toBe('Figure A');
      expect(result[1].product?.nameProduct).toBe('Figure B');
    });

    it('returns an empty array and skips the product lookup entirely when the cart has no ACTIVE rows', async () => {
      jest.mocked(db.ShoppingCart.findAll).mockResolvedValueOnce([]);

      const result = await repository.findActiveForUpdate(5, mockTx);

      expect(result).toEqual([]);
      expect(db.Product.findAll).not.toHaveBeenCalled();
    });
  });

  describe('markOrdered', () => {
    const mockSequelizeQuery = db.sequelize.query as unknown as jest.Mock;
    const mockTx = {} as unknown as TransactionContext;

    it('issues a pure UPDATE (never DELETE/INSERT) scoped to the given cart ids, user, and ACTIVE status, returning the affected-row count', async () => {
      mockSequelizeQuery.mockResolvedValueOnce([undefined, 2]);

      const affected = await repository.markOrdered(5, [1, 2], mockTx);

      expect(db.ShoppingCart.destroy).not.toHaveBeenCalled();
      expect(db.ShoppingCart.create).not.toHaveBeenCalled();
      expect(mockSequelizeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE.*ShoppingCart.*SET.*cart_status.*ORDERED.*WHERE.*id_cart.*IN.*id_user.*cart_status.*ACTIVE/is),
        expect.objectContaining({
          replacements: expect.objectContaining({ cartIds: [1, 2], userId: 5 }),
          transaction: mockTx,
        })
      );
      expect(affected).toBe(2);
    });

    it('returns 0 without querying when given an empty cart id list', async () => {
      const affected = await repository.markOrdered(5, [], mockTx);

      expect(affected).toBe(0);
      expect(mockSequelizeQuery).not.toHaveBeenCalled();
    });
  });
});
