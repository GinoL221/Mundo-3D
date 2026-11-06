import { ForeignKeyConstraintError, Op } from 'sequelize';
import type { CustomCommissionRequestInstance } from '../../../database/models/db';
import { SelectedProductNotFoundException } from '../../../domain/exceptions/SelectedProductNotFoundException';
import { ScopedSequelizeCustomCommissionRequestRepository } from '../ScopedSequelizeCustomCommissionRequestRepository';

jest.mock('../../../database/models/db', () => {
  throw new Error('Scoped commissions must not load the default database');
});

test('keeps creation, expiry boundaries, purge counts and errors on the injected request model', async () => {
  const create = jest.fn();
  const findAll = jest.fn();
  const destroy = jest.fn();
  const model = { create, findAll, destroy };
  const repository = new ScopedSequelizeCustomCommissionRequestRepository({
    CustomCommissionRequest:
      model as unknown as typeof import('../../../database/models/db').CustomCommissionRequest,
  });
  const createdAt = new Date('2026-09-01T00:00:00Z');
  const expiresAt = new Date('2026-10-01T00:00:00Z');
  const input = {
    name: 'Ari',
    email: 'ari@example.com',
    idea: 'Dragon',
    idProduct: 44,
    createdAt,
    expiresAt,
  };
  const row = { ...input, idCustomCommissionRequest: 8 } as CustomCommissionRequestInstance;
  create.mockResolvedValueOnce(row);
  expect(await repository.create(input)).toEqual({ ...input, idCustomCommissionRequest: 8 });
  expect(create).toHaveBeenCalledWith(input);
  findAll.mockResolvedValueOnce([{ ...row, idProduct: undefined }]);
  expect(await repository.listActive(expiresAt)).toEqual([
    { ...input, idProduct: null, idCustomCommissionRequest: 8 },
  ]);
  expect(findAll).toHaveBeenCalledWith({
    where: { expiresAt: { [Op.gt]: expiresAt } },
    order: [['createdAt', 'DESC']],
  });
  destroy.mockResolvedValueOnce(3);
  await expect(repository.purgeExpired(expiresAt)).resolves.toBe(3);
  expect(destroy).toHaveBeenCalledWith({ where: { expiresAt: { [Op.lte]: expiresAt } } });

  const fk = new ForeignKeyConstraintError({ message: 'fk failure' });
  create.mockRejectedValueOnce(fk);
  await expect(repository.create(input)).rejects.toBeInstanceOf(SelectedProductNotFoundException);
  create.mockRejectedValueOnce(fk);
  await expect(repository.create({ ...input, idProduct: null })).rejects.toBe(fk);
  const failure = new Error('persistence unavailable');
  create.mockRejectedValueOnce(failure);
  await expect(repository.create(input)).rejects.toBe(failure);
  findAll.mockRejectedValueOnce(failure);
  await expect(repository.listActive(expiresAt)).rejects.toBe(failure);
  destroy.mockRejectedValueOnce(failure);
  await expect(repository.purgeExpired(expiresAt)).rejects.toBe(failure);
  expect(create).toHaveBeenCalledTimes(4);
  expect(findAll).toHaveBeenCalledTimes(2);
  expect(destroy).toHaveBeenCalledTimes(2);
});
