import { ListOrdersUseCase } from '../use-cases/ListOrdersUseCase';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { User } from '../../domain/entities/User';
import { Role } from '../../domain/Role';

function makeOrder(
  idOrder: number,
  idUser: number,
  status: OrderStatus = OrderStatus.AWAITING_PAYMENT,
): Order {
  const items = [new OrderItem(idOrder * 10, idOrder, 10, 'Figure A', 1, 1500)];
  return new Order(
    idOrder,
    idUser,
    `key-${idOrder}`,
    status,
    items,
    new Date('2026-08-28T14:03:11.000Z'),
  );
}

function makeUser(idUser: number, firstName: string, lastName: string, email: string): User {
  return new User(idUser, firstName, lastName, email, 'secret-hash', null, Role.USER, 'User');
}

describe('ListOrdersUseCase', () => {
  let orderRepo: jest.Mocked<OrderRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
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
    userRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    };
    useCase = new ListOrdersUseCase(orderRepo, userRepo);
  });

  it('returns an empty list without querying users when there are no orders', async () => {
    orderRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(orderRepo.findAll).toHaveBeenCalledTimes(1);
    expect(userRepo.findByIds).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('returns every order with minimal customer identification and never exposes email, full lastName, or password', async () => {
    const orders = [
      makeOrder(1, 7),
      makeOrder(2, 9, OrderStatus.PAID),
      makeOrder(3, 7, OrderStatus.CANCELLED),
      makeOrder(4, 99),
    ];
    orderRepo.findAll.mockResolvedValue(orders);
    userRepo.findByIds.mockResolvedValue([
      makeUser(7, 'María', 'Gómez', 'maria@example.com'),
      makeUser(9, 'Lucas', '', 'lucas@example.com'),
    ]);

    const result = await useCase.execute();

    expect(userRepo.findByIds).toHaveBeenCalledTimes(1);
    expect(userRepo.findByIds).toHaveBeenCalledWith([7, 9, 99]);
    expect(result).toHaveLength(4);
    expect(result.map((o) => o.idOrder)).toEqual([1, 2, 3, 4]);
    expect(result[0].customer).toEqual({ idUser: 7, displayName: 'María G.' });
    expect(result[1].customer).toEqual({ idUser: 9, displayName: 'Lucas' });
    expect(result[1].status).toBe(OrderStatus.PAID);
    expect(result[2].customer).toEqual({ idUser: 7, displayName: 'María G.' });
    expect(result[3].customer).toEqual({ idUser: 99, displayName: 'Cliente eliminado' });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('maria@example.com');
    expect(serialized).not.toContain('Gómez');
    expect(serialized).not.toContain('secret-hash');
    for (const order of result) {
      expect(Object.keys(order.customer).sort()).toEqual(['displayName', 'idUser']);
    }
  });
});
