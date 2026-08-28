/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: proves `CancelOrderUseCase` against the real Sequelize adapters
 * (`SequelizeUnitOfWork`, `SequelizeOrderRepository`,
 * `SequelizeProductRepository`) over a live MySQL 8. Closes tasks.md 12.5:
 * cancel is the one admin path that composes a guarded conditional `UPDATE`
 * (the AWAITING_PAYMENT -> CANCELLED transition) with N `adjustStock` calls
 * (stock restoration) inside ONE shared transaction
 * (`UnitOfWorkPort.runInTransaction`). A mocked/fake `UnitOfWork`
 * (`CancelOrderUseCase.test.ts`) cannot prove these actually share one real
 * database transaction — that is the gap this file closes.
 *
 * Filename matches tasks.md 12.5's exact invocation:
 * `cd backend && npm run test:integration -- cancel-restock`.
 *
 * This file is excluded from the default `npm test` run (see
 * `jest.config.js`'s `testPathIgnorePatterns`) and only runs via
 * `npm run test:integration`, which requires a reachable MySQL/MariaDB
 * (`DB_HOST`/`DB_USER`/`DB_PASS` env vars, see `database/config/config.js`).
 */
import { CreateOrderUseCase } from '../application/use-cases/CreateOrderUseCase';
import { CancelOrderUseCase } from '../application/use-cases/CancelOrderUseCase';
import { SequelizeUnitOfWork } from '../infrastructure/persistence/SequelizeUnitOfWork';
import { SequelizeOrderRepository } from '../infrastructure/repositories/SequelizeOrderRepository';
import { SequelizeShoppingCartRepository } from '../infrastructure/repositories/SequelizeShoppingCartRepository';
import { SequelizeProductRepository } from '../infrastructure/repositories/SequelizeProductRepository';
import { ManualPaymentGateway } from '../infrastructure/payments/ManualPaymentGateway';
import { TransactionContext } from '../domain/ports/UnitOfWorkPort';
import { OrderStatus } from '../domain/entities/Order';
import { IllegalOrderTransitionException } from '../domain/exceptions/IllegalOrderTransitionException';
import { LoggerPort } from '../domain/ports/LoggerPort';
import { bootstrapTestDatabase, closeTestDatabase, readProductStock, getTestDb } from './helpers/testDb';
import { seedCheckoutFixture, cleanupCheckoutFixture, CheckoutFixture } from './helpers/orderTestDb';

jest.setTimeout(30000);

class NoopLogger implements LoggerPort {
  info(): void {}
  warn(): void {}
  error(): void {}
}

function buildCreateOrderUseCase(): CreateOrderUseCase {
  return new CreateOrderUseCase(
    new SequelizeUnitOfWork(),
    new SequelizeOrderRepository(),
    new SequelizeShoppingCartRepository(),
    new SequelizeProductRepository(),
    new ManualPaymentGateway(),
    new NoopLogger()
  );
}

function buildCancelUseCase(productRepo: SequelizeProductRepository = new SequelizeProductRepository()): CancelOrderUseCase {
  return new CancelOrderUseCase(new SequelizeUnitOfWork(), new SequelizeOrderRepository(), productRepo);
}

async function readOrderStatus(idOrder: number): Promise<string | null> {
  const db = getTestDb();
  const instance = await db.Order.findByPk(idOrder);
  return instance ? instance.orderStatus : null;
}

describe('CancelOrderUseCase — real DB, real adapters', () => {
  beforeAll(async () => {
    await bootstrapTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('cancel-then-restock', () => {
    let fixture: CheckoutFixture;
    let idOrder: number;

    beforeEach(async () => {
      // Two line items so a mid-transaction failure on the second item can
      // prove the first item's already-applied restock is also rolled back.
      fixture = await seedCheckoutFixture([5, 8], [2, 3]);
      const dto = await buildCreateOrderUseCase().execute(fixture.userId, 'cancel-restock-checkout-key');
      idOrder = dto.idOrder;
    });

    afterEach(async () => {
      await cleanupCheckoutFixture(fixture);
    });

    it('restores exactly the previously-decremented stock for every line item, atomically, and transitions the order to CANCELLED', async () => {
      // Sanity: checkout actually decremented both products.
      expect(await readProductStock(fixture.productIds[0])).toBe(3); // 5 - 2
      expect(await readProductStock(fixture.productIds[1])).toBe(5); // 8 - 3

      const dto = await buildCancelUseCase().execute(idOrder);

      expect(dto.status).toBe(OrderStatus.CANCELLED);
      expect(await readOrderStatus(idOrder)).toBe(OrderStatus.CANCELLED);
      expect(await readProductStock(fixture.productIds[0])).toBe(5);
      expect(await readProductStock(fixture.productIds[1])).toBe(8);
    });

    it('is a no-op on a second cancel of an already-cancelled order: rejects, and does not restore stock a second time', async () => {
      await buildCancelUseCase().execute(idOrder);
      expect(await readProductStock(fixture.productIds[0])).toBe(5);
      expect(await readProductStock(fixture.productIds[1])).toBe(8);

      await expect(buildCancelUseCase().execute(idOrder)).rejects.toThrow(IllegalOrderTransitionException);

      expect(await readOrderStatus(idOrder)).toBe(OrderStatus.CANCELLED);
      expect(await readProductStock(fixture.productIds[0])).toBe(5);
      expect(await readProductStock(fixture.productIds[1])).toBe(8);
    });

    it('rolls back the whole transaction atomically when a restock step fails mid-transaction: the transition guard UPDATE and any already-applied restock are both undone', async () => {
      // Real DB, real UnitOfWork/OrderRepository. Only `adjustStock` is
      // instrumented: the first call runs the REAL implementation (so its
      // effect is genuinely applied inside the transaction), the second
      // call simulates a runtime failure (e.g. a dropped connection) — a
      // realistic mid-transaction fault that the guarded raw UPDATE queries
      // used elsewhere in this codebase cannot trigger naturally, since a
      // positive restock delta can never violate their `>= 0` floor guard.
      const productRepo = new SequelizeProductRepository();
      const realAdjustStock = productRepo.adjustStock.bind(productRepo);
      const adjustStockSpy = jest
        .spyOn(productRepo, 'adjustStock')
        .mockImplementationOnce((id: number, delta: number, tx?: TransactionContext) => realAdjustStock(id, delta, tx))
        .mockImplementationOnce(() => {
          throw new Error('simulated mid-transaction failure (e.g. a dropped connection)');
        });

      await expect(buildCancelUseCase(productRepo).execute(idOrder)).rejects.toThrow(
        'simulated mid-transaction failure'
      );

      // Whole transaction rolled back: the order stays AWAITING_PAYMENT AND
      // BOTH products' stock stays at the post-checkout decremented level —
      // including the first item, whose restock DID run before the failure
      // but must be undone with everything else in the same transaction.
      expect(await readOrderStatus(idOrder)).toBe(OrderStatus.AWAITING_PAYMENT);
      expect(await readProductStock(fixture.productIds[0])).toBe(3);
      expect(await readProductStock(fixture.productIds[1])).toBe(5);

      adjustStockSpy.mockRestore();
    });
  });
});
