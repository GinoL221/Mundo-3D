import db from '../../../database/models/db';
import { SequelizeUserRepository } from '../SequelizeUserRepository';

jest.mock('dotenv', () => {
  throw new Error('dotenv forbidden in user tests');
});
jest.mock('../../../database/models/db', () => ({
  __esModule: true,
  default: {
    User: { findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  },
}));

test('legacy no-argument repository uses the default user model', async () => {
  jest.mocked(db.User.findByPk).mockResolvedValueOnce(null);
  await expect(new SequelizeUserRepository().findById(19)).resolves.toBeNull();
  expect(db.User.findByPk).toHaveBeenCalledWith(19);
});
