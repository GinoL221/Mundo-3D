'use strict';

// Unit test (fully mocked migrator) for the boot-time schema-consistency
// gate: `checkNoPendingMigrations()` must reject with a clear, actionable
// error when Umzug reports pending migrations, and must ALSO reject when
// migration bookkeeping is current but the physical schema (tables/columns)
// is missing or incompatible — bookkeeping alone cannot prove the live
// schema actually matches. Real migrator wiring is covered by
// `migrator.test.js`.
jest.mock('../migrator', () => ({
  buildMigrator: jest.fn(),
}));

const { buildMigrator } = require('../migrator');
const {
  checkNoPendingMigrations,
  REQUIRED_SCHEMA,
  REQUIRED_COLUMN_DEFINITIONS,
} = require('../checkPendingMigrations');

function makeCompatibleQueryInterface() {
  const columnsByTable = {};
  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
    columnsByTable[table] = Object.fromEntries(columns.map((column) => {
      const expected = REQUIRED_COLUMN_DEFINITIONS[table][column];
      return [column, { type: expected.replace(/!$/, ''), allowNull: !expected.endsWith('!') }];
    }));
  }

  return {
    showAllTables: jest.fn().mockResolvedValue(Object.keys(REQUIRED_SCHEMA)),
    describeTable: jest.fn((tableName) => Promise.resolve(columnsByTable[tableName])),
  };
}

function makeMigrator(pendingNames, queryInterface = makeCompatibleQueryInterface()) {
  return {
    pending: jest.fn().mockResolvedValue(pendingNames.map((name) => ({ name }))),
    options: { context: queryInterface },
  };
}

describe('checkNoPendingMigrations', () => {
  beforeEach(() => {
    buildMigrator.mockReset();
  });

  it('rejects with a clear error naming the pending count when migrations are pending', async () => {
    buildMigrator.mockReturnValue(makeMigrator(['20260901000000-add-orders.js', '20260902000000-add-orders2.js']));

    await expect(checkNoPendingMigrations()).rejects.toThrow(
      'Database schema is not fully migrated: 2 pending migration(s) — run `pnpm db:migrate` before starting the server.'
    );
  });

  it('resolves without error when there are no pending migrations and the physical schema is fully compatible', async () => {
    buildMigrator.mockReturnValue(makeMigrator([]));

    await expect(checkNoPendingMigrations()).resolves.toBeUndefined();
  });

  it('rejects when a required table is missing even though no migrations are pending', async () => {
    const queryInterface = makeCompatibleQueryInterface();
    const tablesWithoutShoppingCart = Object.keys(REQUIRED_SCHEMA).filter((table) => table !== 'ShoppingCart');
    queryInterface.showAllTables.mockResolvedValue(tablesWithoutShoppingCart);
    buildMigrator.mockReturnValue(makeMigrator([], queryInterface));

    await expect(checkNoPendingMigrations()).rejects.toThrow(
      /missing required table "ShoppingCart"/
    );
  });

  it('rejects when a required column has an incompatible physical type', async () => {
    const queryInterface = makeCompatibleQueryInterface();
    const productColumns = await queryInterface.describeTable('Product');
    productColumns.price = { type: 'VARCHAR(255)', allowNull: false };
    buildMigrator.mockReturnValue(makeMigrator([], queryInterface));

    await expect(checkNoPendingMigrations()).rejects.toThrow(
      /incompatible definition for column "price" on table "Product".*expected type DECIMAL\(10,2\)/
    );
  });

  it('rejects when a required column has incompatible nullability', async () => {
    const queryInterface = makeCompatibleQueryInterface();
    const userColumns = await queryInterface.describeTable('User');
    userColumns.email.allowNull = true;
    buildMigrator.mockReturnValue(makeMigrator([], queryInterface));

    await expect(checkNoPendingMigrations()).rejects.toThrow(
      /incompatible definition for column "email" on table "User".*allowNull=false/
    );
  });

  it('rejects when a required column is missing on an existing table even though no migrations are pending', async () => {
    const queryInterface = makeCompatibleQueryInterface();
    const rememberTokenColumns = await queryInterface.describeTable('RememberToken');
    delete rememberTokenColumns.token_hash;
    buildMigrator.mockReturnValue(makeMigrator([], queryInterface));

    await expect(checkNoPendingMigrations()).rejects.toThrow(
      /missing required column "token_hash" on table "RememberToken"/
    );
  });

  // MySQL 8.0.19+ dropped the display-width attribute from DESCRIBE/SHOW
  // COLUMNS output for integer types that weren't given an explicit width
  // at CREATE TABLE time (a purely cosmetic MySQL notation, not a real type
  // difference) — a real MySQL 8.0.46 instance reports `INT`, never
  // `INT(11)`, for every integer column this schema defines. This test
  // reproduces that exact live server behavior; without the fix it fails
  // the same way a real boot against any current MySQL 8.0.19+ would.
  it('accepts an integer column reported without its display width, matching modern MySQL DESCRIBE output', async () => {
    const queryInterface = makeCompatibleQueryInterface();
    const userColumns = await queryInterface.describeTable('User');
    userColumns.id_user = { type: 'INT', allowNull: false }; // no "(11)" — real MySQL 8.0.19+ behavior
    buildMigrator.mockReturnValue(makeMigrator([], queryInterface));

    await expect(checkNoPendingMigrations()).resolves.toBeUndefined();
  });

  it('still rejects a genuinely different integer width, not just any display-width difference', async () => {
    const queryInterface = makeCompatibleQueryInterface();
    const userColumns = await queryInterface.describeTable('User');
    userColumns.id_user = { type: 'BIGINT', allowNull: false };
    buildMigrator.mockReturnValue(makeMigrator([], queryInterface));

    await expect(checkNoPendingMigrations()).rejects.toThrow(
      /incompatible definition for column "id_user" on table "User"/
    );
  });
});
