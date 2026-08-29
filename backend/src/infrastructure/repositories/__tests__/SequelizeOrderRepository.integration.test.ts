/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: proves `SequelizeOrderRepository.findByUserId`'s `distinct: true`
 * is load-bearing against a real MySQL/MariaDB. Without it, the `items`
 * hasMany include makes `findAndCountAll` count joined item rows instead of
 * orders — a multi-item order silently inflates `total`. The mocked
 * `SequelizeOrderRepository.test.ts` only proves the call shape; this proves
 * the actual counted number against a real query.
 *
 * This file is excluded from the default `npm test` run (see
 * `jest.config.js`'s `testPathIgnorePatterns`) and only runs via
 * `npm run test:integration`, which requires a reachable MySQL/MariaDB
 * (`DB_HOST`/`DB_USER`/`DB_PASS` env vars, see `database/config/config.js`).
 */
import { SequelizeOrderRepository } from '../SequelizeOrderRepository';
import { bootstrapTestDatabase, closeTestDatabase } from '../../../__tests__/helpers/testDb';
import {
  seedBuyerWithOrders,
  cleanupOrderHistoryFixture,
  OrderHistoryFixture,
} from '../../../__tests__/helpers/orderHistoryTestDb';

jest.setTimeout(30000);

describe('SequelizeOrderRepository.findByUserId — real DB', () => {
  const repository = new SequelizeOrderRepository();

  beforeAll(async () => {
    await bootstrapTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('distinct:true count proof', () => {
    let fixture: OrderHistoryFixture;
    let otherUserFixture: OrderHistoryFixture;

    beforeAll(async () => {
      // Two orders for the buyer: one with a single item, one with 3 items.
      // Without `distinct: true`, the joined-row count for this buyer would
      // be 1 + 3 = 4, not the real order count of 2.
      fixture = await seedBuyerWithOrders([1, 3]);
      // A second buyer's order must never leak into the first buyer's count
      // or result set (scoping).
      otherUserFixture = await seedBuyerWithOrders([2]);
    });

    afterAll(async () => {
      await cleanupOrderHistoryFixture(fixture);
      await cleanupOrderHistoryFixture(otherUserFixture);
    });

    it('counts orders, not joined item rows, for a buyer with a genuinely multi-item order', async () => {
      const result = await repository.findByUserId(fixture.userId, { limit: 20, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.orders).toHaveLength(2);
    });

    it('scopes strictly to the requesting user regardless of another user having orders too', async () => {
      const result = await repository.findByUserId(fixture.userId, { limit: 20, offset: 0 });

      const returnedIds = result.orders.map((order) => order.idOrder);
      expect(returnedIds).toEqual(expect.arrayContaining(fixture.orderIds));
      for (const otherOrderId of otherUserFixture.orderIds) {
        expect(returnedIds).not.toContain(otherOrderId);
      }
    });

    it('orders newest-first (idOrder DESC)', async () => {
      const result = await repository.findByUserId(fixture.userId, { limit: 20, offset: 0 });

      const ids = result.orders.map((order) => order.idOrder);
      expect(ids).toEqual([...ids].sort((a, b) => b - a));
    });

    it('windows parent orders (not joined rows) via limit/offset, while total stays the full order count', async () => {
      const firstPage = await repository.findByUserId(fixture.userId, { limit: 1, offset: 0 });
      const secondPage = await repository.findByUserId(fixture.userId, { limit: 1, offset: 1 });

      expect(firstPage.orders).toHaveLength(1);
      expect(firstPage.total).toBe(2);
      expect(secondPage.orders).toHaveLength(1);
      expect(secondPage.total).toBe(2);
      expect(firstPage.orders[0].idOrder).not.toBe(secondPage.orders[0].idOrder);
    });

    it('still eager-loads items on every returned order (Order entity construction requires at least one item)', async () => {
      const result = await repository.findByUserId(fixture.userId, { limit: 20, offset: 0 });

      const multiItemOrder = result.orders.find((order) => order.items.length === 3);
      expect(multiItemOrder).toBeDefined();
      expect(multiItemOrder?.totalAmount).toBeGreaterThan(0);
    });
  });
});
