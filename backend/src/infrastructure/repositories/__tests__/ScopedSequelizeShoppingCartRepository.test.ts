import { QueryTypes, Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { withScopedTransaction } from '../../persistence/scopedTransactionContext';
import {
  ScopedSequelizeShoppingCartRepository,
  type ShoppingCartPersistence,
} from '../ScopedSequelizeShoppingCartRepository';

describe('ScopedSequelizeShoppingCartRepository', () => {
  function createPersistence() {
    const transaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transaction;
    const startTransaction = jest.fn().mockResolvedValue(transaction);
    const query = jest.fn();
    const connection = { transaction: startTransaction, query } as unknown as Sequelize;
    const cartFindAll = jest.fn().mockResolvedValue([]);
    const cartCount = jest.fn().mockResolvedValue(0);
    const cartDestroy = jest.fn().mockResolvedValue(0);
    const cartCreate = jest.fn().mockResolvedValue({});
    const productFindAll = jest.fn().mockResolvedValue([]);
    const cartModel = {
      findAll: cartFindAll,
      count: cartCount,
      destroy: cartDestroy,
      create: cartCreate,
    };
    const productModel = { findAll: productFindAll };
    const persistence = {
      ShoppingCart: cartModel,
      Product: productModel,
      sequelize: connection,
    } as unknown as ShoppingCartPersistence;
    return {
      transaction,
      startTransaction,
      query,
      connection,
      cartFindAll,
      cartDestroy,
      cartCreate,
      productFindAll,
      cartModel,
      productModel,
      persistence,
    };
  }

  it('reads and maps cart rows through only the injected model graph', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeShoppingCartRepository(models.persistence);
    models.cartFindAll.mockResolvedValue([
      {
        idCart: 7,
        idUser: 12,
        idProduct: 31,
        quantity: 2,
        unitPrice: '15.50',
        cartStatus: 'ACTIVE',
        product: {
          idProduct: 31,
          nameProduct: 'Figure',
          price: '15.50',
          descriptionProduct: 'Printed figure',
          image: 'figure.png',
          idCategory: 4,
          idFranchise: 6,
        },
      },
    ] as never);

    const result = await repository.findByUserId(12);

    expect(models.cartFindAll).toHaveBeenCalledWith({
      where: { idUser: 12 },
      include: [{ model: models.productModel, as: 'product' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].idCart).toBe(7);
    expect(result[0].unitPrice).toBe(15.5);
    expect(result[0].product?.nameProduct).toBe('Figure');
  });

  it('syncs cart rows using the injected connection transaction and commits', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeShoppingCartRepository(models.persistence);

    await repository.syncCart(12, [{ productId: 31, quantity: 2, unitPrice: 15.5 }]);

    expect(models.startTransaction).toHaveBeenCalledTimes(1);
    expect(models.cartDestroy).toHaveBeenCalledWith({
      where: { idUser: 12, cartStatus: 'ACTIVE' },
      transaction: models.transaction,
    });
    expect(models.cartCreate).toHaveBeenCalledWith(
      {
        idUser: 12,
        idProduct: 31,
        quantity: 2,
        unitPrice: 15.5,
        cartStatus: 'ACTIVE',
      },
      { transaction: models.transaction },
    );
    expect(models.transaction.commit).toHaveBeenCalledTimes(1);
    expect(models.transaction.rollback).not.toHaveBeenCalled();
  });

  it('uses a live same-connection context for checkout reads and updates', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeShoppingCartRepository(models.persistence);
    const rawTransaction = {} as Transaction;
    models.cartFindAll.mockResolvedValueOnce([
      {
        idCart: 7,
        idUser: 12,
        idProduct: 31,
        quantity: 2,
        unitPrice: '15.50',
        cartStatus: 'ACTIVE',
      },
    ] as never);
    models.productFindAll.mockResolvedValueOnce([
      {
        idProduct: 31,
        nameProduct: 'Figure',
        price: '15.50',
        descriptionProduct: 'Printed figure',
        image: 'figure.png',
        idCategory: 4,
        idFranchise: 6,
      },
    ] as never);
    models.query.mockResolvedValueOnce([undefined, 1]);

    await withScopedTransaction(models.connection, rawTransaction, async (context) => {
      const cart = await repository.findActiveForUpdate(12, context);
      const affected = await repository.markOrdered(12, [7], context);

      expect(cart[0].product?.nameProduct).toBe('Figure');
      expect(affected).toBe(1);
    });

    expect(models.cartFindAll).toHaveBeenCalledWith({
      where: { idUser: 12, cartStatus: 'ACTIVE' },
      transaction: rawTransaction,
      lock: Transaction.LOCK.UPDATE,
    });
    expect(models.cartFindAll.mock.calls[0][0]).not.toHaveProperty('include');
    expect(models.productFindAll).toHaveBeenCalledWith({
      where: { idProduct: [31] },
      transaction: rawTransaction,
    });
    expect(models.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE.*ShoppingCart.*SET.*cart_status.*ORDERED/is),
      expect.objectContaining({
        replacements: { cartIds: [7], userId: 12 },
        type: QueryTypes.UPDATE,
        transaction: rawTransaction,
      }),
    );
  });

  it('rejects unknown, expired, and foreign transaction contexts before persistence calls', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeShoppingCartRepository(models.persistence);
    await expect(repository.findActiveForUpdate(12, {} as TransactionContext)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );

    const expiredContext = await withScopedTransaction(
      models.connection,
      {} as Transaction,
      async (context) => context,
    );
    await expect(repository.findActiveForUpdate(12, expiredContext)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );

    const foreignConnection = { transaction: jest.fn() } as unknown as Sequelize;
    await withScopedTransaction(foreignConnection, {} as Transaction, async (context) => {
      await expect(repository.markOrdered(12, [7], context)).rejects.toThrow(
        'Transaction context is not active for this connection',
      );
    });

    expect(models.cartFindAll).not.toHaveBeenCalled();
    expect(models.productFindAll).not.toHaveBeenCalled();
    expect(models.query).not.toHaveBeenCalled();
  });
});
