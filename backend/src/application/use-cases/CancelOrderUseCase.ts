import { UnitOfWorkPort, TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { IllegalOrderTransitionException } from '../../domain/exceptions/IllegalOrderTransitionException';
import { OrderDTO, mapToOrderDTO } from '../dtos/OrderDTO';

// ADMIN-only cancellation. Multi-step (transition + N stock restorations), so
// it runs inside one UnitOfWork transaction, unlike ConfirmOrderPaymentUseCase.
//
// The order's items are read once, before the transaction, purely to know
// which products/quantities to restock — item rows are immutable after order
// creation, so there is no staleness risk. The actual guard against a double
// cancel is `transitionStatus`'s conditional update, checked FIRST inside the
// transaction: if it reports 0 affected rows (order already CANCELLED/PAID,
// or the id does not exist), this throws before any `adjustStock` call runs,
// so a second cancel restores no stock (design.md's "Admin transitions").
export class CancelOrderUseCase {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly orderRepo: OrderRepositoryPort,
    private readonly productRepo: ProductRepositoryPort
  ) {}

  async execute(idOrder: number): Promise<OrderDTO> {
    const existing = await this.orderRepo.findById(idOrder);

    return this.uow.runInTransaction(async (tx: TransactionContext) => {
      const transitioned = await this.orderRepo.transitionStatus(
        idOrder,
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.CANCELLED,
        tx
      );

      if (!transitioned || !existing) {
        throw new IllegalOrderTransitionException();
      }

      for (const item of existing.items) {
        if (item.idProduct !== null) {
          await this.productRepo.adjustStock(item.idProduct, item.quantity, tx);
        }
      }

      const cancelled = new Order(
        existing.idOrder,
        existing.idUser,
        existing.idempotencyKey,
        OrderStatus.CANCELLED,
        existing.items,
        existing.createdAt,
        existing.paymentReference
      );

      return mapToOrderDTO(cancelled);
    });
  }
}
