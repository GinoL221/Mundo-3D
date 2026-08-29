const { createFakeHttpServer } = require('./helpers/fakeHttpServer');

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
    flush: jest.fn((cb) => cb && cb()),
  };
}

// Proxy-Aware Runtime: on a platform that routes to the container by its
// published port, the server must bind to every interface explicitly rather
// than rely on Node's default. The production boot path passes '0.0.0.0' as
// the listen host; the test boot path is intentionally left untouched.
describe('index.js server bind host', () => {
  const originalEnv = process.env;
  let exitSpy;
  let mockLogger;
  let sigtermBefore;
  let sigintBefore;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockLogger = createMockLogger();
    sigtermBefore = process.listeners('SIGTERM');
    sigintBefore = process.listeners('SIGINT');
  });

  afterEach(() => {
    process
      .listeners('SIGTERM')
      .filter((l) => !sigtermBefore.includes(l))
      .forEach((l) => process.removeListener('SIGTERM', l));
    process
      .listeners('SIGINT')
      .filter((l) => !sigintBefore.includes(l))
      .forEach((l) => process.removeListener('SIGINT', l));
    process.env = originalEnv;
    exitSpy.mockRestore();
  });

  function bootProduction(fake) {
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);
    const authenticate = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const checkNoPendingMigrations = jest.fn().mockResolvedValue(undefined);
    const seedInitialData = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      jest.doMock('../database/models/db', () => ({ sequelize: { authenticate, close } }));
      jest.doMock('../database/checkPendingMigrations', () => ({ checkNoPendingMigrations }));
      jest.doMock('../database/seed', () => ({ seedInitialData }));
      require('../../index');
    });
  }

  it('binds the production server explicitly to 0.0.0.0 and still fires onListening', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '3031';
    const fake = createFakeHttpServer();

    bootProduction(fake);
    await flushPromiseChain();

    expect(fake.app.listen).toHaveBeenCalledTimes(1);
    expect(fake.app.listen).toHaveBeenCalledWith('3031', '0.0.0.0', expect.any(Function));
    // The 3-arg form still wires the startup callback (markReady + log line).
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ port: expect.anything() }),
      expect.stringContaining('El servidor esta corriendo'),
    );
  });

  it('leaves the test-env boot path on the host-less listen(port, cb) form', async () => {
    process.env.NODE_ENV = 'test';
    const fake = createFakeHttpServer();
    const ensureDatabaseExists = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('../app', () => fake.app);
      jest.doMock('../infrastructure/logging/logger', () => ({ logger: mockLogger }));
      jest.doMock('../database/config/ensureDatabase', () => ({ ensureDatabaseExists }));
      require('../../index');
    });
    await flushPromiseChain();

    expect(fake.app.listen).toHaveBeenCalledTimes(1);
    expect(fake.app.listen).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
    expect(ensureDatabaseExists).not.toHaveBeenCalled();
  });
});
