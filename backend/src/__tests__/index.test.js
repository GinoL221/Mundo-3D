const { createFakeHttpServer } = require('./helpers/fakeHttpServer');
const { REQUIRED_SCHEMA, REQUIRED_COLUMN_DEFINITIONS } = require('../database/checkPendingMigrations');

async function flushPromiseChain() {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    flush: jest.fn((cb) => {
      if (cb) cb();
    }),
  };
}

// Builds a queryInterface stub reporting every REQUIRED_SCHEMA table/column
// as present — the boot gate's physical-schema layer only reaches
// `describeTable`/`showAllTables` once bookkeeping reports nothing pending.
// See `checkPendingMigrations.test.js` for the missing-table/missing-column
// rejection scenarios.
function makeCompatibleQueryInterface() {
  const columnsByTable = {};
  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
    columnsByTable[table] = Object.fromEntries(
      columns.map((column) => {
        const expected = REQUIRED_COLUMN_DEFINITIONS[table][column];
        return [column, { type: expected.replace(/!$/, ''), allowNull: !expected.endsWith('!') }];
      })
    );
  }

  return {
    showAllTables: jest.fn().mockResolvedValue(Object.keys(REQUIRED_SCHEMA)),
    describeTable: jest.fn((tableName) => Promise.resolve(columnsByTable[tableName])),
  };
}

describe('index.js boot sequence', () => {
  const originalEnv = process.env;
  let exitSpy;
  let mockLogger;
  let sigtermListenersBefore;
  let sigintListenersBefore;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SHUTDOWN_TIMEOUT_MS;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockLogger = createMockLogger();
    // `process` is global: every `require('../../index')` registers new
    // SIGTERM/SIGINT listeners. Snapshot before each test and remove only
    // the newly added ones in afterEach — never `removeAllListeners`, which
    // would strip Jest's own handlers.
    sigtermListenersBefore = process.listeners('SIGTERM');
    sigintListenersBefore = process.listeners('SIGINT');
  });

  afterEach(() => {
    process
      .listeners('SIGTERM')
      .filter((listener) => !sigtermListenersBefore.includes(listener))
      .forEach((listener) => process.removeListener('SIGTERM', listener));
    process
      .listeners('SIGINT')
      .filter((listener) => !sigintListenersBefore.includes(listener))
      .forEach((listener) => process.removeListener('SIGINT', listener));
    process.env = originalEnv;
    exitSpy.mockRestore();
  });

  it('authenticates the connection instead of altering the schema, using the resolved env', async () => {
    process.env.NODE_ENV = 'production';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(ensureDatabaseExists).toHaveBeenCalledWith('production');
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(sync).not.toHaveBeenCalled();
    expect(checkNoPendingMigrations).toHaveBeenCalledTimes(1);
    expect(seedInitialData).toHaveBeenCalledTimes(1);
    expect(fake.app.listen).toHaveBeenCalledTimes(1);
  });

  it('resolves the env dynamically instead of the hardcoded "development" literal', async () => {
    process.env.NODE_ENV = 'staging_env_placeholder';
    // `config.js` doesn't define this env, but that's not what this test
    // covers (see the dedicated unsupported-NODE_ENV test below) — it only
    // proves `ensureDatabaseExists` receives the resolved env, not the
    // hardcoded "development" literal. `ensureDatabaseExists` itself is
    // mocked here so its real guard clause never runs.
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(ensureDatabaseExists).toHaveBeenCalledWith('staging_env_placeholder');
    expect(ensureDatabaseExists).not.toHaveBeenCalledWith('development');
  });

  it('fails fast without seeding or listening when authenticate() rejects', async () => {
    process.env.NODE_ENV = 'production';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockRejectedValue(new Error('schema mismatch'));
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(checkNoPendingMigrations).not.toHaveBeenCalled();
    expect(seedInitialData).not.toHaveBeenCalled();
    expect(fake.app.listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast without listening when seedInitialData() rejects (mocked at the module boundary)', async () => {
    process.env.NODE_ENV = 'production';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockRejectedValue(new Error("Table 'mundo_3d_db.Product' doesn't exist"));

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(checkNoPendingMigrations).toHaveBeenCalledTimes(1);
    expect(seedInitialData).toHaveBeenCalledTimes(1);
    expect(fake.app.listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast without listening when seedInitialData() genuinely rejects (real module, DB call boundary mocked)', async () => {
    process.env.NODE_ENV = 'production';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const dbError = new Error("Table 'mundo_3d_db.Category' doesn't exist");
    const categoryCount = jest.fn().mockRejectedValue(dbError);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({
        sequelize: { authenticate, sync, close },
        Category: { count: categoryCount, bulkCreate: jest.fn() },
      }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      // Real `../database/seed` module — NOT mocked away — so this test
      // actually exercises the fixed rethrow behavior instead of a
      // hand-mocked rejection. `dontMock` reverses any earlier `doMock`
      // registration for this path from a previous test in this file —
      // `jest.resetModules()` clears the module instance cache but not
      // explicit `doMock` factory registrations.
      jest.dontMock('../database/seed');
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(checkNoPendingMigrations).toHaveBeenCalledTimes(1);
    expect(categoryCount).toHaveBeenCalledTimes(1);
    expect(fake.app.listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast without seeding or listening when checkNoPendingMigrations() rejects (pending migrations found)', async () => {
    process.env.NODE_ENV = 'production';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const pending = jest.fn().mockResolvedValue([{ name: '20260901000000-add-orders.js' }]);
    const buildMigrator = jest.fn().mockReturnValue({ pending });

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/migrator', () => ({ buildMigrator }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      // Real `../database/checkPendingMigrations` module — the migrator is
      // mocked at the `pending()` boundary so this proves the real gate
      // logic surfaces through the boot chain. `dontMock` reverses any
      // earlier `doMock` registration for this path from a previous test.
      jest.dontMock('../database/checkPendingMigrations');
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(seedInitialData).not.toHaveBeenCalled();
    expect(fake.app.listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          message: expect.stringContaining('Database schema is not fully migrated: 1 pending migration(s)'),
        }),
      }),
      expect.stringContaining('Error al conectar con la base de datos o insertar datos iniciales')
    );
  });

  it('proceeds to seed and listen when checkNoPendingMigrations() finds nothing pending', async () => {
    process.env.NODE_ENV = 'production';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const pending = jest.fn().mockResolvedValue([]);
    const queryInterface = makeCompatibleQueryInterface();
    const buildMigrator = jest.fn().mockReturnValue({ pending, options: { context: queryInterface } });
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/migrator', () => ({ buildMigrator }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      jest.dontMock('../database/checkPendingMigrations');
      require('../../index');
    });

    await flushPromiseChain();

    expect(pending).toHaveBeenCalledTimes(1);
    expect(seedInitialData).toHaveBeenCalledTimes(1);
    expect(fake.app.listen).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('fails fast with a clear configuration error when NODE_ENV is unsupported (real ensureDatabaseExists/config path)', async () => {
    process.env.NODE_ENV = 'staging';
    const fake = createFakeHttpServer();
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      // Real `../database/config/ensureDatabase` module — NOT mocked away —
      // so this actually exercises the unsupported-NODE_ENV guard clause.
      // `dontMock` reverses any earlier `doMock` registration for this path.
      jest.dontMock('../database/config/ensureDatabase');
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(checkNoPendingMigrations).not.toHaveBeenCalled();
    expect(seedInitialData).not.toHaveBeenCalled();
    expect(fake.app.listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          message: "Unsupported NODE_ENV: 'staging' — expected one of: development, test, production",
        }),
      }),
      expect.stringContaining('Error al conectar con la base de datos o insertar datos iniciales')
    );
  });

  it('keeps the test env boot path listening directly, without touching the database', async () => {
    process.env.NODE_ENV = 'test';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(fake.app.listen).toHaveBeenCalledTimes(1);
    expect(ensureDatabaseExists).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(checkNoPendingMigrations).not.toHaveBeenCalled();
  });

  describe('graceful shutdown', () => {
    function bootInTestEnv() {
      process.env.NODE_ENV = 'test';
      const fake = createFakeHttpServer();
      const authenticate = jest.fn().mockResolvedValue(undefined);
      const sync = jest.fn().mockResolvedValue(undefined);
      const close = jest.fn().mockResolvedValue(undefined);
      const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
      const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
      const seedInitialData = jest.fn().mockResolvedValue(undefined);
      let isReady;

      jest.isolateModules(() => {
        jest.doMock('../app', () => fake.app);
        jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
        jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
        jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
        jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
        jest.doMock('../database/seed', () => ({ seedInitialData }));
        require('../../index');
        // Required inside the same isolated registry as `../../index` so it
        // shares the exact module instance index.js reads/writes — a
        // require() from outside `isolateModules` would return a
        // different, unrelated module instance.
        isReady = require('../infrastructure/health/readinessState').isReady;
      });

      return { fake, close, isReady };
    }

    it('flips readiness immediately, drains via close(cb), and calls closeIdleConnections on SIGTERM', async () => {
      const { fake, close, isReady } = bootInTestEnv();
      await flushPromiseChain();
      expect(isReady()).toBe(true);

      process.emit('SIGTERM');

      expect(isReady()).toBe(false);
      expect(fake.server.closeIdleConnections).toHaveBeenCalledTimes(1);
      expect(fake.server.close).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();

      fake.flushClose();
      await flushPromiseChain();

      expect(close).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('flips readiness immediately, drains via close(cb), and calls closeIdleConnections on SIGINT', async () => {
      const { fake, close, isReady } = bootInTestEnv();
      await flushPromiseChain();

      process.emit('SIGINT');

      expect(isReady()).toBe(false);
      expect(fake.server.closeIdleConnections).toHaveBeenCalledTimes(1);
      expect(fake.server.close).toHaveBeenCalledTimes(1);

      fake.flushClose();
      await flushPromiseChain();

      expect(close).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('ignores a second SIGTERM/SIGINT received while shutdown is already in progress', async () => {
      const { fake, close } = bootInTestEnv();
      await flushPromiseChain();

      process.emit('SIGTERM');
      expect(() => process.emit('SIGINT')).not.toThrow();
      expect(() => process.emit('SIGTERM')).not.toThrow();

      expect(fake.server.close).toHaveBeenCalledTimes(1);
      expect(fake.server.closeIdleConnections).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalled();

      fake.flushClose();
      await flushPromiseChain();

      expect(close).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('force-exits with code 1 when close() never resolves within SHUTDOWN_TIMEOUT_MS', async () => {
      process.env.SHUTDOWN_TIMEOUT_MS = '50';
      const { fake, close } = bootInTestEnv();
      await flushPromiseChain();

      process.emit('SIGTERM');
      // The forced timer is armed at max(0, 50 - 250) = 0ms, so a short real
      // wait is enough to observe it fire deterministically without fake
      // timers (per design.md's testing-strategy rationale).
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(fake.server.closeAllConnections).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
      // close() was never flushed, so the graceful drain path never reached
      // sequelize.close() — only the forced path drove the exit.
      expect(close).not.toHaveBeenCalled();
    });

    it('aborts boot and exits with 1 when a signal is received before listen() resolves', async () => {
      process.env.NODE_ENV = 'production';
      const fake = createFakeHttpServer();
      const authenticate = jest.fn().mockResolvedValue(undefined);
      const sync = jest.fn().mockResolvedValue(undefined);
      const close = jest.fn().mockResolvedValue(undefined);
      const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
      const seedInitialData = jest.fn().mockResolvedValue(undefined);
      // Emits the signal synchronously while boot is still in flight (no
      // `http.Server` exists yet), then lets the boot chain continue.
      const ensureDatabaseExists = jest.fn(
        () =>
          new Promise((resolve) => {
            process.emit('SIGTERM');
            resolve();
          })
      );

      jest.isolateModules(() => {
        jest.doMock('../app', () => fake.app);
        jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
        jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
        jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync, close } }));
        jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
        jest.doMock('../database/seed', () => ({ seedInitialData }));
        require('../../index');
      });

      await flushPromiseChain();

      expect(fake.app.listen).not.toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('closes the Sequelize connection only after the drain completes, not before', async () => {
      const { fake, close } = bootInTestEnv();
      await flushPromiseChain();

      process.emit('SIGTERM');
      await flushPromiseChain();
      expect(close).not.toHaveBeenCalled();

      fake.flushClose();
      await flushPromiseChain();
      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});
