/**
 * Reusable helpers for REAL-DATABASE integration tests (NOT mocked).
 *
 * These bootstrap a real connection against the Sequelize `test` environment
 * (see `database/config/config.js` -> `mundo_3d_test`), reusing the exact
 * same `ensureDatabaseExists` + `sequelize.sync()` pattern already
 * established by `database/test-prepare.js` for the E2E test database — so
 * the integration-test schema never silently diverges from the real one.
 *
 * Intentionally generic (not adjustStock-specific): a future PR that adds a
 * route-level integration suite (guard -> controller -> repository) can
 * import and reuse these same seed/cleanup primitives.
 */

// Force the `test` Sequelize config even if NODE_ENV wasn't already set by
// the test runner (Jest sets NODE_ENV=test by default, but being explicit
// here avoids ever accidentally touching a dev/prod database).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Plain `require()` on purpose (not ES `import`): `ensureDatabase.js` and
// `models/db.js` are untyped CommonJS modules. `models/db` has a matching
// `db.d.ts` used elsewhere via `import db from '.../db'`, but
// `ensureDatabase.js` does not — this matches the existing require() pattern
// already used by `database/test-prepare.js`.
const { ensureDatabaseExists } = require('../../database/config/ensureDatabase');
const db = require('../../database/models/db');

export interface TestProductFixture {
  categoryId: number;
  franchiseId: number;
  productId: number;
}

export interface TestCartFixture {
  userId: number;
  categoryId: number;
  franchiseId: number;
  productIds: [number, number, number];
}

export interface CartRow {
  idProduct: number;
  quantity: number;
  unitPrice: number;
}

let bootstrapped = false;

/**
 * Ensures the `mundo_3d_test` database exists and its schema is in sync with
 * the current Sequelize models. Non-destructive (`force: false`) — safe to
 * call repeatedly, never drops existing tables/rows. Idempotent per process.
 */
export async function bootstrapTestDatabase(): Promise<void> {
  if (bootstrapped) return;
  await ensureDatabaseExists('test');
  await db.sequelize.sync({ force: false });
  bootstrapped = true;
}

/** Closes the underlying Sequelize connection pool. Call once in `afterAll`. */
export async function closeTestDatabase(): Promise<void> {
  await db.sequelize.close();
  bootstrapped = false;
}

/** Creates a minimal, uniquely-named Category row for test isolation. */
export async function createTestCategory(nameOverride?: string): Promise<number> {
  const category = await db.Category.create({
    nameCategory: nameOverride ?? `IntegrationTestCategory-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  return category.idCategory;
}

/** Creates a minimal, uniquely-named Franchise row for test isolation. */
export async function createTestFranchise(nameOverride?: string): Promise<number> {
  const franchise = await db.Franchise.create({
    nameFranchise: nameOverride ?? `IntegrationTestFranchise-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  return franchise.idFranchise;
}

/** Creates a minimal Product row against the given Category/Franchise ids. */
export async function createTestProduct(
  categoryId: number,
  franchiseId: number,
  overrides: { stock?: number; nameProduct?: string; price?: number } = {}
): Promise<number> {
  const product = await db.Product.create({
    nameProduct: overrides.nameProduct ?? 'Integration Test Product',
    price: overrides.price ?? 10.0,
    descriptionProduct: 'Seeded by testDb helper',
    image: 'placeholder.jpg',
    idCategory: categoryId,
    idFranchise: franchiseId,
    stock: overrides.stock ?? 0,
  });
  return product.idProduct;
}

/**
 * Convenience wrapper: seeds a Category + Franchise + Product in one call.
 * Generic (not adjustStock-specific) — reusable by future integration
 * suites that only need "some valid product to act on".
 */
export async function seedProductWithDependencies(
  overrides: { stock?: number; nameProduct?: string; price?: number } = {}
): Promise<TestProductFixture> {
  const categoryId = await createTestCategory();
  const franchiseId = await createTestFranchise();
  const productId = await createTestProduct(categoryId, franchiseId, overrides);
  return { categoryId, franchiseId, productId };
}

/** Reads the persisted `stock` value directly from the DB (bypasses any cache). */
export async function readProductStock(productId: number): Promise<number | null> {
  const instance = await db.Product.findByPk(productId);
  return instance ? Number(instance.stock) : null;
}

/** Deletes a single Product row by id. Safe to call even if already deleted. */
export async function deleteTestProduct(productId: number): Promise<void> {
  await db.Product.destroy({ where: { idProduct: productId } });
}

/** Deletes a single Category row by id. Safe to call even if already deleted. */
export async function deleteTestCategory(categoryId: number): Promise<void> {
  await db.Category.destroy({ where: { idCategory: categoryId } });
}

/** Deletes a single Franchise row by id. Safe to call even if already deleted. */
export async function deleteTestFranchise(franchiseId: number): Promise<void> {
  await db.Franchise.destroy({ where: { idFranchise: franchiseId } });
}

/** Deletes everything created by `seedProductWithDependencies`, in FK-safe order. */
export async function cleanupProductFixture(fixture: TestProductFixture): Promise<void> {
  await deleteTestProduct(fixture.productId);
  await deleteTestFranchise(fixture.franchiseId);
  await deleteTestCategory(fixture.categoryId);
}

/** Creates a minimal, uniquely-named User row for test isolation. */
export async function seedTestUser(
  overrides: { firstName?: string; lastName?: string; email?: string; passwordUser?: string } = {}
): Promise<number> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = await db.User.create({
    firstName: overrides.firstName ?? 'IntegrationTest',
    lastName: overrides.lastName ?? 'User',
    email: overrides.email ?? `integration-test-${unique}@example.com`,
    passwordUser: overrides.passwordUser ?? 'placeholder-hashed-password',
  });
  return user.idUser;
}

/** Deletes a single User row by id. Safe to call even if already deleted. */
export async function deleteTestUser(userId: number): Promise<void> {
  await db.User.destroy({ where: { idUser: userId } });
}

/**
 * Reads the persisted ACTIVE `ShoppingCart` rows for a user directly from the
 * DB (bypasses any cache), normalized to the fields relevant for cart-content
 * comparisons.
 */
export async function readActiveCartRows(userId: number): Promise<CartRow[]> {
  const rows = await db.ShoppingCart.findAll({
    where: { idUser: userId, cartStatus: 'ACTIVE' },
  });
  return rows.map((row: { idProduct: number; quantity: number; unitPrice: number }) => ({
    idProduct: row.idProduct,
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice),
  }));
}

/**
 * Seeds a User + 3 Products (sharing one Category/Franchise) + one
 * pre-existing ACTIVE `ShoppingCart` row for that user against the first
 * product. The pre-existing row is the one the cart-race test's barrier
 * locks via `SELECT ... FOR UPDATE` before releasing two concurrent
 * `syncCart` calls to contend for real.
 */
export async function seedCartFixture(): Promise<TestCartFixture> {
  const userId = await seedTestUser();
  const categoryId = await createTestCategory();
  const franchiseId = await createTestFranchise();
  const productIds: [number, number, number] = [
    await createTestProduct(categoryId, franchiseId, { nameProduct: 'Cart Race Product 1' }),
    await createTestProduct(categoryId, franchiseId, { nameProduct: 'Cart Race Product 2' }),
    await createTestProduct(categoryId, franchiseId, { nameProduct: 'Cart Race Product 3' }),
  ];

  await db.ShoppingCart.create({
    idUser: userId,
    idProduct: productIds[0],
    quantity: 1,
    unitPrice: 1.0,
    cartStatus: 'ACTIVE',
  });

  return { userId, categoryId, franchiseId, productIds };
}

/** Deletes everything created by `seedCartFixture`, in FK-safe order. */
export async function cleanupCartFixture(fixture: TestCartFixture): Promise<void> {
  await db.ShoppingCart.destroy({ where: { idUser: fixture.userId } });
  for (const productId of fixture.productIds) {
    await deleteTestProduct(productId);
  }
  await deleteTestFranchise(fixture.franchiseId);
  await deleteTestCategory(fixture.categoryId);
  await deleteTestUser(fixture.userId);
}

/** Escape hatch: raw access to the real Sequelize `db` object (models + `sequelize`). */
export function getTestDb() {
  return db;
}
