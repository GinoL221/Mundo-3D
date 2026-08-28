import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { OrderDTO, mapToOrderDTO } from '../dtos/OrderDTO';

// Single use case for both the buyer's own order-detail view and the ADMIN
// detail read (order-administration spec). Ownership checking is kept here
// (authorization-adjacent logic tied to the order's own `idUser`), not as a
// domain business rule on the `Order` entity itself and not duplicated in the
// controller. Returns `null` uniformly for "not found" and "not authorized to
// view" so the controller can map both to 404 ORDER_NOT_FOUND without leaking
// whether an order belonging to someone else actually exists.
export class GetOrderByIdUseCase {
  constructor(private readonly orderRepo: OrderRepositoryPort) {}

  async execute(idOrder: number, requestingUserId: number, isAdmin: boolean): Promise<OrderDTO | null> {
    const order = await this.orderRepo.findById(idOrder);
    if (!order) {
      return null;
    }

    if (!isAdmin && order.idUser !== requestingUserId) {
      return null;
    }

    return mapToOrderDTO(order);
  }
}
