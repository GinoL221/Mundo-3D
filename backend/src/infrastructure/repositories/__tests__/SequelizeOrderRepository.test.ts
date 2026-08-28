import { UniqueConstraintError } from 'sequelize';
import { SequelizeOrderRepository } from '../SequelizeOrderRepository';
import db, { OrderInstance } from '../../../database/models/db';
import { OrderStatus } from '../../../domain/entities/Order';
import { DuplicateIdempotencyKeyException } from '../../../domain/exceptions/DuplicateIdempotencyKeyException';
import { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';

jest.mock('../../../database/models/db', () => ({
  Order: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
  OrderItem: {
    bulkCreate: jest.fn(),
  },
  sequelize: {
    query: jest.fn(),
  },
}));

const mockTx = {} as unknown as TransactionContext;

function mockOrderInstance(overrides: Partial<OrderInstance> = {}): OrderInstance {
  return {
    idOrder: 1,
    idUser: 5,
    idempotencyKey: 'key-1',
    orderStatus: OrderStatus.AWAITING_PAYMENT,
    paymentReference: null,
    createdAt: new Date('2026-08-28T10:00:00.000Z'),
    items: [
      { idOrderItem: 100, idOrder: 1, idProduct: 10, productName: 'Figure A', quantity: 2, unitPrice: '15.00' },
    ],
    ...overrides,
  } as unknown as OrderInstance;
}

describe('SequelizeOrderRepository', () => {
  let repository: SequelizeOrderRepository;

  beforeEach(() => {
    repository = new SequelizeOrderRepository();
    jest.clearAllMocks();
  });

  describe('createWithItems', () => {
    it('creates the Order row, bulk-creates its items, and re-reads within the same transaction', async () => {
      jest.mocked(db.Order.create).mockResolvedValueOnce({ idOrder: 1 } as unknown as OrderInstance);
      jest.mocked(db.OrderItem.bulkCreate).mockResolvedValueOnce([] as never);
      jest.mocked(db.Order.findByPk).mockResolvedValueOnce(mockOrderInstance());

      const order = await repository.createWithItems(
        { idUser: 5, idempotencyKey: 'key-1', items: [{ idProduct: 10, productName: 'Figure A', quantity: 2, unitPrice: 15 }] },
        mockTx
      );

      expect(db.Order.create).toHaveBeenCalledWith(
        expect.objectContaining({ idUser: 5, idempotencyKey: 'key-1', orderStatus: OrderStatus.AWAITING_PAYMENT }),
        expect.objectContaining({ transaction: mockTx })
      );
      expect(db.OrderItem.bulkCreate).toHaveBeenCalledWith(
        [expect.objectContaining({ idOrder: 1, idProduct: 10, productName: 'Figure A', quantity: 2, unitPrice: 15 })],
        expect.objectContaining({ transaction: mockTx })
      );
      expect(db.Order.findByPk).toHaveBeenCalledWith(1, expect.objectContaining({ transaction: mockTx }));
      expect(order.idOrder).toBe(1);
      expect(order.items).toHaveLength(1);
      expect(order.totalAmount).toBe(30);
    });

    it('maps a UNIQUE(id_user, idempotency_key) violation to DuplicateIdempotencyKeyException', async () => {
      jest.mocked(db.Order.create).mockRejectedValueOnce(
        new UniqueConstraintError({ message: 'Duplicate entry' })
      );

      await expect(
        repository.createWithItems(
          { idUser: 5, idempotencyKey: 'key-1', items: [{ idProduct: 10, productName: 'Figure A', quantity: 2, unitPrice: 15 }] },
          mockTx
        )
      ).rejects.toThrow(DuplicateIdempotencyKeyException);
    });
  });

  describe('findByIdempotencyKey', () => {
    it('returns the mapped order when found', async () => {
      jest.mocked(db.Order.findOne).mockResolvedValueOnce(mockOrderInstance());

      const order = await repository.findByIdempotencyKey(5, 'key-1');

      expect(order?.idOrder).toBe(1);
      expect(db.Order.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { idUser: 5, idempotencyKey: 'key-1' } })
      );
    });

    it('returns null when no order matches', async () => {
      jest.mocked(db.Order.findOne).mockResolvedValueOnce(null);
      const order = await repository.findByIdempotencyKey(5, 'missing-key');
      expect(order).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the mapped order including items', async () => {
      jest.mocked(db.Order.findByPk).mockResolvedValueOnce(mockOrderInstance());
      const order = await repository.findById(1);
      expect(order?.items[0].productName).toBe('Figure A');
    });

    it('returns null when not found', async () => {
      jest.mocked(db.Order.findByPk).mockResolvedValueOnce(null);
      const order = await repository.findById(999);
      expect(order).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns every order mapped to the domain entity', async () => {
      jest.mocked(db.Order.findAll).mockResolvedValueOnce([mockOrderInstance(), mockOrderInstance({ idOrder: 2 })]);
      const orders = await repository.findAll();
      expect(orders).toHaveLength(2);
    });

    it('orders most-recent-first and caps the result set at 100 — endpoint hygiene, not a caller-controlled page size', async () => {
      jest.mocked(db.Order.findAll).mockResolvedValueOnce([]);
      await repository.findAll();
      expect(db.Order.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ order: [['idOrder', 'DESC']], limit: 100 })
      );
    });
  });

  describe('transitionStatus', () => {
    const mockSequelizeQuery = db.sequelize.query as unknown as jest.Mock;

    it('issues the guarded UPDATE against the reserved-word-quoted Order table and returns true when exactly 1 row changed', async () => {
      mockSequelizeQuery.mockResolvedValueOnce([undefined, 1]);

      const result = await repository.transitionStatus(1, OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID, mockTx);

      expect(mockSequelizeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE.*`Order`.*SET.*`order_status`.*WHERE.*`id_order`.*AND.*`order_status`/is),
        expect.objectContaining({
          replacements: { to: OrderStatus.PAID, from: OrderStatus.AWAITING_PAYMENT, id: 1 },
          transaction: mockTx,
        })
      );
      expect(result).toBe(true);
    });

    it('returns false when the guard condition matches zero rows (double confirm/cancel)', async () => {
      mockSequelizeQuery.mockResolvedValueOnce([undefined, 0]);
      const result = await repository.transitionStatus(1, OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID);
      expect(result).toBe(false);
    });
  });

  describe('attachPaymentReference', () => {
    it('updates the paymentReference column for the given order id', async () => {
      jest.mocked(db.Order.update).mockResolvedValueOnce([1] as never);

      await repository.attachPaymentReference(1, 'MANUAL-1-abcd');

      expect(db.Order.update).toHaveBeenCalledWith(
        { paymentReference: 'MANUAL-1-abcd' },
        { where: { idOrder: 1 } }
      );
    });
  });
});
