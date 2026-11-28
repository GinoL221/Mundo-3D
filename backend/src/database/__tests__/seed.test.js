'use strict';

// Unit test for `seedInitialData()`'s fail-fast contract: a real internal
// error (e.g. a missing/incompatible table) must reject the returned
// promise instead of being silently swallowed, since `backend/index.js`'s
// boot chain relies on that rejection to fail fast.
const path = require('node:path');
const {
  seedInitialData,
  syncCatalogData,
  resolveSeedDataPath,
  SEED_CATEGORIES,
  SEED_FRANCHISES,
} = require('../seed');

function makeDb(overrides = {}) {
  return {
    Category: {
      count: jest.fn().mockResolvedValue(0),
      bulkCreate: jest.fn().mockResolvedValue(undefined),
    },
    Franchise: {
      count: jest.fn().mockResolvedValue(0),
      bulkCreate: jest.fn().mockResolvedValue(undefined),
    },
    User: {
      count: jest.fn().mockResolvedValue(0),
      bulkCreate: jest.fn().mockResolvedValue(undefined),
    },
    Product: {
      count: jest.fn().mockResolvedValue(0),
      bulkCreate: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

describe('seedInitialData', () => {
  let errorSpy;
  let logSpy;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
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

  it('skips User seeding in production while still seeding Category, Franchise, and Product', async () => {
    process.env.NODE_ENV = 'production';
    const db = makeDb();

    await expect(seedInitialData(db)).resolves.toBeUndefined();

    expect(db.User.count).not.toHaveBeenCalled();
    expect(db.User.bulkCreate).not.toHaveBeenCalled();
    expect(db.Category.bulkCreate).toHaveBeenCalledTimes(1);
    expect(db.Franchise.bulkCreate).toHaveBeenCalledTimes(1);
    expect(db.Product.bulkCreate).toHaveBeenCalledTimes(1);
  });

  it('seeds User in development when User.count() is 0 and skips when User.count() > 0', async () => {
    process.env.NODE_ENV = 'development';
    const emptyDb = makeDb();

    await expect(seedInitialData(emptyDb)).resolves.toBeUndefined();
    expect(emptyDb.User.count).toHaveBeenCalledTimes(1);
    expect(emptyDb.User.bulkCreate).toHaveBeenCalledTimes(1);

    const populatedDb = makeDb({
      User: { count: jest.fn().mockResolvedValue(2), bulkCreate: jest.fn() },
    });

    await expect(seedInitialData(populatedDb)).resolves.toBeUndefined();
    expect(populatedDb.User.count).toHaveBeenCalledTimes(1);
    expect(populatedDb.User.bulkCreate).not.toHaveBeenCalled();
  });

  it('resolves products.json from src/database/data when invoked from compiled dist/database without local copy', () => {
    const fakeDistDbDir = path.resolve(__dirname, '../../../dist/database');
    const resolved = resolveSeedDataPath('products.json', fakeDistDbDir);
    expect(resolved).toBeTruthy();
    expect(resolved.endsWith(path.join('database', 'data', 'products.json'))).toBe(true);
  });
});

describe('syncCatalogData', () => {
  it('adds missing categories/franchises, updates existing products without clobbering positive stock, and inserts new products', async () => {
    const existingUpdate = jest.fn().mockResolvedValue(undefined);
    const zeroStockUpdate = jest.fn().mockResolvedValue(undefined);

    const db = {
      sequelize: {
        transaction: jest.fn((cb) => cb({ id: 'tx-1' })),
      },
      Category: {
        findAll: jest.fn().mockResolvedValue([
          { idCategory: 1, nameCategory: 'Llavero' },
          { idCategory: 2, nameCategory: 'Busto' },
        ]),
        create: jest.fn().mockImplementation((payload) => Promise.resolve(payload)),
      },
      Franchise: {
        findAll: jest.fn().mockResolvedValue([{ idFranchise: 1, nameFranchise: 'Marvel' }]),
        create: jest.fn().mockImplementation((payload) => Promise.resolve(payload)),
      },
      Product: {
        findOne: jest.fn().mockImplementation(({ where }) => {
          if (where.nameProduct === 'Mario Bros Coleccionable') {
            return Promise.resolve({ stock: 12, update: existingUpdate });
          }
          if (where.nameProduct === 'Llavero Escudo Capitán América') {
            return Promise.resolve({ stock: 0, update: zeroStockUpdate });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const summary = await syncCatalogData(db);

    expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      categoriesCreated: SEED_CATEGORIES.length - 2,
      franchisesCreated: SEED_FRANCHISES.length - 1,
      productsUpdated: 2,
      productsCreated: 24,
    });
    expect(existingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        nameProduct: 'Mario Bros Coleccionable',
        price: 26500,
        stock: 12,
      }),
      { transaction: { id: 'tx-1' } },
    );
    expect(zeroStockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        nameProduct: 'Llavero Escudo Capitán América',
        price: 4200,
        stock: 50,
      }),
      { transaction: { id: 'tx-1' } },
    );
  });
});
