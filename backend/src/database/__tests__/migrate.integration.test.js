/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Exercises `migrate.js`'s CLI commands (`up`, `down`, `adopt-baseline`)
 * against a disposable scratch database, distinct from `mundo_3d_test`
 * (used by `testDb.ts`) and from the real dev DB. Only runs via
 * `npm run test:integration` (see `jest.integration.config.js`); excluded
 * from the default `npm test` run.
 *
 * Scratch DB name is fixed and dropped/recreated by this suite — never
 * touches `test-prepare.js`'s or `testDb.ts`'s bootstrap paths.
 */

// Force the `development` Sequelize config branch (the only one that reads
// `DB_NAME` from the environment — see `database/config/config.js`) and
// point it at a disposable scratch database. Must happen BEFORE requiring
// `models/db` (which builds the Sequelize singleton at require time).
process.env.NODE_ENV = 'development';
process.env.DB_NAME = 'mundo_3d_migrate_scratch';

const { ensureDatabaseExists } = require('../config/ensureDatabase');
const db = require('../models/db');
const { run } = require('../migrate');
const { buildMigrator } = require('../migrator');

jest.setTimeout(30000);

const BASELINE_NAME = '20260724000000-baseline.js';
const ALL_TABLES = ['User', 'Category', 'Franchise', 'Product', 'ShoppingCart', 'RememberToken'];

async function showTables() {
  const [rows] = await db.sequelize.query('SHOW TABLES');
  return rows.map((row) => Object.values(row)[0]);
}

describe('migrate CLI — real scratch DB', () => {
  beforeAll(async () => {
    await ensureDatabaseExists('development');
  });

  afterAll(async () => {
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of ['SequelizeMeta', ...[...ALL_TABLES].reverse()]) {
      await db.sequelize.query(`DROP TABLE IF EXISTS \`${table}\`;`);
    }
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    await db.sequelize.close();
  });

  it('up applies the baseline migration, creating all 6 tables and recording it', async () => {
    const success = await run(['up']);

    expect(success).toBe(true);
    const tables = await showTables();
    expect(tables).toEqual(expect.arrayContaining(ALL_TABLES));

    const executed = await buildMigrator().executed();
    expect(executed.map((m) => m.name)).toEqual([BASELINE_NAME]);
  });

  it('created tables enforce real FK constraints and the Product.stock default', async () => {
    await db.sequelize.query("INSERT INTO `Category` (name_category) VALUES ('IntegrationCategory')");
    await db.sequelize.query("INSERT INTO `Franchise` (name_franchise) VALUES ('IntegrationFranchise')");
    const [[category]] = await db.sequelize.query(
      "SELECT id_category AS id FROM `Category` WHERE name_category = 'IntegrationCategory'"
    );
    const [[franchise]] = await db.sequelize.query(
      "SELECT id_franchise AS id FROM `Franchise` WHERE name_franchise = 'IntegrationFranchise'"
    );

    await db.sequelize.query(
      `INSERT INTO \`Product\` (id_category, id_franchise, name_product, price) VALUES (${category.id}, ${franchise.id}, 'Test', 9.99)`
    );
    const [[product]] = await db.sequelize.query("SELECT stock FROM `Product` WHERE name_product = 'Test'");
    expect(Number(product.stock)).toBe(0);

    await expect(
      db.sequelize.query(
        "INSERT INTO `Product` (id_category, id_franchise, name_product, price) VALUES (999999, 1, 'Bad', 1.00)"
      )
    ).rejects.toThrow();
  });

  it('re-running up is a no-op when nothing is pending', async () => {
    const pendingBefore = await buildMigrator().pending();
    expect(pendingBefore).toHaveLength(0);

    const success = await run(['up']);

    expect(success).toBe(true);
    const tables = await showTables();
    expect(tables.filter((t) => t === 'Product')).toHaveLength(1);
  });

  it('down reverts the baseline migration and drops its tables', async () => {
    const success = await run(['down']);

    expect(success).toBe(true);
    const tables = await showTables();
    for (const table of ALL_TABLES) {
      expect(tables).not.toContain(table);
    }
    const executed = await buildMigrator().executed();
    expect(executed).toHaveLength(0);
  });

  it('adopt-baseline records the baseline as applied without executing its DDL', async () => {
    const success = await run(['adopt-baseline']);

    expect(success).toBe(true);
    const tables = await showTables();
    for (const table of ALL_TABLES) {
      expect(tables).not.toContain(table);
    }
    const executed = await buildMigrator().executed();
    expect(executed.map((m) => m.name)).toEqual([BASELINE_NAME]);
  });
});
