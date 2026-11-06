'use strict';

const migration = require('../20261102000000-demo-sandbox-fence');

const expectedSql = `CREATE TABLE \`DemoSandboxFence\` (
  \`slot_id\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`lease_id\` CHAR(36) BINARY NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`state\` ENUM('open', 'fenced') NOT NULL,
  \`reset_attempt_id\` CHAR(36) BINARY NULL
) ENGINE=InnoDB`;

describe('isolated slot fence migration', () => {
  it('creates the exact slot fence without IF NOT EXISTS', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ context: { sequelize: { query } } });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expectedSql);
  });

  it('propagates an existing-table error without issuing further statements', async () => {
    const error = new Error('table already exists');
    const query = jest.fn().mockRejectedValue(error);
    await expect(migration.up({ context: { sequelize: { query } } })).rejects.toBe(error);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expectedSql);
  });

  it('refuses rollback without dropping the fence table', async () => {
    const context = { dropTable: jest.fn() };
    await expect(migration.down({ context })).rejects.toThrow('Fence rollback requires an explicit safe plan');
    expect(context.dropTable).not.toHaveBeenCalled();
  });
});
