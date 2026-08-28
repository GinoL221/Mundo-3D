import { ConfirmOrderPaymentUseCase } from '../use-cases/ConfirmOrderPaymentUseCase';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { IllegalOrderTransitionException } from '../../domain/exceptions/IllegalOrderTransitionException';

function makeOrder(idOrder: number, status: OrderStatus): Order {
  const items = [new OrderItem(1, idOrder, 10, 'Figure A', 1, 1500)];
  return new Order(idOrder, 7, `key-${idOrder}`, status, items, new Date('2026-08-28T14:03:11.000Z'));
}

describe('ConfirmOrderPaymentUseCase', () => {
  let orderRepo: jest.Mocked<OrderRepositoryPort>;
  let useCase: ConfirmOrderPaymentUseCase;

  beforeEach(() => {
    orderRepo = {
      createWithItems: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      transitionStatus: jest.fn(),
      attachPaymentReference: jest.fn(),
    };
    useCase = new ConfirmOrderPaymentUseCase(orderRepo);
  });

  it('transitions an AWAITING_PAYMENT order to PAID', async () => {
    orderRepo.transitionStatus.mockResolvedValue(true);
    orderRepo.findById.mockResolvedValue(makeOrder(41, OrderStatus.PAID));

    const dto = await useCase.execute(41);

    expect(orderRepo.transitionStatus).toHaveBeenCalledWith(41, OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID);
    expect(dto.status).toBe(OrderStatus.PAID);
  });

  it('rejects confirming an order that is not AWAITING_PAYMENT (double-confirm)', async () => {
    orderRepo.transitionStatus.mockResolvedValue(false);

    await expect(useCase.execute(41)).rejects.toThrow(IllegalOrderTransitionException);
    expect(orderRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects confirming a nonexistent order id', async () => {
    orderRepo.transitionStatus.mockResolvedValue(false);

    await expect(useCase.execute(999)).rejects.toThrow(IllegalOrderTransitionException);
  });
});
