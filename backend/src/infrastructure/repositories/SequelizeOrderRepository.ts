import { QueryTypes, Transaction, UniqueConstraintError } from 'sequelize';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { OrderRepositoryPort, NewOrderItemInput, PaginationOptions, PagedOrders } from '../../domain/ports/OrderRepositoryPort';
import { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { DuplicateIdempotencyKeyException } from '../../domain/exceptions/DuplicateIdempotencyKeyException';
import db, { OrderInstance } from '../../database/models/db';

// `Order` is a MySQL reserved word — every raw-SQL reference below is
// backtick-quoted, matching `SequelizeProductRepository`'s `PRODUCT_TABLE`
// convention.
const ORDER_TABLE = '`Order`';
const ORDER_ID_COLUMN = '`id_order`';
const ORDER_STATUS_COLUMN = '`order_status`';

export class SequelizeOrderRepository implements OrderRepositoryPort {
  private toEntity(instance: OrderInstance): Order {
    const items = (instance.items ?? []).map(
      (item) =>
        new OrderItem(item.idOrderItem, item.idOrder, item.idProduct, item.productName, item.quantity, Number(item.unitPrice))
    );
    return new Order(
      instance.idOrder,
      instance.idUser,
      instance.idempotencyKey,
      instance.orderStatus as OrderStatus,
      items,
      instance.createdAt,
      instance.paymentReference
    );
  }

  // Private, transaction-aware follow-up read — same rationale as
  // `SequelizeProductRepository.findByIdInternal`: `createWithItems`'s
  // re-read must run on the transaction's own connection.
  private async findByIdInternal(idOrder: number, transaction?: Transaction): Promise<Order | null> {
    const instance = await db.Order.findByPk(idOrder, {
      include: [{ model: db.OrderItem, as: 'items' }],
      transaction,
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async createWithItems(
    input: { idUser: number; idempotencyKey: string; items: NewOrderItemInput[] },
    tx: TransactionContext
  ): Promise<Order> {
    const transaction = tx as unknown as Transaction;

    let orderInstance: OrderInstance;
    try {
      orderInstance = await db.Order.create(
        {
          idUser: input.idUser,
          idempotencyKey: input.idempotencyKey,
          orderStatus: OrderStatus.AWAITING_PAYMENT,
          createdAt: new Date(),
        },
        { transaction }
      );
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateIdempotencyKeyException();
      }
      throw error;
    }

    await db.OrderItem.bulkCreate(
      input.items.map((item) => ({
        idOrder: orderInstance.idOrder,
        idProduct: item.idProduct,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      { transaction }
    );

    const created = await this.findByIdInternal(orderInstance.idOrder, transaction);
    if (!created) {
      throw new Error('Order was created but could not be re-read within the same transaction');
    }
    return created;
  }

  async findByIdempotencyKey(idUser: number, idempotencyKey: string): Promise<Order | null> {
    const instance = await db.Order.findOne({
      where: { idUser, idempotencyKey },
      include: [{ model: db.OrderItem, as: 'items' }],
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async findById(idOrder: number): Promise<Order | null> {
    return this.findByIdInternal(idOrder);
  }

  // Capped at the most recent MAX_LISTED orders — endpoint hygiene against an
  // unbounded full-table scan, not the deferred order-history/pagination
  // feature. No caller-controlled parameter: this is a safety floor, not a
  // page size a client can request.
  private static readonly MAX_LISTED = 100;

  async findAll(): Promise<Order[]> {
    const instances = await db.Order.findAll({
      include: [{ model: db.OrderItem, as: 'items' }],
      order: [['idOrder', 'DESC']],
      limit: SequelizeOrderRepository.MAX_LISTED,
    });
    return instances.map((instance) => this.toEntity(instance));
  }

  // Buyer-scoped, paginated listing (order-history feature). `items` MUST
  // stay eager-loaded even though the response DTO omits them: `Order`'s
  // constructor throws on an empty item list and `totalAmount` reduces over
  // `items`. `distinct: true` is load-bearing — without it, the `items`
  // hasMany include makes `findAndCountAll` count joined item rows instead
  // of orders, silently inflating `total` for any multi-item order.
  async findByUserId(idUser: number, { limit, offset }: PaginationOptions): Promise<PagedOrders> {
    const { rows, count } = await db.Order.findAndCountAll({
      where: { idUser },
      include: [{ model: db.OrderItem, as: 'items' }],
      order: [['idOrder', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
    return { orders: rows.map((instance) => this.toEntity(instance)), total: count };
  }

  // Guarded UPDATE mirroring `adjustStock`'s affected-row-count style — a
  // read-then-write would race two admin actions against the same order.
  async transitionStatus(idOrder: number, from: OrderStatus, to: OrderStatus, tx?: TransactionContext): Promise<boolean> {
    const transaction = tx as unknown as Transaction | undefined;
    const [, affectedRows] = await db.sequelize.query(
      `UPDATE ${ORDER_TABLE} SET ${ORDER_STATUS_COLUMN} = :to ` +
        `WHERE ${ORDER_ID_COLUMN} = :id AND ${ORDER_STATUS_COLUMN} = :from`,
      {
        replacements: { to, from, id: idOrder },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );
    return affectedRows === 1;
  }

  async attachPaymentReference(idOrder: number, reference: string): Promise<void> {
    await db.Order.update({ paymentReference: reference }, { where: { idOrder } });
  }
}
