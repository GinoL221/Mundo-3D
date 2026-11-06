import { Franchise } from '../../../domain/entities/Franchise';
import {
  ScopedSequelizeFranchiseRepository,
  FranchisePersistence,
} from '../ScopedSequelizeFranchiseRepository';

jest.mock('../../../database/models/db', () => {
  throw new Error('Scoped franchises must not load the global database');
});

test('routes all franchise CRUD through its own graph without touching another slot', async () => {
  const rowA = {
    idFranchise: 1,
    nameFranchise: 'A',
    update: jest.fn((patch: { nameFranchise?: string }): Promise<void> => {
      Object.assign(rowA, patch);
      return Promise.resolve();
    }),
  };
  const rowB = { idFranchise: 1, nameFranchise: 'B' };
  const model = (row: { idFranchise: number; nameFranchise: string }) => ({
    findAll: jest.fn().mockResolvedValue([row]),
    findByPk: jest.fn().mockResolvedValue(row),
    create: jest.fn().mockResolvedValue(row),
    destroy: jest.fn().mockResolvedValue(1),
  });
  const a = model(rowA);
  const b = model(rowB);
  const repositoryA = new ScopedSequelizeFranchiseRepository({
    Franchise: a,
  } as unknown as FranchisePersistence);
  const repositoryB = new ScopedSequelizeFranchiseRepository({
    Franchise: b,
  } as unknown as FranchisePersistence);

  expect(await repositoryA.findAll()).toEqual([new Franchise(1, 'A')]);
  expect(await repositoryA.findById(1)).toEqual(new Franchise(1, 'A'));
  expect(await repositoryA.create({ nameFranchise: 'A' })).toEqual(new Franchise(1, 'A'));
  expect(await repositoryA.update(1, { nameFranchise: 'A updated' })).toEqual(
    new Franchise(1, 'A updated'),
  );
  expect(await repositoryA.delete(1)).toBe(true);
  expect(a.findAll).toHaveBeenCalledTimes(1);
  expect(a.findByPk).toHaveBeenNthCalledWith(1, 1);
  expect(a.findByPk).toHaveBeenNthCalledWith(2, 1);
  expect(a.create).toHaveBeenCalledWith({ nameFranchise: 'A' });
  expect(rowA.update).toHaveBeenCalledWith({ nameFranchise: 'A updated' });
  expect(a.destroy).toHaveBeenCalledWith({ where: { idFranchise: 1 } });
  for (const operation of Object.values(b)) expect(operation).not.toHaveBeenCalled();
  expect(rowB).toEqual({ idFranchise: 1, nameFranchise: 'B' });
  expect(await repositoryB.findAll()).toEqual([new Franchise(1, 'B')]);
});
