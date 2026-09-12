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

const fs = require('fs');
const path = require('path');
const { ensureDatabaseExists } = require('../config/ensureDatabase');
const db = require('../models/db');
const { run } = require('../migrate');
const { buildMigrator } = require('../migrator');

jest.setTimeout(30000);

const BASELINE_NAME = '20260724000000-baseline.js';
const ORDERS_MIGRATION_NAME = '20260828000000-orders.js';
// HIGH-1 PR1 — see design.md D1/D2 and proposal.md's "Mandatory schema
// migration". Alters RememberToken only; creates no new table.
const REFRESH_ROTATION_MIGRATION_NAME = '20260901000000-refresh-token-rotation.js';
const EMAIL_CONFIRMATION_TOKEN_TABLE = 'EmailConfirmationToken';
const ALL_TABLES = ['User', 'Category', 'Franchise', 'Product', 'ShoppingCart', 'RememberToken'];
// Order/OrderItem come from a second migration (`20260828000000-orders.js`),
// applied/reverted in addition to the baseline — kept separate from
// ALL_TABLES because the "down reverts the baseline" test below reverts
// migrations one at a time (Umzug's `down` with no args only undoes the
// most recently applied migration), so these two are dropped by a distinct
// `run(['down'])` call rather than the same one that drops ALL_TABLES.
const ORDER_TABLES = ['Order', 'OrderItem'];
// The 4 rotation columns added by REFRESH_ROTATION_MIGRATION_NAME — no
// table dropped/created, so distinguishing its down() needs a column-level
// check instead of showTables().
const REFRESH_ROTATION_COLUMNS = ['family_id', 'superseded_at', 'successor_hash', 'revoked_at'];

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
    for (const table of [
      'SequelizeMeta',
      EMAIL_CONFIRMATION_TOKEN_TABLE,
      ...[...ALL_TABLES, ...ORDER_TABLES].reverse(),
    ]) {
      await db.sequelize.query(`DROP TABLE IF EXISTS \`${table}\`;`);
    }
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    await db.sequelize.close();
  });

  it('backfills pre-existing users and leaves post-migration users unverified', async () => {
    await buildMigrator().up({
      migrations: [BASELINE_NAME, ORDERS_MIGRATION_NAME, REFRESH_ROTATION_MIGRATION_NAME],
    });
    await db.sequelize.query(
      "INSERT INTO `User` (first_name, last_name, email, password_user) VALUES ('Before', 'Migration', 'before-migration@example.com', 'hash'), ('Earlier', 'Migration', 'earlier-migration@example.com', 'hash')",
    );

    const success = await run(['up']);

    expect(success).toBe(true);
    const tables = await showTables();
    expect(tables).toEqual(
      expect.arrayContaining([...ALL_TABLES, ...ORDER_TABLES, EMAIL_CONFIRMATION_TOKEN_TABLE]),
    );

    const [[existingUser]] = await db.sequelize.query(
      "SELECT email_verified_at AS verifiedAt FROM `User` WHERE email = 'before-migration@example.com'",
    );
    expect(existingUser.verifiedAt).not.toBeNull();
    const [[earlierUser]] = await db.sequelize.query(
      "SELECT email_verified_at AS verifiedAt FROM `User` WHERE email = 'earlier-migration@example.com'",
    );
    expect(earlierUser.verifiedAt).toEqual(existingUser.verifiedAt);

    const userColumns = await db.sequelize.getQueryInterface().describeTable('User');
    expect(userColumns.email_verified_at).toMatchObject({ allowNull: true, defaultValue: null });
    await db.sequelize.query(
      "INSERT INTO `User` (first_name, last_name, email, password_user) VALUES ('After', 'Migration', 'after-migration@example.com', 'hash')",
    );
    const [[newUser]] = await db.sequelize.query(
      "SELECT email_verified_at AS verifiedAt FROM `User` WHERE email = 'after-migration@example.com'",
    );
    expect(newUser.verifiedAt).toBeNull();

    const executed = await buildMigrator().executed();
    expect(executed.map((m) => m.name)).toEqual([
      BASELINE_NAME,
      ORDERS_MIGRATION_NAME,
      REFRESH_ROTATION_MIGRATION_NAME,
      '20260902000000-email-confirmation.js',
    ]);
  });

  it('creates digest-only storage with real authority, index, and cascade constraints', async () => {
    const columns = await db.sequelize.getQueryInterface().describeTable('EmailConfirmationToken');
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        'id_email_confirmation_token',
        'id_user',
        'token_hash',
        'expires_at',
        'consumed_at',
        'invalidated_at',
        'active_slot',
        'created_at',
      ]),
    );
    expect(Object.keys(columns).join(' ')).not.toMatch(/plaintext|token_value|token_plain/i);

    const [[user]] = await db.sequelize.query(
      "SELECT id_user AS id FROM `User` WHERE email = 'after-migration@example.com'",
    );
    const insertToken = (hash, activeSlot) =>
      db.sequelize.query(
        `INSERT INTO \`EmailConfirmationToken\` (id_user, token_hash, expires_at, active_slot, created_at)
         VALUES (${user.id}, '${hash}', '2030-01-02 00:00:00', ${activeSlot}, '2030-01-01 00:00:00')`,
      );
    await insertToken('a'.repeat(64), 1);
    await expect(insertToken('b'.repeat(64), 1)).rejects.toThrow();
    await insertToken('c'.repeat(64), 'NULL');
    await insertToken('d'.repeat(64), 'NULL');

    const [indexes] = await db.sequelize.query('SHOW INDEX FROM `EmailConfirmationToken`');
    expect(indexes.some((index) => index.Key_name === 'uq_email_confirmation_token_hash')).toBe(
      true,
    );
    expect(
      indexes
        .filter((index) => index.Key_name === 'uq_email_confirmation_token_user_active_slot')
        .map((index) => index.Column_name),
    ).toEqual(['id_user', 'active_slot']);

    await db.sequelize.query(`DELETE FROM \`User\` WHERE id_user = ${user.id}`);
    const [[remainingTokens]] = await db.sequelize.query(
      `SELECT COUNT(*) AS count FROM \`EmailConfirmationToken\` WHERE id_user = ${user.id}`,
    );
    expect(Number(remainingTokens.count)).toBe(0);
  });

  it('refresh-token-rotation gives RememberToken the 4 rotation columns and drops the 4 duplicate token_hash unique indexes', async () => {
    const columns = await db.sequelize.getQueryInterface().describeTable('RememberToken');
    for (const column of REFRESH_ROTATION_COLUMNS) {
      expect(columns).toHaveProperty(column);
    }
    expect(columns.family_id.allowNull).toBe(false);
    expect(columns.superseded_at.allowNull).toBe(true);

    const [indexes] = await db.sequelize.query('SHOW INDEX FROM `RememberToken`');
    const indexNames = new Set(indexes.map((row) => row.Key_name));
    expect(indexNames.has('token_hash')).toBe(true);
    for (const droppedIndex of ['token_hash_2', 'token_hash_3', 'token_hash_4', 'token_hash_5']) {
      expect(indexNames.has(droppedIndex)).toBe(false);
    }
  });

  it('created tables enforce real FK constraints and the Product.stock default', async () => {
    await db.sequelize.query(
      "INSERT INTO `Category` (name_category) VALUES ('IntegrationCategory')",
    );
    await db.sequelize.query(
      "INSERT INTO `Franchise` (name_franchise) VALUES ('IntegrationFranchise')",
    );
    const [[category]] = await db.sequelize.query(
      "SELECT id_category AS id FROM `Category` WHERE name_category = 'IntegrationCategory'",
    );
    const [[franchise]] = await db.sequelize.query(
      "SELECT id_franchise AS id FROM `Franchise` WHERE name_franchise = 'IntegrationFranchise'",
    );

    await db.sequelize.query(
      `INSERT INTO \`Product\` (id_category, id_franchise, name_product, price) VALUES (${category.id}, ${franchise.id}, 'Test', 9.99)`,
    );
    const [[product]] = await db.sequelize.query(
      "SELECT stock FROM `Product` WHERE name_product = 'Test'",
    );
    expect(Number(product.stock)).toBe(0);

    await expect(
      db.sequelize.query(
        "INSERT INTO `Product` (id_category, id_franchise, name_product, price) VALUES (999999, 1, 'Bad', 1.00)",
      ),
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

  it('down four times removes email-confirmation dependencies before restoring the baseline shape', async () => {
    // Umzug's `down` with no args reverts only the most recently applied migration.
    const firstDown = await run(['down']);
    expect(firstDown).toBe(true);
    let tables = await showTables();
    expect(tables).not.toContain('EmailConfirmationToken');
    const columnsAfterEmailConfirmationDown = await db.sequelize
      .getQueryInterface()
      .describeTable('User');
    expect(columnsAfterEmailConfirmationDown).not.toHaveProperty('email_verified_at');

    const secondDown = await run(['down']);
    expect(secondDown).toBe(true);
    // refresh-token-rotation's down() restores RememberToken byte-for-byte.
    const columnsAfterFirstDown = await db.sequelize
      .getQueryInterface()
      .describeTable('RememberToken');
    for (const column of REFRESH_ROTATION_COLUMNS) {
      expect(columnsAfterFirstDown).not.toHaveProperty(column);
    }
    const [indexesAfterFirstDown] = await db.sequelize.query('SHOW INDEX FROM `RememberToken`');
    const indexNamesAfterFirstDown = new Set(indexesAfterFirstDown.map((row) => row.Key_name));
    for (const restoredIndex of [
      'token_hash',
      'token_hash_2',
      'token_hash_3',
      'token_hash_4',
      'token_hash_5',
    ]) {
      expect(indexNamesAfterFirstDown.has(restoredIndex)).toBe(true);
    }
    tables = await showTables();
    expect(tables).toEqual(expect.arrayContaining([...ALL_TABLES, ...ORDER_TABLES]));

    const thirdDown = await run(['down']);
    expect(thirdDown).toBe(true);
    tables = await showTables();
    for (const table of ORDER_TABLES) {
      expect(tables).not.toContain(table);
    }
    expect(tables).toEqual(expect.arrayContaining(ALL_TABLES));

    const fourthDown = await run(['down']);
    expect(fourthDown).toBe(true);
    tables = await showTables();
    for (const table of [...ALL_TABLES, ...ORDER_TABLES]) {
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

  it('a genuine migration failure surfaces via run() resolving false and sets the CLI failure exit code', async () => {
    // Baseline is already logged as executed by the previous test. This
    // fixture's timestamp (`20260724999999`) sorts before the still-pending
    // `20260828000000-orders.js` and `20260901000000-refresh-token-
    // rotation.js`, so `up` attempts it first, fails, and halts before ever
    // reaching either of them — a real failure against a real DB, not a
    // mocked rejection.
    const brokenMigrationPath = path.join(
      __dirname,
      '../migrations/20260724999999-broken-test-migration.js',
    );
    fs.writeFileSync(
      brokenMigrationPath,
      "'use strict';\n" +
        'module.exports = {\n' +
        '  async up({ context: queryInterface }) {\n' +
        "    await queryInterface.sequelize.query('THIS IS NOT VALID SQL AND MUST FAIL');\n" +
        '  },\n' +
        '  async down() {},\n' +
        '};\n',
    );
    const previousExitCode = process.exitCode;

    try {
      const success = await run(['up']);

      expect(success).toBe(false);
      // Mirrors the exact contract `migrate.js`'s `require.main === module`
      // block relies on (`if (success === false) { process.exitCode = 1; }`)
      // — proving a real migration failure surfaces as a failing CLI run
      // instead of being silently swallowed.
      expect(process.exitCode).toBe(1);

      const executed = await buildMigrator().executed();
      expect(executed.map((m) => m.name)).not.toContain('20260724999999-broken-test-migration.js');
    } finally {
      process.exitCode = previousExitCode;
      fs.unlinkSync(brokenMigrationPath);
    }
  });
});
