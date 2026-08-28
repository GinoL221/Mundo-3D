/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: proves `CreateOrderUseCase` end-to-end through the real Sequelize
 * adapters (`SequelizeUnitOfWork`, `SequelizeOrderRepository`,
 * `SequelizeShoppingCartRepository`, `SequelizeProductRepository`,
 * `ManualPaymentGateway`) against a live MySQL 8 — the load-bearing
 * correctness points design.md calls out for Work Unit 4: all-or-nothing
 * rollback, the `FOR UPDATE` cart lock serializing concurrent checkouts,
 * idempotency-key replay, in-place `markOrdered`, and the `ON DELETE SET
 * NULL` regression that keeps `DELETE /api/products/:id` returning 204.
 *
 * This file is excluded from the default `npm test` run (see
 * `jest.config.js`'s `testPathIgnorePatterns`) and only runs via
 * `npm run test:integration`, which requires a reachable MySQL/MariaDB
 * (`DB_HOST`/`DB_USER`/`DB_PASS` env vars, see `database/config/config.js`).
 */
import { CreateOrderUseCase } from '../application/use-cases/CreateOrderUseCase';
import { DeleteProductUseCase } from '../application/use-cases/DeleteProductUseCase';
import { SequelizeUnitOfWork } from '../infrastructure/persistence/SequelizeUnitOfWork';
import { SequelizeOrderRepository } from '../infrastructure/repositories/SequelizeOrderRepository';
import { SequelizeShoppingCartRepository } from '../infrastructure/repositories/SequelizeShoppingCartRepository';
import { SequelizeProductRepository } from '../infrastructure/repositories/SequelizeProductRepository';
import { ManualPaymentGateway } from '../infrastructure/payments/ManualPaymentGateway';
import { EmptyCartException } from '../domain/exceptions/EmptyCartException';
import { InsufficientStockException } from '../domain/exceptions/InsufficientStockException';
import { DuplicateIdempotencyKeyException } from '../domain/exceptions/DuplicateIdempotencyKeyException';
import { LoggerPort } from '../domain/ports/LoggerPort';
import {
  bootstrapTestDatabase,
  closeTestDatabase,
  readProductStock,
  getTestDb,
} from './helpers/testDb';
import {
  seedCheckoutFixture,
  cleanupCheckoutFixture,
  readActiveCartCount,
  readCartRowById,
  countOrdersForUser,
  CheckoutFixture,
} from './helpers/orderTestDb';

jest.setTimeout(30000);

class NoopLogger implements LoggerPort {
  info(): void {}
  warn(): void {}
  error(): void {}
}

function buildUseCase(): CreateOrderUseCase {
  return new CreateOrderUseCase(
    new SequelizeUnitOfWork(),
    new SequelizeOrderRepository(),
    new SequelizeShoppingCartRepository(),
    new SequelizeProductRepository(),
    new ManualPaymentGateway(),
    new NoopLogger()
  );
}

describe('CreateOrderUseCase — real DB, real adapters', () => {
  beforeAll(async () => {
    await bootstrapTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('all-or-nothing rollback on insufficient stock', () => {
    let fixture: CheckoutFixture;

    beforeEach(async () => {
      // Product A has enough stock (5, requests 2); Product B does not (1, requests 3).
      fixture = await seedCheckoutFixture([5, 1], [2, 3]);
    });

    afterEach(async () => {
      await cleanupCheckoutFixture(fixture);
    });

    it('leaves stock and the ACTIVE cart completely untouched and creates no order', async () => {
      const useCase = buildUseCase();

      await expect(useCase.execute(fixture.userId, 'shortage-key')).rejects.toThrow(InsufficientStockException);

      expect(await readProductStock(fixture.productIds[0])).toBe(5);
      expect(await readProductStock(fixture.productIds[1])).toBe(1);
      expect(await readActiveCartCount(fixture.userId)).toBe(2);
      expect(await countOrdersForUser(fixture.userId)).toBe(0);
    });
  });

  describe('happy path commit + in-place markOrdered', () => {
    let fixture: CheckoutFixture;
    let cartRowIdBefore: number;

    beforeEach(async () => {
      fixture = await seedCheckoutFixture([5], [2]);
      const db = getTestDb();
      const row = await db.ShoppingCart.findOne({ where: { idUser: fixture.userId, cartStatus: 'ACTIVE' } });
      cartRowIdBefore = row.idCart;
    });

    afterEach(async () => {
      await cleanupCheckoutFixture(fixture);
    });

    it('decrements stock, creates an AWAITING_PAYMENT order with a payment reference, and updates the cart row in place (never reinserts)', async () => {
      const useCase = buildUseCase();

      const dto = await useCase.execute(fixture.userId, 'happy-key');

      expect(dto.status).toBe('AWAITING_PAYMENT');
      expect(dto.totalAmount).toBe(20);
      expect(dto.paymentReference).toEqual(expect.stringContaining(String(dto.idOrder)));
      expect(await readProductStock(fixture.productIds[0])).toBe(3);
      expect(await readActiveCartCount(fixture.userId)).toBe(0);
      expect(await countOrdersForUser(fixture.userId)).toBe(1);

      // `markOrdered` must UPDATE the existing row, never delete+recreate —
      // the same `id_cart` persists, just with a flipped status.
      const rowAfter = await readCartRowById(cartRowIdBefore);
      expect(rowAfter).toEqual({ idCart: cartRowIdBefore, cartStatus: 'ORDERED' });
    });

    it('idempotent replay: a second call with the same key returns the original order without a second stock decrement', async () => {
      const useCase = buildUseCase();

      const first = await useCase.execute(fixture.userId, 'replay-key');
      const stockAfterFirst = await readProductStock(fixture.productIds[0]);

      const second = await useCase.execute(fixture.userId, 'replay-key');

      expect(second.idOrder).toBe(first.idOrder);
      expect(await readProductStock(fixture.productIds[0])).toBe(stockAfterFirst);
      expect(await countOrdersForUser(fixture.userId)).toBe(1);
    });
  });

  describe("price freeze: the committed order uses the cart row's unit_price, not the product's current price", () => {
    let fixture: CheckoutFixture;

    beforeEach(async () => {
      // Product is seeded at price 10 (seedCheckoutFixture's per-index
      // price); the cart row is deliberately overridden to a different
      // price (80), simulating a product price change that happened after
      // the item was added to the cart.
      fixture = await seedCheckoutFixture([5], [2], [80]);
    });

    afterEach(async () => {
      await cleanupCheckoutFixture(fixture);
    });

    it("commits the order line item at the cart's frozen unit_price (80), never the product's current price (10)", async () => {
      const useCase = buildUseCase();

      const dto = await useCase.execute(fixture.userId, 'price-freeze-key');

      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].unitPrice).toBe(80);
      expect(dto.totalAmount).toBe(160);

      const db = getTestDb();
      const product = await db.Product.findByPk(fixture.productIds[0]);
      expect(Number(product.price)).toBe(10);
    });
  });

  describe('FOR UPDATE cart lock serializes concurrent checkouts', () => {
    let fixture: CheckoutFixture;

    beforeEach(async () => {
      fixture = await seedCheckoutFixture([5], [1]);
    });

    afterEach(async () => {
      await cleanupCheckoutFixture(fixture);
    });

    it('two concurrent checkouts from the same user yield exactly one committed order; the loser sees an empty cart', async () => {
      const useCaseA = buildUseCase();
      const useCaseB = buildUseCase();

      const results = await Promise.allSettled([
        useCaseA.execute(fixture.userId, 'race-key-a'),
        useCaseB.execute(fixture.userId, 'race-key-b'),
      ]);

      const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof useCaseA.execute>>> => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(EmptyCartException);
      expect(await countOrdersForUser(fixture.userId)).toBe(1);
      // Exactly one decrement happened, never two.
      expect(await readProductStock(fixture.productIds[0])).toBe(4);
    });
  });

  describe('SequelizeOrderRepository real UNIQUE(id_user, idempotency_key) violation', () => {
    let fixture: CheckoutFixture;

    beforeEach(async () => {
      fixture = await seedCheckoutFixture([5], [1]);
    });

    afterEach(async () => {
      await cleanupCheckoutFixture(fixture);
    });

    it('a second createWithItems call with the same key throws DuplicateIdempotencyKeyException against the real UNIQUE constraint', async () => {
      const uow = new SequelizeUnitOfWork();
      const orderRepo = new SequelizeOrderRepository();
      const items = [{ idProduct: fixture.productIds[0], productName: 'Checkout Product 1', quantity: 1, unitPrice: 10 }];

      await uow.runInTransaction((tx) =>
        orderRepo.createWithItems({ idUser: fixture.userId, idempotencyKey: 'dup-key', items }, tx)
      );

      await expect(
        uow.runInTransaction((tx) => orderRepo.createWithItems({ idUser: fixture.userId, idempotencyKey: 'dup-key', items }, tx))
      ).rejects.toThrow(DuplicateIdempotencyKeyException);

      expect(await countOrdersForUser(fixture.userId)).toBe(1);
    });
  });

  describe('DELETE /api/products/:id regression (ON DELETE SET NULL)', () => {
    let fixture: CheckoutFixture;

    beforeEach(async () => {
      fixture = await seedCheckoutFixture([5], [1]);
    });

    afterEach(async () => {
      // The product row is already gone by the time this runs — only clean
      // up the rest of the fixture (cleanupCheckoutFixture tolerates an
      // already-deleted product via `deleteTestProduct`'s safe `destroy`).
      await cleanupCheckoutFixture(fixture);
    });

    it('still returns true (the exact value ProductApiController.destroy maps to 204) for a product that has been ordered, and the surviving OrderItem keeps id_product NULL + its product_name snapshot', async () => {
      const useCase = buildUseCase();
      const dto = await useCase.execute(fixture.userId, 'delete-regression-key');
      const [idProduct] = fixture.productIds;
      const originalProductName = dto.items[0].productName;

      const deleteProductUseCase = new DeleteProductUseCase(new SequelizeProductRepository());
      const deleted = await deleteProductUseCase.execute(idProduct);

      expect(deleted).toBe(true);

      const db = getTestDb();
      const survivingItem = await db.OrderItem.findOne({ where: { idOrder: dto.idOrder } });
      expect(survivingItem).not.toBeNull();
      expect(survivingItem.idProduct).toBeNull();
      expect(survivingItem.productName).toBe(originalProductName);
    });
  });
});
