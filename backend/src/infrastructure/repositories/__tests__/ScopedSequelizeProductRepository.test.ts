import type { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { ScopedSequelizeUnitOfWork } from '../../persistence/ScopedSequelizeUnitOfWork';
import type { ProductInstance } from '../../../database/models/db';
import {
  ScopedSequelizeProductRepository,
  ProductPersistence,
} from '../ScopedSequelizeProductRepository';

jest.mock('../../../database/models/db', () => {
  throw new Error('Explicit repositories must not import the default database');
});

function persistence(label: string) {
  const record = {
    idProduct: 1,
    nameProduct: label,
    price: 10,
    descriptionProduct: null,
    image: null,
    idCategory: 1,
    idFranchise: 1,
    stock: 5,
    update: jest.fn().mockResolvedValue(undefined),
  };
  const database = {
    Product: {
      findAll: jest.fn().mockResolvedValue([record]),
      findByPk: jest.fn().mockResolvedValue(record),
      findOne: jest.fn().mockResolvedValue(record),
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [record], count: 1 }),
      create: jest.fn().mockResolvedValue(record),
      destroy: jest.fn().mockResolvedValue(1),
    },
    Category: { label },
    Franchise: { label },
    sequelize: { query: jest.fn().mockResolvedValue([undefined, 1]) },
  };
  return {
    database,
    record,
    repository: new ScopedSequelizeProductRepository(database as unknown as ProductPersistence),
  };
}

test('uses only injected models for all public product operations, including associations and stock SQL', async () => {
  const a = persistence('A');
  const b = persistence('B');
  for (const { repository, database, record } of [a, b]) {
    expect((await repository.findAll())[0].nameProduct).toBe(record.nameProduct);
    expect((await repository.findById(1))?.nameProduct).toBe(record.nameProduct);
    expect((await repository.findLatest())?.nameProduct).toBe(record.nameProduct);
    expect((await repository.searchPaged({ limit: 10, offset: 0 })).products[0].nameProduct).toBe(
      record.nameProduct,
    );
    expect(
      (
        await repository.create({
          nameProduct: record.nameProduct,
          price: 10,
          idCategory: 1,
          idFranchise: 1,
          descriptionProduct: null,
          image: null,
        })
      ).nameProduct,
    ).toBe(record.nameProduct);
    expect((await repository.update(1, { nameProduct: 'updated' }))?.nameProduct).toBe(
      record.nameProduct,
    );
    expect(record.update).toHaveBeenCalledWith({ nameProduct: 'updated' });
    expect(await repository.delete(1)).toBe(true);
    expect((await repository.adjustStock(1, 2))?.nameProduct).toBe(record.nameProduct);
    expect(database.sequelize.query).toHaveBeenCalledTimes(1);
    for (const mock of [
      database.Product.findAll,
      database.Product.findOne,
      database.Product.findAndCountAll,
    ]) {
      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({
          include: [
            {
              model: database.Category,
              as: 'Category',
              attributes: ['idCategory', 'nameCategory'],
            },
            {
              model: database.Franchise,
              as: 'Franchise',
              attributes: ['idFranchise', 'nameFranchise'],
            },
          ],
        }),
      );
    }
  }
  a.database.Product.findByPk.mockResolvedValueOnce(null as unknown as typeof a.record);
  expect(await a.repository.findById(1)).toBeNull();
  expect((await b.repository.findById(1))?.nameProduct).toBe('B');
});

test('accepts only an active same-connection context and rejects other contexts before SQL or reads', async () => {
  const a = persistence('A');
  const b = persistence('B');
  const raw = {} as Transaction;
  const transaction = jest.fn(async (work: (tx: Transaction) => Promise<unknown>) => work(raw));
  const owner = Object.assign(a.database.sequelize, { transaction });
  const uow = new ScopedSequelizeUnitOfWork(owner as unknown as Sequelize);
  let saved: TransactionContext | undefined;
  await uow.runInTransaction(async (tx) => {
    saved = tx;
    await expect(b.repository.adjustStock(1, -1, tx)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );
    expect(b.database.sequelize.query).not.toHaveBeenCalled();
    expect(b.database.Product.findByPk).not.toHaveBeenCalled();
    expect((await a.repository.adjustStock(1, -1, tx))?.nameProduct).toBe('A');
    expect(a.database.sequelize.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ transaction: raw }),
    );
    expect(a.database.Product.findByPk).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ transaction: raw }),
    );
    a.database.sequelize.query.mockResolvedValueOnce([undefined, 0]);
    await expect(a.repository.adjustStock(1, -20, tx)).rejects.toThrow('Insufficient stock');
    expect(a.database.Product.findByPk).toHaveBeenLastCalledWith(1, { transaction: raw });
  });
  a.database.sequelize.query.mockClear();
  a.database.Product.findByPk.mockClear();
  for (const context of [saved!, {} as TransactionContext]) {
    await expect(a.repository.adjustStock(1, -1, context)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );
    expect(a.database.sequelize.query).not.toHaveBeenCalled();
    expect(a.database.Product.findByPk).not.toHaveBeenCalled();
  }
  expect(a.record.stock).toBe(5);
  expect(b.record.stock).toBe(5);
});

test('keeps stock rejection behavior and follow-up reads on the injected connection', async () => {
  const { repository, database } = persistence('A');
  await expect(repository.adjustStock(1, 0)).rejects.toThrow('Delta must be a non-zero integer');
  expect(database.sequelize.query).not.toHaveBeenCalled();
  database.sequelize.query.mockResolvedValueOnce([undefined, 0]);
  await expect(repository.adjustStock(1, -10)).rejects.toThrow('Insufficient stock');
  expect(database.Product.findByPk).toHaveBeenCalledWith(1, { transaction: undefined });
  database.Product.findByPk.mockResolvedValueOnce(null as unknown as ProductInstance);
  database.sequelize.query.mockResolvedValueOnce([undefined, 0]);
  expect(await repository.adjustStock(99, -1)).toBeNull();
});
