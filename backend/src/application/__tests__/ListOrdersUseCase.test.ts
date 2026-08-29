import { ListOrdersUseCase } from '../use-cases/ListOrdersUseCase';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';

function makeOrder(idOrder: number, idUser: number, status: OrderStatus = OrderStatus.AWAITING_PAYMENT): Order {
  const items = [new OrderItem(idOrder * 10, idOrder, 10, 'Figure A', 1, 1500)];
  return new Order(idOrder, idUser, `key-${idOrder}`, status, items, new Date('2026-08-28T14:03:11.000Z'));
}

describe('ListOrdersUseCase', () => {
  let orderRepo: jest.Mocked<OrderRepositoryPort>;
  let useCase: ListOrdersUseCase;

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
    useCase = new ListOrdersUseCase(orderRepo);
  });

  it('returns an empty list when there are no orders', async () => {
    orderRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(orderRepo.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('returns every order mapped to DTO, not scoped to a single user', async () => {
    const orders = [makeOrder(1, 7), makeOrder(2, 9, OrderStatus.PAID)];
    orderRepo.findAll.mockResolvedValue(orders);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result.map((o) => o.idOrder)).toEqual([1, 2]);
    expect(result.map((o) => o.idUser)).toEqual([7, 9]);
    expect(result[1].status).toBe(OrderStatus.PAID);
  });
});
