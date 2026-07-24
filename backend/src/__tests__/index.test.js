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
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(ensureDatabaseExists).toHaveBeenCalledWith('production');
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(sync).not.toHaveBeenCalled();
    expect(seedInitialData).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it('resolves the env dynamically instead of the hardcoded "development" literal', async () => {
    process.env.NODE_ENV = 'staging';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(ensureDatabaseExists).toHaveBeenCalledWith('staging');
    expect(ensureDatabaseExists).not.toHaveBeenCalledWith('development');
  });

  it('fails fast without seeding or listening when authenticate() rejects', async () => {
    process.env.NODE_ENV = 'production';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockRejectedValue(new Error('schema mismatch'));
    const sync = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(seedInitialData).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast without listening when seedInitialData() rejects (missing/incompatible table)', async () => {
    process.env.NODE_ENV = 'production';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockRejectedValue(new Error("Table 'mundo_3d_db.Product' doesn't exist"));
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(seedInitialData).toHaveBeenCalledTimes(1);
    expect(listen).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('keeps the test env boot path listening directly, without touching the database', async () => {
    process.env.NODE_ENV = 'test';
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const sync = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);
    const listen = jest.fn((port, cb) => cb && cb());

    jest.isolateModules(() => {
      jest.doMock('../app', () => ({ listen }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, sync } }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });

    await flushPromiseChain();

    expect(listen).toHaveBeenCalledTimes(1);
    expect(ensureDatabaseExists).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });
});
