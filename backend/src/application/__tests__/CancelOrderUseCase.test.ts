import { CancelOrderUseCase } from '../use-cases/CancelOrderUseCase';
import { UnitOfWorkPort, TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { IllegalOrderTransitionException } from '../../domain/exceptions/IllegalOrderTransitionException';

function makeOrder(idOrder: number, items: OrderItem[], status: OrderStatus = OrderStatus.AWAITING_PAYMENT): Order {
  return new Order(idOrder, 7, `key-${idOrder}`, status, items, new Date('2026-08-28T14:03:11.000Z'));
}

describe('CancelOrderUseCase', () => {
  let uow: jest.Mocked<UnitOfWorkPort>;
  let orderRepo: jest.Mocked<OrderRepositoryPort>;
  let productRepo: jest.Mocked<ProductRepositoryPort>;
  let useCase: CancelOrderUseCase;

  beforeEach(() => {
    uow = {
      runInTransaction: jest.fn((work: (tx: TransactionContext) => Promise<unknown>) => work({} as TransactionContext)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    orderRepo = {
      createWithItems: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByUserId: jest.fn(),
      transitionStatus: jest.fn(),
      attachPaymentReference: jest.fn(),
    };
    productRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      adjustStock: jest.fn(),
    };
    useCase = new CancelOrderUseCase(uow, orderRepo, productRepo);
  });

  it('cancels an AWAITING_PAYMENT order and restores exactly the decremented stock per line item', async () => {
    const items = [
      new OrderItem(1, 41, 10, 'Figure A', 3, 1500),
      new OrderItem(2, 41, 20, 'Figure B', 1, 500),
    ];
    orderRepo.findById.mockResolvedValue(makeOrder(41, items));
    orderRepo.transitionStatus.mockResolvedValue(true);

    const dto = await useCase.execute(41);

    expect(orderRepo.transitionStatus).toHaveBeenCalledWith(41, OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED, {});
    expect(productRepo.adjustStock).toHaveBeenCalledTimes(2);
    expect(productRepo.adjustStock).toHaveBeenCalledWith(10, 3, {});
    expect(productRepo.adjustStock).toHaveBeenCalledWith(20, 1, {});
    expect(dto.status).toBe(OrderStatus.CANCELLED);
  });

  it('skips restocking a line item whose product was deleted (idProduct === null)', async () => {
    const items = [
      new OrderItem(1, 41, null, 'Figure A (deleted)', 3, 1500),
      new OrderItem(2, 41, 20, 'Figure B', 1, 500),
    ];
    orderRepo.findById.mockResolvedValue(makeOrder(41, items));
    orderRepo.transitionStatus.mockResolvedValue(true);

    await useCase.execute(41);

    expect(productRepo.adjustStock).toHaveBeenCalledTimes(1);
    expect(productRepo.adjustStock).toHaveBeenCalledWith(20, 1, {});
  });

  it('is a no-op restoring no stock when the order is already CANCELLED (second cancel)', async () => {
    const items = [new OrderItem(1, 41, 10, 'Figure A', 3, 1500)];
    orderRepo.findById.mockResolvedValue(makeOrder(41, items, OrderStatus.CANCELLED));
    orderRepo.transitionStatus.mockResolvedValue(false);

    await expect(useCase.execute(41)).rejects.toThrow(IllegalOrderTransitionException);

    expect(productRepo.adjustStock).not.toHaveBeenCalled();
  });

  it('rejects cancelling a nonexistent order id without touching stock', async () => {
    orderRepo.findById.mockResolvedValue(null);
    orderRepo.transitionStatus.mockResolvedValue(false);

    await expect(useCase.execute(999)).rejects.toThrow(IllegalOrderTransitionException);

    expect(productRepo.adjustStock).not.toHaveBeenCalled();
  });
});
