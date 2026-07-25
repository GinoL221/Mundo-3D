'use strict';

// Unit test (mocked queryInterface) for the baseline migration's transaction
// wrapping and partial-DDL-failure diagnostics. Real FK/constraint behavior
// against an actual DB is covered by `migrate.integration.test.js`.
const baseline = require('../20260724000000-baseline');

function makeUpQueryInterface({ failOnTableName } = {}) {
  const query = jest.fn(async (sql) => {
    if (failOnTableName && sql.startsWith(`CREATE TABLE \`${failOnTableName}\``)) {
      throw new Error('boom');
    }
  });
  const transaction = jest.fn(async (callback) => callback('tx-token'));
  return { sequelize: { query, transaction } };
}

function makeDownQueryInterface({ failOnTableName } = {}) {
  const dropTable = jest.fn(async (name) => {
    if (failOnTableName && name === failOnTableName) {
      throw new Error('boom');
    }
  });
  const transaction = jest.fn(async (callback) => callback('tx-token'));
  return { dropTable, sequelize: { transaction } };
}

describe('baseline migration — up()', () => {
  it('creates all 6 tables in FK-safe order inside a single transaction', async () => {
    const queryInterface = makeUpQueryInterface();

    await baseline.up({ context: queryInterface });

    expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(1);
    const calls = queryInterface.sequelize.query.mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls[0][0]).toContain('CREATE TABLE `User`');
    expect(calls[3][0]).toContain('CREATE TABLE `Product`');
    expect(calls[3][1]).toEqual({ transaction: 'tx-token' });
    expect(calls[5][0]).toContain('CREATE TABLE `RememberToken`');
  });

  it('stops after a failing CREATE TABLE and reports which tables were already created', async () => {
    const queryInterface = makeUpQueryInterface({ failOnTableName: 'Product' });

    await expect(baseline.up({ context: queryInterface })).rejects.toThrow(
      /already created: \[User, Category, Franchise\]/
    );
    const attemptedSql = queryInterface.sequelize.query.mock.calls.map(([sql]) => sql);
    expect(attemptedSql.some((sql) => sql.startsWith('CREATE TABLE `ShoppingCart`'))).toBe(false);
    expect(attemptedSql.some((sql) => sql.startsWith('CREATE TABLE `RememberToken`'))).toBe(false);
  });
});

describe('baseline migration — down()', () => {
  it('drops all 6 tables in reverse order inside a single transaction', async () => {
    const queryInterface = makeDownQueryInterface();

    await baseline.down({ context: queryInterface });

    expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(1);
    const calls = queryInterface.dropTable.mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls[0][0]).toBe('RememberToken');
    expect(calls[0][1]).toEqual({ transaction: 'tx-token' });
    expect(calls[5][0]).toBe('User');
  });

  it('stops after a failing DROP and reports which tables were already dropped', async () => {
    const queryInterface = makeDownQueryInterface({ failOnTableName: 'Product' });

    await expect(baseline.down({ context: queryInterface })).rejects.toThrow(
      /already dropped: \[RememberToken, ShoppingCart\]/
    );
    const attemptedNames = queryInterface.dropTable.mock.calls.map(([name]) => name);
    expect(attemptedNames).not.toContain('Franchise');
    expect(attemptedNames).not.toContain('Category');
    expect(attemptedNames).not.toContain('User');
  });
});
