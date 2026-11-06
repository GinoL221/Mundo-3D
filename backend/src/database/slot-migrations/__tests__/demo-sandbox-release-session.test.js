'use strict';

const migration = require('../20261105000000-demo-sandbox-release-session');

const expectedSql = `CREATE TABLE \`DemoSandboxReleaseSession\` (
  \`attempt_id\` CHAR(36) BINARY NOT NULL PRIMARY KEY,
  \`slot_id\` VARCHAR(64) NOT NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`server_uuid\` CHAR(36) BINARY NOT NULL,
  \`connection_id\` BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY \`uq_release_session_attempt\` (\`slot_id\`, \`generation\`, \`attempt_id\`)
) ENGINE=InnoDB`;

describe('isolated slot release session migration', () => {
  it('creates the exact session table without IF NOT EXISTS', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ context: { sequelize: { query } } });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expectedSql);
  });

  it('emits a statement without IF NOT EXISTS', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ context: { sequelize: { query } } });
    expect(query.mock.calls[0][0]).not.toMatch(/IF NOT EXISTS/i);
  });

  it('records the server identity next to the connection id', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ context: { sequelize: { query } } });
    const emitted = query.mock.calls[0][0];
    expect(emitted).toContain('`server_uuid` CHAR(36) BINARY NOT NULL');
    expect(emitted).toContain('`connection_id` BIGINT UNSIGNED NOT NULL');
  });

  it('propagates an existing-table error without issuing further statements', async () => {
    const error = new Error('table already exists');
    const query = jest.fn().mockRejectedValue(error);
    await expect(migration.up({ context: { sequelize: { query } } })).rejects.toBe(error);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('refuses rollback without dropping the session table', async () => {
    const context = { dropTable: jest.fn() };
    await expect(migration.down({ context })).rejects.toThrow(
      'Release session rollback requires an explicit safe plan',
    );
    expect(context.dropTable).not.toHaveBeenCalled();
  });
});
