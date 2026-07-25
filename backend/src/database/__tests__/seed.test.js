'use strict';

// Unit test for `seedInitialData()`'s fail-fast contract: a real internal
// error (e.g. a missing/incompatible table) must reject the returned
// promise instead of being silently swallowed, since `backend/index.js`'s
// boot chain relies on that rejection to fail fast.
const { seedInitialData } = require('../seed');

function makeDb(overrides = {}) {
  return {
    Category: { count: jest.fn().mockResolvedValue(0), bulkCreate: jest.fn().mockResolvedValue(undefined) },
    Franchise: { count: jest.fn().mockResolvedValue(0), bulkCreate: jest.fn().mockResolvedValue(undefined) },
    User: { count: jest.fn().mockResolvedValue(0), bulkCreate: jest.fn().mockResolvedValue(undefined) },
    Product: { count: jest.fn().mockResolvedValue(0), bulkCreate: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

describe('seedInitialData', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('rejects when a model call fails, instead of silently resolving', async () => {
    const dbError = new Error("Table 'mundo_3d_db.Category' doesn't exist");
    const db = makeDb({
      Category: { count: jest.fn().mockRejectedValue(dbError), bulkCreate: jest.fn() },
    });

    await expect(seedInitialData(db)).rejects.toThrow("Table 'mundo_3d_db.Category' doesn't exist");
    expect(errorSpy).toHaveBeenCalledWith('Error al insertar datos iniciales:', dbError);
  });

  it('resolves and skips bulkCreate when counts are already non-zero (idempotency preserved)', async () => {
    const db = makeDb({
      Category: { count: jest.fn().mockResolvedValue(10), bulkCreate: jest.fn() },
    });

    await expect(seedInitialData(db)).resolves.toBeUndefined();
    expect(db.Category.bulkCreate).not.toHaveBeenCalled();
  });
});
