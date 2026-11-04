'use strict';

const migration = require('../20261104000000-demo-sandbox-release-operation');

const expectedSql = `CREATE TABLE \`DemoSandboxReleaseOperation\` (
  \`release_id\` CHAR(36) BINARY NOT NULL PRIMARY KEY,
  \`slot_id\` VARCHAR(64) NOT NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`attempt_id\` CHAR(36) BINARY NOT NULL,
  \`seed_version\` VARCHAR(128) NOT NULL,
  \`lease_id\` CHAR(36) BINARY NOT NULL,
  UNIQUE KEY \`uq_release_attempt\` (\`slot_id\`, \`generation\`, \`attempt_id\`),
  INDEX \`idx_release_slot_generation\` (\`slot_id\`, \`generation\`)
) ENGINE=InnoDB`;

describe('isolated slot release operation migration', () => {
  it('creates the exact release table without IF NOT EXISTS', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ context: { sequelize: { query } } });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expectedSql);
    expect(expectedSql).not.toMatch(/IF NOT EXISTS/i);
  });

  it('lets storage reject a second committed release for one attempt', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ context: { sequelize: { query } } });
    expect(query).toHaveBeenCalledWith(expectedSql);
    expect(expectedSql).toContain(
      'UNIQUE KEY `uq_release_attempt` (`slot_id`, `generation`, `attempt_id`)',
    );
    expect(expectedSql).toContain('`release_id` CHAR(36) BINARY NOT NULL PRIMARY KEY');
  });

  it('propagates an existing-table error without issuing further statements', async () => {
    const error = new Error('table already exists');
    const query = jest.fn().mockRejectedValue(error);
    await expect(migration.up({ context: { sequelize: { query } } })).rejects.toBe(error);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expectedSql);
  });

  it('refuses rollback without dropping the release table', async () => {
    const context = { dropTable: jest.fn() };
    await expect(migration.down({ context })).rejects.toThrow(
      'Release rollback requires an explicit safe plan',
    );
    expect(context.dropTable).not.toHaveBeenCalled();
  });
});
