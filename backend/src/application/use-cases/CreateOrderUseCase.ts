import { UnitOfWorkPort, TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { OrderRepositoryPort, NewOrderItemInput } from '../../domain/ports/OrderRepositoryPort';
import { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { PaymentGatewayPort } from '../../domain/ports/PaymentGatewayPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { Order } from '../../domain/entities/Order';
import { EmptyCartException } from '../../domain/exceptions/EmptyCartException';
import { InsufficientStockException, StockShortage } from '../../domain/exceptions/InsufficientStockException';
import { DuplicateIdempotencyKeyException } from '../../domain/exceptions/DuplicateIdempotencyKeyException';
import { OrderDTO, mapToOrderDTO } from '../dtos/OrderDTO';

const CHECKOUT_CURRENCY = 'ARS';

// Checkout transaction flow (see design.md's Data Flow section):
//   1. Idempotency short-circuit outside any transaction.
//   2. One DB transaction: lock the active cart, decrement stock (collecting
//      every shortage before failing), persist the order + items at the
//      cart's frozen price, then flip the cart rows to ORDERED.
//   3. Post-commit, outside the transaction: initiate payment and persist its
//      reference. A gateway failure is logged and swallowed — the order is
//      already committed and must not be lost.
export class CreateOrderUseCase {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly orderRepo: OrderRepositoryPort,
    private readonly cartRepo: ShoppingCartRepositoryPort,
    private readonly productRepo: ProductRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly logger: LoggerPort
  ) {}

  async execute(userId: number, idempotencyKey: string): Promise<OrderDTO> {
    const existing = await this.orderRepo.findByIdempotencyKey(userId, idempotencyKey);
    if (existing) {
      return mapToOrderDTO(existing);
    }

    let order: Order;
    try {
      order = await this.uow.runInTransaction((tx) => this.checkout(userId, idempotencyKey, tx));
    } catch (error) {
      if (error instanceof DuplicateIdempotencyKeyException) {
        const replay = await this.orderRepo.findByIdempotencyKey(userId, idempotencyKey);
        if (replay) {
          return mapToOrderDTO(replay);
        }
      }
      throw error;
    }

    await this.initiatePayment(order);

    const finalOrder = (await this.orderRepo.findById(order.idOrder)) ?? order;
    return mapToOrderDTO(finalOrder);
  }

  private async checkout(userId: number, idempotencyKey: string, tx: TransactionContext): Promise<Order> {
    const cartRows = await this.cartRepo.findActiveForUpdate(userId, tx);
    if (cartRows.length === 0) {
      throw new EmptyCartException();
    }

    const shortages: StockShortage[] = [];
    for (const row of cartRows) {
      try {
        await this.productRepo.adjustStock(row.idProduct, -row.quantity, tx);
      } catch {
        const current = await this.productRepo.findById(row.idProduct);
        shortages.push({
          idProduct: row.idProduct,
          productName: row.product?.nameProduct ?? `Product #${row.idProduct}`,
          requested: row.quantity,
          available: current?.stock ?? 0,
        });
      }
    }

    if (shortages.length > 0) {
      throw new InsufficientStockException(shortages);
    }

    const items: NewOrderItemInput[] = cartRows.map((row) => ({
      idProduct: row.idProduct,
      productName: row.product?.nameProduct ?? `Product #${row.idProduct}`,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
    }));

    const order = await this.orderRepo.createWithItems({ idUser: userId, idempotencyKey, items }, tx);

    const cartIds = cartRows.map((row) => row.idCart);
    const affected = await this.cartRepo.markOrdered(userId, cartIds, tx);
    if (affected !== cartIds.length) {
      throw new Error('Checkout failed to mark all locked cart rows as ordered');
    }

    return order;
  }

  private async initiatePayment(order: Order): Promise<void> {
    try {
      const intent = await this.paymentGateway.initiate({
        orderId: order.idOrder,
        amount: order.totalAmount,
        currency: CHECKOUT_CURRENCY,
      });
      await this.orderRepo.attachPaymentReference(order.idOrder, intent.reference);
    } catch (error) {
      this.logger.warn(
        { event: 'payment_initiate_failed', orderId: order.idOrder, error: (error as Error).message },
        'Payment gateway initiation failed after order commit; order remains AWAITING_PAYMENT'
      );
    }
  }
}
