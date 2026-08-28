import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { OrderDTO, mapToOrderDTO } from '../dtos/OrderDTO';

// ADMIN-only listing of every order in the system, most recent first. No
// pagination feature — that's deferred order-history work — but the
// repository caps the result set (SequelizeOrderRepository.MAX_LISTED) as
// baseline endpoint hygiene against an unbounded full-table scan.
export class ListOrdersUseCase {
  constructor(private readonly orderRepo: OrderRepositoryPort) {}

  async execute(): Promise<OrderDTO[]> {
    const orders = await this.orderRepo.findAll();
    return orders.map(mapToOrderDTO);
  }
}
