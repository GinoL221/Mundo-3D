import { Category } from '../../../domain/entities/Category';
import {
  ScopedSequelizeCategoryRepository,
  CategoryPersistence,
} from '../ScopedSequelizeCategoryRepository';

jest.mock('../../../database/models/db', () => {
  throw new Error('Scoped categories must not load the global database');
});

test('routes all category CRUD through the supplied graph without touching another slot', async () => {
  const rowA = {
    idCategory: 1,
    nameCategory: 'A',
    update: jest.fn(async (patch: { nameCategory?: string }): Promise<void> => {
      Object.assign(rowA, patch);
    }),
  };
  const rowB = { idCategory: 1, nameCategory: 'B' };
  const model = (row: { idCategory: number; nameCategory: string }) => ({
    findAll: jest.fn().mockResolvedValue([row]),
    findByPk: jest.fn().mockResolvedValue(row),
    create: jest.fn().mockResolvedValue(row),
    destroy: jest.fn().mockResolvedValue(1),
  });
  const a = model(rowA);
  const b = model(rowB);
  const repositoryA = new ScopedSequelizeCategoryRepository({
    Category: a,
  } as unknown as CategoryPersistence);
  const repositoryB = new ScopedSequelizeCategoryRepository({
    Category: b,
  } as unknown as CategoryPersistence);

  expect(await repositoryA.findAll()).toEqual([new Category(1, 'A')]);
  expect(await repositoryA.findById(1)).toEqual(new Category(1, 'A'));
  expect(await repositoryA.create({ nameCategory: 'A' })).toEqual(new Category(1, 'A'));
  expect(await repositoryA.update(1, { nameCategory: 'A updated' })).toEqual(
    new Category(1, 'A updated'),
  );
  expect(await repositoryA.delete(1)).toBe(true);
  expect(a.findAll).toHaveBeenCalledTimes(1);
  expect(a.findByPk).toHaveBeenNthCalledWith(1, 1);
  expect(a.findByPk).toHaveBeenNthCalledWith(2, 1);
  expect(a.create).toHaveBeenCalledWith({ nameCategory: 'A' });
  expect(rowA.update).toHaveBeenCalledWith({ nameCategory: 'A updated' });
  expect(a.destroy).toHaveBeenCalledWith({ where: { idCategory: 1 } });
  for (const operation of Object.values(b)) expect(operation).not.toHaveBeenCalled();
  expect(rowB).toEqual({ idCategory: 1, nameCategory: 'B' });
  expect(await repositoryB.findAll()).toEqual([new Category(1, 'B')]);
});
