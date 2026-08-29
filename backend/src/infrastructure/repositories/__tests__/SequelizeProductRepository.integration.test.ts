/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: two independent concerns against `SequelizeProductRepository`,
 * sharing one bootstrap/close pair per this project's convention (see sibling
 * `*.integration.test.ts` files — each file bootstraps/closes the shared
 * `mundo_3d_test` database exactly once):
 *
 * - `adjustStock`: proves its atomic SQL update (`UPDATE ... SET stock =
 *   stock + :delta WHERE id = :id AND stock + :delta >= 0`, added in the
 *   CRITICAL-2 fix) actually holds up under real concurrent load against a
 *   real MySQL/MariaDB — not just against the mocked call-shape assertions
 *   in `SequelizeProductRepository.test.ts`.
 * - `searchPaged`: proves the WHERE clause behaves correctly against real
 *   rows — case-insensitive name/description matching, accent-insensitivity
 *   (inherited utf8mb4_unicode_ci collation), literal `%`/`_` escaping,
 *   deterministic pagination ordering, combined AND'd filters, and a real
 *   count assertion through the belongsTo `Category`/`Franchise` includes.
 *   `SequelizeProductRepository.test.ts` only pins the options object handed
 *   to the mocked `findAndCountAll`; this proves the rows MySQL actually
 *   returns, closing the gap sdd-verify found (its throwaway probe manually
 *   confirmed these same behaviors, then was deleted).
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
  createTestCategory,
  createTestFranchise,
  deleteTestProduct,
  deleteTestCategory,
  deleteTestFranchise,
  getTestDb,
  TestProductFixture,
} from '../../../__tests__/helpers/testDb';

jest.setTimeout(30000);

// Full-field product row for the searchPaged fixtures below. Not reused from
// testDb.ts's `createTestProduct` (which only overrides
// stock/nameProduct/price) because these scenarios need control over
// `descriptionProduct` too — built directly against the raw `db` escape
// hatch instead of widening a shared helper, per this task's "touch only
// this test file" scope.
async function createSearchTestProduct(
  categoryId: number,
  franchiseId: number,
  overrides: { nameProduct: string; descriptionProduct?: string }
): Promise<number> {
  const db = getTestDb();
  const product = await db.Product.create({
    nameProduct: overrides.nameProduct,
    descriptionProduct: overrides.descriptionProduct ?? 'n/a',
    price: 10.0,
    image: 'placeholder.jpg',
    idCategory: categoryId,
    idFranchise: franchiseId,
    stock: 0,
  });
  return product.idProduct;
}

describe('SequelizeProductRepository — real DB', () => {
  const repository = new SequelizeProductRepository();

  beforeAll(async () => {
    await bootstrapTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('adjustStock — real DB concurrency', () => {
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

  describe('searchPaged — real DB', () => {
    // Unique per test run so search terms can never accidentally match
    // pre-existing catalog rows (dev seed data, other integration files'
    // leftovers, etc.) — mirrors the token pattern sdd-verify's probe used
    // (`zzprobemascaraepsilon`).
    const token = `zzsearch${Date.now()}${Math.floor(Math.random() * 1e6)}`;

    let categoryId: number;
    let franchiseId: number;
    let otherCategoryId: number;
    let otherFranchiseId: number;
    const productIds: number[] = [];

    beforeAll(async () => {
      categoryId = await createTestCategory(`IntSearchCategory-${token}`);
      franchiseId = await createTestFranchise(`IntSearchFranchise-${token}`);
      otherCategoryId = await createTestCategory(`IntSearchOtherCategory-${token}`);
      otherFranchiseId = await createTestFranchise(`IntSearchOtherFranchise-${token}`);

      const track = async (promise: Promise<number>) => {
        const id = await promise;
        productIds.push(id);
        return id;
      };

      // Case-insensitive substring match on name_product.
      await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}GokuFigure` }));

      // Case-insensitive substring match on description_product (OR'd with name).
      await track(
        createSearchTestProduct(categoryId, franchiseId, {
          nameProduct: `${token}UnrelatedName`,
          descriptionProduct: `${token}SpecialDescriptionTerm`,
        })
      );

      // Accent-insensitive match: unaccented search term must match accented name
      // (inherited utf8mb4_unicode_ci collation).
      await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}ZZAccentMáscara` }));

      // Literal `%` escaping, with a decoy that would match if `%` were treated
      // as a wildcard instead of a literal character.
      await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}50% Off Figure` }));
      await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}5000 Off Figure` }));

      // Literal `_` escaping, with a decoy that would match if `_` were treated
      // as a single-character wildcard instead of a literal character.
      await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}a_b Figure` }));
      await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}axb Figure` }));

      // Deterministic ordering across pages: 5 rows sharing one search term.
      for (let i = 1; i <= 5; i += 1) {
        await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}PageOrderItem${i}` }));
      }

      // Combined filters: same search term, only one row matches ALL of
      // search + idCategory + idFranchise.
      await track(createSearchTestProduct(categoryId, franchiseId, { nameProduct: `${token}ComboItem` }));
      await track(createSearchTestProduct(otherCategoryId, franchiseId, { nameProduct: `${token}ComboItem` }));
      await track(createSearchTestProduct(categoryId, otherFranchiseId, { nameProduct: `${token}ComboItem` }));
    });

    afterAll(async () => {
      for (const productId of productIds) {
        await deleteTestProduct(productId);
      }
      await deleteTestFranchise(franchiseId);
      await deleteTestCategory(categoryId);
      await deleteTestFranchise(otherFranchiseId);
      await deleteTestCategory(otherCategoryId);
    });

    it('matches case-insensitively on name_product', async () => {
      const result = await repository.searchPaged({ search: `${token}gokufigure`, limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.products[0].nameProduct).toBe(`${token}GokuFigure`);
    });

    it('matches case-insensitively on description_product, OR-ed with name_product', async () => {
      const result = await repository.searchPaged({ search: `${token}specialdescriptionterm`, limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.products[0].nameProduct).toBe(`${token}UnrelatedName`);
    });

    it('matches accent-insensitively (inherited utf8mb4_unicode_ci collation)', async () => {
      const result = await repository.searchPaged({ search: `${token}zzaccentmascara`, limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.products[0].nameProduct).toBe(`${token}ZZAccentMáscara`);
    });

    it('treats a literal `%` in the search term as a literal character, not a wildcard', async () => {
      const result = await repository.searchPaged({ search: `${token}50%`, limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.products[0].nameProduct).toBe(`${token}50% Off Figure`);
    });

    it('treats a literal `_` in the search term as a literal character, not a single-char wildcard', async () => {
      const result = await repository.searchPaged({ search: `${token}a_b`, limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.products[0].nameProduct).toBe(`${token}a_b Figure`);
    });

    it('orders deterministically by idProduct ASC, with no overlap or reordering across pages', async () => {
      const firstPage = await repository.searchPaged({ search: `${token}PageOrderItem`, limit: 2, offset: 0 });
      const secondPage = await repository.searchPaged({ search: `${token}PageOrderItem`, limit: 2, offset: 2 });
      const thirdPage = await repository.searchPaged({ search: `${token}PageOrderItem`, limit: 2, offset: 4 });

      expect(firstPage.total).toBe(5);
      expect(secondPage.total).toBe(5);
      expect(thirdPage.total).toBe(5);

      const allIds = [...firstPage.products, ...secondPage.products, ...thirdPage.products].map((p) => p.idProduct);
      expect(new Set(allIds).size).toBe(5);
      expect(allIds).toEqual([...allIds].sort((a, b) => a - b));
    });

    it('AND-combines search, idCategory and idFranchise against real rows', async () => {
      const result = await repository.searchPaged({
        search: `${token}comboitem`,
        idCategory: categoryId,
        idFranchise: franchiseId,
        limit: 20,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.products[0].idCategory).toBe(categoryId);
      expect(result.products[0].idFranchise).toBe(franchiseId);
    });

    it('reports the real product count, not an inflated joined-row count, with the Category/Franchise belongsTo includes present', async () => {
      // Concrete regression this guards: an incorrectly-added `distinct: true`
      // is a non-issue today because Category/Franchise are belongsTo (N:1,
      // not hasMany) so the join cannot multiply rows — but if a future
      // hasMany include were added to searchPaged without `distinct: true`,
      // this exact assertion (total === actual row count, not row count times
      // joined rows) would catch it.
      const result = await repository.searchPaged({ search: `${token}PageOrderItem`, limit: 20, offset: 0 });

      expect(result.total).toBe(5);
      expect(result.products).toHaveLength(5);
    });
  });
});
