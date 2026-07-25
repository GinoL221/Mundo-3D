'use strict';

// Unit test (fully mocked migrator) for the boot-time schema-consistency
// gate: `checkNoPendingMigrations()` must reject with a clear, actionable
// error when Umzug reports pending migrations, and resolve silently when
// the schema is fully caught up. Real migrator wiring is covered by
// `migrator.test.js`.
jest.mock('../migrator', () => ({
  buildMigrator: jest.fn(),
}));

const { buildMigrator } = require('../migrator');
const { checkNoPendingMigrations } = require('../checkPendingMigrations');

function makeMigrator(pendingNames) {
  return {
    pending: jest.fn().mockResolvedValue(pendingNames.map((name) => ({ name }))),
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

  it('resolves without error when there are no pending migrations', async () => {
    buildMigrator.mockReturnValue(makeMigrator([]));

    await expect(checkNoPendingMigrations()).resolves.toBeUndefined();
  });
});
