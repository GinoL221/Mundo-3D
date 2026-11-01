import { UniqueConstraintError } from 'sequelize';
import { User } from '../../../domain/entities/User';
import { UserAlreadyExistsException } from '../../../domain/exceptions/UserAlreadyExistsException';
import { ScopedSequelizeUserRepository } from '../ScopedSequelizeUserRepository';

jest.mock('dotenv', () => {
  throw new Error('dotenv forbidden in user tests');
});
jest.mock('../../../database/models/db', () => {
  throw new Error('default DB forbidden in scoped user tests');
});

test('uses only the injected user model while preserving lookup, mapping and errors', async () => {
  const model = { findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() };
  const repository = new ScopedSequelizeUserRepository({
    User: model as unknown as typeof import('../../../database/models/db').User,
  });
  const row = {
    idUser: 1,
    firstName: 'A',
    lastName: 'B',
    email: 'a@example.com',
    passwordUser: 'hash',
    image: '',
    idRole: 0,
    category: '',
  };
  model.findByPk.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
  expect(await repository.findById(1)).toEqual(
    new User(1, 'A', 'B', 'a@example.com', 'hash', null, null, null),
  );
  expect(await repository.findById(2)).toBeNull();
  expect(model.findByPk.mock.calls).toEqual([[1], [2]]);
  model.findOne.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
  expect(await repository.findByEmail('a@example.com')).toEqual(
    new User(1, 'A', 'B', 'a@example.com', 'hash', null, null, null),
  );
  expect(await repository.findByEmail('missing')).toBeNull();
  expect(model.findOne).toHaveBeenCalledWith({ where: { email: 'a@example.com' } });
  model.findAll.mockResolvedValueOnce([row]);
  expect(await repository.findAll()).toEqual([
    new User(1, 'A', 'B', 'a@example.com', 'hash', null, null, null),
  ]);
  const input = new User(0, 'A', 'B', 'a@example.com', 'hash', null);
  model.create.mockResolvedValueOnce(row);
  await repository.create(input);
  expect(model.create).toHaveBeenCalledWith({
    firstName: 'A',
    lastName: 'B',
    email: 'a@example.com',
    passwordUser: 'hash',
    image: null,
  });
  const duplicate = new UniqueConstraintError({ message: 'duplicate', errors: [] });
  model.create.mockRejectedValueOnce(duplicate);
  await expect(repository.create(input)).rejects.toMatchObject({
    message: 'Este email ya está registrado',
    cause: duplicate,
  });
  model.create.mockRejectedValueOnce(duplicate);
  await expect(repository.create(input)).rejects.toBeInstanceOf(UserAlreadyExistsException);
  const error = new Error('unavailable');
  model.create.mockRejectedValueOnce(error);
  await expect(repository.create(input)).rejects.toBe(error);
});
