/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: proves that `SequelizeProductRepository.adjustStock()`'s atomic SQL
 * update (`UPDATE ... SET stock = stock + :delta WHERE id = :id AND
 * stock + :delta >= 0`, added in the CRITICAL-2 fix) actually holds up under
 * real concurrent load against a real MySQL/MariaDB — not just against the
 * mocked call-shape assertions in `SequelizeProductRepository.test.ts`.
 *
 * This file is excluded from the default `npm test` run (see
 * `jest.config.js`'s `testPathIgnorePatterns`) and only runs via
 * `npm run test:integration`, which requires a reachable MySQL/MariaDB
 * (`DB_HOST`/`DB_USER`/`DB_PASS` env vars, see `database/config/config.js`).
 */
import { SequelizeProductRepository } from '../SequelizeProductRepository';
import {
  bootstrapTestDatabase,
  closeTestDatabase,
  seedProductWithDependencies,
  cleanupProductFixture,
  readProductStock,
  TestProductFixture,
} from '../../../__tests__/helpers/testDb';

jest.setTimeout(30000);

describe('SequelizeProductRepository.adjustStock — real DB concurrency', () => {
  const repository = new SequelizeProductRepository();

  beforeAll(async () => {
    await bootstrapTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('concurrent decrements past the floor', () => {
    const INITIAL_STOCK = 10;
    const CONCURRENT_CALLS = 20;
    let fixture: TestProductFixture;

    beforeAll(async () => {
      fixture = await seedProductWithDependencies({ stock: INITIAL_STOCK });
    });

    afterAll(async () => {
      await cleanupProductFixture(fixture);
    });

    it('never lets stock go negative and never silently drops an update', async () => {
      // 20 concurrent `-1` calls against a starting stock of 10: if the old
      // read-then-write race existed, some of these could be lost updates
      // (stock ending up wrong/too high) or the floor guard could be
      // bypassed (stock ending up negative). With the atomic UPDATE fix,
      // exactly 10 must succeed and exactly 10 must be rejected.
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_CALLS }, () => repository.adjustStock(fixture.productId, -1))
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );

      // (c) every rejection must be the exact floor-guard error, not some
      // other failure mode (e.g. a connection error masquerading as success).
      for (const failure of rejected) {
        expect(failure.reason).toBeInstanceOf(Error);
        expect((failure.reason as Error).message).toBe('Insufficient stock');
      }

      const finalStock = await readProductStock(fixture.productId);

      // (a) final persisted stock is exactly 0 — not negative, not stale.
      expect(finalStock).toBe(0);

      // (b) successes + final stock reconstructs the original stock exactly
      // — proves no concurrent write was silently lost.
      expect(fulfilled.length + (finalStock as number)).toBe(INITIAL_STOCK);
      expect(fulfilled.length).toBe(INITIAL_STOCK);
      expect(rejected.length).toBe(CONCURRENT_CALLS - INITIAL_STOCK);
    });
  });

  describe('concurrent non-conflicting reads/writes', () => {
    const INITIAL_STOCK = 50;
    let fixture: TestProductFixture;

    beforeAll(async () => {
      fixture = await seedProductWithDependencies({ stock: INITIAL_STOCK });
    });

    afterAll(async () => {
      await cleanupProductFixture(fixture);
    });

    it('sums concurrent positive and negative deltas exactly when the floor is never crossed', async () => {
      // Mix of increments/decrements that can never cross 0 even in the
      // worst-case sequential ordering (50 - 10*3 = 20 >= 0), so all calls
      // must succeed and the final stock must be the exact arithmetic sum —
      // proving concurrent non-conflicting writes aren't losing each other.
      const increments = Array.from({ length: 10 }, () => repository.adjustStock(fixture.productId, 5));
      const decrements = Array.from({ length: 10 }, () => repository.adjustStock(fixture.productId, -3));

      await Promise.all([...increments, ...decrements]);

      const finalStock = await readProductStock(fixture.productId);
      const expectedStock = INITIAL_STOCK + 10 * 5 + 10 * -3;

      expect(finalStock).toBe(expectedStock);
    });
  });
});
