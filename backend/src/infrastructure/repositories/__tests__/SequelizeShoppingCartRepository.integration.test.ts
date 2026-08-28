/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: proves that `SequelizeShoppingCartRepository.syncCart()` (a plain
 * DELETE-then-INSERT in one transaction, no version token) resolves two
 * overlapping `syncCart` calls for the same user by commit order, never by
 * merging their rows — the documented, accepted last-write-wins tradeoff
 * (see `openspec/changes/concurrency-tests/specs/concurrency-guarantees/spec.md`).
 *
 * NO PRODUCTION CODE CHANGES. This file only characterizes existing behavior
 * of `SequelizeShoppingCartRepository`.
 *
 * This file is excluded from the default `npm test` run (see
 * `jest.config.js`'s `testPathIgnorePatterns`) and only runs via
 * `npm run test:integration`, which requires a reachable MySQL/MariaDB
 * (`DB_HOST`/`DB_USER`/`DB_PASS` env vars, see `database/config/config.js`).
 */
import { SequelizeShoppingCartRepository } from '../SequelizeShoppingCartRepository';
import { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import {
  bootstrapTestDatabase,
  closeTestDatabase,
  seedCartFixture,
  cleanupCartFixture,
  readActiveCartRows,
  getTestDb,
  TestCartFixture,
  CartRow,
} from '../../../__tests__/helpers/testDb';

jest.setTimeout(30000);

const CONCURRENCY_ERROR_CODES = ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'];

function normalize(items: CartRow[]): CartRow[] {
  return [...items]
    .map((item) => ({ idProduct: item.idProduct, quantity: item.quantity, unitPrice: Number(item.unitPrice) }))
    .sort((a, b) => a.idProduct - b.idProduct);
}

describe('SequelizeShoppingCartRepository.syncCart — real DB concurrency', () => {
  const repository = new SequelizeShoppingCartRepository();

  beforeAll(async () => {
    await bootstrapTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('concurrent syncCart calls for the same user (forced contention)', () => {
    let fixture: TestCartFixture;

    beforeEach(async () => {
      fixture = await seedCartFixture();
    });

    afterEach(async () => {
      await cleanupCartFixture(fixture);
    });

    it('never corrupts the cart: at least one write wins, no merge, no partial rows', async () => {
      const [p1, p2, p3] = fixture.productIds;
      const payloadA = [
        { productId: p1, quantity: 1, unitPrice: 10.0 },
        { productId: p2, quantity: 2, unitPrice: 20.0 },
      ];
      const payloadB = [{ productId: p3, quantity: 7, unitPrice: 30.0 }];

      const db = getTestDb();

      // Barrier: hold the pre-existing ACTIVE row locked in our own
      // transaction so both syncCart DELETEs are forced to park behind it
      // instead of racing to interleave freely.
      const t0 = await db.sequelize.transaction();
      await db.ShoppingCart.findOne({
        where: { idUser: fixture.userId, cartStatus: 'ACTIVE' },
        transaction: t0,
        lock: t0.LOCK.UPDATE,
      });

      const racePromise = Promise.allSettled([
        repository.syncCart(fixture.userId, payloadA),
        repository.syncCart(fixture.userId, payloadB),
      ]);

      // Give both syncCart calls one macrotask to issue their DELETE and
      // park on T0's lock before we release it.
      await new Promise((resolve) => setImmediate(resolve));

      await t0.commit();

      const results = await racePromise;
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

      // Invariant 1: a race never loses both writes.
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);

      // Invariant 2: every rejection is a concurrency error — never
      // validation, FK, or connection failure.
      for (const failure of rejected) {
        const reason = failure.reason as { parent?: { code?: string } };
        expect(CONCURRENCY_ERROR_CODES).toContain(reason.parent?.code);
      }

      const rows = await readActiveCartRows(fixture.userId);
      const normalizedRows = normalize(rows);
      const normalizedA = normalize(payloadA.map((i) => ({ idProduct: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })));
      const normalizedB = normalize(payloadB.map((i) => ({ idProduct: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })));

      const matchesA = JSON.stringify(normalizedRows) === JSON.stringify(normalizedA);
      const matchesB = JSON.stringify(normalizedRows) === JSON.stringify(normalizedB);

      // Invariant 3: final rows deep-equal exactly A or exactly B — the
      // seeded pre-existing row is gone, never a union, never a partial mix,
      // never empty.
      expect(matchesA || matchesB).toBe(true);

      // Invariant 4: no leftovers or duplicates.
      const winnerLength = matchesA ? payloadA.length : payloadB.length;
      expect(rows.length).toBe(winnerLength);

      // Invariant 5: if exactly one call fulfilled, the persisted winner
      // must be that call's payload (fully deterministic sub-case).
      if (fulfilled.length === 1) {
        const aFulfilled = results[0].status === 'fulfilled';
        expect(matchesA).toBe(aFulfilled);
        expect(matchesB).toBe(!aFulfilled);
      }
    });
  });

  describe('sequential syncCart calls for the same user (documentation-grade)', () => {
    let fixture: TestCartFixture;

    beforeEach(async () => {
      fixture = await seedCartFixture();
    });

    afterEach(async () => {
      await cleanupCartFixture(fixture);
    });

    it('last write wins exactly when calls are sequential, not concurrent', async () => {
      const [p1, p2, p3] = fixture.productIds;
      const payloadA = [{ productId: p1, quantity: 3, unitPrice: 5.0 }];
      const payloadB = [
        { productId: p2, quantity: 4, unitPrice: 6.0 },
        { productId: p3, quantity: 1, unitPrice: 7.0 },
      ];

      await repository.syncCart(fixture.userId, payloadA);
      await repository.syncCart(fixture.userId, payloadB);

      const rows = await readActiveCartRows(fixture.userId);
      const expected = payloadB.map((i) => ({ idProduct: i.productId, quantity: i.quantity, unitPrice: i.unitPrice }));

      expect(normalize(rows)).toEqual(normalize(expected));
    });
  });

  // orders-checkout Work Unit 4, Phase 8.1: `findActiveForUpdate` must issue
  // `SELECT ... FOR UPDATE` against `ShoppingCart` ONLY — never combined with
  // an `include`, which Sequelize would extend across the join and lock
  // `Product` rows as an unintended side effect (design.md's explicit
  // rejection). Proven here against a real DB with a real concurrent
  // transaction, not a mock.
  describe('findActiveForUpdate — no include-triggered lock leaks onto Product', () => {
    let fixture: TestCartFixture;

    beforeEach(async () => {
      fixture = await seedCartFixture();
    });

    afterEach(async () => {
      await cleanupCartFixture(fixture);
    });

    it('does not block a concurrent transaction from locking the referenced Product row', async () => {
      const db = getTestDb();
      const [firstProductId] = fixture.productIds;

      const cartLockTx = await db.sequelize.transaction();
      try {
        await repository.findActiveForUpdate(fixture.userId, cartLockTx as unknown as TransactionContext);

        const productLockTx = await db.sequelize.transaction();
        try {
          const raceResult = await Promise.race([
            db.Product.findOne({
              where: { idProduct: firstProductId },
              transaction: productLockTx,
              lock: productLockTx.LOCK.UPDATE,
            }).then(() => 'LOCK_ACQUIRED'),
            new Promise((resolve) => setTimeout(() => resolve('TIMED_OUT'), 1500)),
          ]);

          // If the cart lock had leaked onto Product (the include-triggered
          // bug this test guards against), this second transaction's
          // `FOR UPDATE` on the same Product row would block until
          // `cartLockTx` released it, and we'd observe 'TIMED_OUT' instead.
          expect(raceResult).toBe('LOCK_ACQUIRED');
        } finally {
          await productLockTx.commit();
        }
      } finally {
        await cartLockTx.commit();
      }
    });
  });
});
