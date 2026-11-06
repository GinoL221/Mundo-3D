'use strict';

const migration = require('../20261103000000-demo-sandbox-reset-receipt');

const expectedSql = `CREATE TABLE \`DemoSandboxResetReceipt\` (
  \`attempt_id\` CHAR(36) BINARY NOT NULL PRIMARY KEY,
  \`slot_id\` VARCHAR(64) NOT NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`seed_version\` VARCHAR(128) NOT NULL,
  \`consumed\` TINYINT(1) NOT NULL DEFAULT 0,
  INDEX \`idx_receipt_slot_generation\` (\`slot_id\`, \`generation\`)
) ENGINE=InnoDB`;

describe('isolated slot reset receipt migration', () => {
  it('creates the exact receipt table without IF NOT EXISTS', async () => {
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

  it('refuses rollback without dropping the receipt table', async () => {
    const context = { dropTable: jest.fn() };
    await expect(migration.down({ context })).rejects.toThrow(
      'Receipt rollback requires an explicit safe plan',
    );
    expect(context.dropTable).not.toHaveBeenCalled();
  });
});
