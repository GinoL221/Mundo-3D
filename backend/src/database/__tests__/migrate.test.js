'use strict';

// Unit test (fully mocked migrator) for `adoptBaseline()`'s scoping and the
// `adopt-baseline` CLI wiring. Real DB behavior is covered by
// `migrate.integration.test.js`.
jest.mock('../migrator', () => ({
  buildMigrator: jest.fn(),
}));

const { buildMigrator } = require('../migrator');
const { run, adoptBaseline, BASELINE_MIGRATION_NAME } = require('../migrate');

function makeMigrator(pendingNames) {
  return {
    pending: jest.fn().mockResolvedValue(pendingNames.map((name) => ({ name }))),
    storage: { logMigration: jest.fn().mockResolvedValue(undefined) },
  };
}

describe('adoptBaseline', () => {
  it('adopts only the baseline migration when a later migration is also pending', async () => {
    const migrator = makeMigrator([BASELINE_MIGRATION_NAME, '20260901000000-add-orders.js']);

    const adopted = await adoptBaseline(migrator);

    expect(adopted).toEqual([BASELINE_MIGRATION_NAME]);
    expect(migrator.storage.logMigration).toHaveBeenCalledTimes(1);
    expect(migrator.storage.logMigration).toHaveBeenCalledWith({ name: BASELINE_MIGRATION_NAME });
  });

  it('adopts nothing when the baseline is not pending', async () => {
    const migrator = makeMigrator(['20260901000000-add-orders.js']);

    const adopted = await adoptBaseline(migrator);

    expect(adopted).toEqual([]);
    expect(migrator.storage.logMigration).not.toHaveBeenCalled();
  });

  it('adopts explicitly-named migrations instead of the default baseline scope when provided', async () => {
    const migrator = makeMigrator([BASELINE_MIGRATION_NAME, '20260901000000-add-orders.js']);

    const adopted = await adoptBaseline(migrator, ['20260901000000-add-orders.js']);

    expect(adopted).toEqual(['20260901000000-add-orders.js']);
    expect(migrator.storage.logMigration).toHaveBeenCalledTimes(1);
    expect(migrator.storage.logMigration).toHaveBeenCalledWith({
      name: '20260901000000-add-orders.js',
    });
  });
});

describe('run — adopt-baseline CLI wiring', () => {
  beforeEach(() => {
    buildMigrator.mockReset();
  });

  it('scopes the default CLI invocation to only the baseline migration', async () => {
    const migrator = makeMigrator([BASELINE_MIGRATION_NAME, '20260901000000-add-orders.js']);
    buildMigrator.mockReturnValue(migrator);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const success = await run(['adopt-baseline']);

    expect(success).toBe(true);
    expect(migrator.storage.logMigration).toHaveBeenCalledTimes(1);
    expect(migrator.storage.logMigration).toHaveBeenCalledWith({ name: BASELINE_MIGRATION_NAME });
    logSpy.mockRestore();
  });

  it('logs the nothing-to-adopt message and still resolves true when the requested scope has nothing pending', async () => {
    const migrator = makeMigrator(['20260901000000-add-orders.js']);
    buildMigrator.mockReturnValue(migrator);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const success = await run(['adopt-baseline']);

    expect(success).toBe(true);
    expect(migrator.storage.logMigration).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Nothing to adopt — no pending migrations matched the requested scope.'
    );
    logSpy.mockRestore();
  });

  it('forwards explicit migration names from argv instead of the default baseline scope', async () => {
    const migrator = makeMigrator([BASELINE_MIGRATION_NAME, '20260901000000-add-orders.js']);
    buildMigrator.mockReturnValue(migrator);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const success = await run(['adopt-baseline', '20260901000000-add-orders.js']);

    expect(success).toBe(true);
    expect(migrator.storage.logMigration).toHaveBeenCalledTimes(1);
    expect(migrator.storage.logMigration).toHaveBeenCalledWith({
      name: '20260901000000-add-orders.js',
    });
    logSpy.mockRestore();
  });
});

describe('run — non-adopt-baseline commands', () => {
  beforeEach(() => {
    buildMigrator.mockReset();
  });

  it('delegates any other command straight to the migrator\'s own CLI runner', async () => {
    const runAsCLI = jest.fn().mockResolvedValue(true);
    buildMigrator.mockReturnValue({ runAsCLI });

    const success = await run(['up']);

    expect(success).toBe(true);
    expect(runAsCLI).toHaveBeenCalledWith(['up']);
  });

  it('surfaces the migrator CLI runner\'s own failure result unchanged', async () => {
    const runAsCLI = jest.fn().mockResolvedValue(false);
    buildMigrator.mockReturnValue({ runAsCLI });

    const success = await run(['down']);

    expect(success).toBe(false);
  });
});
