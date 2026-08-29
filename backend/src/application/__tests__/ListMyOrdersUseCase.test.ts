import { ListMyOrdersUseCase } from '../use-cases/ListMyOrdersUseCase';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';

function makeOrder(idOrder: number, idUser: number, status: OrderStatus = OrderStatus.AWAITING_PAYMENT): Order {
  const items = [new OrderItem(idOrder * 10, idOrder, 10, 'Figure A', 1, 1500)];
  return new Order(idOrder, idUser, `key-${idOrder}`, status, items, new Date('2026-08-28T14:03:11.000Z'));
}

describe('ListMyOrdersUseCase', () => {
  let orderRepo: jest.Mocked<OrderRepositoryPort>;
  let useCase: ListMyOrdersUseCase;

  beforeEach(() => {
    orderRepo = {
      createWithItems: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByUserId: jest.fn(),
      transitionStatus: jest.fn(),
      attachPaymentReference: jest.fn(),
    };
    useCase = new ListMyOrdersUseCase(orderRepo);
  });

  it('passes idUser through untouched and converts page/pageSize into limit/offset', async () => {
    orderRepo.findByUserId.mockResolvedValue({ orders: [], total: 0 });

    await useCase.execute(7, 3, 10);

    expect(orderRepo.findByUserId).toHaveBeenCalledWith(7, { limit: 10, offset: 20 });
  });

  it('computes offset as (page - 1) * pageSize for the first page', async () => {
    orderRepo.findByUserId.mockResolvedValue({ orders: [], total: 0 });

    await useCase.execute(7, 1, 20);

    expect(orderRepo.findByUserId).toHaveBeenCalledWith(7, { limit: 20, offset: 0 });
  });

  it('maps orders to OrderSummaryDTO (no items) and computes totalPages from total/pageSize', async () => {
    const orders = [makeOrder(2, 7, OrderStatus.PAID), makeOrder(1, 7)];
    orderRepo.findByUserId.mockResolvedValue({ orders, total: 37 });

    const result = await useCase.execute(7, 1, 20);

    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]).toEqual({
      idOrder: 2,
      idUser: 7,
      status: OrderStatus.PAID,
      totalAmount: 1500,
      createdAt: '2026-08-28T14:03:11.000Z',
      paymentReference: null,
    });
    expect((result.orders[0] as unknown as Record<string, unknown>).items).toBeUndefined();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(37);
    expect(result.totalPages).toBe(2);
  });

  it('returns totalPages: 0 when the caller has zero orders (never 0/pageSize -> 0 by coincidence only)', async () => {
    orderRepo.findByUserId.mockResolvedValue({ orders: [], total: 0 });

    const result = await useCase.execute(7, 1, 20);

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.orders).toEqual([]);
  });

  it('trusts an already-validated pageSize with no defensive clamping', async () => {
    orderRepo.findByUserId.mockResolvedValue({ orders: [], total: 0 });

    // 999 would be rejected by the HTTP validator upstream (Work Unit 2) —
    // the use case itself must not silently clamp it, per design decision #6.
    await useCase.execute(7, 1, 999);

    expect(orderRepo.findByUserId).toHaveBeenCalledWith(7, { limit: 999, offset: 0 });
  });
});
