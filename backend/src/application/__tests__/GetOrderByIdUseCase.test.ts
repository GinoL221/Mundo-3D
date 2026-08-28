import { GetOrderByIdUseCase } from '../use-cases/GetOrderByIdUseCase';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';

function makeOrder(idOrder: number, idUser: number): Order {
  const items = [new OrderItem(1, idOrder, 10, 'Figure A', 2, 1500)];
  return new Order(idOrder, idUser, `key-${idOrder}`, OrderStatus.AWAITING_PAYMENT, items, new Date('2026-08-28T14:03:11.000Z'));
}

describe('GetOrderByIdUseCase', () => {
  let orderRepo: jest.Mocked<OrderRepositoryPort>;
  let useCase: GetOrderByIdUseCase;

  beforeEach(() => {
    orderRepo = {
      createWithItems: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      transitionStatus: jest.fn(),
      attachPaymentReference: jest.fn(),
    };
    useCase = new GetOrderByIdUseCase(orderRepo);
  });

  it('returns the order DTO when the requesting user is the owner', async () => {
    const order = makeOrder(41, 7);
    orderRepo.findById.mockResolvedValue(order);

    const dto = await useCase.execute(41, 7, false);

    expect(orderRepo.findById).toHaveBeenCalledWith(41);
    expect(dto).not.toBeNull();
    expect(dto?.idOrder).toBe(41);
    expect(dto?.idUser).toBe(7);
    expect(dto?.totalAmount).toBe(3000);
  });

  it('returns null when the order does not exist', async () => {
    orderRepo.findById.mockResolvedValue(null);

    const dto = await useCase.execute(999, 7, false);

    expect(dto).toBeNull();
  });

  it('returns null when a non-owner, non-admin requests the order (does not leak existence)', async () => {
    const order = makeOrder(41, 7);
    orderRepo.findById.mockResolvedValue(order);

    const dto = await useCase.execute(41, 9, false);

    expect(dto).toBeNull();
  });

  it('returns the order DTO for an ADMIN even when they are not the owner', async () => {
    const order = makeOrder(41, 7);
    orderRepo.findById.mockResolvedValue(order);

    const dto = await useCase.execute(41, 9, true);

    expect(dto).not.toBeNull();
    expect(dto?.idOrder).toBe(41);
    expect(dto?.idUser).toBe(7);
  });
});
