import { CreateOrderUseCase } from '../use-cases/CreateOrderUseCase';
import {
  UnitOfWorkPort,
  TransactionContext,
} from '../../domain/ports/UnitOfWorkPort';
import { OrderRepositoryPort, NewOrderItemInput } from '../../domain/ports/OrderRepositoryPort';
import { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { PaymentGatewayPort, PaymentIntent, InitiatePaymentInput } from '../../domain/ports/PaymentGatewayPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';
import { EmptyCartException } from '../../domain/exceptions/EmptyCartException';
import { InsufficientStockException } from '../../domain/exceptions/InsufficientStockException';

// Hand-written in-memory fakes for all 6 collaborating ports. These are real
// stateful implementations (not jest.fn() mocks) because scenarios (d) and (e)
// need to observe ordering/replay behaviour across calls, not just arguments.

let callLog: string[];

class FakeUnitOfWork implements UnitOfWorkPort {
  transactionCount = 0;

  constructor(private readonly participants: { snapshot(): void; restore(): void }[]) {}

  async runInTransaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    for (const participant of this.participants) participant.snapshot();
    const tx = {} as TransactionContext;
    try {
      const result = await work(tx);
      callLog.push('transaction:commit');
      return result;
    } catch (error) {
      for (const participant of this.participants) participant.restore();
      throw error;
    }
  }
}

class FakeOrderRepository implements OrderRepositoryPort {
  private orders: Order[] = [];
  private nextId = 1;
  private snapshotState: Order[] | null = null;
  createWithItemsCalls = 0;
  attachPaymentReferenceCalls: { idOrder: number; reference: string }[] = [];

  snapshot(): void {
    this.snapshotState = [...this.orders];
  }

  restore(): void {
    if (this.snapshotState) this.orders = [...this.snapshotState];
  }

  async createWithItems(
    input: { idUser: number; idempotencyKey: string; items: NewOrderItemInput[] },
    _tx: TransactionContext
  ): Promise<Order> {
    this.createWithItemsCalls += 1;
    const idOrder = this.nextId++;
    const items = input.items.map(
      (item, index) =>
        new OrderItem(idOrder * 100 + index, idOrder, item.idProduct, item.productName, item.quantity, item.unitPrice)
    );
    const order = new Order(idOrder, input.idUser, input.idempotencyKey, OrderStatus.AWAITING_PAYMENT, items, new Date());
    this.orders.push(order);
    return order;
  }

  async findByIdempotencyKey(idUser: number, idempotencyKey: string): Promise<Order | null> {
    return this.orders.find((o) => o.idUser === idUser && o.idempotencyKey === idempotencyKey) ?? null;
  }

  async findById(idOrder: number): Promise<Order | null> {
    return this.orders.find((o) => o.idOrder === idOrder) ?? null;
  }

  async findAll(): Promise<Order[]> {
    return [...this.orders];
  }

  async transitionStatus(idOrder: number, from: OrderStatus, to: OrderStatus): Promise<boolean> {
    const index = this.orders.findIndex((o) => o.idOrder === idOrder && o.status === from);
    if (index === -1) return false;
    const current = this.orders[index];
    this.orders[index] = new Order(current.idOrder, current.idUser, current.idempotencyKey, to, current.items, current.createdAt, current.paymentReference);
    return true;
  }

  async attachPaymentReference(idOrder: number, reference: string): Promise<void> {
    this.attachPaymentReferenceCalls.push({ idOrder, reference });
    const index = this.orders.findIndex((o) => o.idOrder === idOrder);
    if (index === -1) return;
    const current = this.orders[index];
    this.orders[index] = new Order(current.idOrder, current.idUser, current.idempotencyKey, current.status, current.items, current.createdAt, reference);
  }
}

class FakeShoppingCartRepository implements ShoppingCartRepositoryPort {
  private snapshotState: ShoppingCart[] | null = null;
  markOrderedCalls: { userId: number; cartIds: number[] }[] = [];

  constructor(private rows: ShoppingCart[]) {}

  snapshot(): void {
    this.snapshotState = [...this.rows];
  }

  restore(): void {
    if (this.snapshotState) this.rows = [...this.snapshotState];
  }

  async findByUserId(userId: number): Promise<ShoppingCart[]> {
    return this.rows.filter((r) => r.idUser === userId);
  }

  async getDistinctCount(userId: number): Promise<number> {
    return this.rows.filter((r) => r.idUser === userId).length;
  }

  async syncCart(): Promise<void> {
    throw new Error('syncCart is not exercised by checkout');
  }

  async findActiveForUpdate(userId: number): Promise<ShoppingCart[]> {
    return this.rows.filter((r) => r.idUser === userId && r.status === CartStatus.ACTIVE);
  }

  async markOrdered(userId: number, cartIds: number[]): Promise<number> {
    this.markOrderedCalls.push({ userId, cartIds });
    let affected = 0;
    this.rows = this.rows.map((r) => {
      if (r.idUser === userId && cartIds.includes(r.idCart) && r.status === CartStatus.ACTIVE) {
        affected += 1;
        return new ShoppingCart(r.idCart, r.idUser, r.idProduct, r.quantity, r.unitPrice, CartStatus.ORDERED, r.product);
      }
      return r;
    });
    return affected;
  }
}

class FakeProductRepository implements ProductRepositoryPort {
  private snapshotState: Map<number, Product> | null = null;

  constructor(private products: Map<number, Product>) {}

  snapshot(): void {
    this.snapshotState = new Map(this.products);
  }

  restore(): void {
    if (this.snapshotState) this.products = new Map(this.snapshotState);
  }

  async findAll(): Promise<Product[]> {
    return [...this.products.values()];
  }

  async findById(id: number): Promise<Product | null> {
    return this.products.get(id) ?? null;
  }

  async findLatest(): Promise<Product | null> {
    return null;
  }

  async create(): Promise<Product> {
    throw new Error('create is not exercised by checkout');
  }

  async update(): Promise<Product | null> {
    throw new Error('update is not exercised by checkout');
  }

  async delete(): Promise<boolean> {
    throw new Error('delete is not exercised by checkout');
  }

  async adjustStock(id: number, delta: number): Promise<Product | null> {
    const product = this.products.get(id);
    if (!product) return null;
    const nextStock = (product.stock ?? 0) + delta;
    if (nextStock < 0) {
      throw new Error('Insufficient stock');
    }
    const updated = new Product(
      product.idProduct,
      product.nameProduct,
      product.price,
      product.descriptionProduct,
      product.image,
      product.idCategory,
      product.idFranchise,
      product.Category,
      product.Franchise,
      product.material,
      product.height,
      product.width,
      product.depth,
      product.finish,
      product.productionTime,
      nextStock
    );
    this.products.set(id, updated);
    return updated;
  }
}

class FakePaymentGateway implements PaymentGatewayPort {
  initiateCalls: InitiatePaymentInput[] = [];
  shouldFail = false;

  async initiate(input: InitiatePaymentInput): Promise<PaymentIntent> {
    callLog.push('gateway:initiate');
    this.initiateCalls.push(input);
    if (this.shouldFail) {
      throw new Error('gateway unreachable');
    }
    return { reference: `pay-${input.orderId}`, status: 'PENDING' };
  }

  async confirm(reference: string): Promise<PaymentIntent> {
    return { reference, status: 'CONFIRMED' };
  }

  async cancel(reference: string): Promise<PaymentIntent> {
    return { reference, status: 'CANCELLED' };
  }
}

class FakeLogger implements LoggerPort {
  warnCalls: { obj: object; msg?: string }[] = [];
  info(): void {}
  warn(obj: object, msg?: string): void {
    this.warnCalls.push({ obj, msg });
  }
  error(): void {}
}

function makeProduct(id: number, name: string, stock: number): Product {
  return new Product(id, name, 100, 'desc', 'img.png', 1, 1, undefined, undefined, null, null, null, null, null, null, stock);
}

function makeCartRow(idCart: number, idUser: number, product: Product, quantity: number, unitPrice = product.price): ShoppingCart {
  return new ShoppingCart(idCart, idUser, product.idProduct, quantity, unitPrice, CartStatus.ACTIVE, product);
}

describe('CreateOrderUseCase', () => {
  const userId = 5;

  beforeEach(() => {
    callLog = [];
  });

  function build(cartRows: ShoppingCart[], products: Product[]) {
    const cartRepo = new FakeShoppingCartRepository(cartRows);
    const productRepo = new FakeProductRepository(new Map(products.map((p) => [p.idProduct, p])));
    const orderRepo = new FakeOrderRepository();
    const uow = new FakeUnitOfWork([cartRepo, productRepo, orderRepo]);
    const paymentGateway = new FakePaymentGateway();
    const logger = new FakeLogger();
    const useCase = new CreateOrderUseCase(uow, orderRepo, cartRepo, productRepo, paymentGateway, logger);
    return { useCase, uow, orderRepo, cartRepo, productRepo, paymentGateway, logger };
  }

  it('(a) happy path: creates an AWAITING_PAYMENT order, marks the locked cart rows ORDERED, and attaches the payment reference', async () => {
    const productA = makeProduct(10, 'Figure A', 5);
    const productB = makeProduct(20, 'Figure B', 3);
    const cartRows = [makeCartRow(1, userId, productA, 2), makeCartRow(2, userId, productB, 1)];
    const { useCase, orderRepo, cartRepo, paymentGateway } = build(cartRows, [productA, productB]);

    const dto = await useCase.execute(userId, 'key-1');

    expect(dto.status).toBe(OrderStatus.AWAITING_PAYMENT);
    expect(dto.items).toHaveLength(2);
    expect(dto.totalAmount).toBe(300);
    expect(cartRepo.markOrderedCalls).toEqual([{ userId, cartIds: [1, 2] }]);
    expect(orderRepo.createWithItemsCalls).toBe(1);
    expect(paymentGateway.initiateCalls).toHaveLength(1);
    expect(orderRepo.attachPaymentReferenceCalls).toEqual([{ idOrder: dto.idOrder, reference: `pay-${dto.idOrder}` }]);
    expect(dto.paymentReference).toBe(`pay-${dto.idOrder}`);
  });

  it('(b) rejects with EmptyCartException when the ACTIVE cart has zero rows, with no order/gateway side effects', async () => {
    const { useCase, orderRepo, paymentGateway } = build([], []);

    await expect(useCase.execute(userId, 'key-2')).rejects.toThrow(EmptyCartException);

    expect(orderRepo.createWithItemsCalls).toBe(0);
    expect(paymentGateway.initiateCalls).toHaveLength(0);
  });

  it('(c) all-or-nothing: collects every short line item, leaving stock and cart untouched', async () => {
    const productA = makeProduct(10, 'Figure A', 1); // requests 5, short
    const productB = makeProduct(20, 'Figure B', 10); // sufficient
    const productC = makeProduct(30, 'Figure C', 0); // requests 2, short
    const cartRows = [
      makeCartRow(1, userId, productA, 5),
      makeCartRow(2, userId, productB, 2),
      makeCartRow(3, userId, productC, 2),
    ];
    const { useCase, productRepo, cartRepo, orderRepo, paymentGateway } = build(cartRows, [productA, productB, productC]);

    let caught: InsufficientStockException | undefined;
    try {
      await useCase.execute(userId, 'key-3');
    } catch (error) {
      caught = error as InsufficientStockException;
    }

    expect(caught).toBeInstanceOf(InsufficientStockException);
    expect(caught?.shortages).toHaveLength(2);
    expect(caught?.shortages.map((s) => s.idProduct).sort()).toEqual([10, 30]);
    expect(caught?.shortages.find((s) => s.idProduct === 10)).toEqual({
      idProduct: 10,
      productName: 'Figure A',
      requested: 5,
      available: 1,
    });

    const restoredA = await productRepo.findById(10);
    const restoredB = await productRepo.findById(20);
    expect(restoredA?.stock).toBe(1);
    expect(restoredB?.stock).toBe(10);
    expect(cartRepo.markOrderedCalls).toHaveLength(0);
    expect(orderRepo.createWithItemsCalls).toBe(0);
    expect(paymentGateway.initiateCalls).toHaveLength(0);
  });

  it('(d) idempotent replay: a second call with the same key returns the original order without a new transaction or a duplicate gateway call', async () => {
    const productA = makeProduct(10, 'Figure A', 5);
    const cartRows = [makeCartRow(1, userId, productA, 1)];
    const { useCase, uow, paymentGateway } = build(cartRows, [productA]);

    const first = await useCase.execute(userId, 'shared-key');
    expect(uow.transactionCount).toBe(1);
    expect(paymentGateway.initiateCalls).toHaveLength(1);

    const second = await useCase.execute(userId, 'shared-key');

    expect(second.idOrder).toBe(first.idOrder);
    expect(uow.transactionCount).toBe(1);
    expect(paymentGateway.initiateCalls).toHaveLength(1);
  });

  it('(e) calls the payment gateway strictly after the transaction commits, never inside the transactional callback', async () => {
    const productA = makeProduct(10, 'Figure A', 5);
    const cartRows = [makeCartRow(1, userId, productA, 1)];
    const { useCase } = build(cartRows, [productA]);

    await useCase.execute(userId, 'key-5');

    expect(callLog).toEqual(['transaction:commit', 'gateway:initiate']);
  });

  it('(f) freezes the order line item price at the cart row\'s own unit_price, never re-reading the product\'s current price', async () => {
    // Product is priced 100 (see `makeProduct`), but the cart row carries a
    // deliberately different, stale price (80) — simulating a product price
    // change that happened after the item was added to the cart. The order
    // must record the cart's price, not the product's current one.
    const productA = makeProduct(10, 'Figure A', 5);
    const staleCartPrice = 80;
    const cartRows = [makeCartRow(1, userId, productA, 2, staleCartPrice)];
    const { useCase } = build(cartRows, [productA]);

    const dto = await useCase.execute(userId, 'key-price-freeze');

    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].unitPrice).toBe(staleCartPrice);
    expect(dto.items[0].unitPrice).not.toBe(productA.price);
    expect(dto.items[0].subtotal).toBe(staleCartPrice * 2);
    expect(dto.totalAmount).toBe(staleCartPrice * 2);
  });

  it('swallows a payment gateway failure after commit, logging a warning instead of rethrowing', async () => {
    const productA = makeProduct(10, 'Figure A', 5);
    const cartRows = [makeCartRow(1, userId, productA, 1)];
    const { useCase, paymentGateway, logger, orderRepo } = build(cartRows, [productA]);
    paymentGateway.shouldFail = true;

    const dto = await useCase.execute(userId, 'key-6');

    expect(dto.status).toBe(OrderStatus.AWAITING_PAYMENT);
    expect(logger.warnCalls).toHaveLength(1);
    expect(orderRepo.attachPaymentReferenceCalls).toHaveLength(0);
  });
});
