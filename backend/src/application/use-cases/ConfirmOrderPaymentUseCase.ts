import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { OrderStatus } from '../../domain/entities/Order';
import { IllegalOrderTransitionException } from '../../domain/exceptions/IllegalOrderTransitionException';
import { OrderDTO, mapToOrderDTO } from '../dtos/OrderDTO';

// ADMIN-only payment confirmation. `transitionStatus`'s guarded conditional
// update (`WHERE order_status = 'AWAITING_PAYMENT'`) is the single source of
// truth for "double-confirm is impossible": affectedRows === 0 covers both a
// nonexistent order id and an order that already moved out of
// AWAITING_PAYMENT, and both throw the same IllegalOrderTransitionException
// with zero side effects — no read-then-write race is possible.
export class ConfirmOrderPaymentUseCase {
  constructor(private readonly orderRepo: OrderRepositoryPort) {}

  async execute(idOrder: number): Promise<OrderDTO> {
    const transitioned = await this.orderRepo.transitionStatus(
      idOrder,
      OrderStatus.AWAITING_PAYMENT,
      OrderStatus.PAID
    );

    if (!transitioned) {
      throw new IllegalOrderTransitionException();
    }

    const order = await this.orderRepo.findById(idOrder);
    if (!order) {
      throw new IllegalOrderTransitionException('Order not found after confirmation');
    }

    return mapToOrderDTO(order);
  }
}
