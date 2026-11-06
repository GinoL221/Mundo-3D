import { QueryTypes, UniqueConstraintError } from 'sequelize';
import type { Transaction } from 'sequelize';
import { DuplicateIdempotencyKeyException } from '../../domain/exceptions/DuplicateIdempotencyKeyException';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import type {
  NewOrderItemInput,
  OrderRepositoryPort,
  PaginationOptions,
  PagedOrders,
} from '../../domain/ports/OrderRepositoryPort';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import type { OrderInstance } from '../../database/models/db';
import { resolveScopedTransaction } from '../persistence/scopedTransactionContext';

// `Order` is a MySQL reserved word; quote every raw-SQL reference.
const ORDER_TABLE = '`Order`';
const ORDER_ID_COLUMN = '`id_order`';
const ORDER_STATUS_COLUMN = '`order_status`';

export type OrderPersistence = Pick<
  typeof import('../../database/models/db'),
  'Order' | 'OrderItem' | 'sequelize'
>;

export class ScopedSequelizeOrderRepository implements OrderRepositoryPort {
  private static readonly MAX_LISTED = 100;

  constructor(private readonly db: OrderPersistence) {}

  private toEntity(instance: OrderInstance): Order {
    const items = (instance.items ?? []).map(
      (item) =>
        new OrderItem(
          item.idOrderItem,
          item.idOrder,
          item.idProduct,
          item.productName,
          item.quantity,
          Number(item.unitPrice),
        ),
    );
    return new Order(
      instance.idOrder,
      instance.idUser,
      instance.idempotencyKey,
      instance.orderStatus as OrderStatus,
      items,
      instance.createdAt,
      instance.paymentReference,
    );
  }

  private async findByIdInternal(
    idOrder: number,
    transaction?: Transaction,
  ): Promise<Order | null> {
    const instance = await this.db.Order.findByPk(idOrder, {
      include: [{ model: this.db.OrderItem, as: 'items' }],
      transaction,
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async createWithItems(
    input: { idUser: number; idempotencyKey: string; items: NewOrderItemInput[] },
    context: TransactionContext,
  ): Promise<Order> {
    const transaction = resolveScopedTransaction(context, this.db.sequelize);
    if (!transaction) {
      throw new Error('Transaction context is not active for this connection');
    }

    let orderInstance: OrderInstance;
    try {
      orderInstance = await this.db.Order.create(
        {
          idUser: input.idUser,
          idempotencyKey: input.idempotencyKey,
          orderStatus: OrderStatus.AWAITING_PAYMENT,
          createdAt: new Date(),
        },
        { transaction },
      );
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateIdempotencyKeyException();
      }
      throw error;
    }

    await this.db.OrderItem.bulkCreate(
      input.items.map((item) => ({
        idOrder: orderInstance.idOrder,
        idProduct: item.idProduct,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      { transaction },
    );

    const created = await this.findByIdInternal(orderInstance.idOrder, transaction);
    if (!created) {
      throw new Error('Order was created but could not be re-read within the same transaction');
    }
    return created;
  }

  async findByIdempotencyKey(idUser: number, idempotencyKey: string): Promise<Order | null> {
    const instance = await this.db.Order.findOne({
      where: { idUser, idempotencyKey },
      include: [{ model: this.db.OrderItem, as: 'items' }],
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async findById(idOrder: number): Promise<Order | null> {
    return this.findByIdInternal(idOrder);
  }

  async findAll(): Promise<Order[]> {
    const instances = await this.db.Order.findAll({
      include: [{ model: this.db.OrderItem, as: 'items' }],
      order: [['idOrder', 'DESC']],
      limit: ScopedSequelizeOrderRepository.MAX_LISTED,
    });
    return instances.map((instance) => this.toEntity(instance));
  }

  async findByUserId(idUser: number, { limit, offset }: PaginationOptions): Promise<PagedOrders> {
    const { rows, count } = await this.db.Order.findAndCountAll({
      where: { idUser },
      include: [{ model: this.db.OrderItem, as: 'items' }],
      order: [['idOrder', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
    return { orders: rows.map((instance) => this.toEntity(instance)), total: count };
  }

  async transitionStatus(
    idOrder: number,
    from: OrderStatus,
    to: OrderStatus,
    context?: TransactionContext,
  ): Promise<boolean> {
    const transaction = resolveScopedTransaction(context, this.db.sequelize);
    const [, affectedRows] = await this.db.sequelize.query(
      `UPDATE ${ORDER_TABLE} SET ${ORDER_STATUS_COLUMN} = :to ` +
        `WHERE ${ORDER_ID_COLUMN} = :id AND ${ORDER_STATUS_COLUMN} = :from`,
      {
        replacements: { to, from, id: idOrder },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
    return affectedRows === 1;
  }

  async attachPaymentReference(idOrder: number, reference: string): Promise<void> {
    await this.db.Order.update({ paymentReference: reference }, { where: { idOrder } });
  }
}
