async function flushPromiseChain() {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('index.js boot sequence', () => {
  const originalEnv = process.env;
  let exitSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, SESSION_SECRET: 'test-secret' };
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('authenticates the connection instead of altering the schema, using the resolved env', async () => {
    process.env.NODE_ENV = 'production';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
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
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it('resolves the env dynamically instead of the hardcoded "development" literal', async () => {
    process.env.NODE_ENV = 'staging_env_placeholder';
    // `config.js` doesn't define this env, but that's not what this test
    // covers (see the dedicated unsupported-NODE_ENV test below) — it only
    // proves `ensureDatabaseExists` receives the resolved env, not the
    // hardcoded "development" literal. `ensureDatabaseExists` itself is
    // mocked here so its real guard clause never runs.
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
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
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockRejectedValue(new Error('schema mismatch'));
    const sync = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(checkNoPendingMigrations).not.toHaveBeenCalled();
    expect(seedInitialData).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast without listening when seedInitialData() rejects (mocked at the module boundary)', async () => {
    process.env.NODE_ENV = 'production';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockRejectedValue(new Error("Table 'mundo_3d_db.Product' doesn't exist"));
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(checkNoPendingMigrations).toHaveBeenCalledTimes(1);
    expect(seedInitialData).toHaveBeenCalledTimes(1);
    expect(listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast without listening when seedInitialData() genuinely rejects (real module, DB call boundary mocked)', async () => {
    process.env.NODE_ENV = 'production';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const dbError = new Error("Table 'mundo_3d_db.Category' doesn't exist");
    const categoryCount = jest.fn().mockRejectedValue(dbError);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({
        sequelize: { authenticate, sync },
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
    expect(listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast without seeding or listening when checkNoPendingMigrations() rejects (pending migrations found)', async () => {
    process.env.NODE_ENV = 'production';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const pending = jest.fn().mockResolvedValue([{ name: '20260901000000-add-orders.js' }]);
    const buildMigrator = jest.fn().mockReturnValue({ pending });
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
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
    expect(listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error al conectar con la base de datos o insertar datos iniciales:'),
      expect.objectContaining({
        message: expect.stringContaining('Database schema is not fully migrated: 1 pending migration(s)'),
      })
    );
  });

  it('proceeds to seed and listen when checkNoPendingMigrations() finds nothing pending', async () => {
    process.env.NODE_ENV = 'production';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const pending = jest.fn().mockResolvedValue([]);
    const buildMigrator = jest.fn().mockReturnValue({ pending });
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/migrator', () => ({ buildMigrator }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      jest.dontMock('../database/checkPendingMigrations');
      require('../../index');
    });

    await flushPromiseChain();

    expect(pending).toHaveBeenCalledTimes(1);
    expect(seedInitialData).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('fails fast with a clear configuration error when NODE_ENV is unsupported (real ensureDatabaseExists/config path)', async () => {
    process.env.NODE_ENV = 'staging';
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      // Real `../database/config/ensureDatabase` module — NOT mocked away —
      // so this actually exercises the unsupported-NODE_ENV guard clause.
      // `dontMock` reverses any earlier `doMock` registration for this path.
      jest.dontMock('../database/config/ensureDatabase');
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(checkNoPendingMigrations).not.toHaveBeenCalled();
    expect(seedInitialData).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error al conectar con la base de datos o insertar datos iniciales:'),
      expect.objectContaining({
        message: "Unsupported NODE_ENV: 'staging' — expected one of: development, test, production",
      })
    );
  });

  it('keeps the test env boot path listening directly, without touching the database', async () => {
    process.env.NODE_ENV = 'test';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(listen).toHaveBeenCalledTimes(1);
    expect(ensureDatabaseExists).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(checkNoPendingMigrations).not.toHaveBeenCalled();
  });
});
