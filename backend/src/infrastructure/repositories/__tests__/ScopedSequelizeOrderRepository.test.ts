import { OrderStatus } from '../../../domain/entities/Order';
import { DuplicateIdempotencyKeyException } from '../../../domain/exceptions/DuplicateIdempotencyKeyException';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { QueryTypes, Transaction, UniqueConstraintError } from 'sequelize';
import type { Sequelize } from 'sequelize';
import { withScopedTransaction } from '../../persistence/scopedTransactionContext';
import {
  ScopedSequelizeOrderRepository,
  type OrderPersistence,
} from '../ScopedSequelizeOrderRepository';

function createOrderInstance(overrides: Record<string, unknown> = {}) {
  return {
    idOrder: 1,
    idUser: 5,
    idempotencyKey: 'key-1',
    orderStatus: OrderStatus.AWAITING_PAYMENT,
    paymentReference: null,
    createdAt: new Date('2026-08-28T10:00:00.000Z'),
    items: [
      {
        idOrderItem: 100,
        idOrder: 1,
        idProduct: 10,
        productName: 'Figure A',
        quantity: 2,
        unitPrice: '15.00',
      },
    ],
    ...overrides,
  };
}

describe('ScopedSequelizeOrderRepository', () => {
  function createPersistence() {
    const query = jest.fn();
    const connection = { query } as unknown as Sequelize;
    const orderCreate = jest.fn();
    const orderFindByPk = jest.fn();
    const orderFindOne = jest.fn();
    const orderFindAll = jest.fn();
    const orderFindAndCountAll = jest.fn();
    const orderUpdate = jest.fn();
    const orderItemBulkCreate = jest.fn();
    const orderModel = {
      create: orderCreate,
      findByPk: orderFindByPk,
      findOne: orderFindOne,
      findAll: orderFindAll,
      findAndCountAll: orderFindAndCountAll,
      update: orderUpdate,
    };
    const orderItemModel = { bulkCreate: orderItemBulkCreate };
    const persistence = {
      Order: orderModel,
      OrderItem: orderItemModel,
      sequelize: connection,
    } as unknown as OrderPersistence;
    return {
      connection,
      query,
      orderCreate,
      orderFindByPk,
      orderFindOne,
      orderFindAll,
      orderFindAndCountAll,
      orderUpdate,
      orderItemBulkCreate,
      orderModel,
      orderItemModel,
      persistence,
    };
  }

  it('creates items and re-reads through the injected graph on the active slot transaction', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeOrderRepository(models.persistence);
    const rawTransaction = { sequelize: models.connection } as unknown as Transaction;
    models.orderCreate.mockResolvedValueOnce({ idOrder: 1 });
    models.orderItemBulkCreate.mockResolvedValueOnce([]);
    models.orderFindByPk.mockResolvedValueOnce(createOrderInstance());

    const order = await withScopedTransaction(models.connection, rawTransaction, (context) =>
      repository.createWithItems(
        {
          idUser: 5,
          idempotencyKey: 'key-1',
          items: [{ idProduct: 10, productName: 'Figure A', quantity: 2, unitPrice: 15 }],
        },
        context,
      ),
    );

    expect(models.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        idUser: 5,
        idempotencyKey: 'key-1',
        orderStatus: OrderStatus.AWAITING_PAYMENT,
      }),
      { transaction: rawTransaction },
    );
    expect(models.orderItemBulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          idOrder: 1,
          idProduct: 10,
          productName: 'Figure A',
          quantity: 2,
          unitPrice: 15,
        }),
      ],
      { transaction: rawTransaction },
    );
    expect(models.orderFindByPk).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        include: [{ model: models.orderItemModel, as: 'items' }],
        transaction: rawTransaction,
      }),
    );
    expect(order.items).toHaveLength(1);
    expect(order.totalAmount).toBe(30);
  });

  it('maps idempotency conflicts and preserves buyer pagination/count semantics', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeOrderRepository(models.persistence);
    models.orderCreate.mockRejectedValueOnce(
      new UniqueConstraintError({ message: 'Duplicate entry' }),
    );
    await expect(
      withScopedTransaction(
        models.connection,
        { sequelize: models.connection } as unknown as Transaction,
        (context) =>
          repository.createWithItems({ idUser: 5, idempotencyKey: 'key-1', items: [] }, context),
      ),
    ).rejects.toThrow(DuplicateIdempotencyKeyException);

    models.orderFindAndCountAll.mockResolvedValueOnce({ rows: [createOrderInstance()], count: 1 });
    const result = await repository.findByUserId(5, { limit: 20, offset: 10 });
    expect(models.orderFindAndCountAll).toHaveBeenCalledWith({
      where: { idUser: 5 },
      include: [{ model: models.orderItemModel, as: 'items' }],
      order: [['idOrder', 'DESC']],
      limit: 20,
      offset: 10,
      distinct: true,
    });
    expect(result.total).toBe(1);
    expect(result.orders[0].items[0].unitPrice).toBe(15);
  });

  it('uses the injected connection for guarded status transitions and leaves optional standalone calls unbound', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeOrderRepository(models.persistence);
    models.query.mockResolvedValueOnce([undefined, 1]);
    const rawTransaction = { sequelize: models.connection } as unknown as Transaction;

    const changed = await withScopedTransaction(models.connection, rawTransaction, (context) =>
      repository.transitionStatus(1, OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID, context),
    );
    expect(changed).toBe(true);
    expect(models.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE.*`Order`.*SET.*`order_status`.*WHERE.*`id_order`/is),
      {
        replacements: { to: OrderStatus.PAID, from: OrderStatus.AWAITING_PAYMENT, id: 1 },
        type: QueryTypes.UPDATE,
        transaction: rawTransaction,
      },
    );

    models.query.mockResolvedValueOnce([undefined, 0]);
    await expect(
      repository.transitionStatus(1, OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID),
    ).resolves.toBe(false);
    expect(models.query.mock.calls[1][1]).toEqual(
      expect.objectContaining({ transaction: undefined }),
    );
  });

  it('rejects an undefined required runtime context before order persistence', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeOrderRepository(models.persistence);
    const input = { idUser: 5, idempotencyKey: 'key-1', items: [] };

    await expect(
      repository.createWithItems(input, undefined as unknown as TransactionContext),
    ).rejects.toThrow('Transaction context is not active for this connection');
    expect(models.orderCreate).not.toHaveBeenCalled();
    expect(models.orderItemBulkCreate).not.toHaveBeenCalled();
    expect(models.orderFindByPk).not.toHaveBeenCalled();
    expect(models.query).not.toHaveBeenCalled();
  });

  it('rejects unknown, expired, and foreign contexts before writes or status SQL', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeOrderRepository(models.persistence);
    const input = { idUser: 5, idempotencyKey: 'key-1', items: [] };
    await expect(repository.createWithItems(input, {} as TransactionContext)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );

    const expiredContext = await withScopedTransaction(
      models.connection,
      { sequelize: models.connection } as unknown as Transaction,
      async (context) => context,
    );
    await expect(
      repository.transitionStatus(
        1,
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.PAID,
        expiredContext,
      ),
    ).rejects.toThrow('Transaction context is not active for this connection');

    const foreignConnection = { query: jest.fn() } as unknown as Sequelize;
    await withScopedTransaction(
      foreignConnection,
      { sequelize: foreignConnection } as unknown as Transaction,
      async (context) => {
        await expect(
          repository.transitionStatus(1, OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID, context),
        ).rejects.toThrow('Transaction context is not active for this connection');
      },
    );

    expect(models.orderCreate).not.toHaveBeenCalled();
    expect(models.query).not.toHaveBeenCalled();
  });

  it('applies the same mapping and cap for injected order reads and payment-reference updates', async () => {
    const models = createPersistence();
    const repository = new ScopedSequelizeOrderRepository(models.persistence);
    models.orderFindAll.mockResolvedValueOnce([createOrderInstance()]);
    models.orderUpdate.mockResolvedValueOnce([1]);

    const orders = await repository.findAll();
    await repository.attachPaymentReference(1, 'MANUAL-1-abcd');

    expect(models.orderFindAll).toHaveBeenCalledWith({
      include: [{ model: models.orderItemModel, as: 'items' }],
      order: [['idOrder', 'DESC']],
      limit: 100,
    });
    expect(orders[0].items[0].productName).toBe('Figure A');
    expect(models.orderUpdate).toHaveBeenCalledWith(
      { paymentReference: 'MANUAL-1-abcd' },
      { where: { idOrder: 1 } },
    );
  });
});
