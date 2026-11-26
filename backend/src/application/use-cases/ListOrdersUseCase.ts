import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { WorkshopOrderDTO, mapToWorkshopOrderDTO } from '../dtos/OrderDTO';

// ADMIN/STAFF workshop listing of orders, most recent first, enriched with
// minimal customer identification (`firstName` + last-name initial + `idUser`,
// never email or full last name). The repository caps the result set
// (`SequelizeOrderRepository.MAX_LISTED`) against an unbounded full-table scan.
export class ListOrdersUseCase {
  constructor(
    private readonly orderRepo: OrderRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
  ) {}

  async execute(): Promise<WorkshopOrderDTO[]> {
    const orders = await this.orderRepo.findAll();
    if (orders.length === 0) return [];

    const userIds = [...new Set(orders.map((order) => order.idUser))];
    const users = await this.userRepo.findByIds(userIds);
    const usersById = new Map(users.map((user) => [user.idUser, user]));

    return orders.map((order) => mapToWorkshopOrderDTO(order, usersById.get(order.idUser) ?? null));
  }
}
