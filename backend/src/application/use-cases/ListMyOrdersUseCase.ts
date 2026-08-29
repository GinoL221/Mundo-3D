import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { OrderSummaryDTO, mapToOrderSummaryDTO } from '../dtos/OrderDTO';

// Buyer-scoped, paginated listing (order-history feature), alongside the
// ADMIN-only `ListOrdersUseCase` rather than through it.
//
// `MAX_PAGE_SIZE` is deliberately independent of
// `SequelizeOrderRepository.MAX_LISTED` (design decision #5): that constant
// is a private ADMIN endpoint-hygiene floor, not a client-facing page-size
// contract.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface MyOrdersPageDTO {
  orders: OrderSummaryDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ListMyOrdersUseCase {
  constructor(private readonly orderRepo: OrderRepositoryPort) {}

  // `page`/`pageSize` are trusted as already validated by the HTTP layer
  // (Work Unit 2's `listMyOrdersValidation`) — no defensive clamping here,
  // per design decision #6: a silent clamp would contradict the
  // reject-with-400 contract enforced upstream.
  async execute(idUser: number, page: number, pageSize: number): Promise<MyOrdersPageDTO> {
    const offset = (page - 1) * pageSize;
    const { orders, total } = await this.orderRepo.findByUserId(idUser, { limit: pageSize, offset });

    return {
      orders: orders.map(mapToOrderSummaryDTO),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
